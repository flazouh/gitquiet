/**
 * Which of four groups a listed repository belongs in, and the two figures drawn
 * over a whole list.
 *
 * The one thing readers have asked GitHub for on these pages, louder than anything
 * else and for longer: 1,679 upvotes across three discussions open since June 2021,
 * all asking to divide a repository list into groups. Every attempt to answer it by
 * hand has failed since 2014, because a list of 154 repositories is a list nobody
 * tags twice. So nothing here is tagged. Every group is derived from what the rows
 * already say, which means it is right the first time a page is opened and stays
 * right without anybody maintaining it. `docs/spec/profile.md` has the counts.
 *
 * Groups rather than filters, and the difference matters: a filter shows one thing
 * and hides the rest, so a reader has to know what they want before they look. A
 * group shows everything with a shape, which is what somebody scrolling 154 rows
 * is short of.
 */

import { Option } from "effect"

/** One row of a person's repositories tab or stars tab, as the page lists it. */
export type ListedRepository = {
  readonly owner: string
  readonly repo: string
  /** `owner/repo`, which is the only name that is an address. */
  readonly nameWithOwner: string
  readonly description: Option.Option<string>
  /** Their topics, in the order the row listed them. Often none. */
  readonly topics: ReadonlyArray<string>
  /**
   * The language GitHub names for it, with the colour they paint it.
   *
   * The colour comes from the row rather than from a table of ours: GitHub ships one
   * per language and a table here would be a second copy of it, wrong on whatever
   * they added last month.
   */
  readonly language: Option.Option<{ readonly name: string; readonly colour: string }>
  readonly stars: number
  readonly forks: number
  /**
   * When it was last pushed to, ISO 8601, or nothing.
   *
   * Nothing where the row carried no date at all, which happens on a repository
   * with no commits. Read off their own `<relative-time>`, so it is GitHub's
   * timestamp and not a guess from the words beside it.
   */
  readonly pushedAt: Option.Option<string>
  readonly isArchived: boolean
  /**
   * Whether GitHub calls it a fork at all.
   *
   * Apart from {@link forkedFrom}, which is the parent's name and is missing on a fork
   * whose parent was deleted or made private. The flag is on every fork either way, so a
   * row can say what it is without being able to say what it came from.
   */
  readonly isFork: boolean
  /** A fork, with the repository it came from where the row named one. */
  readonly forkedFrom: Option.Option<string>
  readonly isPrivate: boolean
}

/**
 * One page of a person's list, and whether there is another behind it.
 *
 * Both halves together because a group is only true over the whole list: a reader with
 * 154 repositories has five pages of them, and a Moving count over the first thirty is
 * a wrong answer confidently drawn. So a screen holding this knows whether what it is
 * counting is all of it.
 */
export type Listing = {
  readonly rows: ReadonlyArray<ListedRepository>
  readonly more: boolean
}

/**
 * What a repository is doing, which is what a reader of a list wants to know.
 *
 * **Moving** was pushed to lately. **Quiet** was not, and is not marked as over.
 * **Retired** is archived, which is the owner saying so themselves. **Forked** is
 * somebody else's work, sitting still.
 *
 * Four groups and no fifth, because the next one anybody proposes — "popular",
 * "documentation", "experiments" — needs a judgement the rows cannot supply.
 *
 * _Avoid_: active, stale, dead, inactive, archived-and-forked.
 */
export type Life = "moving" | "quiet" | "retired" | "forked"

/**
 * How lately is lately.
 *
 * Thirty days, which is the window GitHub's own "recently pushed" language uses and
 * short enough that Moving means something. A year would put every abandoned
 * project in it and the group would answer nothing.
 */
export const MOVING_DAYS = 30

const DAY = 24 * 60 * 60 * 1000

/**
 * Which group one row is in.
 *
 * The order of these three questions is the whole rule, so it is worth saying why
 * it is this order.
 *
 * Archived first, because it is the only one the owner said out loud. A repository
 * they retired last week was pushed to last week, and reading that as Moving would
 * have the interface argue with its own owner.
 *
 * Then Moving, before the fork question, so that a fork somebody is working in is
 * work. This is the case the obvious rule gets wrong: forks are mostly noise on
 * these pages, but the fork a person pushed to yesterday is what they are doing
 * today, and burying it under a heading that reads "somebody else's" hides the one
 * row that answered the reader's question.
 *
 * A fork after that is a fork. And a repository with no date at all — no commits
 * yet — is Quiet, because nothing has moved in it.
 */
