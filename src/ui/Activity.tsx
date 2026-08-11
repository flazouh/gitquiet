import { Option } from "effect"
import { useMemo, useState } from "react"
import type { Doer, Happening, RepositoryActivity } from "../domain/activity"
import type { RepoRef } from "../domain/PullRequestRef"
import { Section } from "./Section"
import { StillReading } from "./Waiting"
import { momentOf } from "./when"

/**
 * The Activity Destination: what happened, in the order it happened.
 *
 * The complaint behind this one was checked rather than believed. GitHub's feed route
 * answers with four kinds of card — a follow, a merged pull request, a trending repository
 * and a recommendation — while the same account's own events in the same minute were two
 * thirds pushes, which is what
 * [#173638](https://github.com/orgs/community/discussions/173638) means by "no more
 * commits". So there is no ranking here and there never will be: ranking is the thing being
 * undone, and a page that reordered the day by anything other than the clock would be the
 * same mistake wearing this extension's paint.
 *
 * Presentational, like the other two Destinations. It is handed the happenings, told
 * whether the live read has landed, and told what time it is; it asks GitHub for nothing.
 */
export type ActivityProps = {
  /**
   * What happened, grouped by repository — `activityIn`'s shape and usually its output.
   *
   * Sorted again in here rather than trusted, which is the one place this component
   * overrules its caller. Every other list in this interface draws the order it is given,
   * because ranking those is somebody else's decision to make. This list is chronology or
   * it is nothing, so the guarantee lives with the thing that draws it.
   */
  readonly activity: ReadonlyArray<RepositoryActivity>
  /**
   * Whether the live read is still out.
   *
   * The page opens from what was remembered, so this usually arrives with lines already on
   * the screen: it means "there may be more since", not "there is nothing yet". The two are
   * different sentences and a reader deciding whether to wait needs the right one.
   */
  readonly waiting?: boolean
  /**
   * What time it is, which every relative time on the page is measured from.
   *
   * Handed in rather than read off the clock so that "four minutes ago" can be tested at
   * all. A test that had to freeze time globally would freeze it for React as well.
   */
  readonly now?: Date
}

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * How long ago, in words rather than in the shorthand a table column uses.
 *
 * Deliberately not {@link ageOf}, which prints `4m ago`. That is right for a fixed-width
 * column of ages read as a shape, and wrong in the middle of a sentence: these lines are
 * sentences, and half of them will be read aloud by a screen reader that pronounces `4m` as
 * a letter. "Yesterday" gets its own word for the same reason — it is how somebody would
 * answer the question out loud, and "1 day ago" is not.
 *
 * Rounded down throughout, so a line never claims more time has passed than has.
 */
