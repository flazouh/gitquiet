/**
 * Whether a large file locks the tab while the interface reads it.
 *
 * Reported from a real browser on a real page: `spf13/cobra`'s `command.go`
 * left the tab unable to answer anything for over fifteen seconds, a couple of
 * seconds after it drew, and then recovered. A small file in the same
 * repository and its README did not, so it is the file rather than the
 * repository or the network.
 *
 * The measurement is the one a reader would make: ask the page a trivial
 * question ten times a second and record how long each answer took. A main
 * thread held by anything at all cannot answer, so the gap between one answer
 * and the next is the freeze, whatever is causing it.
 *
 *     bun run build && bun scripts/probe-blob-freeze.ts [--page URL] [--for 40000]
 *
 * Read the answer with `probe-blob-profile`, always, before believing it.
 *
 * On `spf13/cobra`'s `command.go` this reports the page answering nothing for
 * forty seconds, and a do-nothing extension answering two hundred and forty
 * times on the same page — which reads as a freeze this extension causes. A CPU
 * profile across the same window says the thread is one hundred percent idle:
 * nothing is computing, so nothing is held. What differs is that our content
 * script replaces the whole document, and an evaluate is not serviced across
 * that. An unanswered ask means "this probe got no answer"; it takes the
 * profile to say whether anybody was waiting.
 */
import { withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE = argued("--page") ?? "https://github.com/spf13/cobra/blob/main/command.go"
const FOR = Number(argued("--for") ?? 40_000)
/**
 * Which extension to load, so the same question can be asked without ours.
 *
 * A page that cannot answer for forty seconds is only our fault if it answers
 * without us. `--extension` points at a do-nothing manifest for that control.
 */
const EXTENSION = argued("--extension") ?? `${import.meta.dir}/../.output/chrome-mv3`

const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

/*
 * Not waiting for the load event, which is the whole point.
 *
 * What is being measured is whether the tab can answer while the page is
 * arriving. Waiting for `load` first means the measurement starts after the
 * interesting part, and on a heavy page it means never starting at all: three
 * runs against `command.go` spent their entire budget inside the wait and
 * printed nothing, which is indistinguishable from a page that behaved.
 */
/**
 * A deadline on the whole run, so this always says something.
 *
 * Four runs against `command.go` printed nothing at all — killed by an outer
 * timeout while stuck somewhere inside the harness — and "nothing" is the one
 * answer a probe must never give: it reads exactly like a page that behaved.
 * Whatever goes wrong, this prints what it has and says it gave up.
 */
const BUDGET = Number(argued("--budget") ?? 120_000)

const gaveUp = (why: string): never => {
  console.log(JSON.stringify({ page: PAGE, problems: [`gave up: ${why}`] }, null, 2))
  process.exit(0)
}

const before = setTimeout(() => gaveUp(`nothing finished inside ${Math.round(BUDGET / 1000)}s`), BUDGET)
before.unref?.()

const session = await withExtension(PAGE, EXTENSION, { awaitLoad: false }).catch((cause) =>
  gaveUp(`the session never came up (${String(cause).slice(0, 120)})`)
)

/**
 * The ask, with a limit on how long it is allowed to go unanswered.
 *
 * Without this the probe shares the fault it is measuring: a main thread held
 * long enough never answers `Runtime.evaluate` at all, so the await never
 * settles, the loop stops taking readings and the run ends at its outer
 * timeout with nothing printed. A held thread has to be a recorded number, not
 * a probe that also stopped.
 */
const CEILING = 20_000

const askWithin = async (): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const gaveUp = new Promise<boolean>((go) => {
    timer = setTimeout(() => go(false), CEILING)
  })
  const answered = session
    .evaluate<number>("1")
    .then(() => true)
    .catch(() => true)
  const first = await Promise.race([answered, gaveUp])
  if (timer !== undefined) clearTimeout(timer)
  return first
}

try {
  const gaps: Array<{ at: number; ms: number; answered: boolean }> = []
  const started = Date.now()
  let last = started
  while (Date.now() - started < FOR) {
    const asked = Date.now()
    const answered = await askWithin()
    const back = Date.now()
    // The gap since the previous answer, which is what a held thread shows up as.
    gaps.push({ at: asked - started, ms: back - last, answered })
    last = back
    await sleep(100)
  }

  const worst = [...gaps].sort((one, two) => two.ms - one.ms).slice(0, 5)
  const stalls = gaps.filter((one) => one.ms > 1000)
  console.log(
    JSON.stringify(
      {
        page: PAGE,
        asked: gaps.length,
        worstMs: worst.map((one) => `${one.ms}ms at ${one.at}ms`),
        stalls: stalls.length,
        heldMs: stalls.reduce((running, one) => running + one.ms, 0),
        // An ask that never came back at all, which is a freeze longer than
        // this probe is willing to sit through rather than an absence of one.
        unanswered: gaps.filter((one) => !one.answered).length,
        problems: [
          /*
           * An ask that never came back is the headline, not a footnote.
           *
           * The first version of this counted them and then reported
           * `problems: []` beside a page that had not answered anything for
           * forty seconds — which is the same silence-as-success this probe
           * exists to stop.
           */
          ...(gaps.some((one) => !one.answered)
            ? [
                `unanswered here means no reply to this probe, not necessarily a held thread — check with probe-blob-profile`,
                `the page did not answer ${gaps.filter((one) => !one.answered).length} of ${gaps.length} asks, holding the thread ${Math.round(stalls.reduce((running, one) => running + one.ms, 0) / 1000)}s`
              ]
            : []),
          ...session.problems().slice(0, 4)
        ]
      },
      null,
      2
    )
  )
} finally {
  clearTimeout(before)
  session.stop()
}
