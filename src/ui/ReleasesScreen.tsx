import { type Effect, Option } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import { type Attached, downloadable, type Platform, type Version } from "../domain/release"
import type { Repository } from "../domain/repositories"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { DrawnAt } from "./drawnAt"
import { Releases, Yours } from "./Releases"
import { TheBar } from "./TheBar"
import { useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"

/**
 * What this screen draws, in the two reads it takes to draw it.
 *
 * The Versions arrive first and are the page. The files of the newest one arrive second, because
 * their list page names no file at all and the fragment that does has to be asked for by tag, so
 * the list cannot wait on them: a reader who came to read the notes is finished before the
 * second request lands.
 */
export type Shown = {
  readonly versions: ReadonlyArray<Version>
  /** Nothing until the second read lands, and nothing where the Version has no files. */
  readonly attached: Option.Option<Attached>
  /** The reader's own machine, as much of it as the browser will say. */
  readonly machine: Platform
}

export type ReleasesScreenProps = {
  readonly repo: RepoRef
  readonly load: (partly: (shown: Shown) => void) => Effect.Effect<Shown, unknown>
  /** The list as the last visit left it, painted while the live read is in the air. */
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

const READING = "Reading this repository's releases…"

/**
 * A repository's releases: every Change, and the one file this reader should take.
 *
 * Two cards, in the order the two questions are asked. Somebody arriving here either wants the
 * software or wants to know what changed, and their own page answers neither first: it opens on
 * a version heading, an author line and a fold of generated notes, with the files behind a press
 * and no file named at all.
 */
export const ReleasesScreen = ({
  repo,
  load,
  preload,
  onStepAside,
  recallRepositories,
  where,
  at,
  signedIn = viewerOnPage
}: ReleasesScreenProps) => {
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
          what={`The releases of ${repo.owner}/${repo.repo}`}
          onStepAside={onStepAside}
          asideLabel="Show GitHub's list"
        />
      </>
    )
  }

  const shown = read.status === "ready" ? read.value : undefined
  const offered = shown === undefined ? Option.none<Version>() : downloadable(shown.versions)

  return (
    // The same wrapper for the wait and for the cards, holding both in the same slots throughout:
    // the wait has to be the same element on both sides of the answer, or the dissolve has
    // nothing to start from.
    <div className="relative">
      <DrawnAt path={read.status === "loading" ? null : (at ?? null)} />
      <TheBar
        where={{ kind: "repository", owner: repo.owner, repo: repo.repo }}
        recall={recallRepositories}
      />
      {shown === undefined ? null : (
        <div className="t-panels flex flex-col gap-3 pt-2 pb-2">
          {Option.isSome(offered) && Option.isSome(shown.attached) ? (
            <Yours
              version={offered.value}
              attached={shown.attached.value}
              machine={shown.machine}
            />
          ) : null}
          <Releases versions={shown.versions} />
        </div>
      )}
      {waiting ? (
        <Waiting
          what={READING}
          detail={`${repo.owner}/${repo.repo}`}
          room="list"
          leaving={shown !== undefined}
        />
      ) : null}
    </div>
  )
}
