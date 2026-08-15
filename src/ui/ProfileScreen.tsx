import { Option } from "effect"
import { useMemo } from "react"
import { type Answering } from "../domain/answering"
import { grouped, type ListedRepository } from "../domain/life"
import type { Person } from "../domain/person"
import { personIn } from "../github/person"
import { ASIDE } from "./dress"
import { PersonAside } from "./PersonAside"
import { PersonTabs } from "./PersonTabs"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { columnsIn, Row } from "./RepoRow"
import { Section } from "./Section"
import { TheBar } from "./TheBar"
import type { Load } from "./useLive"
import { useLive } from "./useLive"
import { type Elsewhere, usePerson } from "./usePerson"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"
import { dayOf } from "./when"

/** Their repositories as the profile has them, which is the tab's list unchanged. */
export type Owned = {
  readonly rows: ReadonlyArray<ListedRepository>
  /** Whether the walk behind the first answer is still running. */
  readonly reading: boolean
  /** Whether that walk stopped at its cap, so the counts are over part of a longer list. */
  readonly capped: boolean
}

export type ProfileScreenProps = {
  readonly login: string
  /** What they have done lately on other people's work. */
  readonly answering: Load<Answering>
  /** Everything they own, for the band at the foot. */
  readonly owned: Load<Owned>
  readonly who?: Person
  /** How to read their column off the served page. Only a test ever passes one. */
  readonly readWho?: (page: Document) => Option.Option<Person>
  /**
   * Where to read it instead, where the page being stood on is not theirs.
   *
   * Given on a press this extension answered itself: no document loads, so their card is
   * not on the page and never will be. See `usePerson`.
   */
  readonly elsewhere?: Elsewhere
  readonly onStepAside: () => void
  readonly signedIn?: () => boolean
  readonly now?: Date
}

/** How many of their repositories the band at the foot shows before the link takes over. */
const A_FEW = 6

const READING = "Reading their profile…"

/**
 * One number and what it counts, as one line of the Answering band.
 *
 * The number leads and the words follow it, because three of these are read as a column
 * of numbers rather than as three sentences.
 */
const Count = ({
  many,
  what,
  gist
}: {
  readonly many: number
  readonly what: string
  /** What the act is, for a reader who has not been told what this page counts. */
  readonly gist: string
}) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <p className="font-semibold text-ink text-lg tabular-nums leading-6">{many}</p>
    <p className="min-w-0 text-ink text-xs">{what}</p>
    <p className={`min-w-0 ${ASIDE}`}>{gist}</p>
  </div>
)

/**
 * Whether this person answers anybody, which is the question the page is arranged around.
 *
 * The band a reader with a pull request open in another tab came for. Their calendar
 * cannot answer it — 200 commits to your own repository and no reply to a soul is a wall
 * of green, and so is the reverse — so the three acts that are somebody answering are
 * counted on work that is not theirs, and the count is left as a count. Nothing here is
 * scored, ranked or turned into a badge: a reader draws the conclusion.
 *
 * What it cannot see is said under it rather than left for somebody to discover. Public
 * events are 90 days and no private work, and a band that hid that would be read as "this
 * person does nothing".
 */
const Answers = ({
  said,
  login,
  now
}: {
  readonly said: Answering
  readonly login: string
  readonly now: Date
}) => {
  const nothing = said.reviews + said.replies + said.pulls === 0

  return (
    <Section
      name="Answering"
      art="comments"
      summary={`on other people's work, last ${said.days} days`}
    >
      <div className="flex flex-col gap-3 px-3 py-2.5">
        {nothing ? (
          <p className="text-ink text-sm">
            {login} has answered nobody in public in the last {said.days} days.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Count many={said.reviews} what="reviews" gist="on other people's pull requests" />
            <Count many={said.replies} what="replies" gist="on issues and pull requests" />
            <Count many={said.pulls} what="pull requests" gist="opened on other people's work" />
          </div>
        )}

        <p className={ASIDE}>
          {nothing
            ? null
            : `Across ${said.places} ${said.places === 1 ? "repository" : "repositories"}. `}
          {Option.match(said.last, {
            onNone: () => null,
            onSome: (last) => `Last on ${dayOf(last, now)}. `
          })}
          {/* The two holes in the source, said here rather than found out later: a reader
              whose work is private is owed the sentence that this page is not calling
              them idle. */}
          Counted from public events, so private work is not in it.
        </p>
      </div>
    </Section>
  )
}

/**
 * The few of their repositories that are still moving, and the shape of the rest.
 *
 * Six rows and four counts rather than the whole list, because the list has a tab of its
 * own one press away and a profile that reprints it is a profile nobody scrolls past.
 * The six are the ones pushed to most recently, which is the answer to "is any of this
 * alive" that a reader of a stranger's page is after.
 */
