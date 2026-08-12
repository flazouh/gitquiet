import type { CheckState } from "../domain/PullRequest"
import type { RepoRef } from "../domain/PullRequestRef"
import type { Listed, Strand } from "../domain/strand"
import { useArt } from "./art"
import { CHIP } from "./dress"
import { CHECK_TONE, checkArt } from "./Icon"
import { ageOf, momentOf } from "./when"

/**
 * How long something took, in the units their own view prints it in.
 *
 * The same wording the run screen uses, deliberately: a reader moving between the list and a
 * run should not have to read two dialects of the same number.
 */
const said = (seconds: number): string =>
  seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`

const WORD_OF: Record<CheckState, string> = {
  succeeded: "Success",
  failed: "Failure",
  // A Run itself is never this: the word is said of a Job whose failure its Run
  // carried on past, and a Run of such a Job concludes a success. It is here
  // because the outcome a row prints is one vocabulary and this is one of its
  // words.
  tolerated: "Allowed to fail",
  running: "In progress",
  queued: "Queued",
  cancelled: "Cancelled",
  skipped: "Skipped",
  neutral: "Neutral"
}

/**
 * The Run a press on the row opens.
 *
 * The one that explains the standing, which is the workflow that made the Strand red where one
 * did and the newest otherwise. A reader pressing a red row is asking what went wrong, so
 * opening the green workflow beside it would answer a question nobody asked.
 *
 * Out of `latest` and not out of every Run, so a press never lands on an attempt that a
 * re-run has already answered for.
 */
const explains = (strand: Strand): Listed | undefined =>
  strand.latest.find((one) => one.state === strand.state) ?? strand.latest[0]

/**
 * What one workflow of the head came to, as a chip beside the others.
 *
 * The workflow's name and how it went, because that is what the row cannot say once several
 * Runs are folded into it: a `ci` run and a `CodeQL` run of one commit are two outcomes and
 * the reader needs to see which of them is the red one.
 *
 * Where the screen can remember it, the chip carries the press that puts the Workflow away.
 * Here because this is the one place on the screen where a reader is already looking at the
 * Workflow they want gone: a pane of every Workflow in the repository would be their sidebar
 * built again, and `ACTIONS` in `src/ui/place.ts` says why this screen does not have one.
 */
const OfHead = ({
  run,
  onPutAway
}: {
  readonly run: Listed
  readonly onPutAway?: (run: Listed) => void
}) => {
  const art = useArt()
  const Mark = checkArt(art, run.state)
  const Away = art.close

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <a
        className={`${CHIP} flex shrink-0 items-center gap-1.5 no-underline hover:bg-hover`}
        href={run.url}
        title={`${run.workflow} ${WORD_OF[run.state].toLowerCase()}, run #${run.number}`}
      >
        <Mark size={12} aria-hidden="true" className={CHECK_TONE[run.state]} />
        <span className="max-w-[10rem] truncate text-ink">{run.workflow}</span>
        {run.seconds === 0 ? null : (
          <span className="tabular-nums text-ink-muted">{said(run.seconds)}</span>
        )}
      </a>
      {onPutAway === undefined ? null : (
        <button
          type="button"
          onClick={() => onPutAway(run)}
          aria-label={`Put ${run.workflow} away`}
          title={`Put ${run.workflow} away in this repository, until you bring it back`}
          /*
           * Always drawn and dim until it is pointed at, which is the trade the Rail's pin
           * settled: "row actions only appear on hover" is its own complaint in their threads,
           * and a full-strength cross beside every chip would read as a warning about each one.
           */
          className="grid size-5 shrink-0 place-items-center rounded text-ink-muted opacity-50 hover:bg-hover hover:opacity-100"
        >
          <Away size={12} />
        </button>
      )}
    </span>
  )
}

/**
 * One Strand: the work, and what its head came to.
 *
 * Two kinds of Run are counted rather than drawn, and they are different kinds. An attempt a
 * re-run has answered for is superseded; a Run against a commit the work has moved past is
 * earlier. Neither is the standing of the head, and drawing either as a chip beside the one
 * that is puts two answers to one question on the row.
 */
const Row = ({
  strand,
  repo,
  onPutAway
}: {
  readonly strand: Strand
  readonly repo: RepoRef
  readonly onPutAway?: (run: Listed) => void
}) => {
  const art = useArt()
  const Mark = checkArt(art, strand.state)
  const opens = explains(strand)
  const age = ageOf(strand.startedAt)

  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-hover">
      <span
        aria-label={WORD_OF[strand.state]}
        className={`mt-0.5 shrink-0 ${CHECK_TONE[strand.state]}`}
      >
        <Mark size={16} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {/* The commit's title, which is what the work is. Pressing it opens the Run that
              explains the standing rather than the newest one: see `explains`. */}
          <a
            className="min-w-0 flex-1 truncate text-sm font-semibold text-ink no-underline hover:underline"
            href={opens?.url ?? `/${repo.owner}/${repo.repo}/actions`}
          >
            {strand.head}
          </a>

          {strand.pullRequest === null ? null : (
            <a
              className="shrink-0 text-sm tabular-nums text-ink-muted no-underline hover:underline"
              href={`/${repo.owner}/${repo.repo}/pull/${strand.pullRequest}`}
            >
              {`#${strand.pullRequest}`}
            </a>
          )}

          {age === "" ? null : (
            <span className="shrink-0 text-xs text-ink-muted" title={momentOf(strand.startedAt)}>
              {age}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
          {strand.branch === null ? (
            /* A pull ref with no branch row of its own. Their own page shows the ref and
               that is all there is to show. */
            <span className={`${CHIP} shrink-0 font-mono`}>{`pull/${strand.pullRequest}`}</span>
          ) : (
            <a
              className={`${CHIP} min-w-0 max-w-[20rem] truncate font-mono text-ink no-underline hover:underline`}
              href={`/${repo.owner}/${repo.repo}/tree/${strand.branch}`}
              title={strand.branch}
            >
              {strand.branch}
            </a>
          )}

          {strand.latest.map((run) => (
            <OfHead key={run.run} run={run} onPutAway={onPutAway} />
          ))}

          {strand.superseded === 0 ? null : (
            <span className="shrink-0" title="Attempts a re-run has answered for">
              {`${strand.superseded} superseded`}
            </span>
          )}

          {strand.earlier === 0 ? null : (
            <span className="shrink-0">{`${strand.earlier} on earlier commits`}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * A repository's runs, one row per Strand.
 *
 * Every Run of one pull request in one row, which is the whole of this screen: their own page
 * put twenty-five rows on the screen to describe ten pull requests, and a reader looking for
 * the red one read the same commit title three times on the way past it.
 */
export const Strands = ({
  strands,
  repo,
  onPutAway
}: {
  readonly strands: ReadonlyArray<Strand>
  readonly repo: RepoRef
  /** Puts one Run's Workflow away. Left out where there is nowhere to remember the decision. */
  readonly onPutAway?: (run: Listed) => void
}) => {
  if (strands.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-ink-muted">
        Nothing has run in this repository yet.
      </p>
    )
  }

  return (
    <section
      aria-label="Runs"
      className="t-panel-fade overflow-hidden rounded-md border border-line bg-surface"
    >
      {strands.map((strand) => (
        <div
          key={`${strand.pullRequest ?? ""}:${strand.branch ?? ""}`}
          className="border-t border-line-muted first:border-t-0"
        >
          <Row strand={strand} repo={repo} onPutAway={onPutAway} />
        </div>
      ))}
    </section>
  )
}
