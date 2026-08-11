import type { Effect, Option } from "effect"
import type { CommitList, History as Read } from "../domain/commitList"
import type { Repository } from "../domain/repositories"
import { atBranch, commitsOf, withStats } from "../domain/commitList"
import { Branches, type LoadBranches } from "./Branches"
import { History } from "./History"
import { Authors, type LoadAuthors, Dates } from "./Sifting"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { TheBar } from "./TheBar"
import { useFreshening } from "./useFreshening"
import { type Load, useLive } from "./useLive"
import { type AskSizes, useSizes } from "./useSizes"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"

export type HistoryScreenProps = {
  readonly list: CommitList
  readonly load: Load<Read>
  /**
   * The same page as the last visit left it, shown until GitHub answers.
   *
   * A better memory than most lists have: a commit that has landed does not
   * change, so what a stale page is missing is the commits pushed since — and
   * those arrive at the top, where they are noticed.
   */
  readonly preload?: () => Effect.Effect<Option.Option<Read>>
  /** Goes to another page of the same branch, by the cursor GitHub gave. */
  readonly onGo: (path: string) => void
  /** Restores GitHub's own list, which is still on the page behind this. */
  readonly onStepAside: () => void
  /**
   * The repository list as the last visit to Home left it, for the palette behind ⌘K.
   *
   * Out of the store rather than off the network, exactly as a repository's pull request
   * page does it: this page has no business asking GitHub for a hundred and fifty
   * repositories.
   */
  /**
   * How big each commit on the page is, filled in behind the list.
   *
   * Its own read rather than part of the load above, because GitHub has no route
   * that answers it for a page: it is one request per commit, and a list that
   * waited for forty of them would be a list nobody saw.
   */
  readonly sizes?: AskSizes
  /**
   * Every branch of the repository, for the picker beside the list.
   *
   * Optional, and read only once the picker is opened: a repository has a
   * thousand branches and the route answers with all of them, which is not a
   * cost a page should pay for a control most readers never press.
   */
  readonly branches?: LoadBranches
  /**
   * Everybody who has written a commit here, for the author filter.
   *
   * Read only once that filter is opened, for the reason the branches are: it
   * is a question about the whole repository, and most readers never ask it.
   */
  readonly authors?: LoadAuthors
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
}

const WORKING = "Reading this branch's commits…"

/** The same read, said over a list that is already on the screen. */
const CHECKING = "Checking this branch for newer commits…"

/**
 * A branch's commits, as a page of this interface.
 *
 * The branch is named here and the repository is named in the bar above it,
 * each once. Their own page says the repository three times before the first
 * commit — in the header, in the breadcrumb and in the branch picker — and
 * this page is mostly a list of sentences somebody wrote, which is the thing
 * the room should be given to.
 */
export const HistoryScreen = ({
  list,
  load,
  preload,
  sizes,
  branches,
  authors,
  onGo,
  onStepAside,
  recallRepositories,
  signedIn = viewerOnPage
}: HistoryScreenProps) => {
  const live = useLive(load, preload)
  const { read } = live
  const waiting = useWaiting(read.status)
  useFreshening(live.catchingUp, CHECKING)
  const { owner, repo } = list.repo

  const answered = read.status === "ready" ? read.value : undefined
  const found = useSizes(answered, sizes)
  const history = answered === undefined ? undefined : withStats(answered, found)

  if (read.status === "failed") {
    return (
      <ReadFailed
        signedOut={!signedIn()}
        why={read.why}
        what={`The commits in ${owner}/${repo}`}
        onStepAside={onStepAside}
        asideLabel="Show GitHub's list"
      />
    )
  }

  return (
    // One wrapper for the wait and for the list, as everywhere else: the wait
    // has to be the same element on both sides of the answer or the dissolve
    // has nothing to start from.
    <div className="relative">
      <TheBar where={{ kind: "repository", owner, repo }} recall={recallRepositories} />
      {history === undefined ? null : (
        <div>
          {/*
           * The branch, and how many of its commits this page is holding. The
           * count is deliberately of this page rather than of the branch: their
           * paging is a cursor, so nothing here knows how many there are, and a
           * number that looked like a total would be a lie.
           */}
          {/*
           * The three controls their own page has here, in their order: which
           * branch, whose commits, how far back. The count sits after them and
           * is of this page rather than of the branch — their paging is a
           * cursor, so nothing here knows how many there are, and a number that
           * looked like a total would be a lie.
           */}
          <div className="flex items-center gap-1 pt-3 pb-1">
            <Branches
              at={(name) => atBranch(list, name)}
              on={history.branch}
              load={branches}
              onGo={onGo}
            />
            <Authors list={list} load={authors} onGo={onGo} />
            <Dates list={list} onGo={onGo} />
            <span className="pl-1 text-sm text-ink-muted">
              {commitsOf(history).length} on this page
            </span>
          </div>
          <History history={history} list={list} onGo={onGo} />
        </div>
      )}
      {waiting ? (
        <Waiting
          what={WORKING}
          detail={`${owner}/${repo}`}
          room="list"
          leaving={history !== undefined}
        />
      ) : null}
    </div>
  )
}
