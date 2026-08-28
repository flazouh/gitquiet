/**
 * What the reader has chosen, and everything that is known about each choice.
 *
 * One declaration per setting, in one list. The menu is built from it, the
 * defaults come from it, stored values are checked against it, and the diff and
 * the tree read the result — so adding a knob is adding a line here, and there
 * is nowhere for the four copies of that knob to drift apart.
 */

import { LIVES } from "./life"

export type Choice<T extends string> = {
  readonly value: T
  readonly label: string
}

export type Knob<K extends string, T extends string> = {
  readonly key: K
  readonly label: string
  /**
   * The label's other half, in a handful of words: what the knob is about, for
   * a row that is being scanned rather than read. Never the whole trade — the
   * note below is that, and one of the two is always in reach of the other.
   */
  readonly gist: string
  /**
   * What this changes, and what it costs — the whole of it, not a restatement
   * of the label. Shown in the menu, so it is written for someone deciding
   * rather than for someone maintaining this file.
   */
  readonly note: string
  /** Curated knobs are in the menu; advanced ones are behind one more click. */
  readonly advanced: boolean
  /**
   * Which control a reader is given for the choices.
   *
   * They are choices whichever it is, and everything else here treats them as
   * choices: what is stored, what is checked against the schema, and what the
   * little mockups are drawn from. This only says what the row holds. A list
   * of words is a list to pick from; a run of nine pixel sizes is a handle to
   * drag, which would be lost among nine words; and two answers named On and
   * Off are a switch, because that is what a reader reaches for.
   */
  readonly shape: "list" | "switch" | "slide"
  readonly choices: ReadonlyArray<Choice<T>>
  readonly fallback: T
}

const knob = <K extends string, T extends string>(
  key: K,
  label: string,
  gist: string,
  note: string,
  choices: ReadonlyArray<Choice<T>>,
  fallback: T,
  advanced = false,
): Knob<K, T> => ({ key, label, gist, note, advanced, shape: "list", choices, fallback })

/**
 * A knob whose choices are a run of pixel sizes, drawn as a slider.
 *
 * The steps are written out rather than given as a start, an end and a stride,
 * because they are the answers a reader can pick and every other part of this
 * file already knows what to do with a list of answers. A slider over stored
 * numbers would need its own validation, its own default, and its own kind of
 * mockup; a slider over choices needs none of the three.
 */
const slider = <K extends string>(
  key: K,
  label: string,
  gist: string,
  note: string,
  steps: ReadonlyArray<number>,
  fallback: number,
  advanced = false,
): Knob<K, string> => ({
  key,
  label,
  gist,
  note,
  advanced,
  shape: "slide",
  choices: steps.map((px) => ({ value: String(px), label: `${px}px` })),
  fallback: String(fallback),
})

const onOff = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
] as const satisfies ReadonlyArray<Choice<"on" | "off">>

/**
 * A knob with two answers, drawn as a switch.
 *
 * The two answers are always these two, in this order, so that a switch has one
 * meaning everywhere: to the right is on. A knob whose two answers are Show and
 * Hide, or Expanded and Collapsed, is a list of two words instead — the reader
 * has to be told which of the pair a lit switch would mean, and a word says it
 * where a switch cannot.
 */
const toggle = <K extends string>(
  key: K,
  label: string,
  gist: string,
  note: string,
  fallback: "on" | "off",
  advanced = false,
): Knob<K, "on" | "off"> => ({
  key,
  label,
  gist,
  note,
  advanced,
  shape: "switch",
  choices: onOff,
  fallback,
})

/**
 * Whose pull request page this is — the one choice that decides whether any of
 * the others are ever read.
 *
 * Kept out of the menu below deliberately. The menu is inside our page, so a
 * row in it that takes our page away would be the one control in there that
 * closes the thing you are using; the switch lives in the header instead, and
 * its twin sits on GitHub's own tab row for the way back.
 */
