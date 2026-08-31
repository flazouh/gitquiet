import { type Effect, Option } from "effect"
import type { ListedIssues } from "../app/issueList"
import type { Repository } from "../domain/repositories"
import { IssueList } from "./IssueList"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { DrawnAt } from "./drawnAt"
import { TheBar } from "./TheBar"
import { type Load, useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"

export type IssueListScreenProps = {
  readonly repo: { readonly owner: string; readonly repo: string }
  readonly load: Load<ListedIssues>
  /**
   * The page as it was last time, for the screen to show while {@link load}
   * finds out what it is now. Whatever it gives goes the moment the live read
   * answers, either way.
   */
  readonly preload?: () => Effect.Effect<Option.Option<ListedIssues>>
  /** Restores GitHub's own list, which is still on the page behind this. */
  readonly onStepAside: () => void
  /** Goes to another page of the same list, by changing the address GitHub reads. */
  readonly onPage: (page: number) => void
  /**
   * What the address already asked for, where it asked for anything.
   *
   * The rows were fetched by it, so the box has to say it. Only the terms the
   * box can act on reach here — `src/domain/issueList.ts` decides which —
   * because the rest of GitHub's vocabulary would be read as words to find in a
   * title.
   */
  readonly seed?: string
  /**
   * The repository list as the last visit to Home left it, for the palette
   * behind ⌘K. Out of the store rather than off the network, for the reason a
   * repository's pull request list reads it that way.
   */
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string
  /** The exact pathname this screen stands for, as {@link DrawnAt} needs it said. */
  readonly at?: string
}

const WORKING = "Reading this repository's issues…"

/**
 * A repository's issues — `/owner/repo/issues`.
 *
 * One list, in GitHub's own order, and no Courts. Home files issues into three
 * because it asked three questions that each name the reader, and the answer to
 * each is a claim about what the reader owes. This page asked one question that
 * names a repository: of three hundred issues here, the reader is party to
 * fifteen, and heading the other two hundred and eighty-five as anything at all
 * would be this interface inventing a claim GitHub never made.
 *
 * What replaces the grouping is the filter above the rows, which is the same
 * instrument the Working Set carries and cut down to the terms an issue can
 * answer.
 */
export const IssueListScreen = ({
  repo,
  recallRepositories,
  load,
  preload,
  onStepAside,
  onPage,
  seed,
  where,
  at,
  signedIn = viewerOnPage
}: IssueListScreenProps) => {
  const live = useLive(load, preload, where)
  const { read } = live
  const waiting = useWaiting(read.status)

  const named = `${repo.owner}/${repo.repo}`

  if (read.status === "failed") {
    return (
      <>
        {/* The failure screen is an answer too. See {@link DrawnAt}. */}
        <DrawnAt path={at ?? null} />
        <ReadFailed
        signedOut={!signedIn()}
        why={read.why}
        what={`The issues in ${named}`}
        onStepAside={onStepAside}
        asideLabel="Show GitHub's list"
        />
      </>
    )
  }

  const listed = read.status === "ready" ? read.value : undefined

  return (
    // The same wrapper for the wait and for the list, holding both in the same
    // two slots throughout: the wait has to be the same element on both sides of
    // the answer or the dissolve has nothing to start from.
    <div className="relative">
      <DrawnAt path={read.status === "loading" ? null : (at ?? null)} />
      <TheBar
        where={{ kind: "repository", owner: repo.owner, repo: repo.repo }}
        recall={recallRepositories}
      />
      {listed === undefined ? null : (
        <div className="t-panels flex flex-col gap-1 py-3">
          <IssueList
            listed={listed}
            what={named}
            within={repo}
            seed={seed}
            nothing={`No open issues in ${named}.`}
            onPage={onPage}
          />
        </div>
      )}
      {waiting ? (
        <Waiting what={WORKING} detail={named} room="list" leaving={listed !== undefined} />
      ) : null}
    </div>
  )
}
