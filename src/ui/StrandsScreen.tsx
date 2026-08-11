import type { Effect, Option } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import type { Repository } from "../domain/repositories"
import type { Strand } from "../domain/strand"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { Strands } from "./Strands"
import { TheBar } from "./TheBar"
import { useFreshening } from "./useFreshening"
import { useLive } from "./useLive"
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
}

const READING = "Reading this repository's runs…"

/** The same read, said over a list of runs that is already on the screen. */
const CHECKING = "Checking this repository's runs…"

/**
 * What the fold came to, in one line above the rows.
 *
 * Both numbers, because one of them alone is the wrong answer twice over: ten rows without
 * "from 25 runs" looks like a quiet repository, and 25 without the ten hides the whole point
 * of the screen.
 */
const Tally = ({ strands, runs }: { readonly strands: number; readonly runs: number }) => (
  <span className="text-sm text-ink-muted">
    {`${strands} ${strands === 1 ? "strand" : "strands"}`}
    {runs === strands ? "" : `, from ${runs} ${runs === 1 ? "run" : "runs"}`}
  </span>
)

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
  signedIn = viewerOnPage
}: StrandsScreenProps) => {
  const live = useLive(load, preload)
  const { read } = live
  const waiting = useWaiting(read.status)
  useFreshening(live.catchingUp, CHECKING)

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

  const strands = read.status === "ready" ? read.value : undefined
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
          <div className="flex items-center justify-end pb-1.5">
            <Tally strands={strands.length} runs={runs} />
          </div>
          <Strands strands={strands} repo={repo} />
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
