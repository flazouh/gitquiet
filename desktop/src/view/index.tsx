import { useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import type { PullRequestRef } from "../../../src/domain/PullRequestRef"
import { type Host, HostProvider } from "../../../src/ui/host"
import { WithinProvider } from "../../../src/ui/within"
import { ShapeProvider } from "../lib/shape-context"
import type { Viewer } from "../shared/wire"
import "./index.css"
import { PullRequest } from "./pullRequest"
import { Account } from "./Account"
import { keepLinksOutside } from "./outside"
import { record } from "./recorded"
import { pageZoomFromPress } from "../shared/pageZoom"
import { ask } from "./rpc"
import { Supplied } from "./supplied"
import { Update } from "./update"
import { Welcome } from "./welcome"
import { WorkingSet } from "./workingSet"

// Before anything else runs, so a failure while the interface is being built is
// a failure somebody can read.
record()

// Also before anything is drawn: a window that follows a link stops being this
// app, and there is no way back from it. Every outward link is opened outside.
keepLinksOutside()

/**
 * The interface, in a webview that knows nothing it does not need to.
 *
 * One window and no router: this app is a Working Set, and the pull request card
 * is what it becomes rather than a second page it navigates to.
 */

/** Whether anybody is signed in, which is not known until the keychain answers. */
type Who = { readonly at: "asking" } | { readonly at: "nobody" } | { readonly at: "someone"; readonly viewer: Viewer }

/**
 * Which of the two screens the window is showing.
 *
 * A pair of states rather than an address. The extension navigates because it
 * lives inside somebody else's navigation; here there is one window, and going
 * back to the list is the list being drawn again — which also means it is read
 * again, and a pull request the reader has just dealt with is gone from it.
 */
type Showing =
  | { readonly at: "list" }
  | { readonly at: "card"; readonly reference: PullRequestRef }

/**
 * The row the traffic lights sit in, which is also the row the bar stands in.
 *
 * There were two: this one, holding the lights and the account, and the screens'
 * own bar directly under it. Two strips of chrome over one list, and the top one
 * could only be drawn in at its right-hand end — a window whose title bar is
 * covered in controls is a window nobody can move. So this row holds the bar
 * itself, the lights keep the space to its left, and what used to sit up here
 * alone is handed to the bar's own tray. See `host.tsx`.
 *
 * Empty of React children on purpose: the bar is portalled in rather than
 * rendered here, because the screens draw it and the screens live below. What
 * this element supplies is the place, the drag, and the gesture.
 */
const Chrome = ({ hold }: { readonly hold: (row: HTMLElement | null) => void }) => (
  <div
    className="chrome"
    ref={hold}
    /*
     * Double-click to zoom, which macOS gives every window and this one had lost.
     *
     * The webview covers the whole window, title bar included, so the gesture lands
     * on this markup and the window never hears it. Sent on rather than reinvented:
     * the main process asks the window to zoom, which is the same thing the system
     * would have done, so a reader who expects it gets it and a reader who does not
     * is not surprised by something else.
     *
     * Not over a control, because double-clicking a button is two presses of that
     * button and should stay that.
     */
    onDoubleClick={(event) => {
      const target = event.target
      if (target instanceof Element && target.closest("button, a, [role='menu']") !== null) return

      void ask("shapeWindow", { how: "zoom" })
    }}
  />
)

const App = () => {
  const [who, setWho] = useState<Who>({ at: "asking" })
  const [showing, setShowing] = useState<Showing>({ at: "list" })
  /** The title row, which is the element the bar is told to stand in. */
  const [row, setRow] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let watching = true

    void ask("viewer", undefined).then((viewer) => {
      if (!watching) return
      setWho(viewer === null ? { at: "nobody" } : { at: "someone", viewer })
    })

    return () => {
      watching = false
    }
  }, [])

  const back = showing.at === "card" ? () => setShowing({ at: "list" }) : null

  /*
   * What this window answers about itself, for the bar the screens draw.
   *
   * Home, because in here the Working Set is a screen this window becomes rather
   * than an address it goes to — the mark used to be a link to `/`, and following
   * it unloaded the app. And the tray, because the update and the account are
   * about the window rather than about anything on the screen, and this is the one
   * strip that is on every screen.
   */
  const host = useMemo<Host>(
    () => ({
      home: () => setShowing({ at: "list" }),
      tray: (
        <>
          {/* Drawn whether or not anybody is signed in, because an update is about
              the app rather than about the reader. */}
          <Update />
          {who.at === "someone" && (
            <Account viewer={who.viewer} onSignedOut={() => setWho({ at: "nobody" })} />
          )}
        </>
      )
    }),
    [who]
  )

  /*
   * Escape goes back, once nothing inside the card wants it.
   *
   * The card binds Escape to closing whatever it has open — a menu, a dialog —
   * innermost first, which is the order anybody expects. This is the
   * outermost of those, so it only acts when nothing of ours is open: a reader who
   * presses Escape to dismiss a dialog and lands back on the list has been thrown
   * out of the thing they were reading.
   */
  useEffect(() => {
    if (back === null) return

    const leave = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return
      if (document.querySelector('[role="dialog"], [role="menu"]') !== null) return
      back()
    }

    document.addEventListener("keydown", leave)
    return () => document.removeEventListener("keydown", leave)
  }, [back])

  /*
   * Cmd+/−/0 page zoom. WebKit's zoom API is on the window in the main process,
   * so the view only recognises the chord and asks. Ctrl is accepted too, for
   * the same chords on a non-Apple keyboard.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const how = pageZoomFromPress({
        key: event.key,
        meta: event.metaKey,
        ctrl: event.ctrlKey,
        alt: event.altKey
      })
      if (how === null) return
      event.preventDefault()
      void ask("pageZoom", { how })
    }

    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  /**
   * What the window is showing, under the strip.
   *
   * Three layouts rather than two, because they want three different things: the
   * welcome wants the whole window and paints its own gradient across it, the
   * Working Set wants the whole window with a scrollbar, and the moment before
   * either wants nothing at all.
   *
   * Nothing at all is deliberate. The keychain answers in a few milliseconds, and a
   * welcome screen that flashes up in front of somebody who signed in last week is
   * worse than a moment of nothing.
   */
  const signedIn = who.at === "someone"

  return (
    // Everything, so the sheet the strip opens has the same store the screens
    // under it are already reading. Each screen still supplies itself: they are
    // mounted and thrown away as the window changes what it is showing, and the
    // store beneath them is one either way.
    <Supplied>
      <Chrome hold={setRow} />

      {/*
        Nothing at all while the keychain is asked, which is deliberate: it answers
        in a few milliseconds, and a welcome screen that flashes up in front of
        somebody who signed in last week is worse than a moment of nothing.
      */}
      {who.at === "nobody" && (
        <Welcome onSignedIn={(viewer) => setWho({ at: "someone", viewer })} />
      )}

      {/*
        The page, under the row the bar stands in.

        Without being told where it is, the bar portals to the top of the document,
        which is where it belongs on github.com and is wrong twice over here: it
        lands under the traffic lights, and it pushes the drag region down out of
        the title bar, so the window cannot be moved at all. Told the row above, it
        stands beside the lights, which is where a Mac window keeps its toolbar.

        Hidden rather than taken away when nobody is signed in. Signing out
        unmounted the screens and the bar in one commit, and React removes a
        portal's children from their container afterwards — with the container gone,
        `removeChild` threw NotFoundError and the window went blank on the way to
        the welcome. The container is the row now, which is never unmounted at all.
      */}
      <main className="page" hidden={!signedIn}>
        {signedIn && row !== null && (
          <WithinProvider value={row}>
            <HostProvider value={host}>
              {showing.at === "card" ? (
                <PullRequest reference={showing.reference} />
              ) : (
                <WorkingSet onOpen={(reference) => setShowing({ at: "card", reference })} />
              )}
            </HostProvider>
          </WithinProvider>
        )}
      </main>
    </Supplied>
  )
}

const root = document.getElementById("gitquiet-root")
if (root === null) throw new Error("The window has no root to draw into.")

/*
 * Which shape this window is, said once and out loud.
 *
 * The registry's components read a shape from this context and fall back to
 * `pill` when nobody has provided one, which is how a control nothing else here
 * resembles got drawn: not chosen, defaulted to. Everything this app draws is
 * rounded rather than pill — cards at ten pixels, rows and menus at eight — so
 * that is what the window says it is, and the one registry control left, the
 * sign-in button, follows it instead of guessing.
 */
createRoot(root).render(
  <ShapeProvider defaultShape="rounded">
    <App />
  </ShapeProvider>
)
