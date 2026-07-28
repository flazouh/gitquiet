/**
 * What the reader has chosen, and everything that is known about each choice.
 *
 * One declaration per setting, in one list. The menu is built from it, the
 * defaults come from it, stored values are checked against it, and the diff and
 * the tree read the result — so adding a knob is adding a line here, and there
 * is nowhere for the four copies of that knob to drift apart.
 */

export type Choice<T extends string> = {
  readonly value: T
  readonly label: string
}

export type Knob<K extends string, T extends string> = {
  readonly key: K
  readonly label: string
  /**
   * What this changes, and what it costs — the whole of it, not a restatement
   * of the label. Shown in the menu, so it is written for someone deciding
   * rather than for someone maintaining this file.
   */
  readonly note: string
  /** Curated knobs are in the menu; advanced ones are behind one more click. */
  readonly advanced: boolean
  readonly choices: ReadonlyArray<Choice<T>>
  readonly fallback: T
}

const knob = <K extends string, T extends string>(
  key: K,
  label: string,
  note: string,
  choices: ReadonlyArray<Choice<T>>,
  fallback: T,
  advanced = false,
): Knob<K, T> => ({ key, label, note, advanced, choices, fallback })

const onOff = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
] as const satisfies ReadonlyArray<Choice<"on" | "off">>

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
    "What happens to a line too long for the panel. Scroll keeps the numbering tidy and hides the end of long lines behind a sideways scrollbar; Wrap folds them onto the next row, so nothing is hidden and a minified file becomes very tall.",
    [
      { value: "scroll", label: "Scroll" },
      { value: "wrap", label: "Wrap" },
    ],
    "scroll",
  ),
  knob(
    "syntax",
    "Syntax colours",
    "Which colours the code itself is painted in. Everything around it — the canvas, the gutter, the green and red of a changed line — stays GitHub's either way, so this changes keywords, strings and comments and nothing else.",
    [
      { value: "one-dark", label: "One Dark" },
      { value: "github", label: "GitHub" },
    ],
    "one-dark",
  ),
  knob(
    "textSize",
    "Text size",
    "The size of the code, and the height of a row with it. Small fits about a third more of a file on the screen; large is easier to read at a distance or on a very wide monitor.",
    [
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
    ],
    "small",
  ),
  knob(
    "lineNumbers",
    "Line numbers",
    "The column of numbers down the side of each half. Turning them off buys a little width in a narrow panel, and takes away the thing you name when you want to talk about a particular line.",
    onOff,
    "on",
  ),
  knob(
    "fill",
    "Fill changed lines",
    "Whether a changed line is filled with green or red across its whole width, which is GitHub's way, or left the colour of the page with only a mark in the margin. Fills make the shape of a change readable while scrolling quickly; without them a diff is calmer and slower to scan.",
    onOff,
    "on",
  ),
  knob(
    "withinLine",
    "Highlight within a line",
    "On a line that was edited rather than replaced, this marks what changed inside it. Words suits prose and most code; Characters is finer and noisier, and earns its keep when a single digit, bracket or letter moved.",
    [
      { value: "word", label: "Words" },
      { value: "char", label: "Characters" },
      { value: "none", label: "Off" },
    ],
    "word",
  ),
  knob(
    "marks",
    "Change marks",
    "The sign in the gutter that says what happened to a line. Plus and minus is GitHub's and survives being copied as text; Bars is a quieter vertical rule; None leaves the fill to say it alone.",
    [
      { value: "classic", label: "Plus and minus" },
      { value: "bars", label: "Bars" },
      { value: "none", label: "None" },
    ],
    "classic",
    true,
  ),
  knob(
    "separators",
    "Skipped-line headers",
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
    "How many lines appear each time you click into a folded stretch. 20 is for stepping through the lines around a change; 200 opens most of an ordinary file in a click or two.",
    [
      { value: "20", label: "20" },
      { value: "50", label: "50" },
      { value: "200", label: "200" },
    ],
    "20",
    true,
  ),
  knob(
    "prose",
    "Open markdown as a document",
    "Markdown files open rendered as the document they become, with additions and deletions tinted, rather than as a patch. Any one file can still be switched with the Diff and Preview buttons — this only decides which of the two you land on.",
    onOff,
    "on",
    true,
  ),
] as const

/** The rail's knobs. */
export const TREE_KNOBS = [
  knob(
    "density",
    "Row height",
    "The height of a row in the file list, and the spacing that scales with it. Compact fits roughly a third more files before you have to scroll; Relaxed is easier to hit with a mouse and easier on the eye in a long list.",
    [
      { value: "compact", label: "Compact" },
      { value: "default", label: "Default" },
      { value: "relaxed", label: "Relaxed" },
    ],
    "compact",
  ),
  knob(
    "icons",
    "Icons",
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
    "How much of the panel the file list takes from the diff. Wide earns itself in deeply nested repositories, where four levels of folder are spent on indentation before a name even starts.",
    [
      { value: "narrow", label: "Narrow" },
      { value: "medium", label: "Medium" },
      { value: "wide", label: "Wide" },
    ],
    "medium",
  ),
  knob(
    "counts",
    "Line counts",
    "The +N −N beside every file and folder, so the two-line rename and the eight-hundred-line rewrite can be told apart without opening either. Folders add up everything inside them.",
    onOff,
    "on",
  ),
  knob(
    "ticks",
    "Mark files seen",
    "A tick beside each file you have opened here or ticked as viewed on GitHub, and the progress bar in the header that counts them. A folder is only ticked once everything inside it is.",
    onOff,
    "on",
  ),
  knob(
    "flatten",
    "Fold empty folders together",
    "A folder that holds nothing but one other folder is shown as a single row — src/main/java rather than three nested rows, and three levels of indentation saved. Off shows the repository's real shape, one level at a time.",
    onOff,
    "on",
  ),
  knob(
    "folders",
    "Folders on opening",
    "Whether folders start open or shut when a pull request is opened. Shut suits a change that touches a few files across many areas. Changing this rebuilds the list, so whatever you had expanded returns to this state.",
    [
      { value: "open", label: "Expanded" },
      { value: "closed", label: "Collapsed" },
    ],
    "open",
    true,
  ),
  knob(
    "search",
    "Search box",
    "Adds a box above the files that filters the list as you type. It earns its row past thirty or so files; below that the list is quicker to read than to search.",
    onOff,
    "off",
    true,
  ),
  knob(
    "sticky",
    "Folders stick while scrolling",
    "While the file list is scrolled, the folder you are inside stays pinned at the top of it, so a long run of files never leaves you wondering which folder they belong to.",
    onOff,
    "off",
    true,
  ),
] as const

type Values<Knobs extends ReadonlyArray<Knob<string, string>>> = {
  readonly [K in Knobs[number] as K["key"]]: K["choices"][number]["value"]
}

export type DiffSettings = Values<typeof DIFF_KNOBS>
export type TreeSettings = Values<typeof TREE_KNOBS>

export type Settings = {
  readonly diff: DiffSettings
  readonly tree: TreeSettings
}

const fallbacks = <Knobs extends ReadonlyArray<Knob<string, string>>>(
  knobs: Knobs,
) =>
  Object.fromEntries(
    knobs.map((one) => [one.key, one.fallback]),
  ) as Values<Knobs>

export const DEFAULTS: Settings = {
  diff: fallbacks(DIFF_KNOBS),
  tree: fallbacks(TREE_KNOBS),
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
    diff: readGroup(DIFF_KNOBS, held["diff"]),
    tree: readGroup(TREE_KNOBS, held["tree"]),
  }
}
