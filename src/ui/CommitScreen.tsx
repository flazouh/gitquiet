import { ArrowSwitchIcon } from "@primer/octicons-react"
import { useEffect, useMemo, useState } from "react"
import type { DiffFetcher } from "../diff/library"
import type { CommitDetail } from "../domain/PullRequest"
import type { CommitRef } from "../domain/CommitRef"
import { chordFor, DEFAULT_PROFILE, type Profile } from "../keys/commands"
import { diffChoices, treeChoices } from "../settings/apply"
import { Cap } from "./Cap"
import { CommitView } from "./CommitView"
import { KeySheet } from "./KeySheet"
import { SettingsMenu } from "./SettingsMenu"
import { KeyboardScope, useKeys } from "./useKeys"
import { useSettings } from "./useSettings"

export type CommitScreenProps = {
  readonly reference: CommitRef
  readonly load: (sha: string) => Promise<CommitDetail>
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
  readonly keys?: Profile
}

/**
 * The keyboard for the page rather than for the files: the sheet, and the way
 * out of it.
 *
 * A component of its own because a hook cannot be called conditionally, and
 * because what it listens for belongs to the whole page while the file browser
 * below listens for movement between files.
 */
const PageKeys = ({
  keys,
  onHelp,
  onDismiss
}: {
  readonly keys: Profile
  readonly onHelp: () => void
  readonly onDismiss: () => void
}) => {
  useKeys(keys, { help: onHelp, dismiss: onDismiss })
  return null
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
  load,
  fetchDiffs,
  onUseGitHub,
  keys = DEFAULT_PROFILE
}: CommitScreenProps) => {
  const { settings, change } = useSettings()
  const diff = useMemo(() => diffChoices(settings.diff), [settings.diff])
  const tree = useMemo(() => treeChoices(settings.tree), [settings.tree])

  const [helping, setHelping] = useState(false)

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

  const askKey = chordFor(keys, "help")
  const corner = (
    <>
      {askKey === null ? null : (
        <button
          type="button"
          onClick={() => setHelping(true)}
          title="What the keyboard does here"
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-ink-muted hover:bg-hover hover:text-ink"
        >
          <Cap chord={askKey} />
        </button>
      )}
      {/* Beside the settings rather than inside them: this is the control that
          takes the interface away, and an exit buried in the thing being exited
          is an exit nobody finds. */}
      {onUseGitHub === undefined ? null : (
        <button
          type="button"
          onClick={onUseGitHub}
          title="Read GitHub's own page instead"
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-ink-muted hover:bg-hover hover:text-ink"
        >
          <ArrowSwitchIcon size={12} />
          GitHub's page
        </button>
      )}
      <SettingsMenu settings={settings} onChange={change} />
    </>
  )

  return (
    <KeyboardScope value={ours}>
      {/* The gutter GitHub gives this page, put back by hand.
          A pull request's region arrives already inset, so the interface there
          only has to leave room above and below. The region a commit is drawn
          in runs to both edges of the window — their own diff column carries
          the twenty-four pixels — and taking it over without them left the
          panel welded to the side of the screen. */}
      <div ref={setOurs} className="flex flex-col px-6 pt-2">
        <PageKeys
          keys={keys}
          onHelp={() => setHelping((shown) => !shown)}
          onDismiss={() => setHelping(false)}
        />
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
            fetchDiffs={fetchDiffs}
            apart
            diff={diff}
            tree={tree}
            proseAsDocument={settings.diff.prose === "on"}
            keys={keys}
            menu={corner}
          />
        </div>
        {helping ? (
          <KeySheet
            profile={keys}
            unbound={tree.search ? undefined : ["search"]}
            onClose={() => setHelping(false)}
          />
        ) : null}
      </div>
    </KeyboardScope>
  )
}
