import { Effect, Option } from "effect"
import { useCallback, useEffect, useState } from "react"
import type {
  About,
  Front,
  Opened,
  Standing as Stands,
  Starring,
  Touch,
  Welcome as Welcoming
} from "../domain/repoHome"
import { leadFor } from "../domain/repoHome"
import type { Repository } from "../domain/repositories"
import { mountSprite } from "./FileHeading"
import { Branches, type LoadBranches } from "./Branches"
import { ASIDE, PRESSABLE } from "./dress"
import { GitHubHtml } from "./GitHubHtml"
import { Markdown } from "./Markdown"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import type { Shelf } from "../app/shelf"
import { Reading } from "./ReadingPane"
import { RepoTree } from "./RepoTree"
import { Languages, Standing, useStanding } from "./Standing"
import { Star } from "./Star"
import { TheBar } from "./TheBar"
import { useUpdated } from "./useUpdated"
import { type Load, useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"

export type RepoHomeScreenProps = {
  readonly repo: { readonly owner: string; readonly repo: string }
  readonly load: Load<Front>
  readonly preload?: () => Effect.Effect<Option.Option<Front>>
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string
  /** Restores GitHub's own page, which is still behind this one. */
  readonly onStepAside: () => void
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
  /** Stars the repository, or takes the star back. */
  readonly onStar?: (to: Starring) => Effect.Effect<void, unknown>
  /**
   * The contributors, languages, releases and the rest of it.
   *
   * Its own read rather than part of `load`, because nothing on this page waits
   * for it: the file list and the README are drawn from a payload already in the
   * document, and this is a second request that fills the card in behind them.
   */
  readonly loadStanding?: () => Effect.Effect<Stands, unknown>
  /**
   * Every path in the repository, for the folders in the tree.
   *
   * Behind the root rather than in front of it. The root is in the page payload
   * and the tree is drawn from it at once; this is the rest, and it arrives.
   */
  readonly loadPaths?: (sha: string) => Effect.Effect<ReadonlyArray<string>, unknown>
  /**
   * Last commits under one folder, for nested rows of the tree.
   *
   * Asked when a folder opens. The root column arrives with the page; this is
   * one directory at a time, because that is how their route answers.
   *
   * Two stages, as the page itself has: `partly` is the messages and the dates,
   * and the answer is the same column with its faces read behind them.
   */
  readonly loadTouches?: (
    sha: string,
    folder: string,
    partly: (touches: ReadonlyMap<string, Touch>) => void
  ) => Effect.Effect<ReadonlyMap<string, Touch>, unknown>
  /**
   * Every branch, for the picker over the tree.
   *
   * Read when the picker is opened and not before: a repository has a thousand
   * branches at twenty-two kilobytes, and most readers never press it.
   */
  readonly loadBranches?: LoadBranches
  /**
   * The files of this repository, warmed by the pointer and read once.
   *
   * The pane asks it for the file the address names, and the tree warms the
   * row under the pointer, so the usual press opens a file already in hand.
   */
  readonly shelf?: Shelf
  /**
   * The README's own text, so it is parsed here rather than taken as their HTML.
   *
   * Its own read and not part of `load`, for the reason every other read on this
   * page is: the page is drawn from a payload already in the document, and this
   * is a request behind it that replaces one block when it lands. Nothing waits
   * for it, and a refusal leaves GitHub's rendering where it was.
   */
  readonly loadReadme?: (branch: string, path: string) => Effect.Effect<string, unknown>
  /** The file the address names, or nothing for the README. */
  readonly reading?: string | null
  /** The branch GitHub resolved for a file link, when it differs from the tree. */
  readonly readingBranch?: string
  /** A file was chosen in the tree. The address follows. */
  readonly onRead?: (path: string | null) => void
}

const WORKING = "Reading this repository…"

const UPDATED = "Repository updated"

/**
 * How many topics fit on a line that has a description and a star on it too.
 *
 * Three. A popular repository carries a dozen, and the twelfth is not what a
 * reader is on this page for; the first three say what kind of thing it is,
 * which is the whole job of the row.
 */
const TOPICS = 3

/**
 * The tree, and it is never anywhere but on this page.
 *
 * Six separate attempts have hidden this list behind a toggle, and all six are
 * gone. They failed the same way rather than for six reasons: a file list that
 * disappears reads as a page that broke. Refined GitHub's maintainer collected
 * the bug reports — "we've had at least a couple of confused users reporting this
 * as a bug" — and dropped the feature. So the order of this page changes and its
 * contents do not.
 */
const Files = ({
  front,
  repo,
  loadPaths,
  loadTouches,
  loadBranches,
  reading,
  onOpen,
  onNear
}: {
  readonly front: Front
  readonly repo: RepoHomeScreenProps["repo"]
  readonly loadPaths?: RepoHomeScreenProps["loadPaths"]
  readonly loadTouches?: RepoHomeScreenProps["loadTouches"]
  readonly loadBranches?: LoadBranches
  readonly reading: string | null
  readonly onOpen: (path: string) => void
  readonly onNear?: (path: string) => void
}) => (
  /*
   * A definite height, so the tree scrolls inside the card while the README
   * scrolls the page, which is the arrangement every editor uses.
   */
  <section
    aria-label="Files"
    className="flex h-96 min-h-0 flex-col overflow-hidden rounded-lg border border-line lg:h-auto lg:flex-1"
  >
    {/*
     * The branch and the history, over the tree they are about.
     *
     * Where GitHub puts them, and the reason is not habit: a branch name is the
     * answer to "which of these files am I looking at", and that question is
     * only asked once the files are in front of you. Printed on a card above,
     * beside a description, it read as a stray word.
     */}
    <div className="flex shrink-0 items-center gap-2 px-2 pt-2 pb-1.5 text-xs">
      <Branches
        at={(name) => `/${repo.owner}/${repo.repo}/tree/${name}`}
        on={front.branch}
        load={loadBranches}
        onGo={(path) => window.location.assign(path)}
        dress={`flex items-center gap-1.5 px-2 py-1 text-xs text-ink hover:bg-active ${PRESSABLE}`}
      />
      {Option.match(front.commits, {
        onNone: () => null,
        onSome: (many) => (
          <a
            href={`/${repo.owner}/${repo.repo}/commits/${front.branch}`}
            className="text-ink-muted hover:underline"
          >
            {many.toLocaleString()} commits
          </a>
        )
      })}
    </div>
    <RepoTree
      entries={front.entries}
      repo={repo}
      branch={front.branch}
      head={front.head}
      loadPaths={loadPaths}
      loadTouches={loadTouches}
      reading={reading}
      onOpen={onOpen}
      onNear={onNear}
    />
  </section>
)

/**
 * The right-hand column: what it is written in, over what it is written in.
 *
 * One block rather than two, so the languages sit over the tree they describe.
 * The column takes the window's height, the languages take what they need off
 * the top, and the tree takes the rest and scrolls inside it while the README
 * scrolls the page.
 */
const Beside = ({
  front,
  repo,
  loadPaths,
  loadTouches,
  loadBranches,
  stands,
  reading,
  onOpen,
  onNear
}: {
  readonly front: Front
  readonly repo: RepoHomeScreenProps["repo"]
  readonly loadPaths?: RepoHomeScreenProps["loadPaths"]
  readonly loadTouches?: RepoHomeScreenProps["loadTouches"]
  readonly loadBranches?: LoadBranches
  readonly stands: Stands | undefined
  readonly reading: string | null
  readonly onOpen: (path: string) => void
  readonly onNear?: (path: string) => void
}) => (
  <div className="flex min-w-0 flex-col gap-1 lg:sticky lg:top-3 lg:col-start-2 lg:row-start-2 lg:h-[calc(100vh-5.5rem)]">
    <Languages stands={stands} />
    <Files
      front={front}
      repo={repo}
      loadPaths={loadPaths}
      loadTouches={loadTouches}
      loadBranches={loadBranches}
      reading={reading}
      onOpen={onOpen}
      onNear={onNear}
    />
  </div>
)

/**
 * The README's own text, read once, with their rendering standing in until it lands.
 *
 * A README is markdown, and every other markdown on this interface is parsed
 * here. Taken as their HTML it wears their table, their headings and their code
 * fences, which is a second interface inside this one on the page most readers
 * meet first — and it is the page whose own tables are the product's vocabulary.
 *
 * Their rendering is what the first paint uses, because it is already in hand at
 * no request and no wait. The source replaces it when it arrives, and stays away
 * where the read was refused: a README in their chrome beats no README.
 *
 * Nothing is asked for where GitHub gave up rendering it. That is their word for
 * a file too large for their own page, and the screen says so instead.
 */
const useSource = (
  welcome: Welcoming,
  branch: string,
  load: RepoHomeScreenProps["loadReadme"]
): string | undefined => {
  const [source, setSource] = useState<string>()
  const { path, timedOut } = welcome

  useEffect(() => {
    if (load === undefined || timedOut) return
    let wanted = true

    void Effect.runPromise(
      load(branch, path).pipe(
        Effect.match({
          onSuccess: (text) => {
            if (wanted) setSource(text)
          },
          onFailure: () => {}
        })
      )
    )

    return () => {
      wanted = false
    }
  }, [load, branch, path, timedOut])

  return source
}

/**
 * The README.
 *
 * Held to a measure, which is the one thing on this page that is. Everywhere else
 * gitquiet takes the width of the window, because a row of file names and commit
 * messages gains from every pixel. This is prose, and a line of prose that runs
 * fourteen hundred pixels is a line nobody can follow back to its start.
 *
 * Beside the files rather than under them, where there is room for both. Stacked,
 * this is the tallest thing on the page by a long way — a README of any substance
 * is several screens — and the file list a reader came for sits underneath all of
 * it. Side by side, neither one pushes the other off the screen, and the column
 * does the measuring that `max-w` used to.
 *
 * `content-visibility: auto` on the wrapper, which is the line that keeps a long
 * README off the critical path: the browser lays out what is on the screen and
 * skips the rest until it is scrolled to.
 */
const Readme = ({
  welcome,
  repo,
  branch,
  loadReadme
}: {
  readonly welcome: Welcoming
  readonly repo: RepoHomeScreenProps["repo"]
  readonly branch: string
  readonly loadReadme: RepoHomeScreenProps["loadReadme"]
}) => {
  const source = useSource(welcome, branch, loadReadme)

  return (
    <section
      aria-label="Readme"
      className="max-w-4xl rounded-lg border border-line px-6 py-5 lg:col-start-1 lg:row-start-2"
    >
      <h2 className="mb-4 text-sm font-semibold text-ink-muted">{welcome.name}</h2>
      {welcome.timedOut ? (
        <p className="text-sm text-ink-muted">
          GitHub could not render this README. It is too large for their own page as well.
        </p>
      ) : (
        <div style={{ contentVisibility: "auto", containIntrinsicSize: "auto 1200px" }}>
          {source === undefined ? (
            <GitHubHtml html={welcome.html} />
          ) : (
            <Markdown
              markdown={source}
              owner={repo.owner}
              repo={repo.repo}
              branch={branch}
              at={welcome.path}
            />
          )}
        </div>
      )}
    </section>
  )
}

const Welcome = ({
  front,
  loadReadme
}: {
  readonly front: Front
  readonly loadReadme: RepoHomeScreenProps["loadReadme"]
}) =>
  Option.match(front.welcome, {
    onNone: () => null,
    onSome: (welcome) => (
      <Readme
        welcome={welcome}
        repo={front.repo}
        branch={front.branch}
        loadReadme={loadReadme}
      />
    )
  })

/**
 * One of the numbers, or nothing where there is nothing to say.
 *
 * A zero is dropped rather than drawn. "0 stars 0 forks" was on every private
 * repository this was tried on, which is three words saying that nobody has
 * starred something nobody outside the company can see.
 */
const Count = ({ many, what }: { readonly many: Option.Option<number>; readonly what: string }) =>
  Option.match(many, {
    onNone: () => null,
    onSome: (count) =>
      count === 0 ? null : (
        // Sized here rather than inherited. Left to inherit it came out at the
        // root's sixteen pixels, beside a description at fourteen and a
        // contributor count at twelve: three sizes on one row, and a row of
        // three sizes does not look like a row.
        <span className={`shrink-0 ${ASIDE}`}>
          {count.toLocaleString()} {what}
        </span>
      )
  })

/**
 * What the repository says it is, and the numbers people judge it by.
 *
 * A card rather than a line of muted text over the top of the page. The two
 * blocks under it are cards, and a heading that is not one reads as something
 * left over from the page underneath rather than as part of this one.
 */
const Facts = ({
  about,
  onStar,
  stands
}: {
  readonly about: About
  readonly onStar?: RepoHomeScreenProps["onStar"]
  readonly stands: Stands | undefined
}) => (
  /*
   * One line, and everything on it sits on the same centre.
   *
   * `items-center` rather than `items-start`: the things on this row are a
   * twenty-pixel face, a twelve-pixel word and a twenty-eight-pixel button, and
   * hung from their tops they read as three rows that failed to line up.
   */
  <section
    aria-label="About"
    className="flex min-w-0 items-center gap-3 rounded-lg border border-line px-4 py-2 lg:col-span-2 lg:row-start-1"
  >
    {Option.match(about.description, {
      onNone: () => null,
      onSome: (said) => (
        // The one line on this page that is a heading. The repository's name is
        // in the bar above and says which repository this is; this says what it
        // is, which is the question a reader arrived with, so it is the largest
        // thing on the row and the only thing on it at full ink.
        <p className="min-w-0 shrink truncate text-base font-medium leading-6 text-ink" title={said}>
          {said}
        </p>
      )
    })}
    {/*
     * The branch and the commit count are not here. They belong over the file
     * list, which is where GitHub keeps them and where they mean something:
     * "main" and "1,411 commits" beside a description are two facts about a
     * tree, printed above a card that is not the tree.
     */}
    <Count many={about.forks} what="forks" />
    {about.topics.length === 0 ? null : (
      <p className={`hidden shrink-0 items-center gap-2 xl:flex ${ASIDE}`}>
        {about.topics.slice(0, TOPICS).map((topic) => (
          <span key={topic} className="rounded-full bg-surface px-2 py-0.5">
            {topic}
          </span>
        ))}
      </p>
    )}
    <Standing stands={stands} />
    {/*
     * Pushed to the right edge and kept there. It is the one control on this row
     * and the only thing on the page a reader presses without reading anything
     * first, so it belongs in the corner where it is always the same distance
     * from the same edge — not wherever the description and the contributor
     * count happen to leave it.
     */}
    <span className="ml-auto shrink-0">
      <Star starring={about.starring} count={about.stars} onStar={onStar} />
    </span>
  </section>
)

/** What the left column is showing: the README, or the file the address names. */
const Paper = ({
  front,
  reading,
  readingBranch,
  opened,
  loadReadme,
  onRead
}: {
  readonly front: Front
  readonly reading: string | null
  readonly readingBranch?: string
  readonly opened: Read
  readonly loadReadme: RepoHomeScreenProps["loadReadme"]
  readonly onRead?: (path: string | null) => void
}) =>
  reading === null ? (
    <Welcome front={front} loadReadme={loadReadme} />
  ) : (
    <Reading
      path={reading}
      opened={opened.file}
      failed={opened.failed}
      repo={front.repo}
      branch={readingBranch ?? front.branch}
      onClose={() => onRead?.(null)}
    />
  )

type Read = {
  /** The branch and file this answer is about, so another answer is ignored. */
  readonly of: { readonly branch: string; readonly path: string } | null
  readonly file: Opened | undefined
  readonly failed: boolean
}

const NOTHING: Read = { of: null, file: undefined, failed: false }

/**
 * The file the address names.
 *
 * The shelf is asked during the render rather than in an effect, and that is
 * the whole of what makes a warmed file open with no waiting state: an effect
 * runs after the paint, so a pane that learns it already has the file that way
 * still shows "Reading this file…" for a frame. A file that is in hand is drawn
 * in the first render of the press.
 *
 * State is only for the read that has to happen. An answer names the file it is
 * about, because pressing four rows in a second must leave the fourth on the
 * screen and not whichever request was slowest.
 */
const useOpened = (
  reading: string | null,
  branch: string | undefined,
  shelf: Shelf | undefined
): Read => {
  const [arrived, setArrived] = useState<Read>(NOTHING)
  const held = reading === null || branch === undefined ? undefined : shelf?.held(branch, reading)

  useEffect(() => {
    if (reading === null || branch === undefined || shelf === undefined) return
    if (shelf.held(branch, reading) !== undefined) return
    let wanted = true

    void Effect.runPromise(
      shelf.ask(branch, reading).pipe(
        Effect.match({
          onSuccess: (file) => {
            if (wanted) setArrived({ of: { branch, path: reading }, file, failed: false })
          },
          onFailure: () => {
            if (wanted) setArrived({ of: { branch, path: reading }, file: undefined, failed: true })
          }
        })
      )
    )

    return () => {
      wanted = false
    }
  }, [reading, branch, shelf])

  if (reading === null) return NOTHING
  if (held !== undefined && branch !== undefined) {
    return { of: { branch, path: reading }, file: held, failed: false }
  }
  return arrived.of?.branch === branch && arrived.of?.path === reading ? arrived : NOTHING
}

/**
 * A repository's front page.
 *
 * Both blocks are on the page for every reader, which is the part that matters
 * and the part six other attempts got wrong; see `src/domain/repoHome.ts`.
 *
         * Wide enough for two columns, the question of which comes first does not arise:
 * the README is on the left and the files are on the right, and neither is below
 * the fold. Narrow, one has to be first, and whether the reader can push decides
 * it. A Caller came to find out what this is, so they get the README. A Keeper
 * wrote it, so they get the files.
 */
export const RepoHomeScreen = ({
  repo,
  load,
  preload,
  where,
  onStepAside,
  recallRepositories,
  signedIn = viewerOnPage,
  onStar,
  loadStanding,
  loadPaths,
  loadTouches,
  loadBranches,
  loadReadme,
  shelf,
  reading = null,
  readingBranch,
  onRead
}: RepoHomeScreenProps) => {
  const live = useLive(load, preload, where)
  const { read } = live
  const waiting = useWaiting(read.status)
  useUpdated(live.catchingUp, read.status === "ready" ? read.value : undefined, UPDATED)

  // One read for two cards. The languages are their own card over the tree and
  // the people are on the row above, and both arrive in the same answer.
  const stands = useStanding(loadStanding)

  const front = read.status === "ready" ? read.value : undefined
  const opened = useOpened(reading, readingBranch ?? front?.branch, shelf)

  // The pointer resting on a row, on the branch the page is of. Held steady so
  // the tree, which reads its options once, is not rebuilt for a new function.
  const branch = front?.branch
  const warm = useCallback(
    (path: string) => {
      if (branch !== undefined) shelf?.warm(branch, path)
    },
    [shelf, branch]
  )

  // The Material symbols, once per document. The rows reference them by id, and a
  // reference resolves only against a sheet that is really in the page.
  useEffect(() => {
    mountSprite(document)
  }, [])

  if (read.status === "failed") {
    return (
      <ReadFailed
        signedOut={!signedIn()}
        why={read.why}
        what={`${repo.owner}/${repo.repo}`}
        onStepAside={onStepAside}
        asideLabel="Show GitHub's page"
      />
    )
  }

  const welcomeFirst = front !== undefined && leadFor(front.footing) === "welcome"

  return (
    <div className="relative">
      <TheBar
        where={{ kind: "repository", owner: repo.owner, repo: repo.repo }}
        recall={recallRepositories}
      />
      {front === undefined ? null : (
        /*
         * One column narrow, two columns wide, and the document order is the
         * narrow one. Which side each block takes is said outright rather than
         * left to the grid, because the order below is the reading order a
         * Caller and a Keeper each need and it must not decide the sides as
         * well: the files belong on the left for both of them.
         *
         * Two columns from 1024, which is lower than it wants to be and lower
         * for a reason. At 1280 a full-screen window on a laptop is 1256 and
         * falls on the stacked side of it, which is the arrangement this exists
         * to get away from: a README of any length puts the file list a screen
         * and a half down the page. Four hundred pixels of file column truncates
         * the commit message, and a truncated message beats a hidden list.
         */
        <div className="grid gap-1 py-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <Facts about={front.about} onStar={onStar} stands={stands} />
          {welcomeFirst ? (
            <>
              <Paper
                front={front}
                reading={reading}
                readingBranch={readingBranch}
                opened={opened}
                loadReadme={loadReadme}
                onRead={onRead}
              />
              <Beside
                front={front}
                repo={repo}
                loadPaths={loadPaths}
                loadTouches={loadTouches}
                loadBranches={loadBranches}
                stands={stands}
                reading={reading}
                onOpen={(path) => onRead?.(path)}
                onNear={warm}
              />
            </>
          ) : (
            <>
              <Beside
                front={front}
                repo={repo}
                loadPaths={loadPaths}
                loadTouches={loadTouches}
                loadBranches={loadBranches}
                stands={stands}
                reading={reading}
                onOpen={(path) => onRead?.(path)}
                onNear={warm}
              />
              <Paper
                front={front}
                reading={reading}
                readingBranch={readingBranch}
                opened={opened}
                loadReadme={loadReadme}
                onRead={onRead}
              />
            </>
          )}
        </div>
      )}
      {waiting ? (
        <Waiting
          what={WORKING}
          detail={`${repo.owner}/${repo.repo}`}
          room="list"
          leaving={front !== undefined}
        />
      ) : null}
    </div>
  )
}
