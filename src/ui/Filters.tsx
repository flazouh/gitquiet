import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { PullRequestState } from "../domain/PullRequest"
import { asked, termsIn, toggling } from "../domain/sieve"
import type { Opinion } from "../domain/workingSet"
import { type Art, checkName, pullRequestName, type Set, useArt } from "./art"
import { useMenuPhase } from "./useMenuPhase"
import {
  CHECK_TONE,
  OPINION_TONE,
  OPINION_WORDS,
  rollupArtState,
  STATE_INK,
  STATE_WORDS
} from "./Icon"
import { FIELD, HERE } from "./dress"
import { Who } from "./Who"

/**
 * The row above a list: one box holding the whole question, and a chip for each
 * kind of question a row can answer.
 *
 * Both write the same line of text. The box is the truth — it can be typed,
 * edited a word at a time, read back and pasted to somebody else — and a chip is
 * a way of writing a term into it without remembering the spelling. That is why
 * there is no second filter state anywhere in here: a chip reads the line to know
 * whether it is on, so the two can never disagree.
 *
 * The terms themselves are `src/domain/sieve.ts`, which is also where they are
 * matched against rows. This file knows only what a term is called in English.
 */

type Term = {
  readonly term: string
  /** What the term is called to a reader who has never typed one. */
  readonly words: string
  /**
   * The same glyph, in the same colour, that a row carrying this uses.
   *
   * The menu is where a reader learns what the rows mean, so it draws the rows'
   * own vocabulary rather than a second one: the red alert beside Failing is the
   * red alert on the row it will leave on the screen.
   */
  readonly mark: ReactNode
}

type Facet = {
  readonly name: string
  readonly terms: ReadonlyArray<Term>
}

/** A glyph in a tone, which is what most of these marks are. */
const Mark = ({ art: Art, tone }: { readonly art: Art; readonly tone: string }) => (
  <Art size={14} className={`shrink-0 ${tone}`} />
)

/*
 * Each facet takes the set of glyphs rather than reaching for one.
 *
 * These four were constants until the same screens had to draw in a second icon
 * library, which is a change of shape and not only of imports: a constant holding
 * JSX is a glyph chosen when the module loaded, before any platform could say
 * which set it wanted. Functions of the set instead, called once inside the
 * component, so the menu draws the same vocabulary as the rows below it — which
 * is the whole reason the menu draws glyphs at all.
 */

const checkTerm = (art: Set, state: "passing" | "failing" | "running", words: string): Term => {
  const said = rollupArtState(state)

  return {
    term: `is:${state}`,
    words,
    mark: <Mark art={art[checkName(said)]} tone={CHECK_TONE[said]} />
  }
}

const checksFacet = (art: Set): Facet => ({
  name: "Checks",
  terms: [
    checkTerm(art, "failing", "Failing"),
    checkTerm(art, "running", "Running"),
    checkTerm(art, "passing", "Passing")
  ]
})

const reviewTerm = (said: string, opinion: Opinion, art: Art): Term => ({
  term: `review:${said}`,
  words: OPINION_WORDS[opinion],
  mark: <Mark art={art} tone={OPINION_TONE[opinion]} />
})

const reviewFacet = (art: Set): Facet => ({
  name: "Review",
  terms: [
    reviewTerm("required", "review-required", art.eye),
    reviewTerm("changes-requested", "changes-requested", art.comments),
    reviewTerm("approved", "approved", art["check-passed"])
  ]
})

const stateTerm = (art: Set, state: PullRequestState): Term => ({
  term: `is:${state}`,
  words: STATE_WORDS[state],
  mark: <Mark art={art[pullRequestName(state)]} tone={STATE_INK[state]} />
})

const stateFacet = (art: Set): Facet => ({
  name: "State",
  terms: [
    stateTerm(art, "open"),
    stateTerm(art, "draft"),
    stateTerm(art, "merged"),
    stateTerm(art, "closed")
  ]
})

const commentsTerm = (art: Set): Term => ({
  term: "has:comments",
  words: "Has comments",
  mark: <Mark art={art.comment} tone="text-ink-muted" />
})

const activityFacet = (art: Set): Facet => ({
  name: "Activity",
  terms: [
    {
      term: "is:unread",
      words: "Unread",
      // The one dot in here that is not a state: unread is a row in bolder ink,
      // and a dot is what a list of them looks like from a distance.
      mark: <Mark art={art.dot} tone="text-ink-accent" />
    },
    commentsTerm(art),
    {
      term: "is:stale",
      words: "Untouched for a week",
      mark: <Mark art={art.clock} tone="text-ink-muted" />
    }
  ]
})

