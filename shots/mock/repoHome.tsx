import { Effect, Option } from "effect"
import type {
  About,
  Entry,
  Front,
  Hand,
  Standing,
  Tongue,
  Touch,
  Welcome
} from "@/domain/repoHome"
import { RepoHomeScreen } from "@/ui/RepoHomeScreen"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { faceDataUri } from "./faces"
import { daysAgo, hoursAgo } from "./when"

/**
 * A repository's front page, with the README and the files side by side.
 *
 * The argument this picture has to make is that both halves are on the screen at
 * once. GitHub gives a stranger a list of dotfiles above the README they came to
 * read, and gives somebody who works here a README they wrote above the file they
 * came to reach; six extensions tried to settle that by hiding one of the two and
 * all six were reported as a broken page. So the photograph has to show a full tree
 * and a full README together, which means the data has to carry both in full.
 *
 * `oven-sh/bun` for the same reason the Pull Request view uses it: the tree is
 * recognisable at a glance, the language bar has a shape nothing else on the store
 * page has, and everything on it is public. Nothing here is anybody's private
 * repository.
 *
 * The Footing is `caller`, a reader who cannot push, which is the arriving stranger
 * the README lead was written for. At this width it decides the reading order and
 * nothing else: the grid puts the README on the left and the files on the right for
 * both readers, and only a narrow window has to choose between them.
 */

const REPO = { owner: "oven-sh", repo: "bun" } as const

/** The commit the tree was read at, which is what the deeper reads are asked about. */
const HEAD = "6f3c1e2b9a4d70f5c81e3a24bd90f7e6c153a8d2"

const touched = (said: string, hours: number): Option.Option<Touch> =>
  Option.some({
    at: hoursAgo(hours),
    said,
    url: `https://github.com/${REPO.owner}/${REPO.repo}/commit/${HEAD.slice(0, 7)}`,
    oid: Option.some(HEAD),
    who: Option.none()
  })

/**
 * The root of the repository, with the commit column already written onto it.
 *
 * Every row carries a Touch, which is the second request landing rather than the
 * first. A tree drawn without it is honest about a page half a second old and is the
 * wrong half-second to photograph: the column is the thing this screen keeps from
 * GitHub's table, and a reader judging the picture cannot see that it fills in.
 *
 * The dates are spread across a fortnight on purpose. A repository where every row
 * says "3h ago" reads as a fixture, because no real tree moves that way.
 */
const folder = (name: string, said: string, hours: number): Entry => ({
  name,
  path: name,
  kind: "directory",
  touched: touched(said, hours)
})

const file = (name: string, said: string, hours: number): Entry => ({
  name,
  path: name,
  kind: "file",
  touched: touched(said, hours)
})

const ENTRIES: ReadonlyArray<Entry> = [
  folder(".buildkite", "Pin the macOS agents to Sonoma", 74),
  folder(".github", "Run the Comment Cop against forks as well", 9),
  folder("bench", "Add a benchmark for streamed responses", 51),
  folder("ci", "Cache the Zig toolchain by version", 96),
  folder("cmake", "Build WebKit with LTO on Linux", 30),
  folder("docs", "Document the Bun.serve() routes object", 6),
  folder("examples", "Update the React SSR example to React 19", 190),
  folder("packages", "bun-types: add routes to Bun.serve()", 14),
  folder("scripts", "Fetch the WebKit build by tag", 118),
  folder("src", "Decode streamed chunks with one decoder", 2),
  folder("test", "Add a regression test for an aborted stream", 2),
  folder("vendor", "Update WebKit to 2b1c4f0", 40),
  file(".editorconfig", "Use two spaces for TypeScript", 940),
  file(".gitignore", "Ignore the local CMake cache directory", 268),
  file("build.zig", "Raise the Zig requirement to 0.14.0", 210),
  file("bun.lock", "Bump vite to 7.1.14", 22),
  file("CMakeLists.txt", "Build the profile binary on Linux only", 63),
  file("CONTRIBUTING.md", "Explain how to run one test file", 152),
  file("Dockerfile", "Base the image on Debian trixie", 340),
  file("LICENSE.md", "Add the WebKit notice", 1_480),
  file("package.json", "Bump the canary version to 1.3.16", 41),
  file("README.md", "Link the Windows install script", 88),
  file("tsconfig.json", "Turn on erasableSyntaxOnly", 176)
]

/**
 * Every path in the repository, which is the read the folders wait for.
 *
 * The root is in the payload the page already carries and goes up at once; this is
 * the rest of the tree, and until it lands a folder opens onto nothing. A sample
 * rather than the whole of bun, because the picture only needs the folders a reader
 * would open to believe the rail is a real tree.
 */
