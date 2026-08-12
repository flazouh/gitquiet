import { Effect, Option } from "effect"
import { useState } from "react"
import {
  type CommitList,
  type Day,
  type History as Read,
  type Landed,
  pageAfter,
  pageBefore
} from "../domain/commitList"
import { checkName, useArt } from "./art"
import { CHIP, PRESSABLE } from "./dress"
import { CHECK_TONE, rollupArtState } from "./Icon"
import { GitHubHtml } from "./GitHubHtml"
import { ageOf, momentOf } from "./when"
import { Who } from "./Who"

/**
 * Everybody a commit is attributed to.
 *
 * Overlapped rather than spaced, so that two authors take about as much of the
 * row as one. Most commits in a repository written with an agent have two, and
 * a row whose first column changes width depending on how many wrote it is a
 * column the eye cannot run down.
 */
const Faces = ({
  authors,
  committer
}: {
  readonly authors: Landed["authors"]
  readonly committer: Landed["committer"]
}) => {
  /*
   * The committer joins the faces, and only where they are somebody else.
   * On the ordinary commit the two are the same person and a second face would
   * say the same name twice; on a rebase or a patch applied on somebody's
   * behalf they differ, and who put it on the branch is the fact. Named in the
   * label rather than in the row, because a login spelled out on every line is
   * a column of names beside a column of faces saying the same thing.
   */
  const held = Option.getOrUndefined(committer)
  const also =
    held === undefined || authors.some((author) => author.login === held.login) ? undefined : held

  return (
    // `overflow-hidden` because this is a grid track of a fixed width: a commit
    // with four authors would otherwise widen the column on its own row and
    // take the alignment of the whole page with it.
    <span className="flex items-center -space-x-1 overflow-hidden">
      {authors.map((author) => (
        <Who
          key={author.login}
          login={author.login}
          src={Option.getOrUndefined(author.faceUrl)}
          size={16}
        />
      ))}
      {also === undefined ? null : (
        <Who
          login={`${also.login}, who committed it`}
          src={Option.getOrUndefined(also.faceUrl)}
          size={16}
        />
      )}
    </span>
  )
}

/**
 * The room a cell takes when there is nothing in it to draw.
 *
 * Every optional fact on a row draws one of these rather than nothing, so the
 * grid below keeps its tracks: a cell that renders null moves every cell after
 * it one place left, which is the alignment this whole shape exists to hold.
 */
const Empty = () => <span aria-hidden />

/**
 * How wide each of a row's columns is, in the order a row draws them.
 *
 * The Working Set's rows learned this first and the reasoning is written out
 * beside its own `TRACK`: a row of flexbox is right read one row at a time, and
 * a list is not read one row at a time. Sized to their own contents, the checks
 * landed wherever the sentence ran out and every fact after them started at a
 * different place on every line.
 *
 * The numbers are the widest thing each column holds on a real page, read off
 * the rows. The sentence takes what is left, because it is the part worth the
 * width.
 */
const TRACK = {
  /** Two overlapped faces. A third is rare and is clipped rather than paid for. */
  faces: "1.75rem",
  headline: "minmax(0,1fr)",
  more: "1rem",
  /** `28 files`, right-aligned. */
  files: "3.5rem",
  /** `+701 −53`, which is the widest a page of this repository showed. */
  size: "5rem",
  comments: "2.5rem",
  verified: "1rem",
  checks: "1rem",
  /** `#37063`, and five digits is where GitHub's numbering is. */
  number: "3.25rem",
  /** Seven characters and the copy button that appears over them. */
  sha: "5.25rem",
  age: "3.5rem"
} as const

/**
 * Which of the optional columns a page reserves room for.
 *
 * Taken from the whole page rather than from each row, for the reason the
 * Working Set gives: a column that exists on some rows and not others is the
 * ragged edge this is here to fix. A branch where nobody has ever commented on
 * a commit should not keep two and a half rems empty on thirty-five lines to
 * say so.
 *
 * Two of these — the comments and the signatures — arrive with the second read,
 * a moment after the rows. The page settles once when they land. The
 * alternative is holding room on every branch for facts most branches do not
 * have, which is the cost this is avoiding.
 */
