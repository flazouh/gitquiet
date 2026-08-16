import { Effect } from "effect"
import { existsSync } from "node:fs"
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

/**
 * Where the GitHub CLI is, for a run that no shell started.
 *
 * `PATH` is asked first, because that is the answer on a machine where somebody
 * put `gh` somewhere of their own. What follows is the list to try when `PATH`
 * has nothing, and it exists because of the one launch that matters: an app
 * opened from Finder or the Dock inherits `launchd`'s environment, which is
 * `/usr/bin:/bin:/usr/sbin:/sbin` and nothing else. Homebrew installs to
 * `/opt/homebrew/bin`, so a reader with `gh` signed in got the sign-in panel
 * while the same app started from a terminal drew their Working Set.
 *
 * Three places, and none of them one that `launchd`'s own `PATH` already covers:
 * a fourth entry for `/usr/bin` was in here and could never be reached, because
 * `Bun.which` had already looked there.
 */
const GH_PREFIXES: ReadonlyArray<string> = ["/opt/homebrew/bin", "/usr/local/bin", "/opt/local/bin"]

export const whereGhIs = (opts: {
  readonly onPath?: (name: string) => string | null
  readonly exists?: (path: string) => boolean
} = {}): string | null => {
  const onPath = opts.onPath ?? ((name: string) => Bun.which(name))
  const exists = opts.exists ?? existsSync

  return onPath("gh") ?? GH_PREFIXES.map((prefix) => `${prefix}/gh`).find(exists) ?? null
}

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

  const gh = whereGhIs()
  if (gh === null) return null

  const cli = yield* fromCommand([gh, "auth", "token"])
  return cli === "" ? null : cli
})
