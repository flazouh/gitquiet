import { Effect, type Option } from "effect"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import type { DiffFetcher } from "../domain/library"
import type { CommitDetail } from "../domain/PullRequest"
import type { CommitRef } from "../domain/CommitRef"
import { DEFAULT_KEYS, type Keys } from "../keys/commands"
import { diffChoices, treeChoices } from "../domain/choices"
import { CommitView } from "./CommitView"
import type { Repository } from "../domain/repositories"
import { TheBar } from "./TheBar"
import { KeyboardScope } from "./useKeys"
import { useSettings } from "./useSettings"

export type CommitScreenProps = {
  readonly reference: CommitRef
  readonly load: (sha: string) => Effect.Effect<CommitDetail, unknown>
  /**
   * The commit as the last visit left it, painted while the live read is in the air.
   *
   * A commit that has landed never changes, which makes this page the one where a memory is
   * right rather than nearly right. What is kept is the message, the author and every file
   * name without the diffs — see `keptCommit.ts` — so the header and the tree open at once.
   */
  readonly preload?: (sha: string) => Effect.Effect<Option.Option<CommitDetail>>
  /**
   * Content for a file the commit page arrived without.
   *
   * GitHub embeds diffs until it has spent a byte budget and sends every file
   * after that as a name, so without this the files past the first handful show
   * nothing at all.
   */
  readonly fetchDiffs?: DiffFetcher
  /** Hands the page back to GitHub, and remembers that this is what was wanted. */
  readonly onUseGitHub?: () => void
  /** Whose keys move between the files of this commit. */
  /**
   * The repository list as the last visit to Home left it, for the palette behind ⌘K.
   *
   * Out of the store rather than off the network: this page has no business asking GitHub for a
   * hundred and fifty repositories, and a reader who has never opened Home is offered no search
   * at all rather than made to wait for one.
   */
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly keys?: Keys
}

/**
 * One commit on the page GitHub keeps for it, read the way this interface reads
 * everything else.
 *
 * The same file browser, the same tree, the same diff and the same settings as
 * a pull request, because a commit is a set of changed files and that is the
 * thing this is good at. What it does not have is a pull request around it:
 * nothing to merge, nobody's review to wait for, and no branch behind it to go
 * back to — so the panel is the whole page rather than half of one.
 */
export const CommitScreen = ({
  reference,
  recallRepositories,
  load,
  preload,
  fetchDiffs,
  onUseGitHub,
  keys = DEFAULT_KEYS
}: CommitScreenProps) => {
  // Read only: the way into changing them is in the bar above, not in this
  // panel's corner. See `TheBar`.
  const { settings, change } = useSettings()
  // Deferred for the same reason as `Shell`: the diff's redraw is hundreds of
  // milliseconds, and it must not run inside the click that picked the knob.
  const settled = useDeferredValue(settings)
  const diff = useMemo(() => diffChoices(settled.diff), [settled.diff])
  const tree = useMemo(() => treeChoices(settled.tree), [settled.tree])

  // What the keyboard is scoped to, so a keypress inside this interface is not
  // also heard by GitHub's own page underneath it.
  const [ours, setOurs] = useState<HTMLElement | null>(null)

  // How much window is left where the panel starts, remeasured when the window
  // changes size. Read at the top of the document rather than from wherever the
  // reader has scrolled to, because the answer is the panel's own height and a
  // height that shrank as the page moved would be a panel that ate itself.
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const [room, setRoom] = useState<number | null>(null)

  useEffect(() => {
    if (panel === null) return

    let alive = true

    /** True once there was something real to measure. */
    const measure = (): boolean => {
      // The interface is drawn into a container held off to one side and put
      // into GitHub's layout once theirs is ready. A node nobody has attached
      // yet is at the origin with no size, and believing that would give the
      // panel the whole window and hang its last hundred pixels below the
      // bottom of the screen.
      if (!panel.isConnected) return false

      const top = panel.getBoundingClientRect().top + window.scrollY
      setRoom(Math.max(0, Math.round(window.innerHeight - top)))
      return true
    }

    // Watched into the page, because the takeover happens after this effect
    // runs and nothing tells us when. Watching what changes in the document
    // rather than asking every animation frame: a tab in the background is not
    // painting, so frames there never come and the panel would keep the height
    // of nothing until the reader looked at it.
    const arrival =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            if (!alive || !measure()) return
            arrival?.disconnect()
          })

    if (!measure()) arrival?.observe(document.documentElement, { childList: true, subtree: true })

    // Kept watched afterwards, because GitHub's header is not always the same
    // height — a banner above it moves everything down.
    const watcher =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => void measure())
    watcher?.observe(document.documentElement)
    const onResize = (): void => void measure()
    window.addEventListener("resize", onResize)

    return () => {
      alive = false
      arrival?.disconnect()
      watcher?.disconnect()
      window.removeEventListener("resize", onResize)
    }
  }, [panel])

  // The way out is not here any more. It was a labelled button in this corner,
  // a row in two account menus and a control on the pull request card, under
  // three different names, so the one thing a reader reaches for when something
  // of ours is drawn badly was in a different place on every screen. It is at
  // the right of the bar now, which is above all of them — and the settings
  // that used to hang beside it went the same way, for the same reason.

  return (
    <KeyboardScope value={ours}>
      {/* Their bar, ours instead, with the repository's tabs read off their own nav row. */}
      <TheBar
        where={{ kind: "repository", owner: reference.owner, repo: reference.repo }}
        recall={recallRepositories}
        onStepAside={onUseGitHub}
      />
      {/* No gutter of its own. This screen put GitHub's twenty-four pixels back
          by hand, because the region a commit is drawn in runs to both edges of
          the window and a panel welded to that edge reads as part of the
          browser. Twenty-four is one number where the bar above reads three —
          sixteen, twenty-four and thirty-two by width — and it landed on top of
          the inset `#gitquiet-root` already carries, so the panel started forty
          pixels in on a narrow window against a bar at sixteen. The shell owns
          the frame now, on the container every screen has: see `widths.css`. */}
      <div ref={setOurs} className="flex flex-col pt-2">
        {/* The one panel on the page, given the room left under GitHub's header:
            a diff is read in place, with the tree beside it and the next file a
            key away, so it scrolls inside itself rather than running the page
            down.

            Measured rather than written as `calc(100vh - …)`, because how much
            of the window their header has already taken is their decision and
            it is not the same on every page. A pull request can say `100vh`
            because the column it sits in is sticky and has somewhere to slide;
            here the panel is the page, and guessing the header's height leaves
            either a strip of nothing below the panel or a page that scrolls by
            the amount of the guess. */}
        <div
          ref={setPanel}
          style={room === null ? undefined : { height: `${room}px` }}
          className="flex min-h-[40rem] min-w-0 pb-2"
        >
          <CommitView
            sha={reference.sha}
            load={load}
            preload={preload}
            fetchDiffs={fetchDiffs}
            apart
            diff={diff}
            tree={tree}
            proseAsDocument={settled.diff.prose === "on"}
            keys={keys}
            display={{ settings, onChange: change }}
          />
        </div>
      </div>
    </KeyboardScope>
  )
}