type Columns = {
  readonly more: boolean
  readonly comments: boolean
  readonly verified: boolean
  readonly checks: boolean
  readonly number: boolean
}

function* commitsOf(history: Read): Generator<Landed> {
  for (const day of history.days) yield* day.commits
}

const columnsIn = (history: Read): Columns => {
  let more = false
  let comments = false
  let verified = false
  let checks = false
  let number = false

  for (const commit of commitsOf(history)) {
    if (Option.isSome(commit.bodyHtml)) more = true
    if (Option.isSome(commit.pullRequest)) number = true

    const mark = Option.getOrUndefined(commit.mark)
    if (mark === undefined) continue
    if (mark.comments > 0) comments = true
    if (mark.verified) verified = true
    if (Option.isSome(mark.checks)) checks = true
  }

  return { more, comments, verified, checks, number }
}

const tracksOf = (columns: Columns): string =>
  [
    TRACK.faces,
    TRACK.headline,
    ...(columns.more ? [TRACK.more] : []),
    TRACK.files,
    TRACK.size,
    ...(columns.comments ? [TRACK.comments] : []),
    ...(columns.verified ? [TRACK.verified] : []),
    ...(columns.checks ? [TRACK.checks] : []),
    ...(columns.number ? [TRACK.number] : []),
    TRACK.sha,
    TRACK.age
  ].join(" ")

/**
 * How the whole run of checks on a commit came out.
 *
 * A glyph and no number. GitHub's own summary — "251 / 252 checks OK" — is the
 * label rather than the text, because the count is worth having on the one row
 * being looked at and worth nothing on the thirty-four above it: a column of
 * counts is a column nobody reads, and it is the widest thing on the row.
 *
 * Nothing at all where the second read has not answered, and nothing where it
 * answered that nothing ran. Absent and passing are different facts, and a green
 * tick standing in for the first is this column's one unforgivable mistake.
 */
const Checks = ({ mark }: { readonly mark: Landed["mark"] }) =>
  Option.match(Option.flatMap(mark, (one) => one.checks), {
    onNone: () => <Empty />,
    onSome: (checks) => {
      const state = rollupArtState(checks.state)
      const Art = useArt()[checkName(state)]

      return (
        <span
          role="img"
          aria-label={checks.said}
          title={checks.said}
          className={`flex items-center ${CHECK_TONE[state]}`}
        >
          <Art size={12} />
        </span>
      )
    }
  })

/**
 * How much was said about the commit after it landed.
 *
 * Drawn only where somebody said something. A row reading "0 comments" on every
 * line has spent a column to tell the reader nothing thirty-five times.
 */
const Comments = ({ mark }: { readonly mark: Landed["mark"] }) => {
  const Art = useArt().comments
  const held = Option.getOrUndefined(mark)

  if (held === undefined || held.comments === 0) return <Empty />

  return (
    <span
      role="img"
      aria-label={`${held.comments} comments`}
      className="flex items-center justify-end gap-0.5 tabular-nums text-ink-muted"
    >
      <Art size={12} />
      {held.comments}
    </span>
  )
}

/**
 * Whether the signature checked out.
 *
 * Muted rather than green, though it is a tick and a good one. Green is this
 * row's word for "the checks passed", and two green ticks side by side read as
 * one fact drawn twice — which is what they looked like.
 */
const Verified = ({ mark }: { readonly mark: Landed["mark"] }) => {
  const Tick = useArt().tick
  const held = Option.getOrUndefined(mark)

  if (held === undefined || !held.verified) return <Empty />

  return (
    <span
      role="img"
      aria-label="Verified signature"
      title="Verified signature"
      className="flex items-center text-ink-muted"
    >
      <Tick size={12} />
    </span>
  )
}

