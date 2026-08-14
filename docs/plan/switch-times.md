# How long a page switch takes

Status: measured 14 August 2026, against `fluentai-pro/fluentai` on a signed-in
reader with a warm store.

Nine switches, timed from inside the build. The point of writing them down is
that three earlier attempts at this measurement were wrong, each in a way that
invented a delay the product does not have, and each sent real work at it.

## 1. Two traps, both of which produced false delays

**A task space window is not the foreground window**, so Chrome throttles
`requestAnimationFrame` in it. A watcher built on frames measures the frame clock
waking up. That is how a switch that takes 21ms was reported at 800ms, three
times over, with the cause landing somewhere different each time: first a grace
period, then a bundle fetch, then a wedged router. None of them was real.

Safe to measure with: `MutationObserver`, `PerformanceObserver`, and marks
written by the build itself. Not safe: `requestAnimationFrame`, and any reading
gated on another reading arriving.

**Exactly one copy of the extension may be installed.** `Extensions.loadUnpacked`
persists across task spaces, so copies pile up silently over a session, and every
copy answers every press. Two copies cost 2243ms on a switch that takes 63ms with
one, because the first copy borrows the surface and the second finds none and
waits out the whole of `SETTLING`. The signature in the marks is more than one
`open:` for a single press, and two `stand:` marks where the second says
`surface: none`. Count the copies before believing anything:

```js
const ids = new Set()
for (const sheet of Array.from(document.styleSheets)) {
  const at = sheet.href || ''
  if (at.indexOf('chrome-extension://') === 0) ids.add(at.slice(19, 51))
}
```

**The page cannot see this extension's own work.** Its bundles load from
`chrome-extension://` and its reads are made by the content script, so neither
resource timing nor a long task observer in the page records any of it. A press
that spends four seconds fetching an issue looks, from the page, like four
seconds of nothing happening. So the requests are marked where they are made, in
the gateway, and read out of an attribute on `documentElement`.

`scripts/switch-audit.mjs` runs the walk. It needs a build with `src/ui/mark.ts`
and its callers in it, kept aside from `.output` so a rebuild cannot replace the
instrument under a run.

## 2. What nine switches cost

One copy installed. Milliseconds from the press. `addr` is the address moving,
`taken` is the takeover landing, `drawn` is a real page being in the interface,
`quiet` is the last mutation of the leg. `joined` counts reads that folded into a
request already in the air.

```
leg                              addr  stood  taken  drawn  quiet  reqs  joined
repo home -> pulls                  0     65     68    741   3770    24     31
pulls -> a pull request             1     42     43     20   1581    18     21
back to pulls                       -      3      6     40   3315    24     24
pulls -> repo issues                0     57     58     54   2302    25      9
issues -> an issue                  1     60     71   4364   4628     3      1
back to issues                      -      3      5     34   2274     1      1
issues -> notifications             1     18     19     63   3770     1      1
notifications -> working set        1    -46      1     77   6728    40     46
working set -> a pull request      23      1     23   1195   5361    21     23
```

`drawn` asks for thirty elements and a hundred and twenty characters in the
interface, so on the issue leg it marks the text of the issue arriving rather
than the first paint. The header seeded from the row is on the screen at about
70ms.

`stood: -46` is reading ahead working: the screen stood 46ms before the press,
because the pointer had been resting on the row.

## 3. What the numbers say

**The shell is not a cost.** The address moves within 23ms and the takeover lands
within 71ms on all nine legs. No grace period is paid: the surface is borrowed
every time. Nothing in the press path, the bundle, the router or the takeover
needs work.

**One switch out of nine is slow: an issue, at 4364ms.** 2643ms of that is a
single request, GitHub's entire issue HTML page, fetched to mine the persisted
query hash out of it because nothing on our own list page carries that hash.
Every issue after the first uses GraphQL instead.

**Everything else is its heaviest request.** Lists and pull requests draw between
20ms and 1195ms depending on whether the store answers first, and the slowest
request on each leg is GitHub's, at 447ms to 2204ms. Our own work between the
press and the draw is tens of milliseconds.

**The tail after a draw is staged reads landing, not churn.** Measured on repo
home to pulls: drawn at 55ms, 24 requests sent and all back by 2193ms, fourteen
mutations in total, no long tasks at all. The `quiet` column above is the last
read landing rather than a sign of trouble.

## 4. Reading ahead does not join, for issues

`askingOnce` in `src/github/flight.ts` folds identical requests together, and its
own comment says it is what makes reading ahead worth anything. It is wired into
`saidAt`, a GET of one of GitHub's JSON routes, and the `joined` column above
shows it working: 9 to 46 folds a leg.

Both issue reads sit outside it. Measured pairs for the same issue, from the
press:

| path | the screen's read | the warm read |
| --- | --- | --- |
| GraphQL | 798ms | 1494ms |
| the issue's own HTML page | 4519ms | 5427ms |

So resting on a row and pressing it asks GitHub for the issue twice, and resting
buys nothing unless the reader rests longer than the whole read.

## 5. What is left to fix

Done. Both issue reads fold through `askingOnce` now, keyed by the address each
fetches. Measured on the marked build, with the pointer resting 346ms on a row
before the press: the read ahead asked at -190ms, the screen asked at 72ms and
joined at 81ms, one request was made, and both readers were answered at 1073ms
and 1074ms. Before it, the same shape made two requests 700ms apart.

A rest longer than the read is not folded, and should not be: `askingOnce` folds
requests in the air rather than keeping answers. Rest for a second and the read
ahead finishes first, the store carries its answer, and the screen's own live read
goes out again on its own. Measured: the read ahead answered at 59ms after the
press and the screen asked at 71ms, so there was nothing left to join.

Left. Carry the persisted query hash to a list page, so the first issue of a
session stops costing a whole HTML document. That leg is 4364ms, of which 2643ms
is the page fetch, and the roughly 1.7s before the fetch even starts is
`ASKING`, the three second wait for a hash to appear before the read gives up and
falls back to the page. Both halves are ours rather than GitHub's, and this is the
only slow switch left on the audit.

Nothing else on this audit justifies work. Notifications at 63ms, the tail of
mutations, and the bar switch were all instrument faults rather than product
faults.
