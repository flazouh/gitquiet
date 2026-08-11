/**
 * What the box does with a press that is not a letter.
 *
 * Two edits, both of which every editor a reader already uses makes, and neither of which a
 * plain textarea makes on its own. They are here rather than in the component because they
 * are text in and text out: the component's job is the caret, and a caret is untestable in
 * the way a string is not.
 */

/** A list marker at the head of a line: the indent, the marker, and a task box if it has one. */
const MARKER = /^([ \t]*)(?:([-*+])|(\d+)([.)]))(\s+\[[ xX]\])?(\s+)/

/** A quote, which carries on the same way and is not a list. */
const QUOTED = /^([ \t]*>[ \t]?)/

export type Carried = {
  /** What Enter puts in, marker and all. */
  readonly put: string
  /** How many characters before the caret to take away first, for a marker left empty. */
  readonly drop: number
}

/**
 * What Enter means where the caret is, or nothing where it means a new line.
 *
 * Three answers, which is the whole of the rule everybody already knows: under a list item
 * with words in it, the next item; under one with nothing in it, no item, because pressing
 * Enter twice is how a person leaves a list; anywhere else, nothing, and the browser does
 * what it always did.
 *
 * A numbered list counts on from the number that is there rather than from one. GitHub's own
 * markdown renumbers anyway, but a reader watching `1.` follow `7.` reads it as broken.
 */
export const continued = (text: string, at: number): Carried | undefined => {
  const from = text.lastIndexOf("\n", at - 1) + 1
  const line = text.slice(from, at)

  const marker = MARKER.exec(line)
  if (marker !== null) {
    const [whole, indent = "", bullet, counted, stop, task, space = " "] = marker

    // The marker and nothing after it: the reader is leaving the list, so the marker goes
    // with them rather than a second empty one arriving.
    if (line.length === whole.length) return { put: "\n", drop: whole.length }

    const head =
      bullet === undefined
        ? `${Number.parseInt(counted ?? "1", 10) + 1}${stop ?? "."}`
        : bullet

    return { put: `\n${indent}${head}${task === undefined ? "" : " [ ]"}${space}`, drop: 0 }
  }

  const quoted = QUOTED.exec(line)
  if (quoted === null) return undefined

  const head = quoted[1] ?? "> "
  return line.length === head.length
    ? { put: "\n", drop: head.length }
    : { put: `\n${head}`, drop: 0 }
}

/** How far one press moves a line. Two, which is what a nested markdown list takes. */
const STEP = "  "

export type Indented = {
  readonly text: string
  /** Where the selection sits afterwards, so the reader keeps hold of what they had. */
  readonly from: number
  readonly to: number
}

/** The start of the line a position is on. */
const lineFrom = (text: string, at: number): number => text.lastIndexOf("\n", at - 1) + 1

/**
 * The text with the chosen lines moved one step in or out, or nothing where Tab
 * does not mean that.
 *
 * Nothing is the important half. Tab is how somebody working from the keyboard
 * leaves a box, and a box that keeps every Tab is a box they cannot get out of —
 * so it is only taken where the press can only have meant indentation: across a
 * block of lines, or with the caret in the whitespace at the head of one.
 * Mid-sentence it is left to the browser and the focus moves as it always did.
 *
 * A selection inside a single line still moves the line rather than being
 * replaced by a tab, which is what a code editor would do. This is a comment
 * box: the reader who highlighted a phrase and pressed Tab was indenting the
 * paragraph, not deleting the phrase.
 */
export const indented = (
  text: string,
  from: number,
  to: number,
  outward: boolean
): Indented | undefined => {
  const head = lineFrom(text, from)

  if (from === to) {
    // Only in the indent itself. Anything else on the line before the caret and
    // the press is somebody reaching for the next control.
    if (text.slice(head, from).trim() !== "") return undefined

    if (!outward) {
      return {
        text: `${text.slice(0, from)}${STEP}${text.slice(from)}`,
        from: from + STEP.length,
        to: from + STEP.length
      }
    }

    const off = Math.min(STEP.length, from - head)
    if (off === 0) return undefined
    return { text: `${text.slice(0, from - off)}${text.slice(from)}`, from: from - off, to: from - off }
  }

  /*
   * The whole of every line the selection touches, which is what gets moved.
   *
   * A selection that ends exactly at the start of a line does not touch that
   * line. Dragging down over two lines lands the caret at the head of the third,
   * and indenting it as well is one line more than the reader chose.
   */
  const last = text[to - 1] === "\n" ? to - 1 : to
  const broken = text.indexOf("\n", last)
  const end = broken === -1 ? text.length : broken
  const block = text.slice(head, end)
  const lines = block.split("\n")

  const moved = lines.map((line) =>
    outward
      ? line.slice(Math.min(STEP.length, line.length - line.trimStart().length))
      : `${STEP}${line}`
  )
  const after = moved.join("\n")
  if (after === block) return undefined

  // The same words still chosen afterwards. A selection that began at a line's
  // start keeps the whole first line; one that began inside it moves with the
  // line it is on.
  const first = (moved[0]?.length ?? 0) - (lines[0]?.length ?? 0)

  return {
    text: `${text.slice(0, head)}${after}${text.slice(end)}`,
    from: from === head ? head : Math.max(head, from + first),
    to: to + (after.length - block.length)
  }
}

/** An address, which is the whole of what makes a paste a link rather than words. */
const ADDRESS = /^https?:\/\/\S+$/

/**
 * The text with a pasted address wrapped around what was chosen, or nothing.
 *
 * Nothing where there is nothing chosen, because then the address itself is what the reader
 * wants and the browser already pastes it. Nothing where what is chosen is itself an address,
 * because `[https://old](https://new)` is not what anybody meant by that.
 */
export const linked = (
  text: string,
  from: number,
  to: number,
  pasted: string
): string | undefined => {
  const address = pasted.trim()
  if (from === to || !ADDRESS.test(address)) return undefined

  const chosen = text.slice(from, to)
  if (chosen.trim() === "" || ADDRESS.test(chosen.trim())) return undefined

  return `${text.slice(0, from)}[${chosen}](${address})${text.slice(to)}`
}
