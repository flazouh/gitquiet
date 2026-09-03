import { Option } from "effect"
import {
  type Answering,
  type Category,
  type Emoji,
  type ListedDiscussion,
  answeringOf,
  docketsOf,
  listAddressOf
} from "../domain/discussions"
import { COURT_ART, COURT_NAME, COURT_TONE } from "./courts"
import { Section } from "./Section"
import { ageOf, momentOf } from "./when"

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
const SAID: Record<Answering, string> = {
  stale: "Stale",
  unanswered: "Unanswered",
  answered: "Answered",
  unanswerable: ""
}

/**
 * The colour each word wears, and there are only two.
 *
 * Stale is the busy colour the Needs You heading above it already wears, so the row and its
 * heading make one statement rather than two. Everything else is muted: an unanswered question
 * nobody has replied to is not a fault, and an answered one needs no emphasis to be found, since
 * the heading it sits under has already said it.
 */
const TONE: Record<Answering, string> = {
  stale: "text-busy",
  unanswered: "text-ink-muted",
  answered: "text-done",
  unanswerable: ""
}

/**
 * The picture a maintainer chose for a category, however GitHub stores it.
 *
 * An ordinary emoji is a character and is drawn as one. One of GitHub's own — `:shipit:`,
 * `:octocat:` — is an image on their servers, and it is drawn from there rather than replaced
 * with something else: a category with a blank where every other row has a picture reads as a
 * row that failed to load.
 */
const Picture = ({ emoji }: { readonly emoji: Emoji }) => {
  if (emoji.kind === "text") return <>{emoji.text}</>
  if (emoji.kind === "none") return null

  return <img src={emoji.url} alt="" width={16} height={16} className="inline-block" />
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
  const said = SAID[answering]
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
            <span className={`shrink-0 text-xs font-semibold ${TONE[answering]}`}>{said}</span>
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
            href={listAddressOf(one.reference, Option.some(one.category.slug))}
          >
            {one.category.name}
          </a>
          <span aria-hidden="true">·</span>
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
  repo,
  categories,
  chosen
}: {
  readonly repo: { readonly owner: string; readonly repo: string }
  readonly categories: ReadonlyArray<Category>
  readonly chosen: Option.Option<string>
}) => {
  if (categories.length === 0) return null

  const here = (slug: Option.Option<string>): string =>
    Option.getOrElse(slug, () => "") === Option.getOrElse(chosen, () => "")
      ? "bg-hover text-ink"
      : "text-ink-muted"

  return (
    <nav aria-label="Categories" className="flex flex-wrap gap-1 px-3 py-2">
      <a
        className={`rounded px-2 py-0.5 text-xs no-underline hover:bg-hover ${here(Option.none())}`}
        href={listAddressOf(repo)}
      >
        All
      </a>
      {categories.map((one) => (
        <a
          key={one.slug}
          className={`rounded px-2 py-0.5 text-xs no-underline hover:bg-hover ${here(
            Option.some(one.slug)
          )}`}
          href={listAddressOf(repo, Option.some(one.slug))}
        >
          <span aria-hidden="true">
            <Picture emoji={one.emoji} />
          </span>{" "}
          {one.name}
        </a>
      ))}
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
  repo,
  discussions
}: {
  readonly repo: { readonly owner: string; readonly repo: string }
  readonly discussions: ReadonlyArray<ListedDiscussion>
}) => {
  if (discussions.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-ink-muted">
        {`Nothing is being discussed in ${repo.owner}/${repo.repo}.`}
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
          {docket.discussions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink-muted">Nothing.</p>
          ) : (
            <ul>
              {docket.discussions.map((one) => (
                <Row key={`${one.reference.number}`} one={one} />
              ))}
            </ul>
          )}
        </Section>
      ))}
    </>
  )
}