/**
 * How much of the repository a commit moved.
 *
 * The fact GitHub's own list leaves out, and the one that tells a reader
 * whether a row is a typo or a rewrite before they open anything. Counted from
 * the commit's diff a row at a time, so it arrives after the row does and the
 * row must read correctly without it.
 *
 * Two cells rather than one. `1 file +2 −0` and `28 files +701 −53` are the
 * same three facts at two lengths, and set as one cell the plus signs land in a
 * different place on every row. Given a track each, the file counts share a
 * right edge and the line counts share theirs.
 *
 * The file count says its unit, because "5" alone beside two other numbers is a
 * third number to work out. The line counts carry their signs, because `+279
 * −28` is how every tool a reader uses writes this and it needs no key.
 */
const Files = ({ stat }: { readonly stat: Landed["stat"] }) =>
  Option.match(stat, {
    // The track holds the room whether or not the read has landed, so this is
    // empty rather than sized. Both of these arrive a second after the row.
    onNone: () => <Empty />,
    onSome: (size) => (
      <span className="truncate text-right tabular-nums">
        {`${size.files} ${size.files === 1 ? "file" : "files"}`}
      </span>
    )
  })

/**
 * The two line counts, in the green and the red every diff in this interface uses.
 *
 * The minus is U+2212, not a hyphen. At this size a hyphen beside a plus is a
 * dash beside a cross, and the pair is meant to read as one measurement.
 */
const Size = ({ stat }: { readonly stat: Landed["stat"] }) =>
  Option.match(stat, {
    onNone: () => <Empty />,
    onSome: (size) => (
      <span
        aria-label={`${size.added} added, ${size.removed} removed`}
        className="flex justify-end gap-1 overflow-hidden tabular-nums"
      >
        <span className="text-pass">{`+${size.added}`}</span>
        <span className="text-fail">{`−${size.removed}`}</span>
      </span>
    )
  })

/**
 * The sha, and the way to take it somewhere else.
 *
 * Seven characters shown and forty copied. Seven is what every link, every
 * failing check and every `git show` in a message calls it, and forty is what a
 * command needs: a short sha pasted into one is a command that stops working the
 * day the repository grows a collision.
 */
const Sha = ({ commit }: { readonly commit: Landed }) => {
  const [copied, setCopied] = useState(false)
  const Copy = useArt().copy
  const Tick = useArt().tick

  return (
    <span className="relative flex items-center justify-end gap-0.5">
      <code className={`font-mono text-[0.6875rem] text-ink-muted ${CHIP}`}>
        {commit.abbreviatedSha}
      </code>
      {/*
       * Out of the way until the row is pointed at. Thirty-five copy buttons down
       * a page is thirty-five controls nobody is reaching for, and the sha beside
       * each one is the thing being read. Kept for the keyboard by `focus-visible`,
       * which is the tab stop this would otherwise have hidden.
       */}
      <button
        type="button"
        aria-label="Copy the full sha"
        className={`flex items-center p-1 text-ink-muted opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 hover:text-ink ${PRESSABLE}`}
        onClick={() => {
          Effect.runFork(
            Effect.tryPromise(() => navigator.clipboard.writeText(commit.sha)).pipe(
              // Refused by a browser that will not give a page the clipboard, and
              // there is nothing to say about it: the sha is on the row either way.
              Effect.match({ onSuccess: () => setCopied(true), onFailure: () => {} })
            )
          )
        }}
      >
        {copied ? <Tick size={12} /> : <Copy size={12} />}
      </button>
    </span>
  )
}

/** Where the stagger stops climbing, which is the same handful the lists use. */
const LAST_TO_STAGGER = 5

