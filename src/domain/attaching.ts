/**
 * A file dropped or pasted into a box, and the words it leaves behind.
 *
 * Three things happen in order and each of them is text in the box: a mark saying the file is
 * going up, then the mark swapped for the image or the link, or the mark taken out again where
 * GitHub would not take it. All three are here, as text in and text out, because that is the
 * whole of what the box has to get right and none of it needs a network to test.
 */

/** What GitHub answered with once the bytes were theirs. */
export type Uploaded = {
  readonly name: string
  readonly href: string
  /** Both, or neither: an image measured before it went up. */
  readonly width?: number
  readonly height?: number
}

/**
 * The mark that stands where the file will be.
 *
 * A comment rather than the word "Uploading", which is what their own box writes, so that a
 * draft caught halfway and posted anyway says nothing rather than saying a lie. It also gives
 * the swap something exact to find: a reader typing around it cannot make two of them.
 */
export const waiting = (name: string, count = 0): string =>
  `<!-- Uploading "${name}"${count > 0 ? ` (${count + 1})` : ""}... -->`

/**
 * What is written once it is up.
 *
 * An image goes in as an `img` with the size it really is, which is what their own box now
 * writes and what keeps a screenshot from arriving three times the width of the words around
 * it. Anything else goes in as a link, because a link is what a zip is.
 *
 * The alt text is the file name, where their own box writes "Image" every time. A screen
 * reader given "Image" is given nothing, and the name is the one description that was already
 * there. Whoever wants better can type over it, which is the point of writing it in the box
 * rather than hiding it behind an upload.
 */
export const written = (one: Uploaded): string => {
  if (one.width === undefined || one.height === undefined) {
    return `[${one.name}](${one.href})`
  }

  return `<img width="${one.width}" height="${one.height}" alt="${described(one.name)}" src="${one.href}" />`
}

/** The file name as a sentence: no extension, no separators pretending to be spaces. */
const described = (name: string): string => {
  const stem = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim()
  const said = stem === "" ? name : stem
  return said.replaceAll('"', "'")
}

/**
 * The mark swapped for what it stood for, or taken out where nothing came.
 *
 * By find and replace rather than by position, because the reader goes on typing while the
 * bytes go up: a caret held from before the upload started points at the wrong letter by the
 * time it lands. Nothing where the mark is gone, which is what a reader deleting it means.
 */
export const swapped = (text: string, mark: string, put: string): string | undefined => {
  const at = text.indexOf(mark)
  if (at === -1) return undefined

  return `${text.slice(0, at)}${put}${text.slice(at + mark.length)}`
}

/**
 * Where the mark goes in, and where the caret goes after it.
 *
 * On its own line when there is already something on the line, because an image in the middle
 * of a sentence is almost never what a paste means, and a paste at the end of a paragraph is
 * almost always a new one.
 */
export const placed = (
  text: string,
  at: number,
  mark: string
): { readonly text: string; readonly caret: number } => {
  const before = text.slice(0, at)
  const after = text.slice(at)
  const ahead = before === "" || before.endsWith("\n") ? "" : "\n"
  const behind = after.startsWith("\n") || after === "" ? "" : "\n"
  const put = `${ahead}${mark}${behind}`

  return { text: `${before}${put}${after}`, caret: at + put.length }
}

/**
 * Whether this is a picture, which decides what gets written and whether it is measured.
 *
 * By the type the browser gave the file rather than by its name. SVG is left out on purpose:
 * GitHub does not render one in a comment, so an `img` pointing at one shows nothing at all
 * where a link at least opens.
 */
export const pictured = (type: string): boolean =>
  type.startsWith("image/") && type !== "image/svg+xml"
