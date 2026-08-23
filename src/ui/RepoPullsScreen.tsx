import { type Effect, Option } from "effect"
import type { Listed } from "../app/repoList"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { DEFAULT_PROFILE, type Profile } from "../keys/commands"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { type Load, useLive } from "./useLive"
import type { Repository } from "../domain/repositories"
import { TheBar } from "./TheBar"
import { WorkingSet } from "./WorkingSet"

export type RepoPullsScreenProps = {
  readonly repo: { readonly owner: string; readonly repo: string }
  /**
   * Reads the page, saying what it has as it gets it.
   *
   * Four reads of GitHub go into a complete list and only the first is needed to
   * draw one, so this is handed somewhere to put each stage on its way through.
   */
  readonly load: Load<Listed>
  /**
   * The page as it was last time, for the screen to show while {@link load} finds
   * out what it is now. Whatever it gives goes the moment the live read answers,
   * either way — a read that failed leaves the failure rather than what was
   * remembered, which is the only age nothing here can bound.
   */
  readonly preload?: () => Effect.Effect<Option.Option<Listed>>
  readonly onOpen: (reference: PullRequestRef) => void
  /** Restores GitHub's own list, which is still on the page behind this. */
  readonly onStepAside: () => void
  /**
   * What the address already asked for, where it asked for anything.
   *
   * The rows were fetched by it, so the box has to say it. Only the terms the
   * box can act on reach here — `src/domain/repoList.ts` decides which — because
   * the rest of GitHub's vocabulary would be read as words to find in a title.
   */
  readonly seed?: string
  /**
   * Told the filter as the list first shows it and on every change, so the
   * screen can move the address when the box asks for a state the rows on this
   * page were never fetched with. `src/domain/repoList.ts` decides which asks
   * are that — see `addressFor`.
   */
  readonly onQuery?: (query: string) => void
  readonly keys?: Profile
  /**
   * The repository list as the last visit to Home left it, for the palette behind ⌘K.
   *
   * Out of the store rather than off the network: this page has no business asking GitHub for a
   * hundred and fifty repositories, and a reader who has never opened Home is offered no search
   * at all rather than made to wait for one.
   */
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string
}

const WORKING = "Reading this repository's pull requests…"

/**
 * How many there are, and whether the safe read limit cut the list.
 *
 * The one thing this page has to say that the Working Set does not. A repository can
 * A capped read must say how much of the repository it could show.
 */
const Tally = ({ pages, rows }: { readonly pages: Listed["pages"]; readonly rows: number }) =>
  Option.match(pages, {
    onNone: () => (
      <span className="text-sm text-ink-muted">
        {rows} {rows === 1 ? "pull request" : "pull requests"}
      </span>
    ),
    onSome: (where) => (
      <span className="text-sm text-ink-muted">
        {`${rows.toLocaleString()} of ${where.count.toLocaleString()} ${
          where.count === 1 ? "pull request" : "pull requests"
        }`}
      </span>
    )
  })

export const RepoPullsScreen = ({
  repo,
  recallRepositories,
  load,
  preload,
  onOpen,
  onStepAside,
  seed,
  onQuery,
  keys = DEFAULT_PROFILE,
  where,
  signedIn = viewerOnPage
}: RepoPullsScreenProps) => {
  const live = useLive(load, preload, where)
  const { read } = live
  const waiting = useWaiting(read.status)

  if (read.status === "failed") {
    return (
      <ReadFailed
        signedOut={!signedIn()}
        why={read.why}
        what={`The pull requests in ${repo.owner}/${repo.repo}`}
        onStepAside={onStepAside}
        asideLabel="Show GitHub's list"
      />
    )
  }

  const listed = read.status === "ready" ? read.value : undefined
  const rows =
    listed === undefined
      ? 0
      : listed.sittings.reduce((running, sitting) => running + sitting.count, 0)

  return (
    // The same wrapper for the wait and for the list, holding both in the same
    // two slots throughout: the wait has to be the same element on both sides of
    // the answer or the dissolve has nothing to start from.
    <div className="relative">
      {/*
       * Their whole header goes, both rows of it, and this says the same things in one:
       * the repository, and the tabs read off their own nav.
       */}
      <TheBar
        where={{ kind: "repository", owner: repo.owner, repo: repo.repo }}
        recall={recallRepositories}
      />
      {listed === undefined ? null : (
        <div>
          {/* The count alone. The repository was named here as well as in the
              bar directly above, which is the thing this screen's own rule
              forbids on its rows: named once, and the bar is where. Two
              headings a centimetre apart carrying the same twelve characters
              read as two lists rather than as one. */}
          <div className="flex items-center justify-end pt-3">
            <Tally pages={listed.pages} rows={rows} />
          </div>
          <WorkingSet
            sittings={listed.sittings}
            onOpen={onOpen}
            what={`${repo.owner}/${repo.repo}`}
            scope={`${repo.owner}/${repo.repo}`}
            seed={seed}
            onQuery={onQuery}
            within={repo}
            keys={keys}
          />
        </div>
      )}
      {waiting ? (
        <Waiting
          what={WORKING}
          detail={`${repo.owner}/${repo.repo}`}
          room="list"
          leaving={listed !== undefined}
        />
      ) : null}
    </div>
  )
}
