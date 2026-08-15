import { Option } from "effect"
import { useMemo, useRef, useState } from "react"
import {
  type Cell,
  type Group,
  grouped,
  isShut,
  type Life,
  type ListedRepository,
  matching,
  movement,
  type Share,
  shares,
  turnedEntry
} from "../domain/life"
import type { Person } from "../domain/person"
import { personIn } from "../github/person"
import { useArt } from "./art"
import { ASIDE, FIELD, PILL } from "./dress"
import { PersonAside } from "./PersonAside"
import { PersonTabs } from "./PersonTabs"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { painted, Section } from "./Section"
import { TheBar } from "./TheBar"
import type { Load } from "./useLive"
import { useLive } from "./useLive"
import { usePerson } from "./usePerson"
import { useSettings } from "./useSettings"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"
import { dayOf, momentOf } from "./when"

/**
 * A person's repositories, as the screen has them at this moment.
 *
 * `reading` and `capped` are the two honest qualifications on a count. The rows are
 * read a page at a time behind the first paint, so a Moving count is provisional
 * until the walk ends, and a walk that stopped at the cap has not seen their whole
 * list. A group count drawn without either sentence is a wrong number stated plainly.
 */
export type Shown = {
  readonly rows: ReadonlyArray<ListedRepository>
  readonly reading: boolean
  readonly capped: boolean
}

export type PersonReposScreenProps = {
  readonly login: string
  readonly load: Load<Shown>
  /**
   * Who their page says they are, for the column down the left.
   *
   * Given where somebody already has it, which is a test or the staging shots. The
   * screen reads it off the page otherwise, and draws the list without the column where
   * that read comes back with nothing: the list is what the reader came for.
   */
  readonly who?: Person
  /** How to read that column off the served page. Only a test ever passes one. */
  readonly readWho?: (page: Document) => Option.Option<Person>
  /** Restores GitHub's own page, which is still behind this one. */
  readonly onStepAside: () => void
  readonly signedIn?: () => boolean
  /** The day it is, for the groups and the strip. Only a test ever passes one. */
  readonly now?: Date
}

const READING = "Reading their repositories…"

/** What each group is called on the screen, and what it means under the name. */
const NAMED: Record<Life, { readonly title: string; readonly gist: string }> = {
  moving: { title: "Moving", gist: "pushed to in the last 30 days" },
  quiet: { title: "Quiet", gist: "no push in the last 30 days" },
  retired: { title: "Retired", gist: "archived by their owner" },
  forked: { title: "Forked", gist: "somebody else's work, sitting still" }
}

/**
 * What they mostly write, over every repository rather than over this page.
 *
 * By row, and the card says so under itself. GitHub counts a repository's languages
 * by bytes and these rows carry one language each, so a percentage claimed here
 * would be a different number from the one on the repository's own page under the
 * same word. Counting rows answers the question a reader of somebody's list has —
 * what do they mostly write — and can be said without arguing with their page.
 */