/**
 * The same two facets, cut down to what an issue can answer.
 *
 * Every term left out here is one `answersIssue` refuses: an issue is never
 * merged and never a draft, nothing reads one so none is unread, and their
 * search sends no time of last change so none can be called stale. Offering
 * those anyway would put five chips on the row that empty the list, which is a
 * filter teaching the reader that filtering is broken.
 */
const issueStateFacet = (art: Set): Facet => ({
  name: "State",
  terms: [stateTerm(art, "open"), stateTerm(art, "closed")]
})

const issueActivityFacet = (art: Set): Facet => ({
  name: "Activity",
  terms: [commentsTerm(art)]
})

/**
 * The Author chip, built from the logins actually on the screen, each behind its
 * own face.
 *
 * A list of every GitHub account would be a search box, and a search box is what
 * the reader already has. What is useful is the handful of people whose work is
 * in front of them, which is a question the rows have already answered — and a
 * face is how a person is recognised rather than read.
 */
const authorFacet = (
  art: Set,
  authors: ReadonlyArray<string>,
  viewer: string | undefined
): Facet => ({
  name: "Author",
  terms: [
    {
      term: "author:me",
      words: "Mine",
      mark:
        viewer === undefined ? (
          <Mark art={art.eye} tone="text-ink-muted" />
        ) : (
          <Who login={viewer} size={16} />
        )
    },
    ...authors.map((login) => ({
      term: `author:${login}`,
      words: login,
      mark: <Who login={login} size={16} />
    }))
  ]
})

const chosenIn = (query: string, facet: Facet): ReadonlyArray<Term> =>
  facet.terms.filter((one) => asked(query, one.term))


