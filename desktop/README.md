# GitQuiet, as a desktop app

The same interface as the extension, on a window instead of GitHub's page.

```bash
bun install
bun run dev     # builds and launches the app
bun run compile # tsc --noEmit
```

## What is shared, and what is not

Nothing in `src/domain`, `src/app`, `src/ports` or `src/ui` is copied here. This
package imports them, which is what the hexagon was for: the screens and the
rules about pull requests do not know whether they are in a browser extension or
a window.

What is written twice, on purpose, is everything a platform answers:

| Question | Extension | Here |
| --- | --- | --- |
| How do we reach GitHub? | their private page routes, with the reader's session cookie | the documented API, with a token |
| Where are settings kept? | `browser.storage.sync` | *(next)* |
| Where does a token live? | there isn't one | the macOS keychain |
| How do we hear about changes? | GitHub's own socket, signed per page | *(next)* |

## The design system

The window is drawn with [Fluid Functionalism](https://www.fluidfunctionalism.com/),
added from its registry rather than copied out of it:

```bash
bunx shadcn@latest add @fluid/dropdown   # `@fluid` is configured in components.json
bun run dev                              # settles aliases, copies Inter, compiles CSS
```

Three of its parts are the whole vocabulary, and they are worth knowing before
adding anything to this window:

- **A surface ladder.** `--surface-1` … `--surface-8` and a matching shadow for
  each. Nothing picks a grey or writes a `box-shadow`; a thing that sits above
  another thing is wrapped in `<Elevated offset={2}>`, and it reads its parent's
  level from context so nesting walks up the ladder on its own.
- **Spring tiers.** `spring.fast` (0.08s), `spring.moderate` (0.16s) and
  `spring.slow` (0.24s, the only one with any bounce). The bigger the thing that
  moves, the slower the tier, and no duration is ever written by hand. Each
  tier's `.exit` is a plain tween one tier quicker, so dismissing something is
  crisp rather than the entrance played backwards.
- **Weight tokens.** `fontWeights.medium` and friends set `wght` *and* `opsz`
  together, because a heavier weight is a wider glyph and a tighter optical size
  pulls it back. That is what lets a hover thicken a label without nudging the
  text beside it, and it is why this window ships Inter instead of using the
  system font.

Two things about the build are not obvious:

- `src/view/style.css` is the file to edit. `src/view/index.css` is compiled from
  it by Tailwind and is not in git, and neither is `src/view/files`, which is
  Inter copied out of `node_modules` so that the `url()`s beside the compiled
  stylesheet resolve.
- `bun run aliases` rewrites the `~/…` imports that `shadcn add` writes into
  relative ones. Electrobun's command line is a compiled Bun executable, so the
  bundler inside it reads no `tsconfig.json` and resolves no `paths` — however
  they are handed to it. `bun run dev` does this for you; it only matters if you
  build some other way.

## Signing in

One press: your own browser opens on github.com, you approve, and the window is
signed in. That is the **authorization code flow with PKCE**, which is what
GitHub asks a windowed application to use — the browser is sent back to a server
the app started on `127.0.0.1` a moment earlier, and the code it carries is
worthless to anyone else because the verifier never left the app.

There is no embedded login form. An app that draws its own GitHub password field
is an app teaching its readers to type their password into anything that looks
the part.

The **device flow** is still there, behind "No browser on this machine? Use a
code", for a machine with nothing to open.

It needs an OAuth app of your own:

1. GitHub → Settings → Developer settings → **New OAuth App**.
2. Authorization callback URL: `http://127.0.0.1/callback`. The port is left off
   on purpose: the app listens on one the system picks, and GitHub matches the
   host and the path and lets the port vary.
3. Tick **Enable Device Flow**, for the second way in.
4. Generate a client secret. GitHub asks for one when a code is exchanged even
   with PKCE, and it is shipped inside the app because there is nowhere else for
   it to be — the same way their own command line tool and their MCP server ship
   theirs. PKCE is what makes the exchange safe, not that.
5. Build with both set:

```bash
GITHUB_CLIENT_ID=Ov23li… GITHUB_CLIENT_SECRET=… bun run dev
```

Kept in `~/.config/gitquiet/oauth.env` on a machine that builds this often, outside
the repository so no `.gitignore` line stands between a secret and a commit:

```bash
set -a && . ~/.config/gitquiet/oauth.env && set +a && bun run dev
```

They are read **while bundling**, not at launch: `electrobun.config.ts` hands
both to Bun's `define`, so a packaged app carries them. An app opened from Finder
inherits launchd's environment, which has neither, which is why every build
before this shipped a sign-in button that refused before it reached the network.

A release build reads them from two repository secrets, named without the
`GITHUB_` prefix because GitHub refuses to store a secret under one:

| Secret | What it is |
| --- | --- |
| `OAUTH_CLIENT_ID` | the OAuth app's client id |
| `OAUTH_CLIENT_SECRET` | its client secret, for the code exchange |

`release.yml` then greps the built bundle for the id, so a release that lost them
somewhere between the secret and the app fails there rather than on somebody's
machine. Every launch also says which way in it has, as `sign-in: browser`,
`sign-in: code` or `sign-in: none`, in the first lines of the log.

With the id and no secret, the panel offers the code flow only. With neither, it
says so instead of drawing a button that cannot work.

To check an OAuth app without building anything:

```bash
GITHUB_CLIENT_ID=… GITHUB_CLIENT_SECRET=… bun desktop/scripts/try-sign-in.ts
```

Add `--pretend` and it plays the browser itself, which checks the loopback door
and leaves the last leg — a person approving — untested.

## Updating itself

A released app looks for a newer one on launch, downloads it, and then offers one
press: **Restart to update**, in the title bar. Nothing asks permission to look
or to download, because the only part that interrupts a reader is the restart.

It reads its own release page, over the link that outlives the release it was
written against:

```
https://github.com/flazouh/gitquiet/releases/latest/download/stable-macos-arm64-update.json
```

`release.yml` attaches that file and the tarball beside it — everything the build
leaves in `desktop/artifacts` once the disk image has been moved out. Without
them a build checks, finds nothing, writes one line to the log and says nothing
on screen.

A development build never checks: Electrobun's updater refuses on the `dev`
channel, which is the `off` standing in `src/bun/updates.ts`.

Nothing here verifies a signature of its own. What it rests on is macOS: the
tarball holds a bundle signed with this project's Developer ID and notarised by
Apple, and the system refuses to launch one whose signature does not match.

**On a development machine you can skip all of that.** If the GitHub CLI is
signed in, the app uses its token, so a fresh checkout draws a real Working Set
before anybody has created an OAuth app. The order is keychain, then
`GITHUB_TOKEN`, then `gh auth token` — so signing out really does sign you out
rather than falling back to a token you forgot you had.
