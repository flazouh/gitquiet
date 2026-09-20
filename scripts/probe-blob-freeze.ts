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
 */
import { withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE = argued("--page") ?? "https://github.com/spf13/cobra/blob/main/command.go"
const FOR = Number(argued("--for") ?? 40_000)
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`

const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

const session = await withExtension(PAGE, EXTENSION)

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
        problems: session.problems().slice(0, 4)
      },
      null,
      2
    )
  )
} finally {
  session.stop()
}
