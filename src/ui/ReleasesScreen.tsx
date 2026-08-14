import { type Effect, Option } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import {
  type Attached,
  type Change,
  downloadable,
  type Platform,
  type Row,
  rowsIn,
  saidPlatform,
  type Version,
  yoursAmong
} from "../domain/release"
import type { Repository } from "../domain/repositories"
import { ASIDE, CHIP, PILL, PRESSABLE } from "./dress"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { TheBar } from "./TheBar"
import { useFreshening } from "./useFreshening"
import { useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"
import { ageOf, momentOf } from "./when"

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
}

const READING = "Reading this repository's releases…"

/** The same read, said over a list of releases that is already on the screen. */
const CHECKING = "Checking this repository's releases…"

/**
 * The one file this reader should take, as the whole of the top of the page.
 *
 * The row exists because their own page has no such row and the threads say so: the most
 * upvoted complaint about the releases page is a reader at 3,293 points asking where the
 * download button is, and it is a reader's rather than a maintainer's. Their page answers with
 * six files of equal weight, two of which nobody uploaded.
 *
 * Named only when the machine and the processor are both known and the Builds that agree come
 * down to one. Where they do not, every Build is drawn by platform instead, which is the same
 * information their page has without the guess on top of it.
 */
const Yours = ({
  version,
  attached,
  machine
}: {
  readonly version: Version
  readonly attached: Attached
  readonly machine: Platform
}) => {
  const yours = yoursAmong(attached.builds, machine)
  const said = saidPlatform(machine)

  if (Option.isSome(yours)) {
    const build = yours.value
    const rest = attached.builds.length - 1

    return (
      <div className="flex flex-col gap-1.5 pb-4">
        <a
          href={build.url}
          className="flex items-baseline gap-3 rounded-lg bg-active px-3 py-2.5 no-underline hover:bg-hover"
          title={build.digest === null ? build.name : `${build.name}\n${build.digest}`}
        >
          <span className="min-w-0 truncate font-medium text-ink">{build.name}</span>
          {build.size === "" ? null : (
            <span className="ml-auto shrink-0 tabular-nums text-ink-muted text-sm">
              {build.size}
            </span>
          )}
        </a>
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${ASIDE}`}>
          <span>
            {said} · {version.tag}
          </span>
          {rest < 1 ? null : (
            /*
             * A way to the rest, and never the rest itself. The whole value of the row above is
             * that it is one file rather than six, so the other five are a press away on their
             * own page rather than a list under a heading that says Yours.
             */
            <a href={version.url} className="text-ink-muted underline hover:text-ink">
              {rest === 1 ? "1 other file" : `${rest} other files`}
            </a>
          )}
        </div>
      </div>
    )
  }

  /*
   * Every Build, named by what it runs on, because the reader's own machine could not be told
   * from the Builds on offer. Their page draws the same files; what is added here is the platform
   * said in words beside each one, and the honesty of the line above it.
   */
  return (
    <div className="flex flex-col gap-1.5 pb-4">
      <div className={ASIDE}>
        {attached.builds.length === 0
          ? `${version.tag} has no files attached to it.`
          : `No single file is named for ${said}. Every file this version has:`}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {attached.builds.map((build) => (
          <a
            key={build.name}
            href={build.url}
            className={`${PRESSABLE} flex items-baseline gap-2 px-2.5 py-1.5 no-underline hover:bg-active`}
            title={build.digest === null ? build.name : `${build.name}\n${build.digest}`}
          >
            <span className="max-w-[18rem] truncate text-ink text-sm">{build.name}</span>
            <span className="shrink-0 text-ink-muted text-xs">{saidPlatform(build.platform)}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

/** The Version a row belongs to, said once per Version rather than once per row. */
const Tag = ({ version }: { readonly version: Version }) => (
  <span className="flex shrink-0 items-center gap-1.5">
    <a
      href={version.url}
      className={`${CHIP} tabular-nums text-ink text-xs no-underline hover:bg-active`}
      title={`${version.title}, published ${momentOf(version.at)}`}
    >
      {version.tag}
    </a>
    {version.prerelease ? <span className={`${PILL} text-ink-muted text-xs`}>Pre-release</span> : null}
  </span>
)

/**
 * One Change: the sentence, who wrote it, and the pull request it came from.
 *
 * The pull request is a link and the title is the link's text, because that is where a reader
 * goes next with a question about a Change. Their own page makes the reader find the same number
 * inside a paragraph of generated notes.
 */
const OfChange = ({
  change,
  version,
  first
}: {
  readonly change: Change
  readonly version: Version
  readonly first: boolean
}) => (
  <div className="flex items-baseline gap-3 py-1">
    <a href={change.url} className="min-w-0 text-ink no-underline hover:underline">
      {change.title}
    </a>
    <span className={`ml-auto flex shrink-0 items-center gap-2 ${ASIDE}`}>
      <span className="max-w-[9rem] truncate">{change.author}</span>
      <span className="tabular-nums">#{change.pullRequest}</span>
      {first ? <Tag version={version} /> : <span className="w-px" />}
    </span>
  </div>
)

/**
 * The Versions that said nothing, as one line rather than as one card each.
 *
 * Thirty of the sixty-seven Versions of the worked example are this, and their own page gives
 * each of them the same heading, the same author line, the same asset list and the same
 * reactions bar as a Version that changed something. Six of them in a row is six screens of
 * furniture over nothing, which is what pushes the Changes below the fold.
 *
 * Drawn rather than dropped. A tag that exists is a tag somebody may be looking for, and a
 * screen that quietly hides ten of them is a screen that cannot be trusted about the rest.
 */
const OfBare = ({ versions }: { readonly versions: ReadonlyArray<Version> }) => (
  <div className={`flex items-baseline gap-2 py-1 ${ASIDE}`}>
    <span>
      {versions.length === 1
        ? "1 version with nothing in its notes"
        : `${versions.length} versions with nothing in their notes`}
    </span>
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {versions.map((one) => (
        <a
          key={one.tag}
          href={one.url}
          className="tabular-nums text-ink-muted no-underline hover:text-ink hover:underline"
          title={`${one.title}, published ${momentOf(one.at)}`}
        >
          {one.tag}
        </a>
      ))}
    </span>
  </div>
)

/** What a Version said in prose, where it said anything past its own Changes. */
const OfRemark = ({
  version,
  first
}: {
  readonly version: Version
  readonly first: boolean
}) => (
  <div className="flex items-baseline gap-3 py-1">
    <p className="min-w-0 whitespace-pre-line text-ink text-sm">{version.remark}</p>
    <span className={`ml-auto flex shrink-0 items-center gap-2 ${ASIDE}`}>
      {first ? <Tag version={version} /> : <span className="w-px" />}
    </span>
  </div>
)

const OfRow = ({ row }: { readonly row: Row }) => {
  if (row.kind === "bare") return <OfBare versions={row.versions} />
  if (row.kind === "remark") return <OfRemark version={row.version} first={row.first} />
  return <OfChange change={row.change} version={row.version} first={row.first} />
}

/**
 * What the fold came to, in one line above the rows.
 *
 * Both numbers, because either alone is the wrong answer: eight rows without "over 10 versions"
 * looks like a quiet repository, and ten versions without the eight hides the whole point of the
 * screen. The same argument the Actions tally makes, on a page where the gap is wider.
 */
const Tally = ({
  changes,
  versions,
  newest
}: {
  readonly changes: number
  readonly versions: number
  readonly newest: string
}) => (
  <div className={`flex items-baseline gap-3 pb-1.5 ${ASIDE}`}>
    <span>
      {changes === 1 ? "1 change" : `${changes} changes`}
      {`, over ${versions === 1 ? "1 version" : `${versions} versions`}`}
    </span>
    {newest === "" ? null : <span className="ml-auto">Newest {ageOf(newest)}</span>}
  </div>
)

/**
 * A repository's releases: every Change, and the one file this reader should take.
 *
 * Two reads, and the argument for the Change as the unit rather than the Version is in
 * `docs/spec/releases.md`.
 */
export const ReleasesScreen = ({
  repo,
  load,
  preload,
  onStepAside,
  recallRepositories,
  signedIn = viewerOnPage
}: ReleasesScreenProps) => {
  const live = useLive(load, preload)
  const { read } = live
  const waiting = useWaiting(read.status)
  useFreshening(live.catchingUp, CHECKING)

  if (read.status === "failed") {
    return (
      <ReadFailed
        signedOut={!signedIn()}
        why={read.why}
        what={`The releases of ${repo.owner}/${repo.repo}`}
        onStepAside={onStepAside}
        asideLabel="Show GitHub's list"
      />
    )
  }

  const shown = read.status === "ready" ? read.value : undefined
  const rows = shown === undefined ? undefined : rowsIn(shown.versions)
  const offered = shown === undefined ? Option.none<Version>() : downloadable(shown.versions)

  return (
    // The same wrapper for the wait and for the list, holding both in the same slots throughout:
    // the wait has to be the same element on both sides of the answer, or the dissolve has
    // nothing to start from.
    <div className="relative">
      <TheBar
        where={{ kind: "repository", owner: repo.owner, repo: repo.repo }}
        recall={recallRepositories}
      />
      {shown === undefined || rows === undefined ? null : (
        <div className="t-panels flex flex-col pt-2 pb-2">
          {Option.isSome(offered) && Option.isSome(shown.attached) ? (
            <Yours
              version={offered.value}
              attached={shown.attached.value}
              machine={shown.machine}
            />
          ) : null}
          {shown.versions.length === 0 ? (
            <p className={ASIDE}>This repository has published no releases.</p>
          ) : (
            <>
              <Tally
                changes={rows.reduce(
                  (running, row) => running + (row.kind === "change" ? 1 : 0),
                  0
                )}
                versions={shown.versions.length}
                newest={shown.versions[0]?.at ?? ""}
              />
              <div className="flex flex-col">
                {rows.map((row, at) => (
                  <OfRow
                    key={
                      row.kind === "bare"
                        ? `bare-${row.versions[0]?.tag ?? at}`
                        : row.kind === "remark"
                          ? `remark-${row.version.tag}`
                          : `change-${row.change.pullRequest}`
                    }
                    row={row}
                  />
                ))}
              </div>
            </>
          )}
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