export const PAGE_KNOBS = [
  knob(
    "view",
    "Pull request page",
    "Whose page a pull request opens as",
    "Which page a pull request opens as. Ours puts the shell, the sections and the diff on one screen in place of the conversation. GitHub's leaves their page untouched and adds nothing to it but a way back, so nothing here is hidden from you on a day when their page is the one you want.",
    [
      { value: "ours", label: "This extension" },
      { value: "github", label: "GitHub's" }
    ],
    "ours"
  )
] as const

/**
 * How the interface is painted — light or dark, and which colour pack.
 *
 * Separate from `diff.syntax`, which colours keywords inside the code. That
 * knob can follow the pack (`match`) or stay on One Dark or GitHub.
 * These knobs colour the chrome around it: canvas, ink, borders, status chips.
 */
export const THEME_KNOBS = [
  knob(
    "appearance",
    "Appearance",
    "Follow the OS, or force light or dark",
    "Whether the interface follows the operating system's light or dark preference, or stays on Light or Dark regardless. System is the default so the product matches the rest of the machine; Light and Dark are for a day when the OS and the work disagree.",
    [
      { value: "system", label: "System" },
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" }
    ],
    "system"
  ),
  knob(
    "pack",
    "Theme",
    "Which colour pack paints the interface",
    "Which colour pack paints the screens. Match is the default and means the place: GitHub's own colours on GitHub's page, where this interface stands under their header and inside their tab, and Gitquiet — this product's own look — in a window of its own. The rest are familiar editor and terminal packs, Dracula, Gruvbox, Tokyo Night, One Dark and others, each with its own light and dark face, and each of them holds everywhere once it is asked for by name.",
    [
      { value: "match", label: "Match the page" },
      { value: "gitquiet", label: "Gitquiet" },
      { value: "anthropic", label: "Anthropic" },
      { value: "cursor", label: "Cursor" },
      { value: "github", label: "GitHub" },
      { value: "catppuccin", label: "Catppuccin" },
      { value: "nord", label: "Nord" },
      { value: "one-dark", label: "One Dark" },
      { value: "dracula", label: "Dracula" },
      { value: "solarized", label: "Solarized" },
      { value: "gruvbox", label: "Gruvbox" },
      { value: "tokyo-night", label: "Tokyo Night" },
      { value: "rose-pine", label: "Rosé Pine" },
      { value: "monokai", label: "Monokai" },
      { value: "ayu", label: "Ayu" },
      { value: "everforest", label: "Everforest" },
      { value: "kanagawa", label: "Kanagawa" },
      { value: "night-owl", label: "Night Owl" },
      { value: "material", label: "Material" },
      { value: "palenight", label: "Palenight" },
      { value: "horizon", label: "Horizon" },
      { value: "vesper", label: "Vesper" },
      { value: "cobalt", label: "Cobalt" },
      { value: "synthwave", label: "Synthwave" },
      { value: "oxocarbon", label: "Oxocarbon" },
      { value: "flexoki", label: "Flexoki" },
      { value: "zinc", label: "Zinc" }
    ],
    "match"
  ),
  knob(
    "art",
    "Icons",
    "Which set the glyphs are drawn from",
    "Which set every glyph is drawn from. Match uses GitHub's own Octicons on their page, where a pull request in this interface is then the same shape as the one in the header above it, and the product's rounder set in a window of its own, where there is no row of theirs to match. The other two answers hold one set everywhere.",
    [
      { value: "match", label: "Match the page" },
      { value: "github", label: "GitHub" },
      { value: "gitquiet", label: "Gitquiet" }
    ],
    "match"
  )
] as const

/**
 * The diff's own knobs, in the order they matter.
 *
 * Every value is a word rather than a boolean or a number, because the menu
 * shows words and the stored form should be the thing that was chosen rather
 * than a translation of it — `"wrap"` survives a rename of the renderer's
 * option; `true` does not survive being read a year later.
 */
