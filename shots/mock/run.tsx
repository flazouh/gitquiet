import { Option } from "effect"
import type { CheckNote } from "../../src/domain/PullRequest"
import { gathered, type Job, type Run, type RunOpening, type RunRef } from "../../src/domain/run"
import { RunScreen } from "../../src/ui/RunScreen"
import { alreadyKnown, settled, STORE, type View } from "../view"
import { minutesAgo } from "./when"

/**
 * One workflow run, red, on the page GitHub tells its own readers to leave.
 *
 * The argument this picture has to make is the order of the screen. GitHub opens a
 * failed run with a graph and twelve job nodes and puts the error behind three
 * presses; this opens with the assertion that broke the build. So the data has to
 * carry a real assertion, and it has to carry the eleven green jobs around it,
 * because a run with one job in it never had the problem being solved.
 *
 * The same pull request the Pull Request view photographs, and the same failing
 * check. A reader who looks at both sees one piece of work from two sides rather
 * than two unrelated inventions. Nothing here is anybody's private repository.
 *
 * A mixture of standings, because every count on this screen is a claim about a
 * different kind of job: eleven passed, two are still going, one never ran because
 * its `if` was false, and exactly one failed. A board of one colour would be a
 * photograph of the one run where none of the counting matters.
 */

const REFERENCE: RunRef = {
  repo: { owner: "oven-sh", repo: "bun" },
  run: "18742039184",
  attempt: null,
  job: null
}

const jobAt = (id: number): string =>
  `https://github.com/${REFERENCE.repo.owner}/${REFERENCE.repo.repo}/actions/runs/${REFERENCE.run}/job/${id}`

/**
 * The jobs in the order the workflow ran them, which is the order the screen keeps.
 *
 * Sorting them by duration or by name would put the gate job that failed because
 * something else did above the thing that broke, and the gate job's own log never
 * says what happened. The matrix names are the ones bun's own CI prints, so a reader
 * who has waited on `windows-x64 / test` recognises the row that is still going.
 */
const JOBS: ReadonlyArray<Job> = [
  { name: "linux-x64 / build-zig", state: "succeeded", seconds: 494, url: jobAt(53219847001) },
  { name: "linux-x64 / build-cpp", state: "succeeded", seconds: 731, url: jobAt(53219847002) },
  { name: "linux-x64 / link", state: "succeeded", seconds: 96, url: jobAt(53219847003) },
  { name: "linux-x64 / test", state: "failed", seconds: 1154, url: jobAt(53219847004) },
  {
    name: "linux-x64-baseline / build",
    state: "succeeded",
    seconds: 688,
    url: jobAt(53219847005)
  },
  {
    name: "linux-x64-baseline / test",
    state: "succeeded",
    seconds: 1002,
    url: jobAt(53219847006)
  },
  { name: "darwin-aarch64 / build", state: "succeeded", seconds: 421, url: jobAt(53219847007) },
  { name: "darwin-aarch64 / test", state: "succeeded", seconds: 913, url: jobAt(53219847008) },
  { name: "linux-aarch64 / build", state: "succeeded", seconds: 902, url: jobAt(53219847009) },
  { name: "windows-x64 / build", state: "succeeded", seconds: 1284, url: jobAt(53219847010) },
  { name: "windows-x64 / test", state: "running", seconds: 742, url: jobAt(53219847011) },
  { name: "zig fmt", state: "succeeded", seconds: 24, url: jobAt(53219847012) },
  { name: "typecheck", state: "succeeded", seconds: 51, url: jobAt(53219847013) },
  { name: "CodeQL / javascript", state: "queued", seconds: 0, url: jobAt(53219847014) },
  { name: "docs / build", state: "skipped", seconds: 0, url: jobAt(53219847015) }
]

/**
 * The assertion that broke the build, written the way a test runner hands one over.
 *
 * One string with its newlines quoted rather than written, which is what a runner
 * does to a captured log on its way into an annotation. `unescaped` in
 * `src/domain/run.ts` is the code that reads it back, and a message drawn here as a
 * single grey paragraph would mean that code is not being photographed at all.
 *
 * The first line is the whole of what the reader came for, so it is the one the
 * screen prints at size; the sixteen after it are the transcript, one press away.
 */