/**
 * One commit, on one line.
 *
 * The faces, then the sentence somebody wrote, then everything that is about the
 * commit rather than in it: how big it is, how its checks came out, what it
 * landed as, which sha, when. The sentence takes whatever room the rest leaves
 * and truncates, because it is the only part whose length is nobody's to fix.
 *
 * It was two lines and the second was mostly logins. One line holds twice as
 * many commits on a screen, which is the whole point of a page that is a list of
 * them — and the login it cost is already on the face beside the sentence.
 *
 * The whole row is a press. The headline's own link is stretched over the row
 * with an `::after`, rather than the row being an anchor, because a row that is
 * an anchor cannot hold the pull request's link or the copy button: nesting one
 * anchor in another is not a thing a browser will draw.
 */
const Row = ({
  commit,
  repo,
  columns,
  at
}: {
  readonly commit: Landed
  readonly repo: CommitList["repo"]
  readonly columns: Columns
  readonly at: number
}) => {
  const [open, setOpen] = useState(false)
  const art = useArt()
  const More = art["chevron-down"]

  return (
    <li
      className="t-row-in group relative grid items-center gap-2 px-3 py-1.5 text-xs text-ink-muted transition-colors hover:bg-hover"
      style={
        {
          gridTemplateColumns: tracksOf(columns),
          /*
           * Capped, as the Working Set's rows are. A page holds up to thirty-five
           * commits, and forty milliseconds a row uncapped is a page that finishes
           * arriving a second and a half after it started — which is a list being
           * dealt out rather than a list appearing.
           */
          "--row-at": String(Math.min(at, LAST_TO_STAGGER))
        } as React.CSSProperties
      }
    >
      <Faces authors={commit.authors} committer={commit.committer} />

      <a
        href={`/${repo.owner}/${repo.repo}/commit/${commit.sha}`}
        className="min-w-0 truncate text-sm text-ink no-underline after:absolute after:inset-0 after:content-['']"
      >
        {commit.headline}
      </a>

      {columns.more ? (
        Option.match(commit.bodyHtml, {
          onNone: () => <Empty />,
          onSome: () => (
            <button
              type="button"
              aria-label="Show the rest of the message"
              aria-expanded={open}
              // Over the headline's stretched link, which covers the whole row.
              className={`relative flex items-center p-0.5 hover:text-ink ${PRESSABLE}`}
              onClick={() => setOpen((was) => !was)}
            >
              <More size={12} />
            </button>
          )
        })
      ) : null}

      <Files stat={commit.stat} />
      <Size stat={commit.stat} />
      {columns.comments ? <Comments mark={commit.mark} /> : null}
      {columns.verified ? <Verified mark={commit.mark} /> : null}
      {columns.checks ? <Checks mark={commit.mark} /> : null}

      {columns.number
        ? Option.match(commit.pullRequest, {
            onNone: () => <Empty />,
            onSome: (number) => (
              <a
                href={`/${repo.owner}/${repo.repo}/pull/${number}`}
                className={`relative justify-self-end tabular-nums text-ink-muted no-underline hover:text-ink ${CHIP}`}
              >
                {`#${number}`}
              </a>
            )
          })
        : null}

      <Sha commit={commit} />

      <time
        dateTime={commit.createdAt}
        title={momentOf(commit.createdAt)}
        className="text-right tabular-nums"
      >
        {ageOf(commit.createdAt)}
      </time>

      {/*
       * The rest of the message, under the line and across all of it. Its own
       * row of the grid rather than a sibling of the cells, because a cell in
       * the flow would take a track from the line above it.
       */}
      {open
        ? Option.match(commit.bodyHtml, {
            onNone: () => null,
            onSome: (html) => (
              <div
                className="t-panel-fade relative pt-1 pl-6 text-xs text-ink-muted"
                style={{ gridColumn: "1 / -1" }}
              >
                <GitHubHtml html={html} />
              </div>
            )
          })
        : null}
    </li>
  )
}