export const DIFF_KNOBS = [
  knob(
    "layout",
    "Layout",
    "One column, or two side by side",
    "Unified puts the deletions directly above the additions that replace them, in one column. Side by side gives each its own column, which reads better for a rewritten block and worse in a narrow panel, where both halves end up cut off mid-line.",
    [
      { value: "unified", label: "Unified" },
      { value: "split", label: "Side by side" },
    ],
    "unified",
  ),
  knob(
    "longLines",
    "Long lines",
    "Scroll a long line, or fold it onto the next row",
    "What happens to a line too long for the panel. Scroll keeps the numbering tidy and hides the end of long lines behind a sideways scrollbar; Wrap folds them onto the next row, so nothing is hidden and a minified file becomes very tall.",
    [
      { value: "scroll", label: "Scroll" },
      { value: "wrap", label: "Wrap" },
    ],
    "wrap",
  ),
  knob(
    "syntax",
    "Syntax colours",
    "Follow the colour pack, or pick one",
    "Which colours the code itself is painted in. Match the theme follows the colour pack the screens are wearing, so a Dracula interface paints Dracula code. One Dark and GitHub stay as fixed syntax themes when the pack and the code should not share a palette. The canvas, the gutter and the green and red of a changed line follow the pack either way.",
    [
      { value: "match", label: "Match the theme" },
      { value: "one-dark", label: "One Dark" },
      { value: "github", label: "GitHub" },
    ],
    "match",
  ),
  knob(
    "textSize",
    "Text size",
    "How big the code is",
    "The size of the code, and the height of a row with it. Small fits about a third more of a file on the screen; large is easier to read at a distance or on a very wide monitor.",
    [
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
    ],
    "small",
  ),
  toggle(
    "lineNumbers",
    "Line numbers",
    "The numbers down each side",
    "The column of numbers down the side of each half. Turning them off buys a little width in a narrow panel, and takes away the thing you name when you want to talk about a particular line.",
    "on",
  ),
  toggle(
    "fill",
    "Fill changed lines",
    "Green and red across the line, or only a mark",
    "Whether a changed line is filled with green or red across its whole width, which is GitHub's way, or left the colour of the page with only a mark in the margin. Fills make the shape of a change readable while scrolling quickly; without them a diff is calmer and slower to scan.",
    "on",
  ),
  knob(
    "withinLine",
    "Highlight within a line",
    "What changed inside an edited line",
    "On a line that was edited rather than replaced, this marks what changed inside it. Words suits prose and most code; Characters is finer and noisier, and earns its keep when a single digit, bracket or letter moved.",
    [
      { value: "word", label: "Words" },
      { value: "char", label: "Characters" },
      { value: "none", label: "Off" },
    ],
    "word",
  ),
  /*
   * The most asked-for thing on GitHub's own board about reading a diff: 443
   * votes on "Many users want to by default always 'Hide whitespace changes'",
   * and their answer is a checkbox that forgets itself on the next page. This
   * is a setting rather than a button for that reason alone — the complaint was
   * never that it cannot be done, it is that it has to be done again every time.
   *
   * Off by default. A reindent is usually noise and occasionally the whole
   * change, and a reader who has not asked for lines to be held back should not
   * have them held back. `withoutWhitespace` says how it is done.
   */
  knob(
    "whitespace",
    "Whitespace-only changes",
    "Show them, or hold them back",
    "A line that only gained or lost spacing. Held back, it is drawn as an unchanged line and a file that was only reindented says so instead of showing every line of itself as changed. Shown, you see the file exactly as GitHub sent it.",
    [
      { value: "show", label: "Show" },
      { value: "hide", label: "Hide" },
    ],
    "show",
  ),
  knob(
    "marks",
    "Change marks",
    "A plus, a bar, or nothing in the gutter",
    "The sign in the gutter that says what happened to a line. Plus and minus is GitHub's and survives being copied as text; Bars is a quieter vertical rule; None leaves the fill to say it alone.",
    [
      { value: "classic", label: "Plus and minus" },
      { value: "bars", label: "Bars" },
      { value: "none", label: "None" },
    ],
    "bars",
    true,
  ),
  knob(
    "separators",
    "Skipped-line headers",
    "What stands where lines are folded away",
    "What is drawn where a file's unchanged middle has been folded away. Line count says how many lines are hidden, the hunk header shows the raw @@ line from the patch, and a rule draws a plain divider and no more.",
    [
      { value: "line-info", label: "Line count" },
      { value: "line-info-basic", label: "Line count, plain" },
      { value: "metadata", label: "Hunk header" },
      { value: "simple", label: "A rule" },
    ],
    "line-info",
    true,
  ),
  knob(
    "context",
    "Lines kept around a change",
    "Unchanged lines kept either side of it",
    "How many unchanged lines are kept either side of a change before the rest of the file is folded away. 3 is what GitHub shows; 10 usually carries enough of the surrounding function to judge a change without opening anything; 25 makes a heavily edited file a long scroll.",
    [
      { value: "3", label: "3" },
      { value: "10", label: "10" },
      { value: "25", label: "25" },
    ],
    "10",
    true,
  ),
  knob(
    "expansion",
    "Lines revealed per click",
    "How far a folded stretch opens",
    "How many lines appear each time you click into a folded stretch. 20 is for stepping through the lines around a change; 200 opens most of an ordinary file in a click or two.",
    [
      { value: "20", label: "20" },
      { value: "50", label: "50" },
      { value: "200", label: "200" },
    ],
    "20",
    true,
  ),
  toggle(
    "prose",
    "Open markdown as a document",
    "Markdown rendered, not as a patch",
    "Markdown files open rendered as the document they become, with additions and deletions tinted, rather than as a patch. Any one file can still be switched with the Diff and Preview buttons — this only decides which of the two you land on.",
    "on",
    true,
  ),
] as const

