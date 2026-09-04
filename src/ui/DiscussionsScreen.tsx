import type { Effect, Option } from "effect"
import { type Category, type ListedDiscussion } from "../domain/discussions"
import { homeName, type DiscussionList } from "../domain/discussionRoutes"
import type { Repository } from "../domain/repositories"
import { Categories, Discussions, Pages, whereFor } from "./Discussions"
import { DrawnAt } from "./drawnAt"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { TheBar } from "./TheBar"
import { useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"

/**
 * What this screen draws, which is one read.
 *
 * Their discussions list is still served whole by Rails, so the rows, every category the
 * repository has and whether there is another page all arrive in the one document. Their own
 * page spends more than that on the same screen: a hovercard route per row, a vote form per row
 * and a menu route per row, none of which is asked for here.
 */
export type Shown = {
  readonly rows: ReadonlyArray<ListedDiscussion>
  readonly categories: ReadonlyArray<Category>
  readonly more: boolean
}

export type DiscussionsScreenProps = {
  /**
   * The whole address this screen is standing on: the repository, the category, the search and
   * the page. Every control it draws writes another one of these, so it needs all four.
   */
  readonly list: DiscussionList
  readonly load: (partly: (shown: Shown) => void) => Effect.Effect<Shown, unknown>
  /** The page as the last visit left it, painted while the live read is in the air. */
  readonly preload?: () => Effect.Effect<Option.Option<Shown>>
  /** Restores GitHub's own list, which is still on the page behind this. */
  readonly onStepAside: () => void
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string
  /** The exact pathname this screen stands for, as {@link DrawnAt} needs it said. */
  readonly at?: string
}

const READING = "Reading this repository's discussions…"

/**
 * A repository's discussions, filed by who owes the next move.
 *
 * One card and not two, unlike the releases screen next door. There is no second question here:
 * somebody arriving on this page wants to know which threads are stuck, and every fact that
 * answers it is on the row already.
 */
export const DiscussionsScreen = ({
  list,
  load,
  preload,
  onStepAside,
  recallRepositories,
  where,
  at,
  signedIn = viewerOnPage
}: DiscussionsScreenProps) => {
  const named = homeName(list.home)
  const live = useLive(load, preload, where)
  const { read } = live
  const waiting = useWaiting(read.status)

  if (read.status === "failed") {
    return (
      <>
        {/* The failure screen is an answer too. See {@link DrawnAt}. */}
        <DrawnAt path={at ?? null} />
        <ReadFailed
          signedOut={!signedIn()}
          why={read.why}
          what={`The discussions of ${named}`}
          onStepAside={onStepAside}
          asideLabel="Show GitHub's list"
        />
      </>
    )
  }

  const shown = read.status === "ready" ? read.value : undefined

  return (
    // The same wrapper for the wait and for the cards, holding both in the same slots throughout:
    // the wait has to be the same element on both sides of the answer, or the dissolve has
    // nothing to start from.
    <div className="relative">
      <DrawnAt path={read.status === "loading" ? null : (at ?? null)} />
      <TheBar where={whereFor(list.home)} recall={recallRepositories} />
      {shown === undefined ? null : (
        <div className="t-panels flex flex-col gap-3 pt-2 pb-2">
          <Categories list={list} categories={shown.categories} />
          <Discussions home={list.home} discussions={shown.rows} />
          <Pages list={list} more={shown.more} />
        </div>
      )}
      {waiting ? (
        <Waiting
          what={READING}
          detail={named}
          room="list"
          leaving={shown !== undefined}
        />
      ) : null}
    </div>
  )
}
