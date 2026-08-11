import { Effect } from "effect"
import { ApplicationMenu, BrowserWindow, defineElectrobunRPC } from "electrobun/bun"
import type { Answered, Asked, Card, Pending, Viewer, Wire } from "../shared/wire"
import { whoAmI } from "./api"
import { readCard, readPatches } from "./card"
import { readCommit } from "./commit"
import { mainViewUrl, viteIsUp, waitForVite } from "./mainViewUrl"
import { macMenu } from "./menu"
import { nextPageZoom, type PageZoomHow } from "../shared/pageZoom"
import { sayOnLines, sayOnThePullRequest } from "./say"
import { write } from "./write"
import {
  demoCard,
  demoCommit,
  demoPatches,
  demoRemark,
  demoRows,
  demoSayOnLines,
  demoViewer,
  demoWrite,
  inDemo
} from "./demo"
import { fileFor, inFile, keepingLatest, readAcrossRuns } from "./acrossRuns"
import { IDENTIFIER } from "./identity"
import { beginSignIn, CLIENT_ID, finishSignIn } from "./device"
import { forgetToken, keepToken } from "./keychain"
import { currentToken } from "./token"
import { readWorkingSet } from "./workingSet"

/**
 * The window, and the only process allowed to hold a token.
 *
 * Everything that knows a secret stays on this side. A webview can be handed a
 * URL by a link, a redirect, or a page that turned out to be cleverer than
 * expected; this process cannot, so the token lives here and answers questions
 * rather than being sent across to be kept in a variable somebody can read.
 */

/** Said in data, because every one of these is something the screen can word. */
const said = <A>(work: Effect.Effect<A, unknown>): Promise<Answered<A>> =>
  Effect.runPromise(
    work.pipe(
      Effect.map((it): Answered<A> => ({ ok: true, it })),
      Effect.catch((cause: unknown) =>
        Effect.succeed<Answered<A>>({
          ok: false,
          why: cause instanceof Error ? cause.message : String(cause)
        })
      )
    )
  )

/**
 * The same answer, with a line in the terminal saying it was asked for and how
 * long it took.
 *
 * Written because of a wait that could not be explained from either end: the
 * window sat on "Reading your pull requests…" for half an hour while the same
 * four searches, run from a script with the same token on the same machine,
 * answered in four seconds. Nothing in between said anything — so there was no
 * way to tell a read that never finished from one that finished and never
 * arrived, which are different faults in different processes.
 */
const timed = async <A>(what: string, answer: Promise<Answered<A>>): Promise<Answered<A>> => {
  const started = Date.now()
  console.log(`[working-set] ${what}: asked`)

  const it = await answer
  const took = `${Date.now() - started}ms`
  const size = it.ok ? `${(JSON.stringify(it).length / 1024).toFixed(0)}KB, ` : ""
  console.log(`[working-set] ${what}: ${it.ok ? `answered ${size}in ${took}` : `refused in ${took} — ${it.why}`}`)

  return it
}

/**
 * A read that needs the token, with the one case that is not an error handled.
 *
 * Nobody being signed in is a sentence the window has, so it travels as a refusal
 * like any other rather than as an exception nobody catches.
 */
const withToken = <A>(read: (token: string) => Effect.Effect<A, unknown>): Effect.Effect<A, unknown> =>
  currentToken().pipe(
    Effect.flatMap((token) =>
      token === null ? Effect.fail(new Error("Nobody is signed in.")) : read(token)
    )
  )

/**
 * The same read, answered by the invented GitHub when this run is a demo.
 *
 * Here rather than inside each handler because the branch belongs to the process
 * and not to the request: a handler that reads GitHub sometimes and a fixture
 * other times is a handler with two behaviours to keep in step, and every one of
 * these would have said the same `if` again. The token is never asked for in a
 * demo, so a machine with no keychain entry and no network runs the whole
 * interface.
 */