const Shares = ({ list }: { readonly list: ReadonlyArray<Share> }) => {
  if (list.length === 0) return null

  return (
    <Section name="Languages" art="code" summary="by repository">
      <div className="flex flex-col gap-2.5 px-3 py-2.5">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-inset">
          {list.map((one) => (
            <span
              key={one.name}
              title={`${one.name}: ${one.count} ${one.count === 1 ? "repository" : "repositories"}`}
              style={{ width: `${Math.max(one.part * 100, 1)}%`, background: one.colour }}
            />
          ))}
        </div>
        <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${ASIDE}`}>
          {list.slice(0, 6).map((one) => (
            <span key={one.name} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ background: one.colour }} />
              <span className="text-ink">{one.name}</span>
              <span className="tabular-nums">{one.count}</span>
            </span>
          ))}
        </p>
      </div>
    </Section>
  )
}

/**
 * How dark a cell of the strip is, one step per step of the age.
 *
 * The pack's own five steps rather than one colour at five opacities. A translucent
 * fill takes the colour of whatever is behind it, and behind this is GitHub's page in
 * whichever theme the reader set — so the pale end of an opacity ladder was legible on
 * their light page and invisible on their dark one.
 */
const LEVELS: Record<Cell["level"], string> = {
  4: "bg-pass-emphasis",
  3: "bg-pass",
  2: "bg-ink-muted",
  1: "bg-line",
  0: "bg-inset"
}

/**
 * When each repository last moved, as one cell each, newest on the left.
 *
 * The figure that answers "is any of this alive" without a row being read: bright at
 * the left end and grey for the rest of its length is one person keeping one thing
 * going, and an even strip is somebody maintaining everything they own. Both
 * sentences are already in the thirty dates on GitHub's page and neither is legible
 * there.
 *
 * A cell is a link, because a reader who spots the bright end wants the repository
 * that is at it.
 */
const Movement = ({ list }: { readonly list: ReadonlyArray<Cell> }) => {
  if (list.length === 0) return null

  return (
    <Section name="Last moved" art="clock" summary="newest first">
      <div className="flex flex-col gap-2.5 px-3 py-2.5">
        <div className="flex flex-wrap gap-0.5">
          {list.map((one) => (
            <a
              key={one.nameWithOwner}
              href={`/${one.nameWithOwner}`}
              title={Option.match(one.when, {
                onNone: () => `${one.nameWithOwner}: never pushed to`,
                onSome: (when) => `${one.nameWithOwner}: ${momentOf(when)}`
              })}
              aria-label={one.nameWithOwner}
              className={`size-2.5 rounded-sm ${LEVELS[one.level]}`}
            />
          ))}
        </div>
        {/* What the brightness means, because a strip of five greys is a legend nobody
            was given. The count is beside the find field and is not repeated here. */}
        <p className={ASIDE}>One cell each, brighter the more recently it moved.</p>
      </div>
    </Section>
  )
}

/**
 * How wide each of a row's columns is, in the order a row draws them.
 *
 * Fixed tracks rather than a line of flexbox, which is the same repair the Working Set
 * documents and the same reason: read one row at a time, contents-sized cells are right,
 * and a list is not read one row at a time. Sized to the widest thing each column holds
 * in a real list — thirty rows of `sindresorhus` and thirty of `tj` — with the
 * description taking whatever is left, because it is the part worth the width.
 */
const TRACK = {
  name: "14rem",
  said: "minmax(0,1fr)",
  language: "7rem",
  stars: "5.5rem",
  forks: "5rem",
  when: "5.5rem"
} as const

/**
 * Which of the columns a list reserves room for.
 *
 * Over every row rather than each one, so a fact three rows have does not push the
 * other twenty-seven out of line. Over the whole list rather than the found rows, so
 * that typing in the field does not walk the columns sideways under the reader's eyes:
 * the Working Set settled both of these and this is the same list one page along.
 */
type Columns = {
  readonly language: boolean
  readonly stars: boolean
  readonly forks: boolean
}

const columnsIn = (rows: ReadonlyArray<ListedRepository>): Columns => {
  let language = false
  let stars = false
  let forks = false

  for (const one of rows) {
    if (Option.isSome(one.language)) language = true
    if (one.stars > 0) stars = true
    if (one.forks > 0) forks = true
    if (language && stars && forks) break
  }

  return { language, stars, forks }
}

const tracksOf = (columns: Columns): string =>
  [
    TRACK.name,
    TRACK.said,
    ...(columns.language ? [TRACK.language] : []),
    ...(columns.stars ? [TRACK.stars] : []),
    ...(columns.forks ? [TRACK.forks] : []),
    TRACK.when
  ].join(" ")

/**
 * One repository, as a row of the group it belongs to.
 *
 * One line, and every fact on it in the same column as the row above's. Their own rows
 * are five lines tall — name, description, topics as chips, language, stars, licence and
 * a date — which is how thirty repositories become a page nobody scrolls to the end of.
 * The topics are still how a reader finds one; they are read by the find box above
 * rather than printed on every row.
 *
 * The name is the link and the row is not, the way a Change's row is: a reader who wants
 * to select a repository's name should not have to open it to do that.
 */
const Row = ({
  one,
  columns,
  at,
  now
}: {
  readonly one: ListedRepository
  readonly columns: Columns
  /** Where in the group it is, for the entrance. Absent where nothing should animate. */
  readonly at?: number
  readonly now: Date
}) => {
  const language = Option.getOrUndefined(one.language)
  const pushed = Option.getOrUndefined(one.pushedAt)
  /*
   * What it is, or where it came from where it is somebody else's work and says nothing
   * of its own. One sentence either way rather than one of two, so the line and the
   * tooltip over it cannot say different things about the same cell.
   */
  const says = Option.getOrUndefined(
    Option.orElse(one.description, () =>
      Option.map(one.forkedFrom, (from) => `forked from ${from}`)
    )
  )

  return (
    <li
      data-row=""
      className={`grid min-w-0 items-center gap-2 px-3 py-1.5 hover:bg-hover ${
        at === undefined ? "" : "t-row-in"
      }`}
      style={
        {
          gridTemplateColumns: tracksOf(columns),
          ...(at === undefined ? {} : { "--row-at": String(at) })
        } as React.CSSProperties
      }
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <a
          href={`/${one.nameWithOwner}`}
          className="min-w-0 truncate font-semibold text-ink text-sm no-underline hover:underline"
        >
          {one.repo}
        </a>
        {one.isPrivate ? (
          <span className={`${PILL} shrink-0 text-ink-muted text-[11px]`}>Private</span>
        ) : null}
      </span>

      {/* One cell either way, so the columns past it stay straight. */}
      <span className={`min-w-0 truncate ${ASIDE}`} title={says}>
        {says}
      </span>

      {columns.language ? (
        <span className={`flex min-w-0 items-center gap-1.5 ${ASIDE}`}>
          {language === undefined ? null : (
            <>
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: language.colour }}
              />
              <span className="truncate">{language.name}</span>
            </>
          )}
        </span>
      ) : null}

      {/* The counts in their own tracks, held open on the rows that have none of them:
          an empty cell costs nothing and is what keeps the cells either side in line. */}
      {columns.stars ? (
        <span className={`text-right tabular-nums ${ASIDE}`}>
          {one.stars === 0 ? null : `${one.stars.toLocaleString()} ${one.stars === 1 ? "star" : "stars"}`}
        </span>
      ) : null}

      {columns.forks ? (
        <span className={`text-right tabular-nums ${ASIDE}`}>
          {one.forks === 0 ? null : `${one.forks.toLocaleString()} ${one.forks === 1 ? "fork" : "forks"}`}
        </span>
      ) : null}

      {/* A date and never a distance: "2 years ago" under "3 years ago" is the same
          three words to somebody scanning thirty rows. See `dayOf`. */}
      <span className={`text-right tabular-nums ${ASIDE}`}>
        {pushed === undefined ? (
          /* One word in a column this width, and the sentence said aloud beside it: a
             reader being read to gets "never pushed to", which is the whole fact. */
          <span role="img" aria-label="never pushed to" title="never pushed to">
            never
          </span>
        ) : (
          <span title={momentOf(pushed)}>{dayOf(pushed, now)}</span>
        )}
      </span>
    </li>
  )
}

/** How many rows carry the staggered entrance before it stops climbing. */
const STAGGERED = 8

/**
 * One group: its name, its count, its meaning, and its rows until the reader shuts it.
 *
 * A card the size and shape of a Court, because that is what it is — a heading, a count
 * in the header, and rows under it — and it is painted from `Section`'s own table so the
 * two cannot drift. The heading is the control, the way a release's own fold is: a
 * chevron beside a heading is a target a third of the size of the thing it opens.
 *
 * Native `details` rather than state and a button. A fold GitHub can already open with
 * the browser's own find-on-page is a fold that behaves the way the rest of the web
 * does, and the remembering rides on `onToggle` rather than replacing it.
 */
const Fold = ({
  group,
  columns,
  shut,
  onTurn,
  quiet,
  now
}: {
  readonly group: Group
  readonly columns: Columns
  readonly shut: boolean
  readonly onTurn: () => void
  /** Whether the rows should arrive without motion, which is while somebody is typing. */
  readonly quiet: boolean
  readonly now: Date
}) => {
  const art = useArt()
  const Chevron = art["chevron-right"]
  const paint = painted("plain")

  return (
    <details
      open={!shut}
      onToggle={(event) => {
        // React fires this for the state it is already in as well, on the first paint of a
        // fold that was remembered shut. Answered only when it disagrees, or the remembered
        // state would be written back inverted the moment the page opened.
        if (event.currentTarget.open === !shut) return
        onTurn()
      }}
      className={`group shrink-0 overflow-hidden rounded-md border bg-canvas ${paint.edge}`}
    >
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 border-b px-3 py-2 hover:bg-hover [&::-webkit-details-marker]:hidden ${paint.header}`}
      >
        <Chevron
          size={12}
          aria-hidden="true"
          className="shrink-0 opacity-80 transition-transform duration-[var(--duration-quick)] ease-[var(--ease-in-out)] group-open:rotate-90"
        />
        <h2 className="min-w-0 shrink-0 truncate font-semibold text-xs">
          {NAMED[group.life].title}
        </h2>
        <span className="shrink-0 text-ink-muted text-xs tabular-nums">{group.rows.length}</span>
        <span className="min-w-0 flex-1 truncate text-ink-muted text-xs">
          {NAMED[group.life].gist}
        </span>
      </summary>
      <ul className="flex list-none flex-col divide-y divide-line-muted p-0">
        {group.rows.map((one, index) => (
          <Row
            key={one.nameWithOwner}
            one={one}
            columns={columns}
            at={quiet ? undefined : Math.min(index, STAGGERED)}
            now={now}
          />
        ))}
      </ul>
    </details>
  )
}

