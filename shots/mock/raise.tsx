import { Effect } from "effect"
import type { Raising } from "@/domain/raising"
import { RaiseScreen } from "@/ui/RaiseScreen"
import { nothingRemembered, STORE, type View } from "../view"

/**
 * The form, halfway through being filled in.
 *
 * An empty form photographs as an empty form: two grey boxes and a button nobody can
 * press, which says nothing about what writing an issue here is like. So this one is
 * caught with the title written and the body most of the way down, which is also the
 * only state the send button is alive in.
 *
 * The screen takes what the boxes open with as a prop — a "report this" link arrives
 * with the first sentence already written, and the form honours it — so the words below
 * go in the way the address would put them there, and nothing about this picture is a
 * state the running extension cannot be in.
 *
 * The report is `oven-sh/bun#36887`, word for word as it was actually raised. Written
 * out by hand it would read as a made-up bug, and a made-up bug is the one thing on
 * this screen a reader would notice.
 */

const REPO = { owner: "oven-sh", repo: "bun" }

/**
 * What is in the boxes.
 *
 * The backslashes are doubled and the backticks escaped because this is a template
 * literal holding a shell command and three fenced blocks. What reaches the box is
 * what was written: a version, a platform, a container to run, a script, and the
 * three control results that make it a report rather than a complaint.
 */
const SEED: Raising = {
  title: "Bun.SQL sslmode=prefer times out when Postgres has no TLS",
  body: `### What version of Bun is running?

1.3.14

### What platform is your computer?

Linux x86_64

### What steps can reproduce the bug?

Start a PostgreSQL server without TLS:

\`\`\`console
docker run --rm --name bun-sql-prefer-repro \\
  -e POSTGRES_PASSWORD=correct-password \\
  -e POSTGRES_DB=repro \\
  -p 127.0.0.1:55432:5432 \\
  postgres:17-alpine
\`\`\`

Run:

\`\`\`ts
import { SQL } from "bun";

const db = new SQL(
  "postgresql://postgres:correct-password@127.0.0.1:55432/repro?sslmode=prefer",
  { max: 1, connectionTimeout: 3 },
);

try {
  console.log(await db.unsafe("SELECT 1 AS ok"));
} catch (error) {
  console.error(error);
}
\`\`\`

Control results against the same server:

- \`sslmode=disable\` succeeds immediately.
- \`sslmode=require\` fails immediately with
  \`ERR_POSTGRES_TLS_NOT_AVAILABLE: Server does not support SSL\`.
- \`sslmode=prefer\` waits for the connection timeout and fails with
  \`ERR_POSTGRES_CONNECTION_TIMEOUT\`.

### What is the expected behavior?

Per the Bun SQL documentation, \`sslmode=prefer\` should try TLS first and fall
back to a non-TLS connection when the server responds that TLS is unavailable.`
}

export const RAISE_VIEW: View = {
  name: "raise",
  caption:
    "Raising an issue in two boxes rather than eight controls, none of which can be filled in until the issue exists",
  ...STORE,
  draw: () => (
    <RaiseScreen
      repo={REPO}
      seed={SEED}
      /*
       * Answering never, because a capture that raised an issue on somebody's
       * repository would be a capture nobody could take twice. Pressing the button on
       * the stage leaves it saying "Raising…", which is what a slow answer looks like
       * and is the one thing this screen does while it waits.
       */
      onRaise={() => Effect.never}
      onRaised={() => {}}
      recallRepositories={nothingRemembered()}
      onStepAside={() => {}}
    />
  )
}