const fromGitHubOrDemo = <A>(
  demo: () => Effect.Effect<A, unknown>,
  read: (token: string) => Effect.Effect<A, unknown>
): Effect.Effect<A, unknown> => (inDemo ? demo() : withToken(read))

/**
 * Whether this run starts signed in.
 *
 * A token that no longer works answers the same as no token at all — the
 * sign-in panel — because "your access was revoked" and "you have not signed in"
 * ask the reader for exactly the same thing. A demo is always signed in, as
 * somebody who does not exist.
 *
 * Named out here rather than written into the handler because the two halves of
 * the branch have different types — one cannot answer nobody — and the union has
 * to be said out loud somewhere for `Effect.tap` to accept both.
 */
const whoIsSignedIn: Effect.Effect<Viewer | null> = (
  inDemo
    ? demoViewer()
    : currentToken().pipe(
        Effect.flatMap((token) => (token === null ? Effect.succeed(null) : whoAmI(token))),
        Effect.orElseSucceed(() => null)
      )
).pipe(
  // The one line of startup logging kept: it is the difference between "nothing
  // is drawn" meaning nobody is signed in and it meaning the interface never
  // reached this process at all.
  Effect.tap((it) =>
    Effect.sync(() =>
      console.log("[working-set] viewer:", it?.login ?? "nobody", inDemo ? "(demo)" : "")
    )
  )
)

type Shaped = { readonly maximized: boolean; readonly fullScreen: boolean }

/**
 * The window, zoomed or full or put back, and what it now is.
 *
 * Written out here with its type said out loud rather than inside the handler,
 * because the handlers are what gives `rpc` its type and `window` is built with
 * `rpc`: a handler whose body mentions the window is a handler TypeScript cannot
 * check until it knows what the window is, which it cannot know until the handlers
 * are checked. An annotation is enough to cut that circle.
 */
const shaped = (how: "zoom" | "fullScreen"): Effect.Effect<Shaped> =>
  Effect.sync(() => {
    if (how === "fullScreen") window.setFullScreen(!window.isFullScreen())
    else if (window.isMaximized()) window.unmaximize()
    else window.maximize()

    return { maximized: window.isMaximized(), fullScreen: window.isFullScreen() }
  })

/**
 * Where the zoom is kept, so the window opens at the size it was closed at.
 *
 * A demo keeps its own, because a zoom set for a camera is not one the reader
 * asked their real window for.
 */
const remembers = inFile(fileFor(IDENTIFIER, inDemo))
const keepZoom = keepingLatest(remembers)

/**
 * Zoom, changed and then remembered.
 *
 * Kept on each press rather than on quit: an app that is force quit, crashes, or
 * is stopped by the launcher — which is every run during development — never
 * reaches a shutdown hook, and a preference that only survives a polite exit is
 * one that appears not to work. `keepingLatest` waits out the burst, so a reader
 * holding Cmd+= writes one file rather than eight.
 */
const zoomed = (how: PageZoomHow): Effect.Effect<{ readonly zoom: number }> =>
  Effect.sync(() => {
    const zoom = nextPageZoom(window.getPageZoom(), how)
    window.setPageZoom(zoom)
    keepZoom({ zoom })
    return { zoom }
  })