/** The rail's knobs. */
export const TREE_KNOBS = [
  knob(
    "density",
    "Row height",
    "How tall a row in the file list is",
    "The height of a row in the file list, and the spacing that scales with it. Compact fits roughly a third more files before you have to scroll; Relaxed is easier to hit with a mouse and easier on the eye in a long list.",
    [
      { value: "compact", label: "Compact" },
      { value: "default", label: "Default" },
      { value: "relaxed", label: "Relaxed" },
    ],
    "compact",
  ),
  slider(
    "indent",
    "Folder indent",
    "How far each folder steps in",
    "How far a folder steps its contents in, in pixels. Every level spends it again, and a repository is four or five folders deep before a name starts, so indent comes straight out of the names in a narrow rail. 6px is the default and 0px still nests, because the guide lines and the icons say which level a row is on; 16px is roomy enough to read across a wide rail.",
    [0, 2, 4, 6, 8, 10, 12, 14, 16],
    6,
  ),
  knob(
    "icons",
    "Icons",
    "Colourful by file type, or the plain set",
    "Material's icons are colourful and specific to a file's type, so a test, a stylesheet and a lockfile are told apart by colour before the name is read. Plain uses the tree's own quieter set, which stays out of the way and lets the names do the work.",
    [
      { value: "material", label: "Material" },
      { value: "plain", label: "Plain" },
    ],
    "material",
  ),
  knob(
    "width",
    "Rail width",
    "How much room the file list takes",
    "How much of the panel the file list takes from the diff. Wide earns itself in deeply nested repositories, where four levels of folder are spent on indentation before a name even starts.",
    [
      { value: "narrow", label: "Narrow" },
      { value: "medium", label: "Medium" },
      { value: "wide", label: "Wide" },
    ],
    "medium",
  ),
  toggle(
    "counts",
    "Line counts",
    "How much each file changed, beside its name",
    "The +N −N beside every file and folder, so the two-line rename and the eight-hundred-line rewrite can be told apart without opening either. Folders add up everything inside them.",
    "on",
  ),
  toggle(
    "ticks",
    "Mark files seen",
    "A tick on the files you have read",
    "A tick beside each file you have opened here or ticked as viewed on GitHub, and the progress bar in the header that counts them. A folder is only ticked once everything inside it is.",
    "on",
  ),
  /*
   * Remembered rather than pressed each time, for the reason the whitespace knob
   * above is: a reader who wants the change without its proof wants that on the
   * next pull request as well, and a switch that forgets itself between them is
   * a switch that has to be found again every morning. The ways at the head of
   * the rail write this, so the two are the same answer rather than two answers.
   * Two of the three, at least: reading nothing but the tests is a pass made on
   * one pull request, and it stays there.
   */
  knob(
    "tests",
    "Test files",
    "In the rail with the rest, or set aside",
    "Where the files that prove a change go. In the rail is every file GitHub sent. Set aside holds the test files out of the list and out of the counts above it, so a pull request of nine hundred lines where seven hundred are cases reads as the change it makes. The head of that rail turns the same knob, and offers the tests on their own as a pass this does not remember. Which files are tests is read off their names, so a language that keeps its tests inside the file they prove has none to set aside.",
    [
      { value: "show", label: "In the rail" },
      { value: "aside", label: "Set aside" },
    ],
    "show",
  ),
  toggle(
    "flatten",
    "Fold empty folders together",
    "src/main/java as one row, not three",
    "A folder that holds nothing but one other folder is shown as a single row — src/main/java rather than three nested rows, and three levels of indentation saved. Off shows the repository's real shape, one level at a time.",
    "on",
  ),
  knob(
    "folders",
    "Folders on opening",
    "Folders start expanded or shut",
    "Whether folders start open or shut when a pull request is opened. Shut suits a change that touches a few files across many areas. Changing this rebuilds the list, so whatever you had expanded returns to this state.",
    [
      { value: "open", label: "Expanded" },
      { value: "closed", label: "Collapsed" },
    ],
    "open",
    true,
  ),
  toggle(
    "search",
    "Search box",
    "A box that filters the list as you type",
    "Adds a box above the files that filters the list as you type. It earns its row past thirty or so files; below that the list is quicker to read than to search.",
    "off",
    true,
  ),
  toggle(
    "sticky",
    "Folders stick while scrolling",
    "The folder you are in stays pinned",
    "While the file list is scrolled, the folder you are inside stays pinned at the top of it, so a long run of files never leaves you wondering which folder they belong to.",
    "off",
    true,
  ),
] as const

