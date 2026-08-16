import { createContext, useContext, useMemo, type FunctionComponent, type ReactNode } from "react"
import { HUGEICONS } from "./hugeicons"
import { OCTICONS } from "./octicons"
import { useSettings } from "./useSettings"
import type { Settings } from "../domain/Settings"
import type { CheckState, PullRequestState } from "../domain/PullRequest"

/**
 * The glyphs a screen draws, and where they come from.
 *
 * Named rather than imported. A screen asks for `pull-request` and this file
 * decides what that looks like, so no component anywhere names an icon package
 * and the whole interface can be redrawn without touching a screen.
 *
 * Two sets, and the reader picks. The default picks for them by place: GitHub's
 * own glyphs on GitHub's page, ours in a window of ours. That default was once
 * hardcoded per shell, then collapsed to a single set on the grounds that both
 * shells were handing down the same one and the second table was only drift
 * waiting to happen — a third copy in the desktop workspace had gone
 * twenty-seven names behind and did not compile. The drift argument was right
 * and the conclusion was not: what it argues for is one table per set with the
 * `Set` type over both, which is what this is, rather than one set for everyone.
 *
 * Named for the meaning and not the picture: `check-passed` rather than
 * `check-circle-fill`, because the one thing a replacement set must preserve is
 * what the glyph means, and a name that describes a filled circle is a name that
 * lies the moment somebody draws a tick.
 */

/**
 * What a glyph is here: a component taking a size, a class and a name.
 *
 * The props are written out rather than borrowed from an icon package, because
 * borrowing that type is how a package ends up in the imports of every screen
 * that only wanted a shape. The component type itself is React's, which is not
 * pedantry: React 19 lets a component return a promise, both packages type their
 * glyphs as `FC`, and a plainer `(props) => ReactNode` written here rejects
 * every one of them.
 */
export type Art = FunctionComponent<{
  readonly size?: number | "small" | "medium" | "large"
  readonly className?: string
  readonly "aria-label"?: string
}>

