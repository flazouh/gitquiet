import type { DiffSettings, TreeSettings } from "./Settings"
import type { SyntaxChoice } from "./syntax"

/**
 * The reader's words turned into what the renderers take.
 *
 * Kept apart from both the schema and the components on purpose: the stored
 * form is words a person chose, the renderers want their own vocabulary, and
 * putting the translation in one tested function is what stops a knob from
 * meaning one thing in the diff and another in the menu.
 */

/** Pierre's diff options, as far as they are ours to choose. */
export type DiffChoices = {
  readonly layout: "unified" | "split"
  readonly overflow: "scroll" | "wrap"
  readonly syntax: SyntaxChoice
  readonly fontSize: number
  readonly lineHeight: number
  readonly lineNumbers: boolean
  readonly fill: boolean
  readonly withinLine: "word-alt" | "char" | "none"
  /**
   * Whether a change that is only spacing is held back rather than drawn.
   *
   * Not one of Pierre's options. It is answered before the patch reaches them,
   * by `withoutWhitespace`, and it is carried here because everything else the
   * reader chose about a diff is carried here — a second channel for one knob
   * would be a second place to forget it.
   */
  readonly hideWhitespace: boolean
  readonly marks: "classic" | "bars" | "none"
  readonly separators: "line-info" | "line-info-basic" | "metadata" | "simple"
  readonly context: number
  readonly expansion: number
}

const TEXT: Readonly<Record<string, { size: number; height: number }>> = {
  small: { size: 12, height: 20 },
  medium: { size: 13, height: 22 },
  large: { size: 14, height: 24 }
}

export const diffChoices = (settings: DiffSettings): DiffChoices => {
  const text = TEXT[settings.textSize] ?? TEXT["small"]!
  return {
    layout: settings.layout,
    overflow: settings.longLines,
    syntax: settings.syntax,
    fontSize: text.size,
    lineHeight: text.height,
    lineNumbers: settings.lineNumbers === "on",
    fill: settings.fill === "on",
    // Their two word-level modes differ in how they handle whitespace; the
    // alternate one is the one that reads well on prose as well as on code.
    withinLine: settings.withinLine === "word" ? "word-alt" : settings.withinLine,
    hideWhitespace: settings.whitespace === "hide",
    marks: settings.marks,
    separators: settings.separators,
    context: Number(settings.context),
    expansion: Number(settings.expansion)
  }
}

/** The rail's options, plus the two marks that are ours rather than the tree's. */
export type TreeChoices = {
  readonly density: "compact" | "default" | "relaxed"
  readonly icons: "material" | "plain"
  /** Tailwind's width for the rail, in its own scale. */
  readonly width: string
  readonly counts: boolean
  readonly ticks: boolean
  readonly flatten: boolean
  readonly folders: "open" | "closed"
  readonly search: boolean
  readonly sticky: boolean
}

/**
 * How wide the rail is, as a share of the panel it lives in.
 *
 * Fixed pixels made a tree that was right on a laptop and wrong on anything
 * larger: the same two hundred and fifty on a five-thousand-pixel screen, every
 * path in it cut in the middle while a third of the window stood empty.
 *
 * `cqi` and not `vw`, because what the rail has to share is the panel and not
 * the window — a pull request keeps a column for its conversation, and a commit
 * does not. The floor is what each of these used to be, so nothing narrows on
 * the screens they were chosen for; the ceiling is where a rail stops being a
 * rail and starts being the other half of a split.
 */
const WIDTH: Readonly<Record<string, string>> = {
  narrow: "w-[clamp(13rem,18cqi,20rem)]",
  medium: "w-[clamp(16rem,22cqi,26rem)]",
  wide: "w-[clamp(20rem,28cqi,34rem)]"
}

export const treeChoices = (settings: TreeSettings): TreeChoices => ({
  density: settings.density,
  icons: settings.icons,
  width: WIDTH[settings.width] ?? WIDTH["medium"]!,
  counts: settings.counts === "on",
  ticks: settings.ticks === "on",
  flatten: settings.flatten === "on",
  folders: settings.folders,
  search: settings.search === "on",
  sticky: settings.sticky === "on"
})
