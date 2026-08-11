import { useEffect, useId, useRef, useState } from "react"
import { Option } from "effect"
import type { Destination } from "../domain/Settings"
import type { RepositoryAtWork } from "../domain/rail"
import { matching, type Repository } from "../domain/repositories"
import { DEFAULT_PROFILE, type Profile } from "../keys/commands"
import { type ArtName, useArt } from "./art"
import { FIELD, HERE, PRESSABLE } from "./dress"
import { Face } from "./Face"
import { Menu, type Row } from "./Menu"
import { participantRows } from "./participant"
import { useKeys } from "./useKeys"

/**
 * The strip of navigation that never leaves.
 *
 * Two things a reader of GitHub cannot do without it, both taken from their own threads:
 * reach a repository in one press rather than two, and leave a pull request without the
 * back button — which their soft navigation is known to break. So this is deliberately
 * not a sidebar of links to pages: it is the three Destinations Home can be, and the
 * repositories a reader actually goes to.
 *
 * Narrow is a working state rather than a hidden one. The words go; the counts and the
 * faces stay, so "is anything mine?" is answered at three characters wide. That is the
 * difference between narrowing costing density and narrowing costing information. Which
 * width it starts at is remembered in the settings record, because a reader who narrows it
 * has said something about their screen and should not have to say it again after a reload.
 *
 * See `docs/spec/home.md`.
 */
export type RailProps = {
  /** Which Destination is being shown, so the Rail can mark it and offer the others. */
  readonly destination: Destination
  readonly onDestination: (destination: Destination) => void
  /** Ranked by `repositoriesAtWork`; drawn in the order it is given. */
  readonly atWork: ReadonlyArray<RepositoryAtWork>
  /** How much of the Working Set is the reader's own move, for the Destination's count. */
  readonly yourMove: number
  /** How much happened elsewhere, for Activity's count. Absent until that read lands. */
  readonly happened?: number
  /**
   * Every repository the reader has, for the filter.
   *
   * The Rail lists the ones with work in them, which is six or so; the filter searches all
   * 154, which is story 5 — "finding a repository is typing rather than remembering" — and
   * the reason it takes both lists rather than one.
   */
  readonly repositories?: ReadonlyArray<Repository>
  /**
   * The repositories the reader pinned, as `owner/repo`, in the order they pinned them.
   *
   * Above the work rather than mixed into it, and unlimited: GitHub's six is a number about
   * their layout, and a reader who pinned a repository has said it matters whether or not
   * there is a pull request in it this week.
   */
  readonly pinned?: ReadonlyArray<string>
  readonly onPinned?: (pinned: ReadonlyArray<string>) => void
  /** Whether it starts narrow. Remembered by the screen through the settings record. */
  readonly collapsed?: boolean
  readonly onCollapsed?: (collapsed: boolean) => void
  /** Who the reader is, for the menu at the foot of the Rail. */
  readonly participant?: { readonly login: string; readonly faceUrl: Option.Option<string> }
  readonly keys?: Profile
}

/** A repository as the Rail draws it, whichever of its two lists it is in. */
type Standing = {
  readonly owner: string
  readonly repo: string
  readonly faceUrl: Option.Option<string>
  readonly count: number
}

/** Shared so a default prop is not a new array on every render. */
const NONE_PINNED: ReadonlyArray<string> = []

/**
 * The three Destinations, in the order they are offered, each with its glyph.
 *
 * The glyph is what the narrow Rail shows. It used to show the first letter of the name,
 * which is a legend rather than navigation: three rows reading W, R, A tell a reader nothing
 * they were not already told by the wide Rail they have just closed.
 */
const DESTINATIONS: ReadonlyArray<{
  readonly which: Destination
  readonly name: string
  readonly art: ArtName
}> = [
  { which: "working-set", name: "Working Set", art: "working-set" },
  { which: "repositories", name: "Repositories", art: "repositories" },
  { which: "activity", name: "Activity", art: "activity" }
]

/**
 * A number beside the thing it counts.
 *
 * Tabular and monospaced so a column of them lines up on its digits, and dim: the count is
 * the second thing on the row, after what the row is. On the row the reader is standing on
 * it takes the row's own ink, since a dim number on a filled row reads as disabled.
 */