const Owns = ({
  owned,
  login,
  now
}: {
  readonly owned: Owned
  readonly login: string
  readonly now: Date
}) => {
  const groups = useMemo(() => grouped(owned.rows, now), [owned.rows, now])
  const moving = groups.find((group) => group.life === "moving")
  /*
   * The moving ones, or the next group along where nothing of theirs moves. Every group
   * is ordered by its last push, so the six are the six most recent either way — which
   * is what the header above them claims and what a reader is looking for.
   */
  const few = (moving?.rows ?? groups[0]?.rows ?? []).slice(0, A_FEW)
  /* Over the six drawn rather than over the list: the tab holds its columns still
     against a find box, and there is no find box here. */
  const columns = useMemo(() => columnsIn(few), [few])

  if (owned.rows.length === 0) {
    return (
      <Section name="Repositories" art="repositories">
        <p className="px-3 py-6 text-center text-ink-muted text-sm">
          {owned.reading ? `Reading ${login}'s repositories…` : `${login} has no public repository.`}
        </p>
      </Section>
    )
  }

  return (
    <Section
      name="Repositories"
      art="repositories"
      summary={moving === undefined ? "nothing moving" : "moving first"}
      aside={
        <a
          href={`/${login}?tab=repositories`}
          className="rounded-md px-2 py-1 text-ink-accent text-xs no-underline hover:bg-hover"
        >
          All {owned.rows.length}
        </a>
      }
    >
      <ul className="flex list-none flex-col divide-y divide-line-muted p-0">
        {few.map((one) => (
          <Row key={one.nameWithOwner} one={one} columns={columns} now={now} />
        ))}
      </ul>
      <p className={`border-line-muted border-t px-3 py-2 ${ASIDE}`}>
        {groups.map((group, index) => (
          <span key={group.life}>
            {index === 0 ? "" : ", "}
            <span className="text-ink tabular-nums">{group.rows.length}</span> {group.life}
          </span>
        ))}
        {owned.reading ? ", still reading the rest…" : ""}
        {/* A count over part of a list, said where the count is, as the tab says it. */}
        {owned.capped ? ", of the first pages of a longer list" : ""}
      </p>
    </Section>
  )
}

/**
 * One band's place, where the band itself is not there to draw.
 *
 * Both of the ways that happens, because they are the same shape and only the sentence in
 * the middle differs. A read that failed is said rather than left empty, because an empty
 * space is read as "this person does nothing" and the other band is still worth the
 * reader's time. A read still running is said for a plainer reason: the two bands do not
 * arrive together — one is on the page a press earlier and the other is a request to
 * another host — and a band that appears from nothing pushes the band under it down a
 * second after the reader started reading it.
 *
 * The same icon in every state, so that nothing under it moves when the answer lands.
 */
const Instead = ({
  name,
  art,
  what
}: {
  readonly name: string
  readonly art: "comments" | "repositories"
  readonly what: string
}) => (
  <Section name={name} art={art}>
    <p className="px-3 py-6 text-center text-ink-muted text-sm">{what}</p>
  </Section>
)

/**
 * A person's profile, arranged around the one question a reader brings to it.
 *
 * Their own page leads with a year of green squares, which is used as the answer to
 * "will this person reply" and is not one. So the answer goes first, counted from what
 * they did on work that is not theirs, and their repositories go under it with the six
 * that are still moving. `docs/spec/profile.md` carries the evidence for both.
 *
 * The whole page rather than the middle of it: their column and their tab row are drawn
 * here too, because a page in two type scales reads as a broken page. See `PersonAside`.
 */
export const ProfileScreen = ({
  login,
  answering,
  owned,
  who,
  readWho = personIn,
  elsewhere,
  onStepAside,
  signedIn = viewerOnPage,
  now = new Date()
}: ProfileScreenProps) => {
  const served = usePerson(readWho, elsewhere)
  const them = who ?? served
  const said = useLive(answering).read
  const list = useLive(owned).read
  const waiting = useWaiting(list.status === "ready" ? said.status : list.status)

  /*
   * The page is handed back when both reads failed and not before. Either one of them
   * alone is a page worth having: the band answers the question this page is opened
   * with, and the list is the list, and a screen that threw away a good answer because
   * the other read timed out would be worse than GitHub's page on a bad network.
   */
  if (list.status === "failed" && said.status === "failed") {
    return (
      <ReadFailed
        signedOut={!signedIn()}
        why={list.why}
        what={`${login}'s profile`}
        onStepAside={onStepAside}
        asideLabel="Show GitHub's page"
      />
    )
  }

  return (
    <div className="relative">
      <TheBar where={{ kind: "person", login }} />
      <div className="flex min-w-0 flex-col gap-4 py-3 lg:flex-row lg:items-start">
        {them === undefined ? null : <PersonAside who={them} onStepAside={onStepAside} />}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <PersonTabs login={login} on="overview" who={them} />

          <div className="t-panels flex min-w-0 flex-col gap-1">
            {said.status === "ready" ? <Answers said={said.value} login={login} now={now} /> : null}
            {/* A read still running and a read that failed are both said where the answer
                would have been, rather than left as a gap that fills a second later. */}
            {said.status === "loading" ? (
              <Instead
                name="Answering"
                art="comments"
                what={`Reading what ${login} did on other people's work…`}
              />
            ) : null}
            {said.status === "failed" ? (
              <Instead
                name="Answering"
                art="comments"
                what={`Could not read what ${login} did on other people's work.`}
              />
            ) : null}

            {list.status === "ready" ? <Owns owned={list.value} login={login} now={now} /> : null}
            {list.status === "loading" ? (
              <Instead
                name="Repositories"
                art="repositories"
                what={`Reading ${login}'s repositories…`}
              />
            ) : null}
            {list.status === "failed" ? (
              <Instead
                name="Repositories"
                art="repositories"
                what={`Could not read ${login}'s repositories.`}
              />
            ) : null}
          </div>
        </div>
      </div>
      {waiting ? (
        <Waiting
          what={READING}
          detail={login}
          room="list"
          leaving={list.status === "ready" || said.status === "ready"}
        />
      ) : null}
    </div>
  )
}
