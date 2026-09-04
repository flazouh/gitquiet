import { Option } from "effect"
import { useState } from "react"
import {
  CHIPS,
  type Category,
  type Chip,
  type DiscussionList,
  type Home,
  type Emoji,
  type ListedDiscussion,
  answeringOf,
  asWordsGo,
  asking,
  docketsOf,
  homeName,
  listAddressOf,
  listRouteOf,
  raisingAddressOf,
  toggled,
  wordsIn,
  type Participant
} from "../domain/discussions"
import type { Where } from "./Bar"
import { ANSWERING_SAID, ANSWERING_TONE, COURT_ART, COURT_NAME, COURT_TONE } from "./courts"
import { Section } from "./Section"
import { ageOf, momentOf } from "./when"
import { Face } from "./Face"

/**
 * What the bar is standing on, for either kind of home.
 *
 * An organisation is a person to the bar, because that is what it is to GitHub: an account with
 * a name, whose row the bar asks for by that name. A repository keeps its own row and its own
 * tabs, exactly as it does on every other screen.
 */
export const whereFor = (home: Home): Where =>
  home.kind === "repository"
    ? { kind: "repository", owner: home.owner, repo: home.repo }
    : { kind: "person", login: home.org }

/**
 * What a row says about itself before its title is read.
 *
 * The word and not the glyph, and that is the whole change this screen makes to a row. GitHub
 * carries the same fact in the fill of a 16 pixel check: `check-circle-fill` in green when a
 * reply is marked, `check-circle` in grey when none is, in the slot beside the comment count.
 * Read down twenty-five rows those are one texture.
 *
 * Stale is this product's word and not GitHub's, because GitHub has no word for it. Counted over
 * the first page of eight repositories on 2026-09-03, 94 of the 98 unanswered Questions were in
 * this state: somebody replied, and nobody marked what they said.
 */

/**
 * The colour each word wears, and there are only two.
 *
 * Stale is the busy colour the Needs You heading above it already wears, so the row and its
 * heading make one statement rather than two. Everything else is muted: an unanswered question
 * nobody has replied to is not a fault, and an answered one needs no emphasis to be found, since
 * the heading it sits under has already said it.
 */

/**
 * The picture a maintainer chose for a category, however GitHub stores it.
 *
 * An ordinary emoji is a character and is drawn as one. One of GitHub's own — `:shipit:`,
 * `:octocat:` — is an image on their servers, and it is drawn from there rather than replaced
 * with something else: a category with a blank where every other row has a picture reads as a
 * row that failed to load.
 */
/**
 * Who has been in the thread, at most four of them.
 *
 * The same stack the inbox draws on its own rows, for the same reason: on a forum where a
 * question can sit for a month, the people already in a thread say more about whether it is
 * moving than the reply count does. Their page draws this stack too, so a reader who knows it
 * from GitHub finds it where they left it.
 *
 * Hidden from a reader being read to. The author is named in words beside it, and four more
 * names read aloud on every row is noise rather than help.
 */
const Who = ({ people }: { readonly people: ReadonlyArray<Participant> }) =>
  people.length === 0 ? null : (
    <span aria-hidden="true" className="flex shrink-0 items-center gap-1">
      {people.slice(0, 4).map((one) => (
        <Face key={one.login} faceUrl={one.faceUrl} name={one.login} />
      ))}
    </span>
  )

const Picture = ({ emoji }: { readonly emoji: Emoji }) => {
  if (emoji.kind === "text") return <>{emoji.text}</>
  if (emoji.kind === "none") return null

  /*
   * Named rather than `alt=""`. A custom emoji is the only thing on GitHub's own row that
   * separates a Poll from a support question at a glance, so a reader who cannot see it is owed
   * the name their maintainer gave it.
   */
  return (
    <img src={emoji.url} alt={emoji.name} width={16} height={16} className="inline-block" />
  )
}

/**
 * What has been done to a discussion regardless of its answer.
 *
 * Their own row prints "· Closed · Unanswered" together, so these two are drawn beside the
 * answer word rather than in place of it. A closed question is still a question nobody answered,
 * and hiding that behind the word Closed would lose the fact somebody came here for.
 */
const Ended = ({ one }: { readonly one: ListedDiscussion }) => {
  if (!one.closed && !one.locked) return null

  return (
    <span className="shrink-0 text-xs text-ink-muted">
      {one.closed && one.locked ? "Closed, locked" : one.closed ? "Closed" : "Locked"}
    </span>
  )
}