/**
 * What Home opens as, how wide its Rail is, and where its Involved Issues go.
 *
 * Knobs rather than none because the one thing every thread about GitHub's dashboard
 * agrees on is that nobody wants the same page: "I'd like an option for the Feed to be my
 * default view" has 146 upvotes, and the readers underneath it are asking for three
 * different pages. A default Destination costs one stored word and settles the argument.
 *
 * The Rail's width is remembered for the plainer reason that a reader who narrows it has
 * said something about their screen, and asking them to say it again after every reload is
 * the kind of forgetting that makes a control feel broken.
 */
export const HOME_KNOBS = [
  knob(
    "destination",
    "Home opens as",
    "Which Destination Home starts on",
    "Which of Home's three Destinations it opens as. Working Set is the reader's own pull requests, ranked by whose move it is, and the default because it is the page that answers what to do next. Repositories is every repository you have, filtered by typing. Activity is what happened elsewhere, in the order it happened, pushes included.",
    [
      { value: "working-set", label: "Working Set" },
      { value: "repositories", label: "Repositories" },
      { value: "activity", label: "Activity" }
    ],
    "working-set"
  ),
  knob(
    "rail",
    "Rail",
    "The Rail starts wide or narrow",
    "Whether the strip down the left of Home starts wide or narrow. Narrow keeps every count and every face and drops the words, which is enough to answer whether anything is yours; wide names each Destination and each repository.",
    [
      { value: "wide", label: "Wide" },
      { value: "narrow", label: "Narrow" }
    ],
    "wide"
  ),
  knob(
    "issues",
    "Involved Issues",
    "Issues in the Courts, or under them",
    "Where the issues you raised, were assigned, or were mentioned in are drawn. Mixed puts each one in the Court that owes it, beside the pull requests, which is what the question \"whose move is it\" is worth answering about everything at once. Separate keeps the Courts to pull requests and gathers the issues into their own section underneath.",
    [
      { value: "mixed", label: "In the Courts" },
      { value: "separate", label: "Their own section" }
    ],
    "mixed"
  )
] as const