const Count = ({ many, here = false }: { readonly many: number; readonly here?: boolean }) => (
  <span
    className={`shrink-0 font-mono text-xs tabular-nums ${here ? "text-ink" : "text-ink-muted"}`}
  >
    {many}
  </span>
)

/**
 * One of the Rail's lists of repositories, pinned or at work.
 *
 * Both are the same row, which is the point: a reader pins the repository they are looking
 * at, and it moves up rather than changing into something else. The pin itself is drawn on
 * every row rather than on hover — "row actions only appear on hover" is its own complaint
 * in their thread, and reaching one should not be a game of aim.
 */
const List = ({
  name,
  heading,
  art: mark,
  standings,
  narrow,
  pinned,
  onPin
}: {
  readonly name: string
  readonly heading: string
  /** The glyph on the heading, which is all the heading is while the Rail is narrow. */
  readonly art: ArtName
  readonly standings: ReadonlyArray<Standing>
  readonly narrow: boolean
  readonly pinned: ReadonlySet<string>
  readonly onPin?: (address: string) => void
}) => {
  const art = useArt()
  const Mark = art[mark]

  return (
  <div className="flex min-h-0 flex-col gap-1">
    {/*
     * A glyph and a word at full width; a rule at narrow.
     *
     * The line itself is kept either way — giving it back on the frame the width starts
     * moving would make the list jump upwards and then the edge arrive, which is two events
     * for one press — so the box is a fixed height and only its contents change.
     *
     * What changes is what a heading can honestly be at 3.5rem. A lone pin over a column of
     * faces heads nothing: there is no word for it to belong to, and it reads as one more
     * glyph in the same column as the Destinations above it. A rule says the only thing the
     * heading was still saying once its word had gone, which is "a different group starts
     * here".
     */}
    <p
      aria-hidden="true"
      className="flex h-5 items-center gap-1.5 px-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted opacity-70"
    >
      {narrow ? (
        <span className="h-px flex-1 bg-line" />
      ) : (
        <>
          <Mark size={12} className="shrink-0" />
          <span className="t-rail-word truncate">{heading}</span>
        </>
      )}
    </p>
    <ul
      aria-label={name}
      /*
       * Scrolling only at full width. A scrollbar gutter in a strip 3.5rem wide takes eight
       * of the forty pixels the rows have to sit in, which moved every face eight pixels off
       * the axis the Destination glyphs above them stand on — measured on the page, not
       * guessed. Narrow, the card is short enough to grow instead.
       */
      className={`flex min-h-0 list-none flex-col gap-0.5 p-0 ${
        narrow ? "" : "overflow-y-auto"
      }`}
    >
      {standings.map((one) => {
        const address = `${one.owner}/${one.repo}`
        const held = pinned.has(address)
        /*
         * The same glyph whether or not it is pinned, and the state is in its colour.
         *
         * It used to be a struck-through pin on a pinned row, on the grounds that the button
         * unpins — and a struck-through anything reads as "not this" or "not allowed", so the
         * one row that *was* pinned looked like the one row that could not be. The label says
         * the verb, which is where a verb belongs; the glyph says the state.
         */
        const Pin = art.pinned

        return (
          <li key={address} className="flex items-center gap-1">
            <a
              // Their pull requests rather than their code, because that is the page this
              // extension already draws and the reason the reader is looking.
              href={`/${address}/pulls`}
              aria-label={one.count === 0 ? address : `${address}, ${one.count} open`}
              // Centred at narrow, so a face lands on the same axis as the Destination
              // glyphs above it. Left-padded, it sat two pixels off that column and the
              // strip read as two lists that had failed to line up.
              className={`flex min-w-0 flex-1 items-center gap-2 rounded py-1 text-sm text-ink-muted no-underline hover:bg-hover hover:text-ink ${
                narrow ? "justify-center px-0" : "px-2"
              }`}
            >
              <Face faceUrl={one.faceUrl} name={one.repo} pinned={narrow && held} />
              <span aria-hidden="true" className="t-rail-word min-w-0 truncate text-sm">
                {one.repo}
              </span>
            </a>
            {narrow || one.count === 0 ? null : <Count many={one.count} />}
            {narrow || onPin === undefined ? null : (
              <button
                type="button"
                onClick={() => onPin(address)}
                aria-label={`${held ? "Unpin" : "Pin"} ${address}`}
                /*
                 * Always drawn, never revealed on hover, and dim until it is either pointed
                 * at or already holding something. "Row actions only appear on hover" is its
                 * own complaint in their thread; a row of pins at full strength down the
                 * strip is the opposite mistake, so the resting state is quiet and the pinned
                 * one is in the accent.
                 *
                 * A whole square to press rather than the glyph plus two pixels. Twelve pixels
                 * of pin in a sixteen-pixel box was a target a pointer had to be aimed at, on
                 * a control whose entire purpose is being easier than GitHub's own six-slot
                 * pinning dialog.
                 */
                className={`grid size-6 shrink-0 place-items-center rounded hover:bg-hover ${
                  held ? "text-ink" : "text-ink-muted opacity-60 hover:opacity-100"
                }`}
              >
                <Pin size={14} />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  </div>
  )
}

export const Rail = ({
  destination,
  onDestination,
  atWork,
  yourMove,
  happened,
  repositories = [],
  pinned = NONE_PINNED,
  onPinned,
  collapsed = false,
  onCollapsed,
  participant,
  keys = DEFAULT_PROFILE
}: RailProps) => {
  const art = useArt()
  // Named, because JSX takes a dotted name and not a subscript.
  const Chevron = art["chevron-down"]
  const [narrow, setNarrow] = useState(collapsed)

  /*
   * The remembered width arrives after the Rail does.
   *
   * Settings are read from storage, which takes a frame or two, so the first render of this
   * always says wide whatever the reader chose last time. Seeding the state was therefore
   * seeding it with the default and then ignoring the answer — which looked exactly like a
   * width that was not being remembered at all, and was found that way on the live page.
   *
   * Adopted rather than made fully controlled: a Rail whose narrowing depended on a handler
   * would not narrow at all for a caller that has nowhere to keep the answer.
   */
  const [asRemembered, setAsRemembered] = useState(collapsed)
  if (collapsed !== asRemembered) {
    setAsRemembered(collapsed)
    setNarrow(collapsed)
  }
  const [typed, setTyped] = useState("")
  // One at a time: two surfaces open over a strip this narrow would cover each other.
  const [opened, setOpened] = useState<"account" | "create" | undefined>(undefined)
  const filter = useRef<HTMLInputElement>(null)
  const filterId = useId()

  /*
   * Whether a key, rather than a hand, asked for the width the Rail is at.
   *
   * The width below is animated on purpose, but that reasoning is about a press on the widen
   * control: a reader who chose it is watching it happen. A reader who pressed `/` is already
   * typing, and 260ms of strip travel arrives under their first letters with the box they are
   * aiming at still somewhere else while it does.
   *
   * Held until the next change rather than dropped after a frame. A mark that is taken off on
   * the following frame reads well enough in a browser, where the frame is a real paint, but it
   * is two state changes React is free to commit as one — so the attribute could come and go
   * without ever being in the document, which is exactly what it did under test. Kept, it says
   * something true for as long as it is true: this width came from a keypress. The next press
   * on the control says otherwise and animates.
   */
  const [byKey, setByKey] = useState(false)

  /*
   * Reaching for the filter across a render.
   *
   * A narrow Rail has no filter in it, so `/` has to widen first — and the box the reader is
   * aiming at does not exist on the tick their key arrives. Focusing it there focused nothing,
   * quietly, and the letters that followed went to GitHub's own shortcuts instead. This waits
   * for the render that puts the box on the page.
   */
  const [reaching, setReaching] = useState(false)

  useEffect(() => {
    if (!reaching) return
    filter.current?.focus()
    setReaching(false)
  }, [reaching])

  const toggle = (fromKey = false) => {
    const next = !narrow
    setByKey(fromKey)
    setNarrow(next)
    onCollapsed?.(next)
    if (next) setTyped("")
  }

  const goTo = (which: Destination) => {
    onDestination(which)
    // Typing narrows this Rail, not the page: leaving a filter behind after a press on
    // Activity would leave a reader looking at a list they had stopped asking about.
    setTyped("")
  }

  // Their own `/` reaches for their search, and this page is not theirs while it is drawn.
  // Not claimed while the Repositories Destination is showing: that page has a filter of
  // its own over all 154, and two boxes fighting over one keypress is worse than either.
  useKeys(destination === "repositories" ? "off" : keys, {
    search: () => {
      if (narrow) {
        toggle(true)
        setReaching(true)
        return
      }
      filter.current?.focus()
    }
  })

  /*
   * The Destinations, bound separately from the filter above.
   *
   * Two bindings rather than one because they answer to different questions: `/` belongs to
   * whichever box is on the page and is handed back on the one Destination that has its own,
   * while the chords are how a reader leaves a Destination and must work on all three —
   * including the one where `/` is not ours. `g d` is not animated and never will be: a
   * chord pressed fifty times a day that waits for a page to slide is a chord that reads as
   * slower than the page it replaced.
   */
  useKeys(keys, {
    workingSet: () => goTo("working-set"),
    repositories: () => goTo("repositories"),
    activity: () => goTo("activity")
  })

  const found = matching(repositories, typed)
  const searching = typed.trim().length > 0

  const held = new Set(pinned)
  const faceOf = (owner: string, repo: string): Option.Option<string> =>
    repositories.find((one) => one.owner === owner && one.repo === repo)?.faceUrl ??
    Option.none<string>()
  const countOf = (owner: string, repo: string): number =>
    atWork.find((one) => one.owner === owner && one.repo === repo)?.count ?? 0

  /** The repositories the Rail lists: work first, and whatever is being typed instead. */
  const listed: ReadonlyArray<Standing> = (
    searching
      ? found.map((one) => ({
          owner: one.owner,
          repo: one.repo,
          faceUrl: one.faceUrl,
          count: countOf(one.owner, one.repo)
        }))
      : atWork.map((one) => ({
          owner: one.owner,
          repo: one.repo,
          faceUrl: faceOf(one.owner, one.repo),
          count: one.count
        }))
  ).filter((one) => !held.has(`${one.owner}/${one.repo}`))

  /*
   * The pinned repositories, drawn from the addresses rather than from a read.
   *
   * A pin outlives whatever list it was made from: the repository read may not have landed
   * yet, and the repository may have no pull request in it this month, which is the whole
   * point of having pinned it. The face and the count are added where they happen to be
   * known and left out where they are not.
   */
  const kept: ReadonlyArray<Standing> = pinned.flatMap((address) => {
    const [owner, repo] = address.split("/")
    if (owner === undefined || repo === undefined) return []
    return [{ owner, repo, faceUrl: faceOf(owner, repo), count: countOf(owner, repo) }]
  })

  const pinning = (address: string) =>
    onPinned?.(held.has(address) ? pinned.filter((one) => one !== address) : [...pinned, address])

  // A zero beside a Destination is a claim that it holds nothing, which is a different
  // thing from not having read it yet. Both of the reads behind these arrive after the Rail
  // does, so both say nothing until they land.
  /*
   * Where a new issue or pull request lands.
   *
   * The repository the reader has most work in, which is the first of a list already
   * ranked by exactly that. GitHub's own answer is a picker, and a picker is the second
   * press this Rail exists to remove. Absent until some list has arrived, because a
   * `/undefined/issues/new` is worse than a menu with one row on it.
   */
  const aimedAt = atWork[0] ?? repositories[0]
  const creating: ReadonlyArray<Row> = [
    { name: "New repository", where: "/new", art: "repositories" },
    ...(aimedAt === undefined
      ? []
      : [
          {
            name: `New issue in ${aimedAt.repo}`,
            where: `/${aimedAt.owner}/${aimedAt.repo}/issues/new`,
            art: "issue" as const
          },
          {
            name: `New pull request in ${aimedAt.repo}`,
            where: `/${aimedAt.owner}/${aimedAt.repo}/compare`,
            art: "pull-request" as const
          }
        ]),
    // A gist is a file of code and nothing else, which is what the glyph says.
    { name: "New gist", where: "https://gist.github.com/", art: "code" }
  ]

  const countFor = (which: Destination): number | undefined =>
    which === "working-set"
      ? yourMove
      : which === "activity"
        ? happened
        : repositories.length === 0
          ? undefined
          : repositories.length

  return (
    <nav
      aria-label="Rail"
      data-narrow={narrow ? "" : undefined}
      data-snap={byKey ? "" : undefined}
      /*
       * A card, rather than a column with a rule down its right edge.
       *
       * The rule made the strip part of the page's chrome, which is what GitHub's own
       * hamburger drawer is; a raised panel with its own edge makes it a thing the reader
       * owns and can put away. `self-start` so it is as tall as its contents and no taller —
       * a full-height card with six inches of nothing under the account is a column again.
       */
      className={`t-rail flex shrink-0 flex-col gap-2 self-start overflow-hidden rounded-lg border border-line bg-raised p-2 ${
        narrow ? "w-14" : "w-60"
      }`}
    >
      <ul className="flex list-none flex-col gap-0.5 p-0">
        {DESTINATIONS.map((one) => {
          const many = countFor(one.which)
          const here = one.which === destination
          const Glyph = art[one.art]

          return (
            <li key={one.which}>
              <button
                type="button"
                onClick={() => goTo(one.which)}
                // `aria-current` rather than a pressed state: this is where the reader is,
                // not a switch they have flipped.
                aria-current={here ? "page" : undefined}
                aria-label={
                  many === undefined ? one.name : `${one.name}, ${many}`
                }
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                  narrow ? "justify-center" : "justify-between"
                } ${
                  /*
                   * Where the reader is, one step deeper than the hover the rows underneath
                   * take when pointed at, and in full ink rather than in the accent. Two
                   * fills of the same grey read as one strip; the accent tint read as a chip
                   * from another product — see `HERE` in `dress.ts`.
                   */
                  here ? `${HERE} font-medium` : "text-ink-muted hover:bg-hover hover:text-ink"
                }`}
              >
                <span className="relative flex min-w-0 items-center gap-2">
                  {/*
                   * The glyph is the row at 3.5rem and the mark beside the word at 15rem, so
                   * narrowing takes the word away and moves nothing else: the strip's edge is
                   * the only thing that travels.
                   */}
                  <Glyph size={16} className={`shrink-0 ${here ? "" : "opacity-80"}`} />
                  <span aria-hidden="true" className="t-rail-word truncate">
                    {one.name}
                  </span>
                  {/*
                   * Narrow, the count rides the glyph's shoulder.
                   *
                   * Narrow is a working state and not a hidden one: a reader who put the words
                   * away still needs the answer to "is anything mine?", which is the number. It
                   * cannot stay on the row's right edge at this width, so it becomes a badge —
                   * and the repositories' total is left off, being the one count that says how
                   * long a list is rather than how much is owed.
                   */}
                  {narrow && many !== undefined && one.which !== "repositories" ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -top-1 rounded-full bg-accent-emphasis px-1 font-mono text-[9px] leading-[1.4] text-ink-on-emphasis tabular-nums"
                    >
                      {many}
                    </span>
                  ) : null}
                </span>
                {narrow || many === undefined ? null : <Count many={many} here={here} />}
              </button>
            </li>
          )
        })}
      </ul>

      {narrow || repositories.length === 0 ? null : (
        <div className="relative flex flex-col gap-1">
          <label htmlFor={filterId} className="sr-only">
            Filter your repositories
          </label>
          {/*
           * The glyph inside the field rather than a word beside it. The placeholder says
           * what the field is for; the magnifier says what it does before it is read, and at
           * this width a label above the box would cost a line for two words.
           */}
          <art.search
            size={12}
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            ref={filter}
            id={filterId}
            type="search"
            value={typed}
            placeholder="Filter repositories"
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setTyped("")
                event.currentTarget.blur()
              }
            }}
            className={`${FIELD} w-full py-1 pl-7 pr-2 text-xs`}
          />
        </div>
      )}

      {kept.length === 0 || searching ? null : (
        <List
          name="Repositories you pinned"
          heading="Pinned"
          art="pinned"
          standings={kept}
          narrow={narrow}
          pinned={held}
          onPin={onPinned === undefined ? undefined : pinning}
        />
      )}

      {listed.length === 0 ? (
        searching ? (
          <p className="px-2 text-xs text-ink-muted">
            Nothing matches {typed.trim()}, of {repositories.length}.
          </p>
        ) : null
      ) : (
        <List
          name={searching ? "Repositories that match" : "Repositories you are working in"}
          heading={searching ? `${listed.length} of ${repositories.length}` : "Your work"}
          art={searching ? "search" : "work"}
          standings={listed}
          narrow={narrow}
          pinned={held}
          onPin={onPinned === undefined ? undefined : pinning}
        />
      )}

      {/*
       * Everything below the rule is about the reader rather than about their work: starting
       * something, who they are, and what shape they want the strip in. One hairline, because
       * a card divided into four boxes is a filing cabinet.
       */}
      <div className="mt-1 flex flex-col gap-1 border-t border-line-muted pt-2">
        {/*
         * Starting something, from the Rail.
         *
         * Their own thread asks twice for the New-repository button that the chat box
         * displaced, and the two rows under it are the same ask one step further on: an
         * issue and a pull request need a repository to be in, so they aim at the one the
         * reader is most at work in rather than at a picker.
         */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpened(opened === "create" ? undefined : "create")}
            aria-expanded={opened === "create"}
            aria-haspopup="menu"
            aria-label="Create"
            /*
             * A button that looks like one, where this was a row of grey text with a boxed
             * plus glued to its left. It is the only thing in the strip that makes something
             * rather than going somewhere, and a filled control is how that is said without
             * a colour that would compete with the Destination the reader is on.
             */
            /*
             * A square at narrow rather than the same bordered bar with its word removed.
             * A full-width block two lines tall, in a strip 3.5rem wide, is the heaviest
             * thing on the Rail saying the least — and being no longer `w-full` it also
             * picks up the press this codebase gives every control that is not a row.
             */
            className={`${PRESSABLE} flex items-center gap-2 text-sm font-medium text-ink hover:bg-active ${
              narrow ? "size-9 justify-center self-center p-0" : "w-full justify-start px-2 py-1.5"
            }`}
          >
            <art.create size={16} aria-hidden="true" className="shrink-0" />
            <span aria-hidden="true" className="t-rail-word min-w-0 truncate">
              Create
            </span>
          </button>

          <Menu
            name="Create"
            open={opened === "create"}
            onShut={() => setOpened(undefined)}
            rows={creating}
          />
        </div>

        {participant === undefined ? null : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpened(opened === "account" ? undefined : "account")}
              aria-expanded={opened === "account"}
              aria-haspopup="menu"
              aria-label={`${participant.login} and your account`}
              className={`flex w-full items-center gap-2 rounded-md py-1.5 text-sm text-ink-muted hover:bg-hover hover:text-ink ${
                narrow ? "justify-center px-0" : "px-2"
              }`}
            >
              <Face faceUrl={participant.faceUrl} name={participant.login} big />
              <span aria-hidden="true" className="t-rail-word min-w-0 flex-1 truncate text-left">
                {participant.login}
              </span>
              {/*
               * Which way the menu will go, and that there is one at all.
               *
               * Two elements for one glyph, because `.t-rail-word` owns
               * `transition-property: opacity, filter` and a `transition-transform` utility
               * loses to it — the turn simply snapped. So the span goes with the width and
               * the glyph inside it turns, each on its own lane.
               */}
              <span aria-hidden="true" className="t-rail-word flex shrink-0">
                <Chevron
                  size={12}
                  className={`t-turn ${opened === "account" ? "is-turned" : ""}`}
                />
              </span>
            </button>

            <Menu
              name="Your account"
              open={opened === "account"}
              onShut={() => setOpened(undefined)}
              rows={participantRows({ login: participant.login })}
            />
          </div>
        )}

        {/*
         * Drawn as a glyph rather than the typed `«` it was. That character takes the
         * reading font's weight and baseline, and at 12px next to Primer's own icons it
         * reads as a font that failed to load rather than as a button. Home lives in the
         * top bar's top-left control, so the Rail does not repeat it.
         */}
        <button
          type="button"
          // Called rather than handed over: the handler's argument is a mouse event, and
          // `toggle` reads its first argument as "a key did this".
          onClick={() => toggle()}
          aria-label={narrow ? "Widen the Rail" : "Narrow the Rail"}
          className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-hover hover:text-ink"
        >
          {narrow ? (
            <art.widen size={14} aria-hidden="true" />
          ) : (
            <art.narrow size={14} aria-hidden="true" />
          )}
        </button>
      </div>
    </nav>
  )
}