/**
 * A person's repositories tab, in four groups, beside who they are.
 *
 * The loudest unanswered ask on these pages: three discussions carrying 1,679
 * upvotes, the oldest open since June 2021, all asking for this one thing. Nothing
 * here is tagged by anybody — every group is derived from what the rows already
 * say — because curation by hand is the documented failure mode and has failed
 * since 2014. `docs/spec/profile.md` has the evidence.
 *
 * The whole page rather than the list: their column, their tab row and their rows are
 * all replaced, because a page drawn half in one interface and half in another is read
 * as a broken page. See `PersonAside` and `PERSON` in `place.ts`.
 */
export const PersonReposScreen = ({
  login,
  load,
  who,
  readWho = personIn,
  onStepAside,
  signedIn = viewerOnPage,
  now = new Date()
}: PersonReposScreenProps) => {
  /* What was given, or what the page says once it has been parsed. See `usePerson`. */
  const served = usePerson(readWho)
  const them = who ?? served
  const live = useLive(load)
  const { read } = live
  const waiting = useWaiting(read.status)
  const { settings, change } = useSettings()
  const [typed, setTyped] = useState("")
  const box = useRef<HTMLInputElement | null>(null)

  const shown = read.status === "ready" ? read.value : undefined
  const rows = shown?.rows ?? []

  /*
   * Every figure and every group over the same list, and it is the list after the
   * reader's own find rather than before it. A share bar that ignores the field is a
   * figure describing a page nobody is looking at.
   */
  const found = useMemo(() => matching(rows, typed), [rows, typed])
  const groups = useMemo(() => grouped(found, now), [found, now])
  const languages = useMemo(() => shares(found), [found])
  const strip = useMemo(() => movement(found, now), [found, now])
  /* From every row and not the found ones, so a word typed here cannot move the columns. */
  const columns = useMemo(() => columnsIn(rows), [rows])

  if (read.status === "failed") {
    return (
      <ReadFailed
        signedOut={!signedIn()}
        why={read.why}
        what={`${login}'s repositories`}
        onStepAside={onStepAside}
        asideLabel="Show GitHub's page"
      />
    )
  }

  const narrowed = typed.trim().length > 0

  return (
    <div className="relative">
      <TheBar where={{ kind: "person", login }} />
      <div className="flex min-w-0 flex-col gap-4 py-3 lg:flex-row lg:items-start">
        {them === undefined ? null : <PersonAside who={them} onStepAside={onStepAside} />}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <PersonTabs login={login} on="repositories" who={them} />

          {shown === undefined ? null : (
            <div className="t-panels flex min-w-0 flex-col gap-1">
              {/* The bar gets the wider half. It is the figure a reader takes a shape
                  from, and the strip is thirty cells wide whatever room it is given. */}
              <div className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <Shares list={languages} />
                <Movement list={strip} />
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-3 pt-1 pb-0.5">
                <input
                  ref={box}
                  type="search"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return
                    setTyped("")
                  }}
                  /* Their own box on this page reads names, which their documentation says
                     outright. Somebody who kept a library remembers that it parsed dates,
                     not that it was called `chrono`. */
                  placeholder="Find by name, description or topic"
                  aria-label="Find a repository"
                  className={`${FIELD} h-8 min-w-0 flex-1 px-3 text-sm`}
                />
                {/* Held off the edge by the same twelve pixels a row's last column keeps,
                    so the count reads as the end of a column rather than as a stray. */}
                <p aria-live="polite" className={`pr-3 ${ASIDE} tabular-nums`}>
                  {narrowed
                    ? `${found.length} of ${rows.length}`
                    : `${rows.length} ${rows.length === 1 ? "repository" : "repositories"}`}
                  {/* Both qualifications on the count, said where the count is. A group
                      total over part of a list is the wrong answer confidently drawn. */}
                  {shown.reading ? ", reading the rest…" : ""}
                  {shown.capped ? ", the first pages of a longer list" : ""}
                </p>
              </div>

              {groups.length === 0 ? (
                <p className="px-3 py-6 text-center text-ink-muted text-sm">
                  {rows.length === 0 ? (
                    `${login} has no public repository.`
                  ) : (
                    <>
                      Nothing matches that.{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setTyped("")
                          box.current?.focus()
                        }}
                        className="rounded text-ink-accent text-sm hover:bg-hover"
                      >
                        Clear the filter
                      </button>
                    </>
                  )}
                </p>
              ) : (
                groups.map((group) => (
                  <Fold
                    key={group.life}
                    group={group}
                    columns={columns}
                    shut={isShut(settings.turned, login, group.life)}
                    quiet={narrowed}
                    now={now}
                    onTurn={() =>
                      change((current) => {
                        const entry = turnedEntry(login, group.life)
                        return {
                          ...current,
                          turned: current.turned.includes(entry)
                            ? current.turned.filter((one) => one !== entry)
                            : [...current.turned, entry]
                        }
                      })
                    }
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
      {waiting ? (
        <Waiting what={READING} detail={login} room="list" leaving={shown !== undefined} />
      ) : null}
    </div>
  )
}
