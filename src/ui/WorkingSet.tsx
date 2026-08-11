import { Option } from "effect"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  courtOfIssue,
  type InvolvedIssue,
  type IssueRef,
  type ListedIssue,
  nameOf,
  pageOf
} from "../domain/issues"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { sieveOf, undecided } from "../domain/sieve"
import { stepping } from "../domain/stepping"
import { type Piled, setAside, type Sitting, sifted, walkThrough } from "../domain/sittings"
import type { CheckRollup, Court, InvolvedPullRequest, Size } from "../domain/workingSet"
import { DEFAULT_PROFILE, type Profile } from "../keys/commands"
import { type ArtName, checkName, issueName, pullRequestName, useArt } from "./art"
import { COURT_ART, COURT_NAME, COURT_TONE } from "./courts"
import { toneOf } from "./labelTone"
import { type Asking, Doings } from "./Doings"
import { Filters } from "./Filters"
import { Keying } from "./useLetters"
import { CHECK_TONE, OPINION_TONE, OPINION_WORDS, rollupArtState } from "./Icon"
import { StillReading } from "./Waiting"
import { rememberFilter, rememberedFilter } from "./remembered"
import { Section } from "./Section"
import { useKeys } from "./useKeys"
import { useSettings } from "./useSettings"
import { loginOnPage } from "./viewer"
import { ageOf, momentOf } from "./when"
import { Owner } from "./Owner"
import { Who } from "./Who"

/**
 * The colour a reason wears, which is the same rule again one row down.
 *
 * `plain` for anything unrecognised. A reason nobody has seen before is not
 * evidence of trouble, and painting it red on the chance would be inventing a
 * problem out of an unfamiliar string.
 */
type Tint = "plain" | "bad" | "busy" | "good"

const TINT: Record<Tint, string> = {
  plain: "bg-surface text-ink-muted",
  bad: "bg-fail-muted text-fail",
  busy: "bg-attention-muted text-busy",
  good: "bg-pass-muted text-pass"
}

/**
 * GitHub's reasons, in words rather than in their wire spelling, and in a colour.
 *
 * A lookup with a fallback rather than a total mapping, because the set is open:
 * five turned up in sixteen rows and there is no reason to think that is all of
 * them. An unrecognised one reads as a slightly clumsy sentence, which is better
 * than `CI_FAILING` and far better than nothing.
 */
const KNOWN_REASONS: Record<string, { readonly words: string; readonly tint: Tint }> = {
  CI_FAILING: { words: "CI failing", tint: "bad" },
  CI_RUNNING: { words: "CI running", tint: "busy" },
  MERGE_CONFLICTS: { words: "Merge conflicts", tint: "bad" },
  WAITING_FOR_REVIEW: { words: "Waiting for review", tint: "plain" },
  READY_TO_MERGE: { words: "Ready to merge", tint: "good" }
}

const reasonRead = (reason: string): { readonly words: string; readonly tint: Tint } => {
  const known = KNOWN_REASONS[reason]
  if (known !== undefined) return known

  const words = reason.toLowerCase().replaceAll("_", " ")
  return {
    words: words.charAt(0).toUpperCase() + words.slice(1),
    tint: "plain"
  }
}

const addressOf = (reference: PullRequestRef): string =>
  `${reference.owner}/${reference.repo}#${reference.number}`

const linkOf = (reference: PullRequestRef): string =>
  `/${reference.owner}/${reference.repo}/pull/${reference.number}`

/**
 * What an issue is called where pull requests are called something too.
 *
 * The word in front is not decoration. Both kinds are named `owner/repo#7` and
 * both are keys here — the row that is arriving, the row the keyboard is on —
 * so two rows that happened to be numbered alike would be one row to everything
 * that reads these strings.
 */
const addressOfIssue = (reference: IssueRef): string => `issue ${nameOf(reference)}`

/**
 * The run of checks in the space a row has.
 *
 * A count rather than names, and only when something is outstanding: "12 of 12"
 * on a green pull request is a row spending its width to say nothing.
 */
const Checks = ({ rollup }: { readonly rollup: CheckRollup }) => {
  const art = rollupArtState(rollup.state)
  const Art = useArt()[checkName(art)]
  const tone = CHECK_TONE[art]

  return (
    <span className={`flex items-center gap-1 text-xs ${tone}`}>
      <Art size={12} />
      {rollup.passed < rollup.total ? (
        <span className="tabular-nums">{`${rollup.passed} of ${rollup.total}`}</span>
      ) : null}
    </span>
  )
}

/**
 * How wide each of a row's columns is, in the order a row draws them.
 *
 * A row used to be a line of flexbox: everything sized to its own contents, a
 * spacer in the middle, and the halves pushed apart. Read one row at a time that
 * is right, and a list is not read one row at a time — so the checks landed
 * wherever the title ran out, the addresses started at a different place on every
 * line, and a column of facts that all mean the same thing zig-zagged down the
 * page. Fixed tracks put each fact at the same distance from an edge on every
 * row, which is the entire point of a list.
 *
 * The numbers are measured rather than guessed: the widest thing each column
 * holds in a real Working Set, read off the rows themselves. The title takes
 * whatever is left, because it is the one part worth the width.
 */
const TRACK = {
  face: "1rem",
  state: "0.875rem",
  number: "2.75rem",
  title: "minmax(0,1fr)",
  repo: "8.5rem",
  standing: "7.5rem",
  checks: "5.5rem",
  comments: "2.75rem",
  labels: "4rem",
  size: "6rem",
  age: "3.5rem"
} as const

/**
 * Where a row is in the run of rows arriving, or nothing if it was already here.
 *
 * The stagger stops climbing after six, which holds the run under a quarter of a
 * second: a repository with sixty open pull requests would otherwise have its
 * last row waiting two and a half seconds for its turn, which is the wait this
 * whole exercise is about removing.
 */
const STAGGERED = 6

type Arriving = (address: string) => number | undefined