/**
 * What happens when an organisation puts its single sign-on in the way.
 *
 * Out of the menu, as the page knob above is, and for a related reason: the menu
 * is inside our own screens and this knob is about a page where none of them can
 * stand. It is offered on the card that replaces their wall instead, which is the
 * one moment a reader has an opinion about it.
 *
 * Off to start with, and this is the only default here that is about consent
 * rather than about taste. On means this posts their form for the reader — their
 * own session, their own click, but made without them — and that is a thing to be
 * asked for rather than assumed. One tick on the card is the whole of the asking.
 */
export const SIGN_ON_KNOBS = [
  knob(
    "byItself",
    "Signing on again",
    "Answer their single sign-on without being asked",
    "What happens when an organisation's single sign-on stands between you and a page. Ask draws the card and waits for you. By itself posts the same form the card's button posts, the moment the page loads, so the wall passes by without a click. Either way your identity provider still decides: if it wants a password or a second factor, its own screen appears and nothing here can skip it.",
    [
      { value: "ask", label: "Ask" },
      { value: "always", label: "By itself" }
    ],
    "ask"
  )
] as const

/**
 * Whose keys reach this interface.
 *
 * One knob, and the only one whose choices are named after hands rather than
 * after what they do: the commands are the same in all three, and what changes
 * is which keys carry them. Every one of them can be changed a row further
 * down — see `bound` — and this is where a reader who has changed nothing
 * starts from.
 */
export const KEY_KNOBS = [
  knob(
    "profile",
    "Keys",
    "Which set of keys reaches this interface",
    "Which keys reach the commands. Left hand keeps every default under the hand that is not on the pointer, which is the hand doing the scrolling and the clicking for the whole of a review: w and s move between files, f searches, x marks one read. Vim gives the same commands to j and k and leaves the letters vim has other plans for alone. Off hands the keyboard back to GitHub entirely, so their own shortcuts work on this page exactly as they do on every other.",
    [
      { value: "standard", label: "Left hand" },
      { value: "vim", label: "Vim" },
      { value: "off", label: "Off" }
    ],
    "standard"
  )
] as const

/**
 * Any one knob there is, whichever group it belongs to.
 *
 * A panel or a sheet holds knobs from several groups at once, and the plain
 * `Knob<string, string>` it would otherwise draw them as forgets which keys
 * exist. This remembers, so anything keyed by knob — a glyph, a sample — is
 * answered for every knob by the compiler rather than by a test.
 */
export type AnyKnob =
  | (typeof PAGE_KNOBS)[number]
  | (typeof THEME_KNOBS)[number]
  | (typeof DIFF_KNOBS)[number]
  | (typeof TREE_KNOBS)[number]
  | (typeof HOME_KNOBS)[number]
  | (typeof SIGN_ON_KNOBS)[number]
  | (typeof KEY_KNOBS)[number]

/** The key of any one knob there is. */
export type KnobKey = AnyKnob["key"]

type Values<Knobs extends ReadonlyArray<Knob<string, string>>> = {
  readonly [K in Knobs[number] as K["key"]]: K["choices"][number]["value"]
}

export type PageSettings = Values<typeof PAGE_KNOBS>
export type SignOnSettings = Values<typeof SIGN_ON_KNOBS>
export type ThemeSettings = Values<typeof THEME_KNOBS>
export type DiffSettings = Values<typeof DIFF_KNOBS>
export type TreeSettings = Values<typeof TREE_KNOBS>
export type HomeSettings = Values<typeof HOME_KNOBS>
export type KeySettings = Values<typeof KEY_KNOBS>

