import { Option } from "effect"
import { useMemo, useState } from "react"
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
import { useArt } from "./art"
import { ASIDE, CHIP, FIELD, PILL } from "./dress"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { TheBar } from "./TheBar"
import { PersonTabs } from "./PersonTabs"
import type { Load } from "./useLive"
import { useLive } from "./useLive"
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
  /** Restores GitHub's own list, which is still on the page behind this. */
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
 * By row, and the bar says so under itself. GitHub counts a repository's languages
 * by bytes and these rows carry one language each, so a percentage claimed here
 * would be a different number from the one on the repository's own page under the
 * same word. Counting rows answers the question a reader of somebody's list has —
 * what do they mostly write — and can be said without arguing with their page.
 */
const Shares = ({ list }: { readonly list: ReadonlyArray<Share> }) => {
  if (list.length === 0) return null

  return (
    <section aria-label="Languages" className="min-w-0 flex-1">
      <div className="flex h-1.5 overflow-hidden rounded-full">
        {list.map((one) => (
          <span
            key={one.name}
            title={`${one.name}: ${one.count} ${one.count === 1 ? "repository" : "repositories"}`}
            style={{ width: `${Math.max(one.part * 100, 1)}%`, background: one.colour }}
          />
        ))}
      </div>
      <p className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 ${ASIDE}`}>
        {list.slice(0, 6).map((one) => (
          <span key={one.name} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full" style={{ background: one.colour }} />
            <span className="text-ink">{one.name}</span>
            <span className="tabular-nums">{one.count}</span>
          </span>
        ))}
      </p>
    </section>
  )
}

/** How dark a cell of the strip is, one step per step of the age. */
const LEVELS: Record<Cell["level"], string> = {
  4: "bg-pass",
  3: "bg-pass/60",
  2: "bg-ink-muted/50",
  1: "bg-ink-muted/30",
  0: "bg-ink-muted/15"
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
    <section aria-label="Last moved" className="min-w-0 flex-1">
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
      <p className={`mt-2 ${ASIDE}`}>
        Last moved, newest first. {list.length} {list.length === 1 ? "repository" : "repositories"}.
      </p>
    </section>
  )
}

/** One repository, as a row of the group it belongs to. */
const Row = ({ one, now }: { readonly one: ListedRepository; readonly now: Date }) => {
  const language = Option.getOrUndefined(one.language)
  const pushed = Option.getOrUndefined(one.pushedAt)

  return (
    <li className="flex min-w-0 flex-col gap-1 px-2 py-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <a
          href={`/${one.nameWithOwner}`}
          className="min-w-0 truncate font-semibold text-ink no-underline hover:underline"
        >
          {one.repo}
        </a>
        {one.isPrivate ? <span className={`${PILL} ${ASIDE}`}>Private</span> : null}
        {Option.match(one.forkedFrom, {
          onNone: () => null,
          onSome: (from) => (
            <span className={ASIDE}>
              forked from{" "}
              <a href={`/${from}`} className="text-ink-muted no-underline hover:underline">
                {from}
              </a>
            </span>
          )
        })}
      </div>
      {Option.match(one.description, {
        onNone: () => null,
        onSome: (said) => <p className="min-w-0 text-sm text-ink-muted">{said}</p>
      })}
      {one.topics.length === 0 ? null : (
        <p className="flex min-w-0 flex-wrap gap-1">
          {/* Three, as the spec says. A row with eleven topics is a row whose name and
              description are the last things a reader finds in it. */}
          {one.topics.slice(0, 3).map((topic) => (
            <a
              key={topic}
              href={`/topics/${topic}`}
              className={`${CHIP} text-xs text-ink-muted no-underline hover:text-ink`}
            >
              {topic}
            </a>
          ))}
        </p>
      )}
      <p className={`flex flex-wrap items-center gap-x-3 ${ASIDE}`}>
        {language === undefined ? null : (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full" style={{ background: language.colour }} />
            {language.name}
          </span>
        )}
        {one.stars === 0 ? null : (
          <span className="tabular-nums">
            {one.stars} {one.stars === 1 ? "star" : "stars"}
          </span>
        )}
        {one.forks === 0 ? null : (
          <span className="tabular-nums">
            {one.forks} {one.forks === 1 ? "fork" : "forks"}
          </span>
        )}
        {/* A date and never a distance: "2 years ago" under "3 years ago" is the same
            three words to somebody scanning thirty rows. See `dayOf`. */}
        {pushed === undefined ? (
          <span>never pushed to</span>
        ) : (
          <span title={momentOf(pushed)}>moved {dayOf(pushed, now)}</span>
        )}
      </p>
    </li>
  )
}

/**
 * One group: its name, its count, and its rows, until the reader shuts it.
 *
 * The heading is the control, which is how the Home sections work. A separate
 * chevron beside a heading is a target a third of the size of the thing it opens.
 */
const Rows = ({
  group,
  shut,
  onTurn,
  now
}: {
  readonly group: Group
  readonly shut: boolean
  readonly onTurn: () => void
  readonly now: Date
}) => {
  const art = useArt()
  const Chevron = art["chevron-down"]

  return (
    <section>
      <h2>
        <button
          type="button"
          onClick={onTurn}
          aria-expanded={!shut}
          className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
        >
          <Chevron size={12} className={`t-turn ${shut ? "" : "is-turned"}`} aria-hidden="true" />
          <span className="font-semibold text-ink">{NAMED[group.life].title}</span>
          <span className={`${CHIP} text-xs tabular-nums`}>{group.rows.length}</span>
          <span className={`min-w-0 truncate ${ASIDE}`}>{NAMED[group.life].gist}</span>
        </button>
      </h2>
      {shut ? null : (
        <ul className="flex flex-col">
          {group.rows.map((one) => (
            <Row key={one.nameWithOwner} one={one} now={now} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * A person's repositories tab, in four groups.
 *
 * The loudest unanswered ask on these pages: three discussions carrying 1,679
 * upvotes, the oldest open since June 2021, all asking for this one thing. Nothing
 * here is tagged by anybody — every group is derived from what the rows already
 * say — because curation by hand is the documented failure mode and has failed
 * since 2014. `docs/spec/profile.md` has the evidence.
 */
export const PersonReposScreen = ({
  login,
  load,
  onStepAside,
  signedIn = viewerOnPage,
  now = new Date()
}: PersonReposScreenProps) => {
  const live = useLive(load)
  const { read } = live
  const waiting = useWaiting(read.status)
  const { settings, change } = useSettings()
  const [typed, setTyped] = useState("")

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

  if (read.status === "failed") {
    return (
      <ReadFailed
        signedOut={!signedIn()}
        why={read.why}
        what={`${login}'s repositories`}
        onStepAside={onStepAside}
        asideLabel="Show GitHub's list"
      />
    )
  }

  return (
    <div className="relative">
      <TheBar where={{ kind: "person", login }} />
      <div className="t-panels flex flex-col gap-3 pt-2 pb-2">
        <PersonTabs login={login} on="repositories" />

        {shown === undefined ? null : (
          <>
            <div className="flex min-w-0 flex-col gap-4 rounded-lg px-3 py-2.5 sm:flex-row sm:gap-6">
              <Shares list={languages} />
              <Movement list={strip} />
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-3 px-1">
              <input
                type="search"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                /* Their own box on this page reads names, which their documentation says
                   outright. Somebody who kept a library remembers that it parsed dates,
                   not that it was called `chrono`. */
                placeholder="Find by name, description or topic"
                aria-label="Find a repository"
                className={`${FIELD} min-w-0 flex-1 px-2 py-1 text-sm`}
              />
              <p className={`${ASIDE} tabular-nums`}>
                {found.length === rows.length
                  ? `${rows.length} ${rows.length === 1 ? "repository" : "repositories"}`
                  : `${found.length} of ${rows.length}`}
                {/* Both qualifications on the count, said where the count is. A group
                    total over part of a list is the wrong answer confidently drawn. */}
                {shown.reading ? ", reading the rest…" : ""}
                {shown.capped ? ", the first pages of a longer list" : ""}
              </p>
            </div>

            {groups.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-ink-muted">
                {rows.length === 0
                  ? `${login} has no public repository.`
                  : `Nothing here matches “${typed}”.`}
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {groups.map((group) => (
                  <Rows
                    key={group.life}
                    group={group}
                    shut={isShut(settings.turned, login, group.life)}
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
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {waiting ? (
        <Waiting what={READING} detail={login} room="list" leaving={shown !== undefined} />
      ) : null}
    </div>
  )
}
