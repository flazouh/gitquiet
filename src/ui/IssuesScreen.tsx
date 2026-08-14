import { type Effect, Option } from "effect"
import { useMemo } from "react"
import type { ListedIssues } from "../app/issueList"
import type { Owed } from "../domain/finding"
import { owedIssues } from "../domain/finding"
import { pathOf } from "../domain/issueDashboard"
import { INVOLVEMENTS, type Involvement } from "../domain/issues"
import type { Repository } from "../domain/repositories"
import { HERE } from "./dress"
import { IssueList } from "./IssueList"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { TheBar } from "./TheBar"
import { useFreshening } from "./useFreshening"
import { type Load, useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"

export type IssuesScreenProps = {
  /** Which of the three questions this page is asking, which is which tab is on. */
  readonly involvement: Involvement
  readonly load: Load<ListedIssues>
  readonly preload?: () => Effect.Effect<Option.Option<ListedIssues>>
  /** Restores GitHub's own list, which is still on the page behind this. */
  readonly onStepAside: () => void
  /** Goes to another page of the same tab, by changing the address GitHub reads. */
  readonly onPage: (page: number) => void
  /** Goes to another tab. */
  readonly onGo: (involvement: Involvement) => void
  /**
   * What the address already asked for, where it asked for anything.
   *
   * The rows were fetched by it, so the box has to say it. Only the terms the
   * box can act on reach here — `src/domain/issueDashboard.ts` decides which —
   * because the rest of GitHub's vocabulary would be read as words to find in a
   * title.
   */
  readonly seed?: string
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
}

/**
 * What each tab is called, and what it means when it is empty.
 *
 * GitHub calls the middle one Created and everything here calls the same fact
 * authored. Their word is what the tab says, because the tab stands where
 * theirs stood and a reader comparing the two pages should find the same three
 * words in the same order.
 */
const TAB: Record<Involvement, { readonly name: string; readonly nothing: string }> = {
  assigned: { name: "Assigned", nothing: "No open issues are assigned to you." },
  authored: { name: "Created", nothing: "You have no open issues." },
  mentioned: { name: "Mentioned", nothing: "No open issues mention you." }
}

/** What the refusal calls this list, which has to read as a sentence. */
const WHAT: Record<Involvement, string> = {
  assigned: "The issues assigned to you",
  authored: "The issues you raised",
  mentioned: "The issues that mention you"
}

/** One array for every read that has nothing to offer, so a fold cannot spin on a new one. */
const NOTHING: ReadonlyArray<Owed> = []

const WORKING = "Reading your issues…"

/** The same read, said over a list that is already on the screen. */
const CHECKING = "Checking your issues…"

/**
 * GitHub's three tabs, as tabs.
 *
 * Links rather than buttons underneath, because each one is an address: a
 * reader can copy it, keep it, or open it beside this one. The press is caught
 * here so the screen decides where it goes, which is the same address the link
 * carries — the interception buys the decision, not a faster navigation.
 *
 * Their own modifiers are left alone, so a tab opened into a new window is
 * still a tab opened into a new window.
 */
const Tabs = ({
  on,
  onGo
}: {
  readonly on: Involvement
  readonly onGo: (involvement: Involvement) => void
}) => (
  <div role="tablist" aria-label="Your issues" className="flex items-center gap-1">
    {INVOLVEMENTS.map((involvement) => {
      const here = involvement === on

      return (
        <a
          key={involvement}
          role="tab"
          aria-selected={here}
          href={pathOf(involvement)}
          onClick={(event) => {
            // Their own modifiers still mean what they always mean: a tab
            // opened in a new window is a tab this page has no business
            // intercepting.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            onGo(involvement)
          }}
          className={`flex h-8 shrink-0 items-center rounded-md px-2.5 text-xs no-underline ${
            here
              ? `${HERE} font-semibold`
              : "bg-hover text-ink-muted hover:bg-active hover:text-ink"
          }`}
        >
          {TAB[involvement].name}
        </a>
      )
    })}
  </div>
)

/**
 * Every issue the reader is party to — `/issues`.
 *
 * One tab at a time and no Courts, which is the difference from Home. Home asks
 * all three questions at once and files the answers by what the reader owes,
 * because its job is to say what to do next across every kind of work. This
 * page was asked for by somebody who pressed one of the three, so the question
 * is already written on the tab: a Court over these rows would be a heading
 * that says what the tab above it says.
 *
 * The rows name their repositories, unlike a repository's own list. They come
 * from everywhere, so the repository is the first thing worth knowing about
 * each one rather than the one thing every row shares.
 */
export const IssuesScreen = ({
  involvement,
  recallRepositories,
  load,
  preload,
  onStepAside,
  onPage,
  onGo,
  seed,
  signedIn = viewerOnPage
}: IssuesScreenProps) => {
  const live = useLive(load, preload)
  const { read } = live
  const waiting = useWaiting(read.status)
  useFreshening(live.catchingUp, CHECKING)

  /*
   * What ⌘K searches beside the repositories, for the reason the Working Set gives: a
   * title half-remembered is the usual way back to a row, and every one of them is
   * already on this screen. Read here rather than below the failure, because a hook
   * cannot stand after a return.
   */
  const owed = useMemo(
    () => (read.status === "ready" ? owedIssues(read.value.rows) : NOTHING),
    [read]
  )

  if (read.status === "failed") {
    return (
      <ReadFailed
        signedOut={!signedIn()}
        why={read.why}
        what={WHAT[involvement]}
        onStepAside={onStepAside}
        asideLabel="Show GitHub's list"
      />
    )
  }

  const listed = read.status === "ready" ? read.value : undefined

  return (
    // The same wrapper for the wait and for the list, holding both in the same
    // two slots throughout: the wait has to be the same element on both sides of
    // the answer or the dissolve has nothing to start from.
    <div className="relative">
      <TheBar where={{ kind: "home" }} recall={recallRepositories} owed={owed} />
      {listed === undefined ? null : (
        <div className="t-panels flex flex-col gap-1 py-3">
          <Tabs on={involvement} onGo={onGo} />
          <IssueList
            listed={listed}
            what="your issues"
            seed={seed}
            nothing={TAB[involvement].nothing}
            onPage={onPage}
          />
        </div>
      )}
      {waiting ? (
        <Waiting
          what={WORKING}
          detail={TAB[involvement].name}
          room="list"
          leaving={listed !== undefined}
        />
      ) : null}
    </div>
  )
}
