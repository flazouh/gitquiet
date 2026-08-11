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

The app uses GitHub's **device flow**: it shows a short code, you type it into
github.com, and the token it gets back goes into your keychain. There is no
embedded login form, and no client secret — a secret shipped inside a
downloadable app is not a secret.

It needs an OAuth app of your own:

1. GitHub → Settings → Developer settings → **New OAuth App**.
2. Tick **Enable Device Flow**.
3. Copy the Client ID and run with it set:

```bash
GITHUB_CLIENT_ID=Ov23li… bun run dev
```

Until that is set, the sign-in button says so rather than failing quietly.

**On a development machine you can skip all of that.** If the GitHub CLI is
signed in, the app uses its token, so a fresh checkout draws a real Working Set
before anybody has created an OAuth app. The order is keychain, then
`GITHUB_TOKEN`, then `gh auth token` — so signing out really does sign you out
rather than falling back to a token you forgot you had.