export const lifeOf = (one: ListedRepository, now: Date = new Date()): Life => {
  if (one.isArchived) return "retired"

  const pushed = Option.getOrUndefined(one.pushedAt)
  const at = pushed === undefined ? undefined : Date.parse(pushed)
  const moving = at !== undefined && Number.isFinite(at) && now.getTime() - at <= MOVING_DAYS * DAY

  if (moving) return "moving"
  if (Option.isSome(one.forkedFrom)) return "forked"

  return "quiet"
}

/** One group, with its rows in the order they will be drawn. */
export type Group = {
  readonly life: Life
  readonly rows: ReadonlyArray<ListedRepository>
}

/**
 * The order the groups are drawn in, and it is the order a reader asks in.
 *
 * What is happening, then what is here, then what is over, then what is not theirs.
 * Empty groups are dropped rather than drawn with a nothing under them: four
 * headings on an account with three repositories is a shape that says less than the
 * three rows do.
 */
export const LIVES: ReadonlyArray<Life> = ["moving", "quiet", "retired", "forked"]

/**
 * A list of rows as the four groups, newest push first inside each.
 *
 * Sorted by push inside a group rather than by stars: stars order a list by how it
 * did, and a reader on somebody's repositories tab is asking what they are doing.
 * A row with no date sorts last, which is where a repository with no commits
 * belongs in a list ordered by pushes.
 */
export const grouped = (
  rows: ReadonlyArray<ListedRepository>,
  now: Date = new Date()
): ReadonlyArray<Group> => {
  const held = new Map<Life, Array<ListedRepository>>()

  for (const one of rows) {
    const life = lifeOf(one, now)
    const already = held.get(life)
    if (already === undefined) held.set(life, [one])
    else already.push(one)
  }

  return LIVES.flatMap((life) => {
    const found = held.get(life)
    if (found === undefined || found.length === 0) return []

    return [{ life, rows: [...found].sort((left, right) => pushedFirst(left, right)) }]
  })
}

/** Newest push first, and a row with no date after every row that has one. */
const pushedFirst = (left: ListedRepository, right: ListedRepository): number => {
  const when = (one: ListedRepository): number => {
    const pushed = Option.getOrUndefined(one.pushedAt)
    const at = pushed === undefined ? Number.NaN : Date.parse(pushed)
    return Number.isFinite(at) ? at : Number.NEGATIVE_INFINITY
  }

  return when(right) - when(left) || left.nameWithOwner.localeCompare(right.nameWithOwner)
}

/**
 * The groups that start shut.
 *
 * Forked, because a fork nobody pushed to is somebody else's work and is most of what
 * makes these lists long. Quiet as well, because it is the larger half of most accounts
 * and it is not what anybody opens a list of repositories to find: 60 of this author's
 * 90 are quiet, and every one of them sat above Retired and pushed it off the screen.
 * Moving is what the reader came for and it stays open.
 *
 * Shut is not hidden. The heading carries the count, so a shut group still says how many
 * are in it, and one press is the whole cost of reading them.
 */
export const SHUT_AT_FIRST: ReadonlySet<Life> = new Set<Life>(["quiet", "forked"])

/** One remembered turn of one group of one person's list. */
export const turnedEntry = (login: string, life: Life): string => `${login.toLowerCase()}:${life}`

/**
 * Whether a group is shut, from what the reader turned and what it started as.
 *
 * A stored entry means "the reader turned this group the other way", rather than
 * "this group is shut". One list carries both halves that way: Forked starts shut,
 * so an entry for it means opened, and an entry for Moving means shut. The
 * alternative was a second list of what is open, and two lists that have to
 * disagree about the same group is how a group ends up in both.
 *
 * Per person, because 154 repositories of one account and three of another are not
 * the same list and do not want the same shape.
 */
export const isShut = (
  turned: ReadonlyArray<string>,
  login: string,
  life: Life
): boolean => SHUT_AT_FIRST.has(life) !== turned.includes(turnedEntry(login, life))

