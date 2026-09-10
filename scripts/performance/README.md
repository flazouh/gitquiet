# Observer performance probes

These probes run the real mount and link observers in Chromium through Ego Lite. They use detached browser documents. They measure DOM work, not animation FPS or the complete extension.

1. On the baseline checkout, run `bun scripts/performance/observer-server.ts before`. Stop that server after it builds.
2. On the changed checkout, run `bun scripts/performance/observer-server.ts after`. Keep this server running.
3. Run `ego-browser nodejs < scripts/performance/run-observers.js`.

The snapshots live under `.tmp/perf-observers`. Preserve the baseline bundles when changing checkouts.

The baseline command requires the exported `protectOwnedLinks` module. For older code with an inline observer, first extract that observer without changing its behavior. Keep its initial scan, observer options and route marking unchanged. This is how the `a5d71df` baseline below was prepared. Do not run the `before` command on fixed code and label it as the old baseline.

The matrix covers 0, 1,000, 100,000, 250,000 and 500,000 hidden native nodes. Each case performs 40 screen updates, 40 hidden native updates, and 40 link additions. The runner alternates version order.

Every case checks visibility, link destinations, region replacement and teardown. The changed version must make zero document selector calls during routine updates. It must check each added link once. These budgets are deterministic; elapsed time depends on the machine and includes timer scheduling.

The probe does not remove GitHub's real page or change repository data. Run full-extension checks on real PRs separately before claiming that animation or scrolling problems are fully resolved.

## Verified observer results

The baseline uses mount code from `a5d71df` and its inline link observer extracted behind the same test interface. It is not a full 0.12.0 release comparison.

Each version ran 40 updates per phase at each size. The recorded timing run alternated version order with no test or build job running. Screen update medians include timer scheduling:

| Hidden native nodes | Before | After |
| ---: | ---: | ---: |
| 0 | 4.6 ms | 4.7 ms |
| 1,000 | 4.8 ms | 4.6 ms |
| 100,000 | 12.3 ms | 4.6 ms |
| 250,000 | 33.7 ms | 4.6 ms |
| 500,000 | 76.2 ms | 4.6 ms |

At every size, document selector calls fell from 280 to zero per phase. The 40 link additions required 820 ownership checks before and 40 after. Visibility, replacement recovery and teardown checks passed in all ten cases.

Initial fixture mount time at 500,000 nodes stayed near 8.8 ms. These changes remove repeated observer work; this probe does not establish a faster initial full-page render.

`bun run gates` passed 4,552 tests with zero failures and 9,519 assertions. Lint and both typechecks passed. `bun run build` passed.

After changing probe cleanup to use promise finalizers, the complete matrix passed again. Probe lint and the main typecheck also passed.

The code-quality review found a link moved into native content before observer delivery. A failing regression test reproduced it. The fix checks final root containment. The final review found no remaining blockers in the observer changes. The changed extension loaded automatically through Ego’s explicit browser-target session. The store copy was disabled, and the large PR mounted one root. A matched 30-wheel-event probe recorded no tasks above 50 ms on the small PR and one 59 ms task on the large PR. The earlier store-build probe recorded six large-PR tasks of 52 to 116 ms. These are separate live runs with different native DOM sizes, not a controlled release comparison. Full animation and initial-render optimization remain unverified.