/**
 * One discussion: what it is waiting for, what it is called, and who is in it.
 *
 * The title is the link and the row is not, for the reason the inbox gives: GitHub's whole row
 * is one anchor with controls inside it, which is why their presses need a script to stop the
 * navigation and why a reader cannot select a title without opening the thread.
 */
const Row = ({ one }: { readonly one: ListedDiscussion }) => {
  const answering = answeringOf(one)
  const said = ANSWERING_SAID[answering]
  const age = ageOf(one.askedAt)

  return (
    <li className="flex items-start gap-2.5 px-3 py-2 hover:bg-hover">
      {/* Their own emoji, which is the one thing on their row that tells a Poll from a support
          question at a glance. Hidden from a reader being read to: the category is named below
          it in words. */}
      <span aria-hidden="true" className="mt-0.5 w-5 shrink-0 text-center text-sm">
        <Picture emoji={one.category.emoji} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {said === "" ? null : (
            <span className={`shrink-0 text-xs font-semibold ${ANSWERING_TONE[answering]}`}>{said}</span>
          )}
          <a
            className="min-w-0 flex-1 truncate text-sm text-ink no-underline hover:underline"
            href={one.url}
          >
            {one.title}
          </a>
          <Ended one={one} />
          {age === "" ? null : (
            <span className="shrink-0 text-xs text-ink-muted" title={momentOf(one.askedAt)}>
              {age}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
          <a
            className="min-w-0 truncate text-ink-muted no-underline hover:underline"
            href={listAddressOf(one.reference.home, Option.some(one.category.slug))}
          >
            {one.category.name}
          </a>
          {one.labels.map((label) => (
            <span key={label} className="rounded border border-edge px-1 text-ink-muted">
              {label}
            </span>
          ))}
          <span aria-hidden="true">·</span>
          <Who people={one.participants} />
          <span className="min-w-0 truncate">{one.author}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {one.comments === 1 ? "1 reply" : `${one.comments} replies`}
          </span>
          {one.upvotes === 0 ? null : (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{`${one.upvotes} up`}</span>
            </>
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * Every category the repository has, as a way of narrowing the list.
 *
 * Their sidebar's nine and not the five the first page of rows happens to mention. A category
 * nobody has posted in this month is still a category, and a filter built out of the rows would
 * quietly lose four of them.
 */
export const Categories = ({
  list,
  categories
}: {
  readonly list: DiscussionList
  readonly categories: ReadonlyArray<Category>
}) => {
  const here = (slug: Option.Option<string>): string =>
    Option.getOrElse(slug, () => "") === Option.getOrElse(list.category, () => "")
      ? "bg-hover text-ink"
      : "text-ink-muted"

  /*
   * The category keeps whatever the reader was filtering by. Changing which category is being
   * read is not a reason to forget that they asked for the stale ones, and their own sidebar
   * loses it every time.
   */
  const to = (slug: Option.Option<string>): string =>
    listRouteOf({ ...list, category: slug, page: 1 })

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Sieves list={list} />
        <div className="flex items-center gap-2">
          <Words list={list} />
          {/* GitHub's own form, handed over rather than drawn: which category a discussion goes
              in, and what each of a repository's categories is for, is their page's to explain. */}
          <a
            className="rounded px-2 py-0.5 text-xs text-ink-muted no-underline hover:bg-hover"
            href={raisingAddressOf(list.home)}
          >
            New discussion
          </a>
        </div>
      </div>
      {categories.length === 0 ? null : (
        <nav aria-label="Categories" className="flex flex-wrap gap-1">
          <a
            className={`rounded px-2 py-0.5 text-xs no-underline hover:bg-hover ${here(
              Option.none()
            )}`}
            href={to(Option.none())}
          >
            All
          </a>
          {categories.map((one) => (
            <a
              key={one.slug}
              className={`rounded px-2 py-0.5 text-xs no-underline hover:bg-hover ${here(
                Option.some(one.slug)
              )}`}
              href={to(Option.some(one.slug))}
            >
              <span aria-hidden="true">
                <Picture emoji={one.emoji} />
              </span>{" "}
              {one.name}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}

/**
 * Where pressing a chip, or typing in the box, takes the reader.
 *
 * The first page every time. A reader on page four of everything who asks for the stale ones is
 * asking a different question, and answering it with page four of the new question is how a
 * filter comes back empty for no reason anybody can see.
 */
const asAsked = (list: DiscussionList, query: string): string =>
  listRouteOf({ ...list, query, page: 1 })

/**
 * The filter bar: their own vocabulary, as things to press.
 *
 * Links and never buttons, because each one is an address. A reader can copy what they are
 * looking at, send it to somebody, open it in a tab and come back to it, and the filtering is
 * done by GitHub across every page rather than by this screen over the twenty-five rows it
 * holds.
 *
 * Stale leads, and it is the reason this bar exists. Their own controls offer Unanswered, which
 * is 98 of the 120 Questions counted across eight repositories; 94 of those already have
 * somebody's reply in them and need pointing at rather than answering. Nobody would think to
 * type `is:unanswered comments:>0`, and it is one press here.
 */
const Sieves = ({ list }: { readonly list: DiscussionList }) => (
  <nav aria-label="Filters" className="flex flex-wrap items-center gap-1">
    {CHIPS.map((chip: Chip) => (
      <a
        key={chip.name}
        aria-current={asking(list.query, chip) ? "true" : undefined}
        className={`rounded px-2 py-0.5 text-xs no-underline hover:bg-hover ${
          asking(list.query, chip) ? "bg-hover text-ink" : "text-ink-muted"
        }`}
        href={asAsked(list, toggled(list.query, chip))}
      >
        {chip.name}
      </a>
    ))}
  </nav>
)

/**
 * The box, for everything the chips have no word for.
 *
 * Holds the reader's own words and never the chips' terms, so a chip pressed does not turn up
 * in the box as text to delete by hand. Submitting is a navigation, which is what every other
 * control on this screen is.
 */
const Words = ({ list }: { readonly list: DiscussionList }) => {
  const [typed, setTyped] = useState(wordsIn(list.query))

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault()
        window.location.assign(asAsked(list, asWordsGo(list.query, typed)))
      }}
    >
      <input
        aria-label="Search these discussions"
        className="w-48 rounded border border-edge bg-transparent px-2 py-0.5 text-xs text-ink"
        placeholder="Search"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
      />
    </form>
  )
}

/**
 * Their pager, as the two presses a reader makes.
 *
 * Their own list prints no total anywhere and answers no route that does, so there is no page
 * count to draw and nothing here claims one. Back is offered from page two onwards and forward
 * only where GitHub drew a next link.
 */
export const Pages = ({
  list,
  more
}: {
  readonly list: DiscussionList
  readonly more: boolean
}) => {
  if (list.page === 1 && !more) return null

  return (
    <nav aria-label="Pages" className="flex items-center gap-2 px-3 pb-2 text-xs">
      {list.page > 1 ? (
        <a
          className="text-ink-accent no-underline hover:underline"
          href={listRouteOf({ ...list, page: list.page - 1 })}
        >
          Newer
        </a>
      ) : null}
      <span className="text-ink-muted tabular-nums">{`Page ${list.page}`}</span>
      {more ? (
        <a
          className="text-ink-accent no-underline hover:underline"
          href={listRouteOf({ ...list, page: list.page + 1 })}
        >
          Older
        </a>
      ) : null}
    </nav>
  )
}

/**
 * A repository's discussions in three Courts.
 *
 * Grouped and never filtered, the way the inbox is. Their own controls can already ask for
 * `is:unanswered`, and that is not the question: unanswered is 98 rows of the 120 counted, and 94
 * of those have somebody's reply sitting in them. What nobody can ask their list for is the
 * difference between a question nobody came to and a question everybody came to and nobody
 * finished, and that difference is the whole of what this screen draws.
 *
 * Three of the product's four, and the missing one is Running. See `DISCUSSION_COURTS`.
 */
export const Discussions = ({
  home,
  discussions
}: {
  readonly home: Home
  readonly discussions: ReadonlyArray<ListedDiscussion>
}) => {
  if (discussions.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-ink-muted">
        {`Nothing is being discussed in ${homeName(home)}.`}
      </p>
    )
  }

  return (
    <>
      {docketsOf(discussions).map((docket) => (
        <Section
          key={docket.court}
          name={COURT_NAME[docket.court]}
          tone={COURT_TONE[docket.court]}
          art={COURT_ART[docket.court]}
          summary={<span className="tabular-nums">{docket.count}</span>}
        >
          {docket.rows.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink-muted">Nothing.</p>
          ) : (
            <ul>
              {docket.rows.map((one) => (
                <Row key={`${one.reference.number}`} one={one} />
              ))}
            </ul>
          )}
        </Section>
      ))}
    </>
  )
}