/** Which of Home's three Destinations is being shown. */
export type Destination = HomeSettings["destination"]

/** Which page a pull request opens as, named so the two sides read as words. */
export type View = PageSettings["view"]

export type Settings = {
  readonly page: PageSettings
  readonly signOn: SignOnSettings
  readonly theme: ThemeSettings
  readonly diff: DiffSettings
  readonly tree: TreeSettings
  readonly home: HomeSettings
  readonly keys: KeySettings
  /**
   * The chords a reader put on a command themselves, as command to chord.
   *
   * Not a knob, and it cannot be one: a knob is a choice between answers this
   * file knows the whole of, and any key on the board is an answer here. What
   * a command is called and which chord it carries by default belong to
   * `src/keys/commands.ts`, which is also where an entry naming a command that
   * no longer exists is dropped — this only promises that both halves are
   * words a reader could have typed.
   */
  readonly bound: Readonly<Record<string, string>>
  /**
   * The repositories a reader pinned, as `owner/repo`, in the order they pinned them.
   *
   * The one field here that is not a knob, and it has to be: GitHub allows six pins because
   * six is what their layout holds, and "six is not enough" is its own discussion in their
   * community. A list has no such number in it. Ordered rather than a set, because the order
   * is the reader's own answer to which repository they look at first.
   */
  readonly pinned: ReadonlyArray<string>
  /**
   * The Workflows a reader put away, as `owner/repo:workflow`, in the order they put them away.
   *
   * A list rather than a knob for the reason the pins are one: how many Workflows a repository
   * runs is theirs to decide. Scoped to a repository because a Workflow is a file in one, and
   * `ci.yml` is a different file in each of the hundreds a reader has. The Workflow is its file
   * where their page named one and its own `name:` where it did not, which is `putAwayKey` in
   * `src/domain/putAway.ts`.
   *
   * Four discussions on GitHub's own board ask for this, and 1,303 votes of the four are the
   * two it answers: 884 on marking a Workflow so it stops appearing, and 419 on hiding an old
   * or renamed one. Their own filters do it for one page load; this is remembered.
   */
  readonly putAway: ReadonlyArray<string>
  /**
   * The groups of a person's repositories a reader turned the other way, as `login:group`.
   *
   * A list for the reason the pins are one: how many people a reader looks at is theirs.
   * Scoped to a login because 154 repositories of one account and three of another do not
   * want the same shape.
   *
   * An entry means turned rather than shut, which is what lets one list carry both halves:
   * Forked starts shut, so an entry for it means opened. `isShut` in `src/domain/life.ts`
   * is where that is read, and the argument against a second list of what is open is
   * written there.
   */
  readonly turned: ReadonlyArray<string>
}

/** Whether a stored value is an address this interface could actually draw. */
const isAddress = (value: unknown): value is string =>
  typeof value === "string" && /^[^/\s]+\/[^/\s]+$/.test(value)

/**
 * Whether a stored entry still names one Workflow of one repository.
 *
 * The first colon and not every colon: a Workflow's own `name:` may carry one, and "Code
 * Quality: PR" is a real name off `octo-repo`. A repository address cannot, so the first is
 * always the one that divides the two halves.
 */
const isPutAway = (value: unknown): value is string => {
  if (typeof value !== "string") return false

  const divide = value.indexOf(":")
  return divide > 0 && isAddress(value.slice(0, divide)) && divide < value.length - 1
}

/**
 * Whether a stored entry still names one group of one person's list.
 *
 * The group is checked against the four there are rather than accepted as any word, because
 * an entry nothing draws is a row of the reader's own choices that can never be undone from
 * the screen it came from.
 */
const isTurned = (value: unknown): value is string => {
  if (typeof value !== "string") return false

  const divide = value.indexOf(":")
  if (divide <= 0) return false

  return GROUPS.has(value.slice(divide + 1))
}

/** The four groups, out of the one place they are named. */
const GROUPS: ReadonlySet<string> = new Set<string>(LIVES)