const rpc = defineElectrobunRPC<Wire, "bun">("bun", {
  // Fifteen minutes, which is not a timeout for a request so much as one for a
  // person: `finishSignIn` is held open while the reader types a code into
  // GitHub, and the default would give up on them after a few seconds.
  maxRequestTime: 15 * 60 * 1000,
  handlers: {
    requests: {
      /**
       * Whether this run starts signed in.
       *
       * A token that no longer works answers the same as no token at all — the
       * sign-in panel — because "your access was revoked" and "you have not
       * signed in" ask the reader for exactly the same thing.
       */
      viewer: (): Promise<Viewer | null> => Effect.runPromise(whoIsSignedIn),

      beginSignIn: () =>
        CLIENT_ID === ""
          ? Promise.resolve<Answered<Pending>>({
              ok: false,
              why: "No OAuth client id. Create a GitHub OAuth app with device flow enabled and set GITHUB_CLIENT_ID."
            })
          : said(beginSignIn()),

      /**
       * Waits out the sign-in, then keeps the token before answering.
       *
       * Kept first and read second on purpose: if the keychain refuses, the
       * reader is told now rather than being shown a signed-in window that
       * forgets them the moment they quit.
       */
      finishSignIn: (pending: Pending) =>
        said(
          finishSignIn(pending).pipe(
            Effect.tap((token) => keepToken(token)),
            Effect.flatMap((token) => whoAmI(token))
          )
        ),

      signOut: () => Effect.runPromise(forgetToken().pipe(Effect.orElseSucceed(() => undefined))),

      /**
       * The list, read with a token the interface never sees.
       *
       * A refusal is data rather than a rejection because every way this fails
       * is something the window can word: a revoked token, a rate limit, a
       * network that went away mid-flight.
       */
      workingSet: () =>
        timed("working set", said(fromGitHubOrDemo(demoRows, (token) => readWorkingSet(token)))),

      /** One pull request, whole. Everything its card draws but the file content. */
      card: (card: Card) =>
        said(
          fromGitHubOrDemo(
            () => demoCard(card),
            (token) => readCard(token, card)
          )
        ),

      /** The content of the files a reader has opened, or is about to. */
      patches: (asked: Card & { readonly paths: ReadonlyArray<string> }) =>
        said(
          fromGitHubOrDemo(
            () => demoPatches(asked, asked.paths),
            (token) => readPatches(token, asked, asked.paths)
          )
        ),

      commit: ({ owner, repo, sha }: { readonly owner: string; readonly repo: string; readonly sha: string }) =>
        said(
          fromGitHubOrDemo(
            () => demoCommit(owner, repo, sha),
            (token) => readCommit(token, owner, repo, sha)
          )
        ),

      /**
       * Something done rather than read, which is the only thing here that is not
       * undoable by pressing again.
       *
       * The card asks twice before it gets this far — every one of these buttons
       * arms on the first press and acts on the second — so nothing extra is asked
       * here. What is refused here is the one thing GitHub cannot be asked at all:
       * see `SOLO` in `Asked`.
       */
      /**
       * The window, zoomed or put back — or made full screen, or brought out of it.
       *
       * A toggle rather than a setter because that is what the reader's gesture is:
       * they double-click the strip again, or choose the menu item again, and expect
       * the window to go back. Answering with both facts costs nothing and saves the
       * interface from keeping its own idea of a window it does not own.
       */
      shapeWindow: ({ how }: { readonly how: "zoom" | "fullScreen" }) => said(shaped(how)),

      pageZoom: ({ how }: { readonly how: PageZoomHow }) => said(zoomed(how)),

      /** A remark on some lines, which comes back as the thread it started. */
      sayOnLines: (
        asked: Card & {
          readonly path: string
          readonly line: number
          readonly startLine: number
          readonly body: string
          readonly headSha: string
        }
      ) =>
        said(
          fromGitHubOrDemo(
            () => demoSayOnLines(asked, asked),
            (token) => sayOnLines(token, asked, asked)
          )
        ),

      /** A remark on the pull request itself. */
      sayOnThePullRequest: (asked: Card & { readonly body: string }) =>
        said(
          fromGitHubOrDemo(
            () => demoRemark(asked, asked.body),
            (token) => sayOnThePullRequest(token, asked, asked.body)
          )
        ),

      /**
       * A link, opened where links belong.
       *
       * Checked rather than passed along: this is a string from the webview handed
       * to a shell, and `open` will launch an application for anything it
       * recognises. Only http and https, so nothing here can be talked into
       * opening a file, a script, or a scheme somebody registered.
       */
      openOutside: ({ url }: { readonly url: string }) =>
        said(
          Effect.gen(function* () {
            const where = yield* Effect.try(() => new URL(url))
            if (where.protocol !== "http:" && where.protocol !== "https:") {
              return yield* Effect.fail(new Error(`Not a link to open: ${url}`))
            }

            yield* Effect.tryPromise(() => Bun.$`open ${where.href}`.quiet())
          })
        ),

      write: (wanted: Card & { readonly asked: Asked }) =>
        said(
          wanted.asked.doing === "enqueue" && wanted.asked.how === "SOLO"
            ? Effect.fail(
                new Error(
                  "GitHub's merge queue cannot be asked for a pull request that merges alone. Their own page can."
                )
              )
            : fromGitHubOrDemo(
                () => demoWrite(wanted, wanted.asked),
                (token) => write(token, wanted, wanted.asked)
              )
        )
    }
  }
})