/**
 * A place the keyboard walk can stand, which is a row of either kind.
 *
 * The two are kept apart by their kind rather than folded into one address,
 * because pressing Enter on them means two different things: a pull request is
 * handed to whoever owns the prefetch machinery, and an issue is a page of
 * GitHub's that this interface has nothing to add to.
 */
type Stop =
  | {
      readonly kind: "pull-request"
      readonly address: string
      readonly reference: PullRequestRef
    }
  | { readonly kind: "issue"; readonly address: string; readonly reference: IssueRef }

/**
 * The repository a list is of, where it is of one, so its rows can stop saying so.
 *
 * Not derived from the rows: a Working Set that happens to hold one repository this
 * morning still has to name it, because nothing above those rows does.
 */
type Within = { readonly owner: string; readonly repo: string }

/** One array rather than a fresh one per render, so the walk below is rebuilt when it changes. */
const NO_ISSUES: ReadonlyArray<InvolvedIssue> = []

const isWithin = (
  reference: { readonly owner: string; readonly repo: string },
  within: Within | undefined
): boolean =>
  within !== undefined && within.owner === reference.owner && within.repo === reference.repo

/**
 * Which of the optional columns a list reserves room for.
 *
 * A Working Set of sixteen rows where none of them has a reason should not keep
 * seven rems empty on every line for the reason none of them has. Taken from the
 * whole list rather than from each row, because a column that exists on some rows
 * and not others is the ragged thing this is here to fix — and from every row
 * rather than the filtered ones, so that typing in the filter box does not shift
 * the columns under the reader's eyes.
 */
export type Columns = {
  readonly repo: boolean
  readonly standing: boolean
  /**
   * Labels, which only an Involved Issue says here.
   *
   * A pull request carries a count of them too and this list has never drawn
   * it: what a reader of one of those rows is deciding on is where it stands and
   * how big it is, and the labels would be four rems taken from the titles to
   * repeat what the reason beside them already says. An issue has neither of
   * those facts and its labels are how GitHub's own issue list is read, so the
   * column arrives with the issues and leaves with them.
   */
  readonly labels: boolean
}

const columnsIn = (sittings: ReadonlyArray<Sitting>, within: Within | undefined): Columns => {
  let standing = false
  let repo = false
  let labels = false

  for (const one of walkThrough(sittings)) {
    if (Option.isSome(one.why) || Option.isSome(one.reviewed)) standing = true
    if (!isWithin(one.reference, within)) repo = true
    if (standing && repo) break
  }

  for (const one of sittings.flatMap((sitting) => sitting.issues)) {
    if (!isWithin(one.reference, within)) repo = true
    if (one.labels.length > 0) labels = true
    if (repo && labels) break
  }

  return { repo, standing, labels }
}

/**
 * The same question asked of a list that is issues and nothing else.
 *
 * A repository's own issue list, where `standing` is never true: nothing on
 * that page is reviewed and nothing is on a shelf. Written here rather than in
 * the screen that needs it so that the tracks and the row stay one decision —
 * a column worked out in two places is a seam down the middle of the list.
 */
export const columnsForIssues = (
  rows: ReadonlyArray<ListedIssue>,
  within: Within | undefined
): Columns => {
  let repo = false
  let labels = false

  for (const one of rows) {
    if (!isWithin(one.reference, within)) repo = true
    if (one.labels.length > 0) labels = true
    if (repo && labels) break
  }

  return { repo, standing: false, labels }
}

/**
 * How many of the row's tracks an issue's labels stand across.
 *
 * Counted from the same list `tracksOf` builds, rather than written down beside it: the two
 * numbers have to agree for either row to line up, and a column added to one and forgotten in
 * the other is a seam down the middle of every Court that nothing would fail about.
 */
const spanOf = (columns: Columns): number =>
  (columns.standing ? 1 : 0) + (columns.labels ? 1 : 0) + 3

/** How many labels are named before the rest become a number. */
const NAMED = 2

const tracksOf = (columns: Columns): string =>
  [
    TRACK.face,
    TRACK.state,
    TRACK.number,
    TRACK.title,
    ...(columns.repo ? [TRACK.repo] : []),
    ...(columns.standing ? [TRACK.standing] : []),
    TRACK.checks,
    TRACK.comments,
    ...(columns.labels ? [TRACK.labels] : []),
    TRACK.size,
    TRACK.age
  ].join(" ")

/**
 * How much a pull request changes, in the two numbers everyone already reads.
 *
 * `+120 −8`, in the green and the red every diff in this interface uses, so the
 * row says the same thing the card's header says in the same colours. Fixed
 * width and tabular, because a column of these is scanned rather than read: the
 * numbers have to line up for the four-thousand-line one to stand out from its
 * neighbours at a glance, which is the entire reason it is here.
 */
const Sized = ({ size }: { readonly size: Option.Option<Size> }) =>
  Option.match(size, {
    // The track is the row's, not this cell's, so the space is held whether or
    // not the read has landed: a list does not rearrange itself under the
    // pointer a second after it was drawn.
    onNone: () => <span aria-hidden="true" />,
    onSome: (found) => (
      <span
        aria-label={`${found.added} added, ${found.deleted} removed`}
        className="flex justify-end gap-1 overflow-hidden font-mono text-xs tabular-nums"
      >
        <span className="text-pass">{`+${found.added}`}</span>
        <span className="text-fail">{`−${found.deleted}`}</span>
      </span>
    )
  })

