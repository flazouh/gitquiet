import type { Effect, Option } from "effect"
import { useCallback } from "react"
import type { RepoRef } from "../domain/PullRequestRef"
import { type Away, curated, putAwayEntry, putAwayIn, putAwayKey } from "../domain/putAway"
import type { Repository } from "../domain/repositories"
import type { Listed, Strand } from "../domain/strand"
import { useArt } from "./art"
import { CHIP } from "./dress"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { Strands } from "./Strands"
import { TheBar } from "./TheBar"
import { useLive } from "./useLive"
import { useSettings } from "./useSettings"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"

export type StrandsScreenProps = {
  readonly repo: RepoRef
  readonly load: () => Effect.Effect<ReadonlyArray<Strand>, unknown>
  /**
   * The list as the last visit left it, painted while the live read is in the air.
   *
   * This is the page a reader comes back to between runs, and a list that paints at once
   * and corrects itself reads as a list that never left.
   */
  readonly preload?: () => Effect.Effect<Option.Option<ReadonlyArray<Strand>>>
  /** Restores GitHub's own list, which is still on the page behind this. */
  readonly onStepAside: () => void
  /**
   * The repository list as the last visit to Home left it, for the palette behind ⌘K.
   *
   * Out of the store rather than off the network, for the reason a repository's pull request
   * list reads it that way.
   */
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string
}

const READING = "Reading this repository's runs…"

/**
 * What the fold came to, in one line above the rows.
 *
 * Both numbers, because one of them alone is the wrong answer twice over: ten rows without
 * "from 25 runs" looks like a quiet repository, and 25 without the ten hides the whole point
 * of the screen.
 */
const Tally = ({ strands, runs }: { readonly strands: number; readonly runs: number }) => (
  // Pushed to the end by itself rather than by the line, so the line holds one child on a
  // screen with nothing put away and the tally is where it has always been.
  <span className="ml-auto text-sm text-ink-muted">
    {`${strands} ${strands === 1 ? "strand" : "strands"}`}
    {runs === strands ? "" : `, from ${runs} ${runs === 1 ? "run" : "runs"}`}
  </span>
)

/**
 * What is away, above the rows, for as long as it is away.
 *
 * A decision that is remembered has to be findable, or it is a screen quietly holding
 * something back. GitHub's own Workflow filter is the opposite mistake and the reason these
 * threads exist: it holds one Workflow, applies to the list alone, and forgets on the next page
 * load. So each Workflow that is away is a press that brings it back, and the count beside it
 * says how many Runs of this page it is holding. A Workflow that has not run lately shows no
 * number, because zero on a chip reads as a result rather than as a silence.
 */
const PutAway = ({
  away,
  onBack
}: {
  readonly away: ReadonlyArray<Away>
  readonly onBack: (key: string) => void
}) => {
  const art = useArt()
  const Back = art.back

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-ink-muted">
      <span>Put away</span>
      {away.map((one) => (
        <button
          key={one.key}
          type="button"
          onClick={() => onBack(one.key)}
          aria-label={`Bring ${one.workflow} back`}
          title={
            one.runs === 0
              ? `Bring ${one.workflow} back. It has no run on this page.`
              : `Bring ${one.workflow} back, and the ${one.runs} run${
                  one.runs === 1 ? "" : "s"
                } of it this page carries.`
          }
          className={`${CHIP} flex shrink-0 items-center gap-1.5 hover:bg-active`}
        >
          <Back size={12} aria-hidden="true" />
          <span className="max-w-[10rem] truncate text-ink">{one.workflow}</span>
          {one.runs === 0 ? null : <span className="tabular-nums">{one.runs}</span>}
        </button>
      ))}
    </div>
  )
}

/**
 * A repository's Actions tab: every recent Run, folded into the work it belongs to.
 *
 * One read and no staging, because their page carries all of it in one document. The argument
 * for the Strand as the unit rather than the Run is in `docs/spec/actions.md`.
 */
export const StrandsScreen = ({
  repo,
  load,
  preload,
  onStepAside,
  recallRepositories,
  where,
  signedIn = viewerOnPage
}: StrandsScreenProps) => {
  const live = useLive(load, preload, where)
  const { read } = live
  const waiting = useWaiting(read.status)
  const { settings, change } = useSettings()

  /*
   * Both written against the settings as they stand at the moment of the press rather than
   * against this render's copy, for the reason the Rail's pin is: two presses a second apart
   * each spreading their own snapshot is how one of them silently undoes the other.
   */
  const putAway = useCallback(
    (run: Listed) =>
      change((current) => {
        const entry = putAwayEntry(repo, putAwayKey(run))
        return current.putAway.includes(entry)
          ? current
          : { ...current, putAway: [...current.putAway, entry] }
      }),
    [change, repo]
  )

  const bringBack = useCallback(
    (key: string) =>
      change((current) => ({
        ...current,
        putAway: current.putAway.filter((one) => one !== putAwayEntry(repo, key))
      })),
    [change, repo]
  )

  if (read.status === "failed") {
    return (
      <ReadFailed
        signedOut={!signedIn()}
        why={read.why}
        what={`The runs in ${repo.owner}/${repo.repo}`}
        onStepAside={onStepAside}
        asideLabel="Show GitHub's list"
      />
    )
  }

  /*
   * The reader's own curation, applied to what came back rather than to what was asked for.
   * The list is kept between visits and read whole, so bringing a Workflow back is answered
   * out of the store and never costs another trip to GitHub.
   */
  const curation =
    read.status === "ready"
      ? curated(read.value, putAwayIn(settings.putAway, repo))
      : undefined
  const strands = curation?.strands
  const runs =
    strands === undefined ? 0 : strands.reduce((running, one) => running + one.runs.length, 0)

  return (
    // The same wrapper for the wait and for the list, holding both in the same two slots
    // throughout: the wait has to be the same element on both sides of the answer, or the
    // dissolve has nothing to start from.
    <div className="relative">
      <TheBar
        where={{ kind: "repository", owner: repo.owner, repo: repo.repo }}
        recall={recallRepositories}
      />
      {strands === undefined ? null : (
        <div className="t-panels flex flex-col pt-2 pb-2">
          <div className="flex items-center gap-3 pb-1.5">
            {curation === undefined || curation.away.length === 0 ? null : (
              <PutAway away={curation.away} onBack={bringBack} />
            )}
            <Tally strands={strands.length} runs={runs} />
          </div>
          <Strands strands={strands} repo={repo} onPutAway={putAway} />
        </div>
      )}
      {waiting ? (
        <Waiting
          what={READING}
          detail={`${repo.owner}/${repo.repo}`}
          room="list"
          leaving={strands !== undefined}
        />
      ) : null}
    </div>
  )
}