const Chip = ({
  facet,
  query,
  open,
  byKey,
  onOpen,
  onQuery
}: {
  readonly facet: Facet
  readonly query: string
  readonly open: boolean
  /** Whether the shutting was asked for by a key, which does not wait to be animated. */
  readonly byKey: boolean
  readonly onOpen: (name: string | undefined) => void
  readonly onQuery: (query: string) => void
}) => {
  const art = useArt()
  // Named, because JSX takes a dotted name and not a subscript.
  const Chevron = art["chevron-down"]
  const on = chosenIn(query, facet)
  /*
   * Where the menu is in opening and shutting, from the same hook the account and
   * repository menus use.
   *
   * This was thirty lines of its own with identical reasoning in the comments, which is
   * two copies of one decision waiting to drift — and they had: `Menu.tsx` learned to
   * skip the leaving phase for a keypress and this one carried on fading, so Escape
   * did two different things to two menus in the same row.
   */
  const phase = useMenuPhase(open, byKey)

  const up = phase === "arriving" || phase === "here"

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => onOpen(open ? undefined : facet.name)}
        /* The same height as the box beside it. A row of controls that do the same
           job at two different heights reads as two rows that failed to line up.

           Filled rather than outlined, in both states: the fill under a chip that
           has terms on it is already the loudest thing in the row, and a line
           around a fill is the same fact drawn twice. The ink carries the rest,
           which is where a reader looking for what is filtered looks.

           A step of the pack's own ladder for the chip with terms on it, not the
           accent — see `HERE` in `dress.ts`. The weight comes with it, because a
           resting chip reaches the same fill for as long as a pointer is on it. */
        className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs ${
          on.length > 0
            ? `${HERE} font-semibold`
            : "bg-hover text-ink-muted hover:bg-active hover:text-ink"
        }`}
      >
        {/* One term on: the chip wears that term's own mark, so a filtered list
            says what it is filtered to without being opened. More than one, and
            a count is the only thing that fits. */}
        {on.length === 1 ? on[0]!.mark : null}
        {facet.name}
        {on.length > 1 ? <span className="tabular-nums">{on.length}</span> : null}
        <Chevron size={12} />
      </button>

      {/*
       * On the page while it is open and for one close after that, and nothing at
       * all either side. Two reasons, and they pull the same way: the keyboard
       * walk through the list pauses whenever a menu is anywhere in this
       * interface, and a shut menu left in the document would pause it forever.
       * While it is leaving it keeps its shape but stops being a menu — there is
       * nothing in a fading ghost worth pointing at, or reading aloud.
       */}
      {phase === "shut" ? null : (
        <div
          {...(up ? { role: "menu", "aria-label": facet.name } : { "aria-hidden": true })}
          data-origin="top-left"
          data-phase={phase}
          className={`t-menu ${phase === "here" ? "is-open" : phase === "leaving" ? "is-closing" : ""} absolute left-0 z-20 mt-1 min-w-48 rounded-md bg-raised p-1 shadow-lg`}
        >
          {facet.terms.map((one) => {
            const chosen = asked(query, one.term)

            return (
              <button
                key={one.term}
                type="button"
                {...(up ? { role: "menuitemcheckbox", "aria-checked": chosen } : {})}
                tabIndex={up ? undefined : -1}
                onClick={() => onQuery(toggling(query, one.term))}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-hover ${
                  chosen ? "text-ink" : "text-ink-muted"
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">{one.mark}</span>
                <span className="grow truncate">{one.words}</span>
                {chosen ? (
                  <art.tick size={12} className="shrink-0 text-ink" aria-hidden="true" />
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * What the box shows before anything is typed in it.
 *
 * Two of them, because the example has to be a term the list can answer.
 * `is:failing` is a check and an issue has none, so on a list of issues it
 * teaches a word that empties the list.
 */
const EXAMPLE: Record<"work" | "issues", string> = {
  work: "Filter by title, or author:me is:failing",
  issues: "Filter by title, or author:me is:closed"
}

export const Filters = ({
  query,
  authors,
  viewer,
  what,
  about = "work",
  onQuery
}: {
  readonly query: string
  /** The logins on the screen, which is what the Author chip offers. */
  readonly authors: ReadonlyArray<string>
  /** Whoever is signed in, whose own face stands for "Mine". */
  readonly viewer?: string
  /** What this list is, for the box's label: the Working Set, or a repository. */
  readonly what: string
  /**
   * What the rows below are, which decides which chips are worth offering.
   *
   * Work is the mixed list: pull requests, their checks and their reviews, with
   * issues among them. Issues is a list that holds nothing else, where a chip
   * for a check is a chip that empties the list.
   */
  readonly about?: "work" | "issues"
  readonly onQuery: (query: string) => void
}) => {
  const art = useArt()
  const [open, setOpen] = useState<string | undefined>(undefined)
  // Which of the two ways of shutting was used, kept here because this is where both
  // are heard. A chip cannot tell a keypress from a press on the page behind it.
  const [byKey, setByKey] = useState(false)
  const row = useRef<HTMLDivElement | null>(null)

  // Escape and a press elsewhere, which are the two ways anyone shuts a menu
  // without having been told how.
  useEffect(() => {
    if (open === undefined) return

    const shut = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setByKey(true)
      setOpen(undefined)
    }
    const away = (event: MouseEvent) => {
      const on = event.target
      if (on instanceof Node && row.current?.contains(on) === true) return
      setByKey(false)
      setOpen(undefined)
    }

    document.addEventListener("keydown", shut)
    document.addEventListener("mousedown", away)
    return () => {
      document.removeEventListener("keydown", shut)
      document.removeEventListener("mousedown", away)
    }
  }, [open])

  const facets = useMemo(
    () =>
      about === "issues"
        ? [authorFacet(art, authors, viewer), issueStateFacet(art), issueActivityFacet(art)]
        : [
            authorFacet(art, authors, viewer),
            checksFacet(art),
            reviewFacet(art),
            stateFacet(art),
            activityFacet(art)
          ],
    [about, art, authors, viewer]
  )
  const anything = termsIn(query).length > 0

  return (
    // The row is above the shelves below it, not merely before them. Its menus
    // hang out of it, and a shelf that animates in is a stacking context of its
    // own — without a layer here, the shelf paints over the open menu.
    <div
      ref={row}
      /* The box and the chips are one control, not six: four pixels between them so the row
         reads as a single instrument, matching the column they stand in. */
      className="relative z-30 flex flex-wrap items-center gap-1"
    >
      <input
        type="search"
        aria-label={`Filter ${what}`}
        placeholder={EXAMPLE[about]}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        className={`${FIELD} h-8 min-w-64 grow px-3 text-sm`}
      />

      {facets.map((facet) => (
        <Chip
          key={facet.name}
          facet={facet}
          query={query}
          open={open === facet.name}
          byKey={byKey}
          onOpen={setOpen}
          onQuery={onQuery}
        />
      ))}

      {anything ? (
        <button
          type="button"
          onClick={() => onQuery("")}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-ink-muted hover:bg-hover"
        >
          <art.close size={12} />
          Clear
        </button>
      ) : null}
    </div>
  )
}