const FAILING_TEST = [
  "test/js/bun/http/serve-abort.test.ts > Bun.serve() aborting > keeps a keep-alive socket when a stream aborts mid-chunk",
  "error: expect(received).toBe(expected)",
  "",
  "Expected: 0",
  "Received: 1",
  "",
  "      at <anonymous> (/home/runner/work/bun/bun/test/js/bun/http/serve-abort.test.ts:110:5)",
  "",
  "3 tests failed:",
  "  (fail) Bun.serve() aborting > keeps a keep-alive socket when a stream aborts mid-chunk [63.14ms]",
  "  (fail) Bun.serve() aborting > ends the stream once when the client hangs up [21.02ms]",
  "  (fail) Bun.serve() streaming > decodes a chunk split across a code point [4.88ms]",
  "",
  " 2911 pass",
  "    3 fail",
  " 6842 expect() calls",
  "Ran 2914 tests across 214 files. [6m 41s]"
].join("\\n")

const DEPRECATED =
  "Node.js 20 actions are deprecated. Please update the following actions to use Node.js 24: actions/checkout@v4, actions/cache@v4, actions/upload-artifact@v4. For more information see: https://github.blog/changelog/2025-06-09-github-actions-deprecating-node20/"

const EXIT = "Process completed with exit code 1."

/**
 * Every Note as GitHub wrote it, repeats and all.
 *
 * The repeats are the point. Their own page draws one row per occurrence, so the
 * deprecation notice that three jobs each printed once is three rows there and one
 * row with a count here, and the two sentences saying only that a process exited
 * non-zero are two more rows there and one here, ranked under everything that names
 * a cause. Handing this array to `gathered` rather than writing the result out is
 * what makes the picture a photograph of that code running.
 */
const NOTES: ReadonlyArray<CheckNote> = [
  {
    level: "failure",
    where: "Run bun test",
    message: FAILING_TEST,
    at: Option.some({ step: 9, line: 412 })
  },
  { level: "failure", where: "Run bun test", message: EXIT, at: Option.none() },
  {
    level: "failure",
    where: "Upload the failing test reports",
    message: EXIT,
    at: Option.none()
  },
  { level: "warning", where: "Set up job", message: DEPRECATED, at: Option.none() },
  { level: "warning", where: "Set up job", message: DEPRECATED, at: Option.none() },
  { level: "warning", where: "Set up job", message: DEPRECATED, at: Option.none() },
  {
    level: "warning",
    where: "Restore the Zig cache",
    message:
      "Cache not found for input keys: bun-linux-x64-zig-0.14.0-6f3c1e2b, bun-linux-x64-zig-0.14.0",
    at: Option.none()
  },
  {
    level: "warning",
    where: "Upload the profile build",
    message:
      "No files were found with the provided path: build/release/bun-profile. No artifacts will be uploaded.",
    at: Option.none()
  },
  {
    level: "notice",
    where: "Upload the build",
    message: "Uploaded bun-linux-x64 (94.2 MB) and bun-linux-x64-profile (241.8 MB) in 38s.",
    at: Option.none()
  }
]

/**
 * The run itself, against the head of a pull request that is still open.
 *
 * Twenty-two minutes in and still going, because a finished run is the easy case: the
 * numbers stop moving and nobody needs the screen again. A reader arrives here while
 * the Windows matrix is still running and wants to know whether the red is theirs.
 */
const RUNNING: Run = {
  workflow: "CI",
  title: "Decode streamed chunks with one decoder",
  number: "18742",
  state: "failed",
  seconds: 1338,
  trigger: "pull request",
  actor: "jhalvorsen",
  branch: "serve-abort-mid-chunk",
  pullRequest: "23014",
  startedAt: minutesAgo(22)
}

export const RUN: RunOpening = {
  run: RUNNING,
  jobs: JOBS,
  notes: NOTES,
  gathering: gathered(NOTES),
  // A failed run, so GitHub offers both re-runs and no cancel, which is the row of
  // controls worth having in the shot.
  presses: { mayRerun: true, mayRerunFailed: true, mayCancel: false }
}

export const RUN_VIEW: View = {
  name: "run",
  caption:
    "A failed run opening on the assertion that broke it, with the eleven green jobs counted instead of drawn",
  ...STORE,
  draw: () => (
    <RunScreen
      reference={REFERENCE}
      load={settled(RUN)}
      preload={alreadyKnown(RUN)}
      onStepAside={() => {}}
      onUseGitHub={() => {}}
    />
  )
}