const fallbacks = <Knobs extends ReadonlyArray<Knob<string, string>>>(
  knobs: Knobs,
) =>
  Object.fromEntries(
    knobs.map((one) => [one.key, one.fallback]),
  ) as Values<Knobs>

export const DEFAULTS: Settings = {
  page: fallbacks(PAGE_KNOBS),
  signOn: fallbacks(SIGN_ON_KNOBS),
  theme: fallbacks(THEME_KNOBS),
  diff: fallbacks(DIFF_KNOBS),
  tree: fallbacks(TREE_KNOBS),
  home: fallbacks(HOME_KNOBS),
  keys: fallbacks(KEY_KNOBS),
  bound: {},
  pinned: [],
  putAway: [],
  turned: [],
}

const readGroup = <Knobs extends ReadonlyArray<Knob<string, string>>>(
  knobs: Knobs,
  stored: unknown,
): Values<Knobs> => {
  const held =
    typeof stored === "object" && stored !== null
      ? (stored as Record<string, unknown>)
      : {}
  return Object.fromEntries(
    knobs.map((one) => {
      const found = held[one.key]
      const known = one.choices.some((choice) => choice.value === found)
      return [one.key, known ? found : one.fallback]
    }),
  ) as Values<Knobs>
}

/**
 * A chord long enough to be one and short enough to have been typed.
 *
 * A length rather than a shape, because `Escape`, `/` and `g d` are all chords
 * and the browser has a name for every key on the board. Deliberately not called
 * `isChord`: `src/keys/commands.ts` has a function of that name which asks the
 * real question — whether the matcher could ever read this press — and two
 * functions with one name a file apart is how a vocabulary starts drifting.
 * Whether the command it is written against still exists is asked there as well.
 */
const isWritten = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 16

const readBound = (stored: unknown): Readonly<Record<string, string>> => {
  if (typeof stored !== "object" || stored === null) return {}

  return Object.fromEntries(
    Object.entries(stored as Record<string, unknown>).filter(
      (entry): entry is [string, string] => entry[0].length <= 32 && isWritten(entry[1])
    )
  )
}

/**
 * Stored settings, read defensively.
 *
 * What comes back from storage was written by an older version of this file, by
 * a newer one, or by nothing at all. A value that is no longer offered falls
 * back to the default rather than reaching the renderer, which would take it at
 * its word and draw nothing.
 */
export const readSettings = (stored: unknown): Settings => {
  const held =
    typeof stored === "object" && stored !== null
      ? (stored as Record<string, unknown>)
      : {}
  return {
    page: readGroup(PAGE_KNOBS, held["page"]),
    signOn: readGroup(SIGN_ON_KNOBS, held["signOn"]),
    theme: readGroup(THEME_KNOBS, held["theme"]),
    diff: readGroup(DIFF_KNOBS, held["diff"]),
    tree: readGroup(TREE_KNOBS, held["tree"]),
    home: readGroup(HOME_KNOBS, held["home"]),
    keys: readGroup(KEY_KNOBS, held["keys"]),
    // Entry by entry, for the reason the lists below are read that way: a
    // number or an object where a chord should be would reach the matcher, be
    // compared against a keypress, and never match anything again.
    bound: readBound(held["bound"]),
    // Item by item, because a list read whole is a list that reaches the Rail with a
    // number or an object in it, and the row drawn from that is a link to nowhere.
    pinned: Array.isArray(held["pinned"])
      ? [...new Set(held["pinned"].filter(isAddress))]
      : [],
    // Item by item as well, and for the same reason: an entry that has lost its repository
    // would hide a Workflow of that name in every repository the reader opens.
    putAway: Array.isArray(held["putAway"])
      ? [...new Set(held["putAway"].filter(isPutAway))]
      : [],
    // Item by item again. An entry naming a group that no longer exists is a turn nothing
    // draws and nothing can undo, which is the reader's own choice held out of reach.
    turned: Array.isArray(held["turned"])
      ? [...new Set(held["turned"].filter(isTurned))]
      : [],
  }
}