/** What the application is called, in the window's title and its first menu. */
const APP_NAME = "GitQuiet"

/**
 * Which page the window opens.
 *
 * A demo opens a different one — the same markup with an in-memory
 * `localStorage` in front of it, so an invented list is not filtered by the
 * reader's real filter and nothing typed on camera is written into their
 * session. A whole page rather than a flag on this address because the scheme
 * handler resolves the address to a file and answers nothing for one with a
 * query or a hash on the end. See `scripts/build-demo-view.ts`.
 */
const page = inDemo ? "demo.html" : "index.html"

const bundledView = `views://main/${page}`
const viteView = `${process.env["GITQUIET_VITE"] ?? "http://127.0.0.1:5173"}${inDemo ? `/${page}` : ""}`
const waitingForHmr = process.env["GITQUIET_HMR"] === "1"
const view = await mainViewUrl({
  bundled: bundledView,
  vite: viteView,
  probe: waitingForHmr ? waitForVite : viteIsUp
})
if (view.hmr) {
  console.log(`[working-set] HMR: loading ${view.url}`)
} else if (waitingForHmr) {
  console.log(`[working-set] HMR: Vite did not answer at ${viteView}; using bundled view`)
}

/*
 * The menu bar, before the window rather than after it.
 *
 * Set on the application and not on the window, so the keys it carries — quitting,
 * closing, and the editing pair a webview cannot copy without — are live from the
 * first frame instead of from whenever this line happened to run. See `menu.ts`
 * for why a window without one is a window whose keyboard is half missing.
 */
ApplicationMenu.setApplicationMenu(macMenu(APP_NAME))

const window = new BrowserWindow({
  title: APP_NAME,
  url: view.url,
  frame: { x: 200, y: 120, width: 1100, height: 760 },
  titleBarStyle: "hiddenInset",
  trafficLightOffset: { x: 12, y: 10 },
  rpc
})
// Fill the screen without entering macOS fullscreen (no separate Space).
window.maximize()

/*
 * The zoom the reader left, put back before they see the page at the wrong size.
 *
 * Read from disk above rather than asked for by the interface, and set here on
 * the window rather than in the view, because page zoom is a property of the
 * window: there is no size for the interface to ask about until this line has
 * run, and asking afterwards is one frame drawn wrong on every launch.
 */
const { zoom } = await Effect.runPromise(readAcrossRuns(remembers))
if (zoom !== 1) {
  window.setPageZoom(zoom)
  console.log(`[working-set] zoom: ${zoom}`)
}

/**
 * The door onto the window, when a development run has asked for one.
 *
 * `evaluateJavascriptWithResponse` is Electrobun's own handler, registered by
 * the view rather than by us, which is why it is not in `Wire` and why the cast
 * is here: this is the one call that leaves the typed schema, and it leaves it
 * in one place instead of everywhere it is used.
 */
const asked = Number(process.env["GITQUIET_INSPECT"] ?? "")
if (Number.isInteger(asked) && asked > 0) {
  const evaluate = (script: string) =>
    (rpc as unknown as { request: (name: string, params: unknown) => Promise<unknown> }).request(
      "evaluateJavascriptWithResponse",
      { script }
    )

  const { openInspector } = await import("./inspect")
  openInspector(evaluate, asked, {
    openDevTools: () => window.webview?.openDevTools(),
    raise: () => window.activate()
  })
}