const Row = ({
  one,
  court,
  chosen,
  arriving,
  within,
  columns,
  asking
}: {
  readonly one: InvolvedPullRequest
  readonly court: Court
  readonly chosen: boolean
  readonly arriving: Arriving
  readonly within?: Within
  readonly columns: Columns
  readonly asking?: Asking
}) => {
  const art = useArt()
  const Art = art[pullRequestName(one.state)]
  const address = addressOf(one.reference)
  const at = arriving(address)
  const here = isWithin(one.reference, within)

  return (
    /*
     * A row is a link and, at its end, a button — and a button inside a link is
     * neither valid nor pressable without arguing with the link. So the row is a
     * wrapper of two: everything that is read, which is the link, and the one
     * thing that acts, which is not. Hover and the chosen tint move up here with
     * it, since it is the whole line that lights.
     */
    <div
      // Named, because two stylesheets have to reach the thing that lights under
      // the pointer and it is no longer the anchor.
      data-row=""
      className={`group grid items-center pr-1 hover:bg-hover ${chosen ? "bg-hover" : ""} ${
        at === undefined ? "" : "t-row-in"
      }`}
      style={
        {
          gridTemplateColumns: "minmax(0,1fr) auto",
          ...(at === undefined ? {} : { "--row-at": String(at) })
        } as React.CSSProperties
      }
    >
      <a
        href={linkOf(one.reference)}
        /*
         * Unread leads, because it is the one thing here that decides whether to
         * look at all, and the row's own Court closes: read aloud, a pull request
         * in the middle of a stack has to say that it is waiting even though the
         * heading above it says Your Move.
         */
        aria-label={`${one.readByViewer ? "" : "Unread. "}${one.title}. ${
          here ? `#${one.reference.number}` : address
        }. ${COURT_NAME[court]}`}
        aria-current={chosen ? "true" : undefined}
        /*
         * A plain link, and deliberately nothing more. The prefetch script already
         * listens for a press on any pull request link, holds GitHub's conversation
         * back and asks the worker for the interface — so a press here opens
         * instantly for exactly the same reason a press on GitHub's own row does,
         * and preventing the default would be throwing that machinery away.
         *
         * It also means command-click, middle-click and the context menu all behave
         * the way a link behaves, which is how an extension avoids being an
         * obstacle.
         */
        className="grid min-w-0 items-center gap-2 px-3 py-1.5 no-underline"
        style={{ gridTemplateColumns: tracksOf(columns) }}
      >
        {/*
         * Who, first. A column of faces down the left edge is the one thing in a row
         * that is recognised rather than read, and a reader scanning a repository's
         * list for their own work was crossing the whole width of every row to find
         * it. English reads left to right and this is the first question it asks.
         */}
        <Who login={one.author.login} src={Option.getOrUndefined(one.author.faceUrl)} />

        <Art
          size={14}
          className={`shrink-0 ${one.state === "open" ? "text-pass" : "text-ink-muted"}`}
        />

        {/*
         * The number, beside the icon rather than at the far end of the row. It is
         * how a pull request is spoken about — in a branch name, in a review
         * request, in the sentence asking someone to look — and behind a title long
         * enough to truncate it was the one thing a reader had to hunt for. The
         * repository follows the title still, since that is context rather than
         * identity, and the number is not repeated there: the same fact twice on
         * one row is read twice before it is understood once.
         *
         * Unless the list is one repository's own, which names it above the rows.
         * Then the context is already established and the address on every line is
         * a column of identical text taking width from the titles beside it.
         */}
        <span className="justify-self-end font-mono text-xs text-ink-muted tabular-nums">
          {`#${one.reference.number}`}
        </span>

        <span
          className={`truncate text-sm ${one.readByViewer ? "text-ink" : "font-semibold text-ink"}`}
        >
          {one.title}
        </span>

        {/*
         * Which repository, as the owner's picture and the repository's own name —
         * not the whole address. `octo-org/octo-repo` is twelve rems of
         * monospace to say `octo-repo`, and the owner is already in the picture beside it.
         * The address in full is on the row for a pointer that rests and for a
         * screen reader, which is where the twelve rems belonged all along.
         *
         * Nothing at all when the list is one repository's own: the heading above
         * the rows has already said it, and a column of identical text is width
         * taken from the titles.
         */}
        {columns.repo ? (
          <span
            title={`${one.reference.owner}/${one.reference.repo}`}
            className="flex min-w-0 items-center gap-1.5"
          >
            <Owner owner={one.reference.owner} />
            <span className="truncate font-mono text-xs text-ink-muted">{one.reference.repo}</span>
          </span>
        ) : null}

        {/*
         * Where it stands: GitHub's reason for it being here if they gave one, and
         * the review decision otherwise.
         *
         * One column rather than two, because both answer the same question and
         * neither is on most rows — two columns would keep fourteen rems empty on
         * every line to be ready for a pair of facts that rarely arrive together.
         * The reason wins where there is one: `Merge conflicts` is why nothing is
         * moving, and `Review required` under it would only be saying so again.
         */}
        {columns.standing ? (
          <span className="min-w-0 truncate">
            {Option.match(one.why, {
              onNone: () =>
                Option.match(one.reviewed, {
                  onNone: () => null,
                  onSome: (opinion) =>
                    opinion === "review-required" && Option.isNone(one.shelf) ? null : (
                      <span className={`text-xs ${OPINION_TONE[opinion]}`}>
                        {OPINION_WORDS[opinion]}
                      </span>
                    )
                }),
              onSome: (reason) => {
                const read = reasonRead(reason)
                return (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${TINT[read.tint]}`}>
                    {read.words}
                  </span>
                )
              }
            })}
          </span>
        ) : null}

        {/*
         * The checks, the remarks, the size and the age: four columns every row has
         * a track for whether or not it has the fact, because a row that leaves its
         * track empty keeps the rows above and below it in line. This is the whole
         * repair — the icons now run straight down the page instead of landing
         * wherever the title before them happened to stop.
         */}
        <span className="min-w-0 truncate">
          {Option.match(one.checks, {
            onNone: () => null,
            onSome: (rollup) => <Checks rollup={rollup} />
          })}
        </span>

        <span className="flex items-center gap-1 text-xs text-ink-muted">
          {one.comments > 0 ? (
            <>
              <art.comment size={12} />
              <span className="tabular-nums">{one.comments}</span>
            </>
          ) : null}
        </span>

        {columns.labels ? <span aria-hidden="true" /> : null}

        <Sized size={one.size} />

        <span
          title={momentOf(one.changedAt)}
          className="text-right text-xs text-ink-muted tabular-nums"
        >
          {ageOf(one.changedAt)}
        </span>
      </a>

      {asking === undefined ? (
        <span aria-hidden="true" />
      ) : (
        <Doings one={one} asking={asking} chosen={chosen} />
      )}
    </div>
  )
}

/**
 * An Involved Issue, in the tracks the pull requests above it are already in.
 *
 * The same grid rather than a list of its own under the same heading, because a
 * Court is what is owed to somebody and a reader looking down one is asking a
 * single question of every line in it. Two arrangements sharing a heading would
 * put the ages of half the rows in one place and the other half somewhere else,
 * which is the raggedness the tracks were measured to end.
 *
 * What an issue has no answer for is left empty rather than filled: no checks
 * run on one, nobody reviews one, and there is no diff to size. A dash or a zero
 * in those cells would be this interface inventing facts, and an empty track
 * costs nothing — holding it is what keeps the columns either side of it
 * straight.
 */
export const IssueRow = ({
  one,
  court,
  chosen,
  arriving,
  within,
  columns
}: {
  readonly one: ListedIssue
  /**
   * The Court this row is sitting in, where it is in one.
   *
   * Nothing on a repository's own issue list, which files nothing: that page
   * asked one question about a repository and its rows have no Court to be in.
   * The label below says the kind and the number either way, which is the part
   * that has to be said aloud.
   */
  readonly court?: Court
  readonly chosen: boolean
  readonly arriving: Arriving
  readonly within?: Within
  readonly columns: Columns
}) => {
  const art = useArt()
  const Art = art[issueName(one.state)]
  const address = addressOfIssue(one.reference)
  const at = arriving(address)
  const here = isWithin(one.reference, within)

  return (
    // The wrapper the pull requests wear, down to the empty second cell. There
    // is nothing to ask GitHub about an issue from here, and a row an inch
    // shorter than the ones above it would say there was something missing from
    // it rather than something absent from the interface.
    <div
      data-row=""
      className={`group grid items-center pr-1 hover:bg-hover ${chosen ? "bg-hover" : ""} ${
        at === undefined ? "" : "t-row-in"
      }`}
      style={
        {
          gridTemplateColumns: "minmax(0,1fr) auto",
          ...(at === undefined ? {} : { "--row-at": String(at) })
        } as React.CSSProperties
      }
    >
      <a
        href={pageOf(one.reference)}
        // How the keyboard finds this row's link when it is asked to open what
        // it is standing on. A pull request is opened through the prop that
        // holds the prefetch machinery; an issue is GitHub's own page and
        // following the link is the whole of what opening it means.
        data-issue={address}
        /*
         * The kind is said aloud, which it is not on a pull request's row. There
         * the glyph is one of four that all mean pull request and the heading
         * settles the rest; here the two kinds are mixed under one heading, and
         * an issue that did not say so would be a pull request to anybody not
         * looking at the icon.
         */
        aria-label={`${one.title}. Issue ${
          here ? `#${one.reference.number}` : nameOf(one.reference)
        }.${court === undefined ? "" : ` ${COURT_NAME[court]}`}`}
        aria-current={chosen ? "true" : undefined}
        className="grid min-w-0 items-center gap-2 px-3 py-1.5 no-underline"
        style={{ gridTemplateColumns: tracksOf(columns) }}
      >
        <Who login={one.author.login} src={Option.getOrUndefined(one.author.faceUrl)} />

        <Art
          size={14}
          className={`shrink-0 ${one.state === "open" ? "text-pass" : "text-ink-muted"}`}
        />

        <span className="justify-self-end font-mono text-xs text-ink-muted tabular-nums">
          {`#${one.reference.number}`}
        </span>

        <span className="truncate text-sm text-ink">{one.title}</span>

        {columns.repo ? (
          <span
            title={`${one.reference.owner}/${one.reference.repo}`}
            className="flex min-w-0 items-center gap-1.5"
          >
            <Owner owner={one.reference.owner} />
            <span className="truncate font-mono text-xs text-ink-muted">{one.reference.repo}</span>
          </span>
        ) : null}

        {/*
         * One cell across the tracks a pull request fills and an issue cannot.
         *
         * This was four cells: a review decision, its checks, its diff, and a count of
         * labels — three of them empty on every issue ever drawn, and the fourth spending
         * a whole track to say "4 labels". Held open, they read as data that failed to
         * arrive rather than as a kind of work that has no such thing.
         *
         * Spanned rather than given the issue a shorter template of its own, which was
         * tried and looked worse: the title track is what takes up the slack, so a shorter
         * row widens it and walks the repository column sideways down the list. The tracks
         * stay the pull request's; only what stands in them is the issue's.
         */}
        <span
          style={{ gridColumn: `span ${spanOf(columns)}` }}
          className="flex min-w-0 items-center justify-end gap-1.5 overflow-hidden"
        >
          {one.comments > 0 ? (
            <span className="flex shrink-0 items-center gap-1 text-xs text-ink-muted">
              <art.comment size={12} />
              <span className="tabular-nums">{one.comments}</span>
            </span>
          ) : null}

          {/*
           * Two of the labels' own words, and a number for the rest.
           *
           * They were counted, and the reason holds where it was aimed: six coloured pills
           * beside a title fight the title, which is the part worth reading. What changed is
           * where they stand. Out here, at the far end of the row where a pull request keeps
           * its diff, two quiet words say what an issue is about before its title is read —
           * `agent:claude-code` is the whole triage answer — and the tail stays a number.
           *
           * Their own colours are not used. GitHub's label palette is chosen per repository
           * and half of it is unreadable on this surface; the fill here is the same one every
           * quiet chip in this interface wears.
           */}
          {one.labels.slice(0, NAMED).map((word) => (
            <span
              key={word}
              title={word}
              className="flex max-w-32 shrink-0 items-center gap-1.5 rounded-full bg-hover pr-2 pl-1.5 py-0.5 text-[11px] text-ink-muted"
            >
              {/* The word's own colour, worked out from the word — see `labelTone.ts`. Two
                  labels on a row are told apart before either is read, which a shared grey
                  cannot do, and the word is right there for anyone the colour fails. */}
              <span
                aria-hidden="true"
                style={{ background: toneOf(word) }}
                className="size-1.5 shrink-0 rounded-full"
              />
              <span className="truncate">{word}</span>
            </span>
          ))}

          {one.labels.length > NAMED ? (
            <span
              title={one.labels.slice(NAMED).join(", ")}
              className="shrink-0 rounded-full bg-hover px-1.5 py-0.5 text-[11px] text-ink-muted tabular-nums"
            >
              {`+${one.labels.length - NAMED}`}
            </span>
          ) : null}
        </span>

        {/*
         * When it was raised, which is the only age their issue search answers
         * with: it sends no time of last change, so a column claiming to say when
         * anything last happened would be reading a field nobody has.
         */}
        <time
          dateTime={one.raisedAt}
          title={`Raised ${momentOf(one.raisedAt)}`}
          className="text-right text-xs text-ink-muted tabular-nums"
        >
          {ageOf(one.raisedAt)}
        </time>
      </a>

      <span aria-hidden="true" />
    </div>
  )
}

/*
 * How many issues a Court shows before the rest are behind a press.
 *
 * A live afternoon put eleven issues of one repository into Waiting and pushed the
 * pull requests in it off the bottom of the screen. The pull requests are the moves; the
 * issues are the rest of what is owed, and a tail of them nobody asked for cannot be allowed
 * to bury the half of the Court that can actually be acted on. Five is enough to see that
 * there are issues here and few enough to leave the next Court in sight.
 */
const AT_MOST = 5

/**
 * The line between the two kinds of work inside one Court.
 *
 * A Court answers one question — whose move is it — and for a long time both kinds answered it
 * in one undivided list. That held at four rows. A live afternoon has nine pull requests and
 * fifteen issues in Waiting, and interleaved by age they read as one long list in two
 * rhythms, the review column starting and stopping down the page.
 *
 * Three things carry it, all of them quiet. The kind's own glyph, which is the same one the rows
 * below wear, so the band and its rows are obviously one thing. The words, small and spaced,
 * because a band that only had a glyph would be a puzzle. And the count out at the right edge,
 * where the ages line up — a number in that column reads as the end of a row rather than as
 * decoration, and it gives the Court's own total something to add up from.
 *
 * The rule between them is what keeps it a seam rather than a heading: it carries the eye
 * across, where a filled bar of its own would stop it and turn one Court into two.
 */
const Seam = ({
  art: name,
  name: words,
  many
}: {
  readonly art: ArtName
  readonly name: string
  readonly many: number
}) => {
  const art = useArt()
  const Mark = art[name]

  return (
    <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 text-ink-muted">
      <Mark size={12} className="shrink-0 opacity-80" aria-hidden="true" />
      <span className="text-[11px] font-medium uppercase tracking-[0.08em]">{words}</span>
      <span className="h-px flex-1 bg-line-muted" />
      <span className="text-[11px] tabular-nums">{many}</span>
    </div>
  )
}

/**
 * The issues of one Court, with any long tail folded.
 *
 * A component of its own rather than a `slice` where they are drawn, because the fold has to
 * remember whether it has been opened, and the walk has to be able to open it: `j` onto a row
 * that is not on the screen moves the selection into nothing.
 *
 * Nothing is folded in the section the reader gets by asking for their issues apart. There the
 * issues are what was asked for and there is nothing below them to bury.
 */
const Issues = ({
  issues,
  court,
  onlyIssues,
  chosen,
  arriving,
  within,
  columns
}: {
  readonly issues: ReadonlyArray<InvolvedIssue>
  readonly court: Court
  /** Whether this Court has no pull requests, in which case the seam has one side. */
  readonly onlyIssues: boolean
  readonly chosen?: string
  readonly arriving: Arriving
  readonly within?: Within
  readonly columns: Columns
}) => {
  const art = useArt()
  // Named, because JSX takes a dotted name and not a subscript.
  const Chevron = art["chevron-down"]
  const [asked, showAll] = useState(false)
  const rest = issues.length - AT_MOST
  /* The walk standing in the tail counts as having asked, whether or not anything was pressed. */
  const reached = issues
    .slice(AT_MOST)
    .some((one) => addressOfIssue(one.reference) === chosen)
  const all = asked || reached
  const shown = all ? issues : issues.slice(0, AT_MOST)

  return (
    <>
      {/*
       * The line between the two kinds.
       *
       * This box held them interleaved, on the reasoning that a Court is one answer to one
       * question and a seam across it invites a reader to read the half above and stop. That
       * reasoning was written against a Court of four. A live afternoon has nine pull requests
       * and fifteen issues in Waiting, and interleaved by age they read as one long
       * list in two rhythms — the review column starting and stopping down the page.
       *
       * So: a seam, but the quietest one available. No heading weight, no fill, a rule that
       * carries the eye across rather than stopping it, and the Court's own count still covering
       * everything owed. Drawn only where there is something on both sides of it: a Court of
       * issues alone needs no line telling it what it is.
       */}
      {onlyIssues ? null : <Seam art="issue" name="Issues" many={issues.length} />}

      {shown.map((one) => (
        <IssueRow
          key={addressOfIssue(one.reference)}
          one={one}
          court={court}
          chosen={chosen === addressOfIssue(one.reference)}
          arriving={arriving}
          within={within}
          columns={columns}
        />
      ))}

      {rest > 0 && !all ? (
        <button
          type="button"
          onClick={() => showAll(true)}
          className="group/fold flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink-muted hover:bg-hover hover:text-ink"
        >
          {/* The chevron turns as the fold opens, which is the one thing on this control that
              says which way it goes. Down is more; there is no up, because nothing here folds
              back — a reader who asked to see fifteen issues did not ask to be given five again. */}
          <Chevron
            size={12}
            className="shrink-0 opacity-70 transition-transform duration-[var(--duration-quick)] ease-[var(--ease-out)] group-hover/fold:translate-y-0.5"
            aria-hidden="true"
          />
          <span>{`${rest} more issue${rest === 1 ? "" : "s"}`}</span>
        </button>
      ) : null}
    </>
  )
}

/**
 * A pile as a tree, so the order things land in is visible.
 *
 * Indentation with a rail down the left and an arrow into each row, rather than
 * three sibling rows: the top of a stack cannot land until the foundation does,
 * and a flat list says nothing about that at all. The rail is `stack.css`; the
 * arrow is a glyph, so each shell draws it in its own set.
 *
 * The arrow is on the rows that sit on something and not on the foundation,
 * which is the whole of what it says. A foundation with an arrow beside it
 * would be pointing at nothing above it.
 */
const Tier = ({
  pile,
  chosen,
  arriving,
  within,
  columns,
  asking,
  stacked = false
}: {
  readonly pile: Piled
  readonly chosen: string | undefined
  readonly arriving: Arriving
  readonly within?: Within
  readonly columns: Columns
  readonly asking?: Asking
  /** Whether this row is standing on the one before it, rather than on nothing. */
  readonly stacked?: boolean
}) => {
  const StackedOn = useArt()["stacked-on"]

  return (
    <div role="treeitem" aria-expanded={pile.above.length > 0 ? true : undefined}>
      {stacked ? <StackedOn size={12} className="t-stack-mark shrink-0 text-ink-accent" /> : null}
      <Row
        one={pile.one}
        court={pile.court}
        chosen={chosen === addressOf(pile.one.reference)}
        arriving={arriving}
        within={within}
        columns={columns}
        asking={asking}
      />
      {pile.above.length > 0 ? (
        <div role="group" className="t-stack ml-4">
          {pile.above.map((higher) => (
            <Tier
              key={addressOf(higher.one.reference)}
              pile={higher}
              chosen={chosen}
              arriving={arriving}
              within={within}
              columns={columns}
              asking={asking}
              stacked
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

const Pile = ({
  pile,
  chosen,
  arriving,
  within,
  columns,
  asking
}: {
  readonly pile: Piled
  readonly chosen: string | undefined
  readonly arriving: Arriving
  readonly within?: Within
  readonly columns: Columns
  readonly asking?: Asking
}) =>
  pile.above.length === 0 ? (
    <Row
      one={pile.one}
      court={pile.court}
      chosen={chosen === addressOf(pile.one.reference)}
      arriving={arriving}
      within={within}
      columns={columns}
      asking={asking}
    />
  ) : (
    <div role="tree" aria-label={`Stacked on ${pile.one.title}`}>
      <Tier
        pile={pile}
        chosen={chosen}
        arriving={arriving}
        within={within}
        columns={columns}
        asking={asking}
      />
    </div>
  )

export const WorkingSet = ({
  sittings,
  onOpen,
  what = "your pull requests",
  scope,
  seed,
  within,
  keys = DEFAULT_PROFILE,
  asking,
  bare = false
}: {
  readonly sittings: ReadonlyArray<Sitting>
  readonly onOpen: (reference: PullRequestRef) => void
  /**
   * Whether something outside is holding this list off the edge of the window already.
   *
   * The padding below belongs to a list that *is* the page — their own `/pulls`, where this
   * takes the full width and a filter box running to the last pixel has its label cut in half.
   * On Home the Rail is beside it and the pair is inset together, so the list's own padding
   * became a second inset: the cards started sixteen pixels further in and twelve lower than
   * the strip they are meant to line up with.
   */
  readonly bare?: boolean
  /** What this list is, which the filter box says in its label. */
  readonly what?: string
  /**
   * The repository every row is in, where this list is one repository's own and
   * says so above the rows. Their addresses then shrink to the number, which is
   * the only part of an address that differs from line to line.
   */
  readonly within?: Within
  /**
   * The name this list's filter is remembered under, or nothing to remember none.
   *
   * Per list rather than one for the whole extension: `author:seawatts` means
   * something in the repository whose rows they are on and nothing anywhere else.
   */
  readonly scope?: string
  /**
   * What the address already asked for, where it asked for anything.
   *
   * A reader can arrive here on a link to closed pull requests, or from
   * GitHub's own controls before this interface took the page. The rows are
   * narrowed either way; without this the box is empty and the page reads as
   * everything there is.
   */
  readonly seed?: string
  readonly keys?: Profile
  /**
   * How a row asks GitHub to change a pull request, where the surface can write.
   *
   * Left out and the rows are what they were: links to read. The list itself has
   * no opinion about which verbs exist — that is the state's to answer, row by
   * row — only about whether anything at all can be asked from here.
   */
  readonly asking?: Asking
}) => {
  /*
   * Seeded from the address, or from what was remembered, in the first render
   * rather than after it. A filter arriving a moment later would draw the whole
   * list and then take most of it away, which reads as the page changing its
   * mind about what was asked.
   *
   * The address wins where it says anything. It is what the reader just did,
   * and the rows on the screen were fetched by it: a box showing last week's
   * filter over this minute's list describes neither.
   */
  const [query, setQuery] = useState(() => {
    if (seed !== undefined && seed.length > 0) return seed
    return scope === undefined ? "" : rememberedFilter(scope)
  })

  const ask = useCallback(
    (next: string) => {
      setQuery(next)
      if (scope !== undefined) rememberFilter(scope, next)
    },
    [scope]
  )
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  /** This list's own rows, so the keyboard reaches one of them and not another list's. */
  const list = useRef<HTMLDivElement>(null)

  /*
   * One line of text is the whole filter, chips included. Parsed here rather than
   * held apart as a dozen booleans, so that what the reader can see in the box is
   * exactly what the list is answering — and so that the terms are testable
   * without a browser, in `src/domain/sieve.ts`.
   */
  const viewer = useMemo(() => loginOnPage(), [])
  const sieve = useMemo(() => sieveOf(query, viewer), [query, viewer])
  const shown = useMemo(() => sifted(sittings, sieve), [sittings, sieve])

  /*
   * Whether this reader keeps their issues in the Courts or under them.
   *
   * Read here rather than handed in, because it is a question about this list
   * and about nothing else on the page: the screens that draw this one are the
   * Working Set, a repository's list and Home, and none of them has any reason
   * to know that issues can be moved. Mixed until storage answers, which is the
   * default and is what most readers are waiting to see anyway.
   *
   * The rule that decides an issue's Court runs before either arrangement, so
   * switching this changes where a row is drawn and never what it means.
   */
  const { settings } = useSettings()
  const apart = settings.home.issues === "separate"

  const arranged = useMemo(() => {
    /*
     * A Court is drawn where it holds something and nowhere else.
     *
     * `filedIn` and `sifted` both leave an empty Court out already, so this guards
     * the surfaces that hand a list in rather than derive one: a screen holding a
     * shape of four Courts while it reads would otherwise draw four headings with
     * a count of nought under each, which is a page claiming to answer a question
     * it has not asked yet.
     */
    const held = (sittings: ReadonlyArray<Sitting>) =>
      sittings.filter((sitting) => sitting.piles.length > 0 || sitting.issues.length > 0)

    if (!apart) return { courts: held(shown), loose: NO_ISSUES }
    const set = setAside(shown)
    return { courts: held(set.sittings), loose: set.issues }
  }, [apart, shown])

  /*
   * Whether an empty list means the filter matched nothing or that the reads the
   * filter asks about have not landed yet.
   *
   * A repository's rows arrive one read before their checks and two before their
   * review decisions, so a remembered `is:passing` excludes every row for about a
   * second after the list is drawn. Telling the reader nothing matched would be
   * blaming their filter for our own staging — and leaves the list a heading with
   * nothing under it.
   */
  const waiting = useMemo(
    () => walkThrough(sittings).some((one) => undecided(one, sieve)),
    [sittings, sieve]
  )

  /*
   * The logins the Author chip offers: the ones in front of the reader, and not
   * their own, which the chip already calls Mine.
   */
  const authors = useMemo(() => {
    const found = new Set<string>()
    for (const one of walkThrough(sittings)) {
      if (one.author.login.toLowerCase() === viewer?.toLowerCase()) continue
      found.add(one.author.login)
    }
    return [...found].sort((first, next) => first.localeCompare(next)).slice(0, 8)
  }, [sittings, viewer])

  /*
   * Every row the eye passes, in the order it passes them.
   *
   * Court by Court rather than every pull request and then every issue, because
   * the walk is a line drawn down what is on the screen: a reader pressing `j`
   * through Your Move and finding themselves in Waiting is following
   * the page, and one who finds themselves back at the top of it is not.
   */
  const stops = useMemo(() => {
    const found: Array<Stop> = []

    for (const sitting of arranged.courts) {
      for (const one of walkThrough([sitting])) {
        found.push({
          kind: "pull-request",
          address: addressOf(one.reference),
          reference: one.reference
        })
      }
      for (const one of sitting.issues) {
        found.push({
          kind: "issue",
          address: addressOfIssue(one.reference),
          reference: one.reference
        })
      }
    }

    for (const one of arranged.loose) {
      found.push({
        kind: "issue",
        address: addressOfIssue(one.reference),
        reference: one.reference
      })
    }

    return found
  }, [arranged])

  const walkable = useMemo(() => stops.map((stop) => stop.address), [stops])

  /*
   * Which rows have been on screen before, so that the ones that have not can
   * arrive and the ones that have can stay still.
   *
   * A repository's list is read in stages, and the later ones only add to rows
   * already drawn: whose move it is, then the checks, then the branches that
   * fold rows into stacks. Folding a row into a stack moves it inside a tree, so
   * React builds a new element for it — and an entrance keyed to the element
   * would replay every time a stage lands. Keyed to the pull request instead, a
   * row enters once and then holds its place however the list is rearranged
   * around it.
   */
  const seen = useRef<ReadonlySet<string>>(new Set())
  // Whether anything has been drawn yet, which decides whether the first set of
  // rows arrives or is simply here.
  const drawn = useRef(false)

  const entering = useMemo(() => {
    const fresh = new Map<string, number>()
    // The first set does not arrive. The screen that owns this list drew a
    // skeleton over the wait, and that skeleton dissolving is this moment's
    // motion: rows rising into place underneath it would be two entrances for
    // one event, each hiding half of the other, and the list would read as
    // unable to settle. Every stage after this one is a genuine arrival into a
    // list already on the screen, and those still rise.
    if (!drawn.current) return fresh

    for (const address of walkable) {
      if (seen.current.has(address)) continue
      fresh.set(address, Math.min(fresh.size, STAGGERED - 1))
    }
    return fresh
  }, [walkable])

  useEffect(() => {
    drawn.current = true
    if (walkable.length === 0) return
    // Everything currently drawn, rather than only what just entered: a row the
    // filter is hiding has still been seen, and typing a word should not make it
    // arrive again when the word is deleted.
    seen.current = new Set([...seen.current, ...walkable])
  }, [walkable])

  const arriving = useMemo<Arriving>(() => (address) => entering.get(address), [entering])

  const move = (by: number): void => {
    if (walkable.length === 0) return
    const at = chosen === undefined ? -1 : walkable.indexOf(chosen)
    // From nowhere, either direction arrives at the first: a reader pressing a
    // key wants to be somewhere, and the top is the only defensible somewhere.
    // From a row, round the ends, the same as the files in a review: a held key
    // spins the list rather than stopping dead at the bottom of it.
    const to = at === -1 ? 0 : stepping(walkable.length, at, by)
    setChosen(walkable[to])
  }

  /**
   * The row the walk is on, opened in a tab of its own.
   *
   * The reason it is worth a key: reading a list is triage, and triage is opening
   * four things to come back to rather than leaving the list for each one and
   * finding your place in it again. A pointer has had this all along, through
   * the browser's own handling of a held modifier on a link; the keyboard had
   * Enter and nothing else.
   *
   * `window.open` rather than a click on the row's own link with keys faked onto
   * it: an event a script makes carries no modifiers the browser will honour, so
   * a synthesised shift-click opens in this tab, which is the opposite of what
   * was asked.
   */
  const openAside = (): void => {
    const found = stops.find((stop) => stop.address === chosen)
    if (found === undefined) return

    const where =
      found.kind === "pull-request" ? linkOf(found.reference) : pageOf(found.reference)
    window.open(where, "_blank", "noopener")
  }

  useKeys(keys, {
    nextFile: () => move(1),
    previousFile: () => move(-1),
    openAside
  })

  useEffect(() => {
    const open = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" || chosen === undefined) return
      // Enter in the filter box is the reader finishing a word, not opening
      // whatever happens to be selected behind it.
      const on = event.target
      if (on instanceof HTMLElement && on.closest("input, textarea") !== null) return

      const found = stops.find((stop) => stop.address === chosen)
      if (found === undefined) return

      event.preventDefault()

      if (found.kind === "pull-request") {
        onOpen(found.reference)
        return
      }

      /*
       * An issue is opened by pressing its own link, which is the one thing here
       * that is not this interface's to do better. The prop above carries the
       * worker that has a pull request screen ready before the press lands;
       * there is no such screen for an issue, so the row is a link to GitHub's
       * page and the keyboard follows it exactly as a click would — through the
       * browser, so a middle press, a modifier and the history all behave.
       */
      for (const link of list.current?.querySelectorAll("a[data-issue]") ?? []) {
        if (link.getAttribute("data-issue") !== chosen) continue
        if (link instanceof HTMLAnchorElement) link.click()
        return
      }
    }

    document.addEventListener("keydown", open)
    return () => document.removeEventListener("keydown", open)
  }, [chosen, stops, onOpen])

  /*
   * The columns every row in this list will keep, decided once for the list. From
   * `sittings` rather than `shown`, so that a filter narrowing the list to three
   * rows does not re-cut its columns while the reader is still typing.
   */
  const columns = useMemo(() => columnsIn(sittings, within), [sittings, within])

  const anything = sittings.some((sitting) => sitting.count > 0)

  return (
    // Down the page only, and unless somebody outside is already doing it. Across, the frame
    // belongs to the shell — `#gitquiet-root` on GitHub's page, `.page` in the window — so that
    // this list starts on the same line as the bar above it and as every other screen. It had
    // sixteen pixels of its own, which stacked with the shell's to sixty-four on a wide window.
    //
    // Named as whose keys these are, so the letters inside a row's menu are read
    // against the same profile as the `j` that walked the reader onto the row.
    // Through a context rather than a prop: the menu is four components down and
    // none of them between here and there has an opinion about keyboards.
    <Keying value={keys}>
      <div
        ref={list}
        /* Four pixels between the filter row and the Courts, and between the Courts themselves.
           Each Court is its own filled card, so the fill is what separates them; the twelve
           pixels of canvas this started at was a gutter doing a border's job twice over. */
        className={`t-panels flex flex-col gap-1 ${bare ? "" : "py-3"}`}
      >
        <Filters query={query} authors={authors} viewer={viewer} what={what} onQuery={ask} />

        {!anything ? (
          <p className="px-3 py-2 text-sm text-ink-muted">
            Nothing needs you. No pull request is waiting on you.
          </p>
        ) : shown.length === 0 && waiting ? (
          <StillReading what="Still reading what this filter asks about." />
        ) : shown.length === 0 ? (
          <p className="px-3 py-2 text-sm text-ink-muted">Nothing matches that.</p>
        ) : (
          <>
            {arranged.courts.map((sitting) => (
              <Section
                key={sitting.court}
                name={COURT_NAME[sitting.court]}
                tone={COURT_TONE[sitting.court]}
                art={COURT_ART[sitting.court]}
                summary={<span className="tabular-nums">{sitting.count}</span>}
              >
                <div className="divide-y divide-line-muted">
                  {/* Both bands or neither: a Court holding one kind needs no line telling it
                      which kind it is, and the heading above already said. */}
                  {sitting.piles.length > 0 && sitting.issues.length > 0 ? (
                    <Seam art="pull-request" name="Pull requests" many={sitting.piles.length} />
                  ) : null}

                  {sitting.piles.map((pile) => (
                    <Pile
                      key={addressOf(pile.one.reference)}
                      pile={pile}
                      chosen={chosen}
                      arriving={arriving}
                      within={within}
                      columns={columns}
                      asking={asking}
                    />
                  ))}

                  {/*
                   * The issues after the pull requests, in the same box and under the
                   * same count, with a quiet rule between the two kinds. See the seam
                   * inside `Issues` for why it is there and why it is that quiet.
                   *
                   * Nothing at all where the Court holds no issues. Drawn anyway, this
                   * put a band reading `Issues 0` under every Court of pull requests: a
                   * heading for a kind of row that is not on the page.
                   */}
                  {sitting.issues.length === 0 ? null : (
                    <Issues
                      issues={sitting.issues}
                      court={sitting.court}
                      onlyIssues={sitting.piles.length === 0}
                      chosen={chosen}
                      arriving={arriving}
                      within={within}
                      columns={columns}
                    />
                  )}
                </div>
              </Section>
            ))}

            {/*
             * The reader who asked for the two apart, answered underneath rather
             * than beside: the Courts are the page and the issues are a section of
             * it, which is what "their own section" was chosen to mean.
             *
             * Headed by the words the spec gives them, because a box of rows under
             * three Courts with no heading is a fourth Court whose name the reader
             * has to work out. Each row still says which Court owes it, since that
             * is the one thing this arrangement takes off the screen.
             */}
            {arranged.loose.length === 0 ? null : (
              <Section
                name="Involved Issues"
                art="issue"
                summary={<span className="tabular-nums">{arranged.loose.length}</span>}
              >
                <div className="divide-y divide-line-muted">
                  {arranged.loose.map((one) => (
                    <IssueRow
                      key={addressOfIssue(one.reference)}
                      one={one}
                      court={courtOfIssue(one)}
                      chosen={chosen === addressOfIssue(one.reference)}
                      arriving={arriving}
                      within={within}
                      columns={columns}
                    />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </Keying>
  )
}