const agoOf = (iso: string, now: Date): string => {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ""

  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  if (seconds < MINUTE) return "just now"

  const minutes = Math.floor(seconds / MINUTE)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`

  const hours = Math.floor(seconds / HOUR)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`

  const days = Math.floor(seconds / DAY)
  if (days === 1) return "yesterday"
  if (days < 31) return `${days} days ago`

  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

const newestFirst = (left: string, right: string): number => right.localeCompare(left)

const nameOf = (repo: RepoRef): string => `${repo.owner}/${repo.repo}`

/**
 * Whose act it was, as a picture.
 *
 * Decoration and nothing else — the login is in the text beside it — so it is silent, and
 * an initial stands in where GitHub gave no face. Without the fallback the sentences would
 * step left and right down the page depending on who happens to have an avatar, which is
 * the sort of raggedness that makes a column unreadable at a glance.
 */
const Face = ({ who }: { readonly who: Doer | undefined }) => (
  <span
    aria-hidden="true"
    // `self-center` because the line it stands in aligns on the text baseline: a
    // sixteen-pixel box sitting on the baseline of twelve-pixel text hangs three
    // pixels low, which down a column of forty lines reads as faces that wobble.
    className="flex size-4 shrink-0 self-center items-center justify-center overflow-hidden rounded-full bg-surface text-[8px] font-semibold uppercase text-ink-muted"
  >
    {who === undefined
      ? null
      : Option.match(who.faceUrl, {
          onNone: () => who.login.slice(0, 1),
          onSome: (src) => <img alt="" src={src} width={16} height={16} />
        })}
  </span>
)

/**
 * Who did it, said once however many of them there were.
 *
 * Fourteen people starring a repository in an afternoon is one line here, and the domain
 * keeps all fourteen names rather than counting them because a reader who recognises one of
 * them learns something a number cannot tell them. Two names both fit and both get said.
 * Past that the line would be a paragraph, so it names the first and counts the rest — and
 * the rest are on the hover, where a name that was worth keeping is still reachable.
 */
const Crowd = ({ by }: { readonly by: ReadonlyArray<Doer> }) => {
  const first = by[0]?.login
  const second = by[1]?.login

  const said =
    first === undefined
      ? "Somebody"
      : second === undefined
        ? first
        : by.length === 2
          ? `${first} and ${second}`
          : `${first} and ${by.length - 1} others`

  return (
    <span
      className="font-medium text-ink"
      title={by.length > 2 ? by.map((who) => who.login).join(", ") : undefined}
    >
      {said}
    </span>
  )
}

/** A branch, in the type everything else in this interface writes code in. */
const Branch = ({ name }: { readonly name: string }) => (
  <span className="font-mono text-xs text-ink">{name}</span>
)

/**
 * The verb each kind of happening is spoken with.
 *
 * The domain already names these by what a reader would call them, so most of this is the
 * kind itself. `commented` takes its preposition here rather than in the domain, where the
 * kind is the act and not the sentence it ends up in.
 */
const VERB: Record<Happening["kind"], string> = {
  pushed: "pushed",
  opened: "opened",
  merged: "merged",
  closed: "closed",
  reopened: "reopened",
  commented: "commented on",
  raised: "raised",
  settled: "settled",
  starred: "starred",
  branched: "made the branch",
  deleted: "deleted the branch"
}

/**
 * What happened, as the rest of the sentence after the name.
 *
 * The awkward case is a pull request, and it is awkward because of what GitHub sends rather
 * than by choice: their events carry a number and a head branch and no title at all, ever.
 * So the branch is what stands in for a name — "opened #4 from widen-the-rail" — and no
 * title is invented to fill the gap, because an invented one would be indistinguishable
 * from a real one and wrong. Issues do carry titles, and theirs is printed.
 *
 * A push says its branch and says a count of commits only where one was served. Their
 * public events answer with the ref alone, so most pushes read "pushed to main", which is
 * less than the old feed said and infinitely more than the new one, where a push does not
 * appear at all.
 */
const What = ({ one }: { readonly one: Happening }) => {
  const branch = Option.getOrUndefined(one.ref)
  const number = Option.getOrUndefined(one.number)
  const title = Option.getOrUndefined(one.title)
  const commits = Option.getOrUndefined(one.howMany)

  switch (one.kind) {
    case "pushed":
      return (
        <>
          {/*
           * A run of pushes to one branch, said once. A live afternoon produced twenty-five
           * consecutive lines of one person pushing to one branch minutes apart, which is
           * the feed nobody could read — and folding them is only honest if the line says
           * how many were folded.
           */}
          {commits === undefined
            ? one.howOften === 1
              ? VERB.pushed
              : `${VERB.pushed} ${one.howOften} times`
            : `${VERB.pushed} ${commits} commit${commits === 1 ? "" : "s"}`}
          {branch === undefined ? null : (
            <>
              {" to "}
              <Branch name={branch} />
            </>
          )}
        </>
      )

    case "branched":
    case "deleted":
      return branch === undefined ? (
        <>{`${VERB[one.kind]}`}</>
      ) : (
        <>
          {`${VERB[one.kind]} `}
          <Branch name={branch} />
        </>
      )

    case "starred":
      return <>{VERB.starred}</>

    default:
      return (
        <>
          {`${VERB[one.kind]}${number === undefined ? "" : ` #${number}`}`}
          {/*
           * Whichever of the two identities there is, and never both: an issue has a title
           * and a pull request has a branch, and the data has been measured rather than
           * assumed on that point.
           */}
          {title === undefined ? null : ` ${title}`}
          {title !== undefined || branch === undefined ? null : (
            <>
              {" from "}
              <Branch name={branch} />
            </>
          )}
        </>
      )
  }
}

const Line = ({ one, now }: { readonly one: Happening; readonly now: Date }) => (
  // The Working Set's row, to the pixel: named for the stylesheets that light it, lit
  // across the whole line, and the same three-and-a-half by six padding. It was two by
  // four with a corner radius, which put this list a size and a shape away from every
  // other list in the interface.
  <li data-row="" className="hover:bg-hover">
    <a
      href={one.url}
      /*
       * No `aria-label`. Everything the line says is real text — who, what, and when — so
       * the name a screen reader reads is built from the same words on the screen and
       * cannot fall behind them, which is what a hand-written label eventually does.
       */
      className="flex items-baseline gap-2 px-3 py-1.5 text-sm no-underline"
    >
      <Face who={one.by[0]} />

      <span className="min-w-0 flex-1 text-ink-muted">
        <Crowd by={one.by} /> <What one={one} />
      </span>

      {/*
       * A `<time>` with the machine-readable moment on it as well as the hover, because
       * "yesterday" is the answer to a different question than "at 14:02", and a reader
       * chasing down when something broke needs the second one without leaving the page.
       *
       * The space before it is deliberate and is not layout — a flex row throws away
       * whitespace between its items. It is there so the line is one sentence when it is
       * read aloud rather than "pushed to main4 minutes ago", which is what concatenating
       * two inline boxes gives a screen reader.
       */}{" "}
      <time
        dateTime={one.at}
        title={momentOf(one.at)}
        className="shrink-0 text-xs text-ink-muted tabular-nums"
      >
        {agoOf(one.at, now)}
      </time>
    </a>
  </li>
)

/*
 * How many lines one repository may take before the rest are behind a click. A live
 * afternoon put fifty-seven lines from a single repository on the page and pushed every
 * other repository below the fold, which loses the one thing this page is for: seeing at a
 * glance where work is happening. Eight is about a screen's worth of one repository.
 */
const AT_MOST = 8

const Happened = ({ one, now }: { readonly one: RepositoryActivity; readonly now: Date }) => {
  const name = nameOf(one.repo)
  const [all, showAll] = useState(false)
  const rest = one.happenings.length - AT_MOST
  const shown = all ? one.happenings : one.happenings.slice(0, AT_MOST)

  return (
    /*
     * One card per repository, which is the box a Court is drawn in.
     *
     * The repository is said once in its header rather than on every line — GitHub's own
     * feed repeats the address down fourteen consecutive cards about one repository — and
     * the header is where that address was already going. What it replaces is a heading
     * floating over a list with a hairline rail down its left, which is a third way of
     * grouping rows in an interface that already had one.
     */
    <Section
      name={name}
      art="activity"
      heading={
        // The header's own ink rather than a link's blue. A Court's title is a word in
        // the header's colour, and one card in three wearing GitHub's link blue for the
        // same job made the cards look like two different kinds of box.
        <a
          href={`/${one.repo.owner}/${one.repo.repo}`}
          className="font-mono text-ink no-underline hover:underline"
        >
          {name}
        </a>
      }
      summary={<span className="tabular-nums">{one.happenings.length}</span>}
    >
      <ul
        aria-label={`What happened in ${name}`}
        className="flex list-none flex-col divide-y divide-line-muted p-0"
      >
        {shown.map((happening) => (
          <Line
            key={`${happening.at}-${happening.kind}-${happening.by[0]?.login ?? ""}-${happening.url}`}
            one={happening}
            now={now}
          />
        ))}
      </ul>

      {/*
       * The rest, on a row of the card rather than a button loose underneath it. Full
       * width and divided from the lines above, so it reads as the end of this card and
       * not as the start of the next one.
       */}
      {rest > 0 && !all ? (
        <button
          type="button"
          onClick={() => showAll(true)}
          className="w-full border-t border-line-muted px-3 py-1.5 text-left text-xs text-ink-muted hover:bg-hover hover:text-ink"
        >
          {`${rest} more in ${name}`}
        </button>
      ) : null}
    </Section>
  )
}

export const Activity = ({ activity, waiting = false, now = new Date() }: ActivityProps) => {
  /*
   * Newest repository first, and newest line first within each of them. Sorted here even
   * though the domain hands them over sorted, because this is the one page whose entire
   * claim is that nothing has been reordered — a claim worth holding against a caller that
   * one day maps over the list and loses the order on the way.
   */
  const shown = useMemo(
    () =>
      [...activity]
        .sort((left, right) => newestFirst(left.at, right.at))
        .map((one) => ({
          ...one,
          happenings: [...one.happenings].sort((left, right) => newestFirst(left.at, right.at))
        })),
    [activity]
  )

  return (
    // Unpadded for the same reason the other Destinations are: Home insets the pair of
    // columns, and a second inset here would only push this one off the Rail's top line.
    //
    // `t-panels` and a twelve-pixel gap, which is what the Courts stand in. The cards
    // rise into place forty milliseconds apart down the column and the run stops after
    // six, so a day with thirty repositories in it still assembles in a quarter of a
    // second.
    <section aria-label="Activity" className="t-panels flex flex-col gap-3">
      {/*
       * Not the whole-page wait. That one carries the attribute the click benchmark reads
       * to decide when a reader could start reading, and this page is usually drawn from
       * memory before the read lands — claiming to be unread with forty lines on the screen
       * would quietly spoil every measurement taken since.
       */}
      {waiting ? <StillReading what="Still reading what has happened." /> : null}

      {shown.length === 0 ? (
        waiting ? null : (
          <p className="px-3 py-2 text-sm text-ink-muted">
            Nothing has happened yet. Pushes, pull requests and stars from the people and
            repositories you follow will appear here.
          </p>
        )
      ) : (
        shown.map((one) => <Happened key={nameOf(one.repo)} one={one} now={now} />)
      )}
    </section>
  )
}