export type ArtName =
  | "pull-request"
  | "pull-request-draft"
  | "pull-request-merged"
  | "pull-request-closed"
  /**
   * Two for an issue where a pull request has four, because an issue has two
   * states: nothing merges and nothing is a draft.
   */
  | "issue"
  | "issue-closed"
  | "check-passed"
  | "check-failed"
  | "check-running"
  | "check-queued"
  | "check-skipped"
  | "comment"
  | "comments"
  /**
   * A reviewer that is not a person, which is a different afternoon's work.
   *
   * Six unanswered colleagues and six unanswered findings are the same number
   * and not the same job: one is a conversation and the other is a list to
   * agree or disagree with. The glyph is what says which before the row is
   * read, the word "bot" beside an author being the only thing that said it
   * before, and only once a thread was already open.
   */
  | "bot"
  | "clock"
  | "eye"
  | "tick"
  | "dot"
  | "chevron-down"
  /**
   * Pinned, and the same glyph struck through for taking it back.
   *
   * A pin has to be legible at eleven pixels beside a repository name, which is why
   * this is Primer's own rather than a typed character: `☆` at that size is a speck,
   * and a control nobody can see is a control nobody presses.
   */
  | "pinned"
  | "unpin"
  | "close"
  /*
   * The Rail's own glyphs: one per Destination, one per section heading, and the four
   * controls at its foot.
   *
   * These are what the narrow Rail is. It used to collapse to the first letter of each
   * Destination — a column of W, R, A, which is a legend the reader has to have been taught.
   * A glyph is the same width and says what it is, so the strip at 3rem is navigation rather
   * than an abbreviation of it.
   */
  | "working-set"
  | "repositories"
  /**
   * What one repository in a list is, said before its name is read.
   *
   * Three states worth a glyph of their own, and they are the three that change what a
   * row means: a fork is somebody else's work, an archive is finished work, and a lock
   * is work nobody else can open. Everything else takes `repositories`.
   */
  | "fork"
  | "archived"
  | "private"
  | "activity"
  | "search"
  | "create"
  | "home"
  | "narrow"
  | "widen"
  | "work"
  /** A Court's own glyph: the reader's move. The other two are `clock` and `tick` above. */
  | "needs-you"
  /**
   * The inbox, kept from their bar, in the two states it has.
   *
   * A tray rather than the bell it was. The bell was chosen to keep this glyph off the one
   * the Working Set wears, and the two are not confusable in the places they stand: the
   * Working Set is a Destination in the Rail, beside a word, and this is alone in the far
   * corner of the strip.
   *
   * Two names because the difference is the drawing's to make. Octicons has no unread tray,
   * so its answer is the filled one; Hugeicons draws the mark into the glyph.
   */
  | "notifications"
  | "notifications-unread"
  /*
   * A repository's own tabs, one glyph each, for the bar's strip and the menu behind the
   * repository's name.
   *
   * Their row is read rather than reproduced — see `theirNav.ts` — so these are named for
   * what a tab is about and matched to a tab by its first word in `tabMarks.ts`. `issue`,
   * `pull-request` and `comments` above already answer three of the nine, which is the
   * argument for naming a set by meaning: Discussions needs no glyph of its own.
   */
  | "code"
  | "actions"
  | "projects"
  | "security"
  | "insights"
  | "settings"
  | "wiki"
  /**
   * The reader themselves, and the way out, for the two rows of the Participant menu that
   * are not a setting or GitHub's own mark.
   *
   * A menu of six rows where one wears a glyph and five do not is worse than a menu of
   * bare words: the odd row reads as the only one that does anything.
   */
  | "person"
  | "sign-out"
  /**
   * The rest, which were not named at all until now.
   *
   * Fifteen glyphs were imported straight from the icon package into fifteen
   * screens, past the table that exists so that this interface can be redrawn.
   * They are named here for the same reason as everything above: a screen that
   * says `copy` keeps working the day the drawing changes.
   */
  | "back"
  /**
   * The other way along the reader's own path, which is the pair to `back`.
   *
   * Not `needs-you`, which is the same arrow drawn for a different reason: that
   * one is a Court, and a set is named by meaning here rather than by picture. A
   * pack is free to draw the two alike, and nothing that says `forward` has to
   * change on the day one of them stops.
   */
  | "forward"
  | "chevron-right"
  | "chevron-up"
  | "copy"
  | "file"
  /** The two the reader's own settings are filed under, beside `settings` and `diff`. */
  | "appearance"
  | "files"
  | "diff"
  | "info"
  /** An error, as distinct from `check-failed`: a step that broke, a reason a merge cannot go. */
  | "error"
  /** Away from this interface, to a page it does not draw. */
  | "external"
  /** What a box for writing offers: the marks a Participant puts around their own words. */
  | "bold"
  | "italic"
  | "quote"
  | "list"
  /**
   * A file into the words: the one control that says a comment can carry one.
   *
   * Paste and drop do the same thing and neither is visible. A reader who has never dropped a
   * screenshot into this box has no way to learn that it takes one, and a reader who cannot
   * drag has no way to do it at all.
   */
  | "attach"
  /**
   * Writing the words, as against reading them back.
   *
   * One half of every switch in `Ways.tsx`; `eye` is the other half everywhere,
   * because looking at what a document comes to is the same act whether the
   * document is a README, a changed file or a comment being typed. This is the
   * one side that is not looking: it is the box the words go into.
   */
  | "write"
  /**
   * What a stacked pull request sits on: the mark in a tier's gutter, pointing
   * out of the row that is waiting and up into the row it goes into.
   *
   * It points at the base and not away from it. A layer merges into the one it
   * sits on, and the trunk is drawn above and to the left, so an arrow turning
   * up out of a row says where that row's work is going. Turned the other way
   * the same arrow said the base flows into the layer, which is the direction
   * nothing here travels in.
   *
   * Named for the relationship and not for an arrow, because the two sets draw
   * it differently on purpose: GitHub's is a corner arrow of the same weight as
   * the glyphs beside it, and the window's is Hugeicons' curved one, which
   * turns the corner the way the rest of that set rounds everything.
   */
  | "stacked-on"
  /** The handle on a menu of everything else, which a row wears at its end. */
  | "more"
  | "link"
  /**
   * The command key itself, for the badge that says which key opens the palette.
   *
   * A glyph rather than the character: `⌘` is in a font, and in a monospace kbd beside a `K` it
   * sat a pixel low and a shade lighter than the letter next to it. An icon is the same weight as
   * everything else in the strip.
   *
   * The one name both sets answer with the same drawing, like `github` from the other direction:
   * a key on the reader's keyboard is not a house style. Octicons has no glyph for it and the
   * nearest name is a prompt, which is how the badge came to read `>_K`. See `commandKey.tsx`.
   */
  | "command"
  /**
   * Their mark, for the one control that leaves this interface for theirs.
   *
   * A brand rather than a picture of an idea. The way out was an arrow-switch
   * beside the word "GitHub", and wordless in the strip an arrow-switch says
   * "switch something" and stops there. The mark names the destination, which
   * is the whole of what the button has to say, and it is the same shape in
   * both sets because it belongs to GitHub rather than to a drawing style.
   */
  | "github"
  /**
   * Taking a file away with you, for the one row on the releases screen that is the
   * reason a reader came to that page at all.
   *
   * The most upvoted complaint about GitHub's releases page is a reader asking where
   * the download button is, at 3,293 points, so the glyph is doing the work a word
   * cannot do fast enough. `file` is the wrong shape for it: a file is a thing that
   * exists, and this is a thing that happens.
   */
  | "download"
  /**
   * A version, for the chip that says which one a Change arrived in.
   *
   * Named for the tag rather than for a version number, because that is what GitHub
   * publishes and what the reader can go and look at. The releases screen wears it
   * once per section heading and never on a row: thirty tags down a page, a glyph
   * beside each would be the noise the screen exists to remove.
   */
  | "tag"

