import { Effect } from "effect"
import { IDENTIFIER } from "./identity"

/**
 * Where the token lives, which is not in this app.
 *
 * The operating system's keychain, reached through the `security` command that
 * ships with macOS. A file under Application Support would have been fewer
 * lines and would also have been a GitHub token in plain text on disk, readable
 * by every process the reader runs.
 *
 * The command line rather than a native binding because the surface is three
 * verbs and this way there is nothing to compile, nothing to keep in step with
 * an architecture, and nothing to go wrong in a build.
 */

const SERVICE = IDENTIFIER
const ACCOUNT = "github-token"

/** A keychain that would not answer. Not the same as one with nothing in it. */
export class KeychainRefused extends Error {
  readonly _tag = "KeychainRefused"
}

const run = (args: ReadonlyArray<string>, input?: string) =>
  Effect.tryPromise({
    try: async () => {
      const it = Bun.spawn(["security", ...args], {
        stdin: input === undefined ? "ignore" : new TextEncoder().encode(input),
        stdout: "pipe",
        stderr: "pipe"
      })
      const [out, code] = await Promise.all([new Response(it.stdout).text(), it.exited])
      return { out, code }
    },
    catch: (cause) => new KeychainRefused(String(cause))
  })

/**
 * The token being held, if one is.
 *
 * A missing password and a locked keychain are told apart: the first is a
 * reader who has not signed in yet and gets the sign-in panel, the second is
 * something to report rather than paper over by asking them to sign in again.
 */
export const heldToken = Effect.fn("heldToken")(function* () {
  const { out, code } = yield* run(["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"])

  // 44 is `errSecItemNotFound` reaching us as an exit code: nothing is stored,
  // which is the ordinary state of a machine nobody has signed in on.
  if (code === 44) return null
  if (code !== 0) return yield* Effect.fail(new KeychainRefused(`security exited ${code}`))

  const token = out.trim()
  return token === "" ? null : token
})

/**
 * Keeps a token, replacing whatever was there.
 *
 * `-U` because signing in again with a different account should be signing in,
 * not an error about a password that already exists.
 *
 * The token goes in on stdin rather than as `-w <token>`, which would put it in
 * the process list for anybody running `ps` at the wrong moment. Twice, because
 * `-w` with no value prompts for the password and then prompts again to confirm
 * it — send it once and `security` reads an empty second line, says "passwords
 * don't match", and still exits 0 having stored nothing at all.
 */
export const keepToken = Effect.fn("keepToken")(function* (token: string) {
  const { code } = yield* run(
    ["add-generic-password", "-U", "-s", SERVICE, "-a", ACCOUNT, "-l", "GitQuiet", "-w"],
    `${token}\n${token}\n`
  )

  if (code !== 0) return yield* Effect.fail(new KeychainRefused(`security exited ${code}`))

  // Read back, because the failure this is guarding against exits 0. A token
  // that did not arrive would otherwise be found out on the next launch, as a
  // reader who signed in yesterday being asked to sign in again.
  const kept = yield* heldToken()
  if (kept !== token) {
    return yield* Effect.fail(new KeychainRefused("the keychain kept nothing, and said nothing"))
  }
})

/**
 * Forgets the token.
 *
 * Nothing stored is a success, not a failure: signing out of an app you were
 * never signed in to is exactly the state the caller was asking for.
 */
export const forgetToken = Effect.fn("forgetToken")(function* () {
  const { code } = yield* run(["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT])
  if (code !== 0 && code !== 44) {
    return yield* Effect.fail(new KeychainRefused(`security exited ${code}`))
  }
})