/**
 * A day of them, under the heading GitHub wrote for it.
 *
 * Their grouping kept rather than replaced with a flat list. On a branch that
 * moves, the day is the only thing that turns forty rows into "yesterday" and
 * "the week before" — and it is the one piece of ordering a reader already has
 * in their head when they arrive.
 */
const OneDay = ({
  day,
  repo,
  columns,
  from
}: {
  readonly day: Day
  readonly repo: CommitList["repo"]
  /** The page's tracks, not the day's: three cards whose columns disagree is three lists. */
  readonly columns: Columns
  /** Where this day's rows fall in the whole page, so the stagger runs down it once. */
  readonly from: number
}) => (
  /*
   * The day is the card, and the card is a fill. `quiet.css` paints every
   * `section[aria-label]` in this interface with the surface colour and the wide
   * corner, so this asks for neither: the list inside it had a border and a
   * rounding of its own, which drew a second card inside the first one.
   *
   * `overflow-hidden` so the corner is real. The fill belongs to the section and
   * the hover fill belongs to the row, so without this the first and last rows
   * square off the corner the card has just drawn.
   */
  <section aria-label={day.title} className="flex flex-col overflow-hidden">
    <h2 className="px-3 pt-3 pb-1.5 text-xs font-semibold text-ink-muted">{day.title}</h2>
    {/*
     * `list-none` said here rather than left to the reset. This tree renders
     * inside GitHub's own page, where a `ul` carries their marker, and the
     * marker was drawn as a dot in the gutter of every commit.
     */}
    <ul className="list-none">
      {day.commits.map((commit, index) => (
        <Row
          key={commit.sha}
          commit={commit}
          repo={repo}
          columns={columns}
          at={from + index}
        />
      ))}
    </ul>
  </section>
)

/**
 * The way to another page of the same branch.
 *
 * Real links rather than buttons, and their cursor rather than a page number:
 * GitHub pages a commit list by where it got to, which is the only honest way
 * to page a list that grows from the end being read.
 */
const Step = ({
  where,
  words,
  onGo
}: {
  readonly where: string
  readonly words: string
  readonly onGo: (path: string) => void
}) => (
  <a
    href={where}
    className={`px-3 py-1.5 text-sm text-ink no-underline hover:bg-active ${PRESSABLE}`}
    onClick={(event) => {
      // A modified press still belongs to the browser: the address is a real
      // one, and a reader opening the older commits in a new tab means it.
      if (event.metaKey || event.ctrlKey || event.shiftKey) return
      event.preventDefault()
      onGo(where)
    }}
  >
    {words}
  </a>
)

/**
 * One page of a branch's history.
 *
 * What GitHub's own `/commits/BRANCH` is, in this interface's dress.
 */
export const History = ({
  history,
  list,
  onGo
}: {
  readonly history: Read
  readonly list: CommitList
  readonly onGo: (path: string) => void
}) => {
  /*
   * Where each day's rows start in the whole page, so that the arriving stagger
   * runs once down the list rather than restarting at every heading — which
   * reads as three lists appearing rather than one.
   */
  let sofar = 0
  const columns = columnsIn(history)

  return (
    <div className="flex flex-col gap-3 pb-6">
      {history.days.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-ink-muted">
          There are no commits on {history.branch}.
        </p>
      ) : (
        history.days.map((day) => {
          const from = sofar
          sofar += day.commits.length
          return (
            <OneDay
              key={day.title}
              day={day}
              repo={list.repo}
              columns={columns}
              from={from}
            />
          )
        })
      )}

      {Option.isNone(history.older) && Option.isNone(history.newer) ? null : (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Option.match(history.newer, {
            onNone: () => null,
            onSome: (cursor) => (
              <Step where={pageBefore(list, cursor)} words="Newer" onGo={onGo} />
            )
          })}
          {Option.match(history.older, {
            onNone: () => null,
            onSome: (cursor) => <Step where={pageAfter(list, cursor)} words="Older" onGo={onGo} />
          })}
        </div>
      )}
    </div>
  )
}