/** Ours, in a module of its own so a set can hold it without a cycle. */
export { SpinnerIcon } from "./spinner"

export type Set = Record<ArtName, Art>

/**
 * The sets there are, under the name the reader's answer holds.
 *
 * Two, and the type will not let a third through with a name missing. Adding one
 * is a module exporting a `Set`, a line here, and a choice on the knob.
 */
export const SETS = { github: OCTICONS, gitquiet: HUGEICONS } as const

export type ArtChoice = Settings["theme"]["art"]

/**
 * What the reader's answer comes to, given where this is drawn.
 *
 * `match` is the default and is not a set: it is the reader saying the question
 * belongs to the place rather than to them. On GitHub's page that resolves to
 * their glyphs, because the argument for Octicons is recognition and recognition
 * only exists next to the row of theirs the reader already knows. In a window of
 * our own there is no such row, so it resolves to ours.
 */
export const setOf = (chosen: ArtChoice, here: Set): Set =>
  chosen === "match" ? here : SETS[chosen]

/**
 * The set a screen with nobody above it draws in.
 *
 * A test renders one component and no shell, and it still has to draw. Ours
 * rather than theirs, because a screen with no page around it is the window
 * case.
 */
export const THE_ART: Set = HUGEICONS

const Drawn = createContext<Set | null>(null)

/**
 * The set every screen below this asks for, resolved once.
 *
 * Here rather than in each glyph: the answer is a read of the reader's settings,
 * and a hundred icons each doing that read is a hundred stores. This is the same
 * shape as `Theme` for the same reason — one place reads the choice, everything
 * under it is handed the result.
 *
 * `here` is the shell's own answer to `match`: what this place would be drawn in
 * if the reader never opened the settings. The extension passes GitHub's set
 * because it is standing on GitHub's page; the desktop window passes ours.
 */
export const ArtProvider = ({
  here,
  children
}: {
  readonly here?: Set
  readonly children: ReactNode
}) => {
  const { settings } = useSettings()
  const set = useMemo(() => setOf(settings.theme.art, here ?? THE_ART), [settings.theme.art, here])

  return <Drawn.Provider value={set}>{children}</Drawn.Provider>
}

/** The glyphs this screen is drawn in. */
export const useArt = (): Set => useContext(Drawn) ?? THE_ART

/**
 * Which glyph a pull request's state is, and which a check's run came to.
 *
 * The mapping lives here, beside the names, so that a screen reading the set
 * from the context and a screen still importing the glyph directly cannot come
 * to different conclusions about what a merged pull request looks like.
 */
export const pullRequestName = (state: PullRequestState): ArtName => {
  switch (state) {
    case "draft":
      return "pull-request-draft"
    case "merged":
      return "pull-request-merged"
    case "closed":
      return "pull-request-closed"
    case "open":
      return "pull-request"
  }
}

export const issueName = (state: "open" | "closed"): ArtName =>
  state === "closed" ? "issue-closed" : "issue"

export const checkName = (state: CheckState): ArtName => {
  switch (state) {
    case "succeeded":
      return "check-passed"
    case "failed":
    // The same glyph a failure gets, in a different colour, because it is the
    // same event: the job fell over. What differs is whether anybody owes it a
    // move, and `CHECK_TONE` is where that is said.
    case "tolerated":
      return "check-failed"
    // Running and queued are not the same wait: one is happening, the other has
    // not begun. GitHub draws that difference and so does this.
    case "running":
      return "check-running"
    case "queued":
      return "check-queued"
    case "cancelled":
    case "skipped":
    case "neutral":
      return "check-skipped"
  }
}