/** One cell of the last-moved strip: a repository, when it moved, and how lately. */
export type Cell = {
  readonly nameWithOwner: string
  readonly when: Option.Option<string>
  /** 4 for this week down to 0 for over a year ago or never. */
  readonly level: 0 | 1 | 2 | 3 | 4
}

/**
 * The steps of the strip, in days, and the reason for each.
 *
 * A week, a month, half a year, a year. The month is `MOVING_DAYS`, so the strip
 * and the groups are drawing the same fact at two resolutions rather than two
 * facts that nearly agree.
 */
const STEPS: ReadonlyArray<readonly [number, Cell["level"]]> = [
  [7, 4],
  [MOVING_DAYS, 3],
  [180, 2],
  [365, 1]
]

/**
 * Every repository as one cell, newest push first.
 *
 * The figure a reader reads instead of thirty rows: a strip that is bright on the
 * left and grey for the rest of its length says one person keeps one thing alive,
 * and an even strip says the opposite. Neither sentence is on GitHub's page,
 * though every row carries the date it is drawn from.
 *
 * One cell per repository and no bucketing by week, unlike the contribution
 * calendar this borrows its shape from. A repository is the unit a reader presses,
 * and a cell that stands for four of them cannot be pressed.
 */
export const movement = (
  rows: ReadonlyArray<ListedRepository>,
  now: Date = new Date()
): ReadonlyArray<Cell> =>
  [...rows].sort(pushedFirst).map((one) => {
    const pushed = Option.getOrUndefined(one.pushedAt)
    const at = pushed === undefined ? Number.NaN : Date.parse(pushed)
    const days = Number.isFinite(at) ? (now.getTime() - at) / DAY : Number.POSITIVE_INFINITY

    return {
      nameWithOwner: one.nameWithOwner,
      when: one.pushedAt,
      level: STEPS.find(([within]) => days <= within)?.[1] ?? 0
    }
  })

/** One band of the share figure: a language, its colour, and how much of the list it is. */
export type Share = {
  readonly name: string
  readonly colour: string
  /** How many rows are in it. */
  readonly count: number
  /** Its part of the whole, 0 to 1, for the width of a band. */
  readonly part: number
}

/**
 * The languages of a list, largest first, as a bar can draw them.
 *
 * By row and not by byte. GitHub counts a repository's languages by bytes, and this
 * cannot: the rows carry one language each, the one they call primary. Counting
 * rows is the honest reading of what is there, and it answers the question a reader
 * of somebody's list actually has — what do they mostly write — rather than which
 * repository happens to hold the most generated CSS.
 *
 * Rows with no language are left out rather than drawn as a grey band. A band that
 * stands for absence invites a press and has nothing behind it.
 */
export const shares = (rows: ReadonlyArray<ListedRepository>): ReadonlyArray<Share> => {
  const counted = new Map<string, { readonly colour: string; count: number }>()

  for (const one of rows) {
    const language = Option.getOrUndefined(one.language)
    if (language === undefined) continue

    const already = counted.get(language.name)
    if (already === undefined) counted.set(language.name, { colour: language.colour, count: 1 })
    else already.count += 1
  }

  const named = [...counted.entries()]
  const whole = named.reduce((sum, [, one]) => sum + one.count, 0)
  if (whole === 0) return []

  return named
    .map(([name, one]) => ({ name, colour: one.colour, count: one.count, part: one.count / whole }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
}

/**
 * The rows whose name, description or topics hold every word typed.
 *
 * Wider than GitHub's own box on these pages, which reads names alone — their
 * documentation says so, and it is why finding a starred repository by what it does
 * is impossible there. Somebody who saved a library eight months ago remembers that
 * it parsed dates, not that it was called `chrono`.
 *
 * Words all have to match, in any order, case-insensitively, which is the same rule
 * the repository switcher uses. One rule for finding things, wherever it is done.
 */
export const matching = (
  rows: ReadonlyArray<ListedRepository>,
  typed: string
): ReadonlyArray<ListedRepository> => {
  const words = typed
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0)
  if (words.length === 0) return rows

  return rows.filter((one) => {
    const against = [
      one.nameWithOwner,
      Option.getOrElse(one.description, () => ""),
      ...one.topics,
      Option.match(one.language, { onNone: () => "", onSome: (language) => language.name })
    ]
      .join(" ")
      .toLowerCase()

    return words.every((word) => against.includes(word))
  })
}