const PATHS: ReadonlyArray<string> = [
  ...ENTRIES.map((entry) => (entry.kind === "directory" ? `${entry.path}/` : entry.path)),
  "src/bun.js/api/server.zig",
  "src/bun.js/api/BunObject.zig",
  "src/bun.js/webcore/response.zig",
  "src/bun.js/webcore/streams.zig",
  "src/bun.js/webcore/blob.zig",
  "src/bun.js/event_loop.zig",
  "src/bundler/bundle_v2.zig",
  "src/cli/run_command.zig",
  "src/cli/test_command.zig",
  "src/cli/install_command.zig",
  "src/install/lockfile.zig",
  "src/install/resolvers/npm_resolver.zig",
  "src/js_parser.zig",
  "src/js_printer.zig",
  "src/http.zig",
  "src/http/websocket_http_client.zig",
  "src/string.zig",
  "src/main.zig",
  "test/js/bun/http/serve-abort.test.ts",
  "test/js/bun/http/serve-stream.test.ts",
  "test/js/bun/http/serve-routes.test.ts",
  "test/js/node/fs/fs.test.ts",
  "test/cli/install/bun-install.test.ts",
  "test/harness.ts",
  "docs/runtime/typescript.md",
  "docs/runtime/hot.md",
  "docs/bundler/index.md",
  "docs/installation.md",
  "packages/bun-types/bun.d.ts",
  "packages/bun-types/package.json",
  "packages/bun-inspector-frontend/package.json",
  "bench/snippets/serve.mjs",
  "scripts/build-webkit.sh",
  "scripts/download-zig.ps1",
  "cmake/targets/BuildBun.cmake",
  "ci/linux/build.yml",
  "examples/react-ssr/index.tsx",
  ".github/workflows/ci.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/comment-cop.yml"
]

const BRANCHES: ReadonlyArray<string> = [
  "main",
  "bun-v1.3.15",
  "jhalvorsen/webkit-2b1c4f0",
  "serve-abort-mid-chunk",
  "zlib-brotli-windows",
  "file-stream-allocations",
  "install-peer-ranges",
  "windows-resolve-sync"
]

/**
 * The README as GitHub renders it, which is how it arrives and how it is drawn.
 *
 * Their HTML rather than markdown of ours. It is in the payload the page already
 * carries, they have already sanitised it, and every extension of theirs in it is
 * work nobody here should do a second time. Written without images, because a store
 * capture waits on every image on the page and a badge that github.com declines to
 * serve is a picture with a hole in it.
 *
 * Long enough to reach the bottom of the frame, which is the point of putting a
 * README in the photograph at all. A page of prose that stops two thirds of the way
 * down leaves the reader looking at the floor of the interface rather than at it.
 */
const README = [
  "<h1>Bun</h1>",
  "<p>Bun is an all-in-one toolkit for JavaScript and TypeScript apps. It ships as a",
  "single executable called <code>bun</code>.</p>",
  "<p>At its core is the Bun runtime, a fast JavaScript runtime built as a drop-in",
  "replacement for Node.js. It is written in Zig and runs on JavaScriptCore, which",
  "cuts both start-up time and memory use.</p>",
  "<pre><code>bun run index.tsx        # TypeScript and JSX, with no build step",
  "bun test                 # the test runner",
  "bun install              # the package manager",
  "bun build ./index.tsx    # the bundler",
  "</code></pre>",
  "<h2>Install</h2>",
  "<p>Bun runs on Linux (x64 and arm64), macOS (x64 and Apple Silicon) and Windows",
  "(x64). Every build is a single binary with no runtime dependency.</p>",
  "<pre><code>curl -fsSL https://bun.sh/install | bash    # macOS and Linux",
  "npm install -g bun                          # any platform with npm",
  "brew install oven-sh/bun/bun                # Homebrew",
  "docker pull oven/bun                        # Docker",
  "</code></pre>",
  "<h2>Upgrade</h2>",
  "<p>Bun releases a canary build on every commit to <code>main</code>, and a stable",
  "build every fortnight.</p>",
  "<pre><code>bun upgrade",
  "</code></pre>",
  "<h2>What is in the box</h2>",
  "<ul>",
  "<li><strong>Runtime</strong>: TypeScript and JSX with no build step, hot reloading,",
  "environment files, and most of the Node.js API surface.</li>",
  "<li><strong>Package manager</strong>: <code>bun install</code>, workspaces, a binary",
  "lockfile, overrides, and a global cache shared across projects.</li>",
  "<li><strong>Test runner</strong>: <code>bun test</code>, watch mode, snapshots,",
  "mocks, and a DOM implementation for component tests.</li>",
  "<li><strong>Bundler</strong>: <code>bun build</code>, plugins, loaders, macros, and",
  "single file executables.</li>",
  "</ul>",
  "<h2>Contributing</h2>",
  "<p>Read <a href=\"CONTRIBUTING.md\">CONTRIBUTING.md</a> to build Bun from source. A",
  "first build takes about twenty minutes and needs Zig 0.14.0, CMake and a recent",
  "LLVM.</p>",
  "<h2>License</h2>",
  "<p>Bun is MIT licensed. It bundles JavaScriptCore, which is LGPL-2.1 licensed, and",
  "the notices for everything it vendors are in <a href=\"LICENSE.md\">LICENSE.md</a>.</p>"
].join("\n")

