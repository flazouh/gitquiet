import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import type { PullRequestRef } from "../../../src/domain/PullRequestRef"
import { THE_ART } from "../../../src/ui/art"
import { Button } from "../components/ui/button"
import { ShapeProvider } from "../lib/shape-context"
import type { Viewer } from "../shared/wire"
import "./index.css"
import { PullRequest } from "./pullRequest"
import { Account } from "./Account"
import { keepLinksOutside } from "./outside"
import { record } from "./recorded"
import { pageZoomFromPress } from "../shared/pageZoom"
import { ask } from "./rpc"
import { Settings } from "./settings"
import { SignIn } from "./signIn"
import { Supplied } from "./supplied"
import { Update } from "./update"
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
 * The strip the traffic lights sit in, and the only thing allowed to share it.
 *
 * Nothing may be drawn across the draggable region — a window whose title bar is
 * covered in buttons is a window nobody can move — so who is signed in, and the
 * way to stop being, sit at the far end of it where the drag is given up
 * deliberately.
 */
const Chrome = ({
  who,
  onBack,
  onSettings,
  onSignedOut
}: {
  readonly who: Who
  /** The way back to the list, drawn only while there is one to go back to. */
  readonly onBack: (() => void) | null
  readonly onSettings: () => void
  readonly onSignedOut: () => void
}) => (
  <div
    className="chrome"
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
  >
    {onBack !== null && (
      /*
       * The one control the window needs and the screens cannot supply.
       *
       * The card's own way out is `onStepAside`, which it draws when a read fails
       * and hands the reader GitHub's page instead — on a page that is the right
       * answer, because GitHub's own conversation tab is underneath. Here there is
       * nothing underneath, so a card that loaded perfectly had no way back at all.
       *
       * In the title bar rather than on the card, because it is about the window
       * rather than about the pull request, and because a control that appears in a
       * fixed place is one a reader can find without looking.
       *
       * The registry's button, with the window's own arrow in it. It used to draw
       * a twenty-pixel pill, which was the only corner of that radius on screen —
       * not chosen, though: `Button` takes its shape from a context this window
       * never provided, so it fell back to the registry's pill default. The shape
       * is declared where the app is mounted now, and the glyph is the same one
       * the Previous and Next buttons inside the card already use, rather than the
       * `‹` that was standing in for one.
       */
      <div className="chrome-start">
        <Button size="sm" variant="ghost" leadingIcon={THE_ART.back} onClick={onBack}>
          Working Set
        </Button>
      </div>
    )}
    {/*
      Drawn whether or not anybody is signed in, because an update is about the
      app rather than about the reader: a window sitting on the sign-in panel is
      exactly where a restart costs nothing.
    */}
    <div className="chrome-end">
      <Update />
      {who.at === "someone" && (
        <Account viewer={who.viewer} onSettings={onSettings} onSignedOut={onSignedOut} />
      )}
    </div>
  </div>
)

const App = () => {
  const [who, setWho] = useState<Who>({ at: "asking" })
  const [showing, setShowing] = useState<Showing>({ at: "list" })
  /*
   * Held by the window rather than by either screen, because it is opened from
   * the strip above both of them and a reader who changes how diffs are drawn
   * while looking at the list should not have to open a card to do it.
   */
  const [tweaking, setTweaking] = useState(false)

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

  return (
    // Everything, so the sheet the strip opens has the same store the screens
    // under it are already reading. Each screen still supplies itself: they are
    // mounted and thrown away as the window changes what it is showing, and the
    // store beneath them is one either way.
    <Supplied>
      <Chrome
        who={who}
        onBack={back}
        onSettings={() => setTweaking(true)}
        onSignedOut={() => setWho({ at: "nobody" })}
      />
      {/*
        Two layouts, because a panel and a list want opposite things: the sign-in
        panel wants the middle of the window and the Working Set wants all of it,
        with its own scrollbar.

        Nothing at all while the keychain is asked. It answers in a few
        milliseconds, and a sign-in panel that flashes up in front of somebody who
        is already signed in is worse than a moment of nothing.
      */}
      {who.at === "someone" ? (
        <main className="page">
          {showing.at === "card" ? (
            <PullRequest
              reference={showing.reference}
              onBack={() => setShowing({ at: "list" })}
            />
          ) : (
            <WorkingSet onOpen={(reference) => setShowing({ at: "card", reference })} />
          )}
        </main>
      ) : (
        <main className="middle">
          {who.at === "nobody" && <SignIn onSignedIn={(viewer) => setWho({ at: "someone", viewer })} />}
        </main>
      )}
      {tweaking ? <Settings onClose={() => setTweaking(false)} /> : null}
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
