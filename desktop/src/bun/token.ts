import { Effect } from "effect"
import { heldToken } from "./keychain"

/**
 * The token this run will use, from the first place that has one.
 *
 * The keychain is the real answer and the only one the app writes to. The two
 * behind it are for the machine this is being built on: an environment variable
 * for a throwaway token, and the GitHub CLI's own token for the case where the
 * reader is already signed in there — which is most developers, and which means
 * a fresh checkout can read a real Working Set before anybody has created an
 * OAuth app.
 *
 * Order matters and this order is deliberate: having signed in through the app
 * beats whatever a shell happened to export, so a sign-out is a sign-out rather
 * than a fall back to a token the reader forgot they had.
 */

const fromCommand = (args: ReadonlyArray<string>) =>
  Effect.tryPromise({
    try: async () => {
      const it = Bun.spawn([...args], { stdout: "pipe", stderr: "ignore" })
      const [out, code] = await Promise.all([new Response(it.stdout).text(), it.exited])
      return code === 0 ? out.trim() : ""
    },
    // A command that is not installed is not a failure. It is one of three
    // places to look, and looking somewhere that does not exist is a null.
    catch: () => new Error("unreachable")
  }).pipe(Effect.orElseSucceed(() => ""))

export const currentToken = Effect.fn("currentToken")(function* () {
  const kept = yield* heldToken().pipe(Effect.orElseSucceed(() => null))
  if (kept !== null) return kept

  const exported = process.env["GITHUB_TOKEN"] ?? ""
  if (exported !== "") return exported

  const cli = yield* fromCommand(["gh", "auth", "token"])
  return cli === "" ? null : cli
})