const WELCOME: Welcome = { name: "README.md", html: README, timedOut: false }

const ABOUT: About = {
  description: Option.some(
    "Incredibly fast JavaScript runtime, bundler, test runner, and package manager, all in one"
  ),
  stars: Option.some(80_412),
  forks: Option.some(3_147),
  topics: ["javascript", "typescript", "bundler", "zig", "nodejs"],
  starring: "unstarred"
}

const hand = (login: string, called: string): Hand => ({
  login,
  called,
  url: `https://github.com/${login}`,
  face: faceDataUri(login)
})

/**
 * The contributor row, drawn as locally-generated SVG avatars.
 *
 * Eight, which is what the row holds before it stops reading as a sample of the
 * people who wrote this and starts reading as a list that was cut off. The logins
 * are invented so that no real person's picture or handle appears in a public
 * marketing screenshot. A locally-drawn data URI also cannot race the shutter the
 * way a lazily-fetched remote image can.
 */
const HANDS: ReadonlyArray<Hand> = [
  hand("jhalvorsen", "Jon Halvorsen"),
  hand("dperrault", "Dom Perrault"),
  hand("mvenn", "Marco Venn"),
  hand("t-okafor", "Temi Okafor"),
  hand("kbranch", "Kai Branch"),
  hand("linnea-h", "Linnea H"),
  hand("s-almeida", "Sofia Almeida"),
  hand("jstahl", "Jan Stahl")
]

/**
 * The language bar, in GitHub's own colours.
 *
 * Theirs rather than ours, which is the one place on this page the site's palette is
 * kept: a reader knows Zig's orange from TypeScript's blue without reading a word,
 * and inventing a second set of colours would throw away a decade of that. The
 * shares add to a hundred because a bar whose pieces do not is a bar with a gap at
 * the end of it.
 */
const TONGUES: ReadonlyArray<Tongue> = [
  { name: "Zig", share: 43.6, colour: "#ec915c", url: "?l=zig" },
  { name: "C++", share: 31.2, colour: "#f34b7d", url: "?l=c%2B%2B" },
  { name: "TypeScript", share: 12.4, colour: "#3178c6", url: "?l=typescript" },
  { name: "JavaScript", share: 5.9, colour: "#f1e05a", url: "?l=javascript" },
  { name: "C", share: 3.1, colour: "#555555", url: "?l=c" },
  { name: "Objective-C", share: 1.4, colour: "#438eff", url: "?l=objective-c" },
  { name: "Other", share: 2.4, colour: "#ededed", url: "?l=other" }
]

const at = (path: string) => `https://github.com/${REPO.owner}/${REPO.repo}/${path}`

const STANDING: Standing = {
  hands: HANDS,
  handCount: Option.some(783),
  handsUrl: Option.some(at("graphs/contributors")),
  tongues: TONGUES,
  shipped: Option.some({ name: "bun-v1.3.15", at: daysAgo(3), url: at("releases/tag/bun-v1.3.15") }),
  shippedUrl: Option.some(at("releases")),
  landings: [
    { name: "production", state: "active", url: at("deployments/production") },
    { name: "docs", state: "active", url: at("deployments/docs") }
  ],
  landingsUrl: Option.some(at("deployments")),
  leaning: Option.some(214_882),
  leaningFaces: [],
  leaningUrl: Option.some(at("network/dependents")),
  parcels: Option.some(6),
  parcelsUrl: Option.some(`https://github.com/orgs/${REPO.owner}/packages`)
}

export const FRONT: Front = {
  repo: REPO,
  footing: "caller",
  branch: "main",
  head: HEAD,
  entries: ENTRIES,
  welcome: Option.some(WELCOME),
  about: ABOUT,
  commits: Option.some(21_478)
}

export const REPO_HOME_VIEW: View = {
  name: "repo-home",
  caption:
    "A repository's README and its whole file tree on one screen, so neither reader has to scroll past the other one's page",
  ...STORE,
  /*
   * The language bar, which the About read writes and nothing on the page waits for.
   * The tree and the README are drawn from the payload GitHub already sent; this is
   * the second request, and a capture taken before it lands is missing the card that
   * says what the repository is written in. See View.ready.
   */
  ready: '[aria-label="Languages"]',
  draw: () => (
    <RepoHomeScreen
      repo={REPO}
      load={settled(FRONT)}
      preload={alreadyKnown(FRONT)}
      recallRepositories={nothingRemembered()}
      signedIn={() => true}
      onStepAside={() => {}}
      onStar={() => Effect.void}
      loadStanding={settled(STANDING)}
      loadPaths={settled(PATHS)}
      loadBranches={settled(BRANCHES)}
      reading={null}
      onRead={() => {}}
    />
  )
}
