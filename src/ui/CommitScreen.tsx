import { ArrowSwitchIcon } from "@primer/octicons-react"
import { useMemo, useState } from "react"
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
      <div ref={setOurs} className="flex flex-col pt-2">
        <PageKeys
          keys={keys}
          onHelp={() => setHelping((shown) => !shown)}
          onDismiss={() => setHelping(false)}
        />
        {/* The one panel on the page, given the height of the window: a diff is
            read in place, with the tree beside it and the next file a key away,
            so it scrolls inside itself rather than running the page down. */}
        <div className="flex h-[calc(100vh-1rem)] min-h-[40rem] min-w-0 flex-1 pb-2">
          <CommitView
            sha={reference.sha}
            load={load}
            fetchDiffs={fetchDiffs}
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
