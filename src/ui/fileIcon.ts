import {
  MATERIAL_BY_EXTENSION,
  MATERIAL_BY_FILE_NAME,
  MATERIAL_FILE,
  type TreeIcon
} from "./materialIcons.generated"

/** `src/diff/engine.ts` → `engine.ts`. */
export const nameOf = (path: string): string => path.slice(path.lastIndexOf("/") + 1)

/**
 * Everything before the name, slash included: `src/diff/`, or nothing for a
 * file at the root.
 *
 * The slash stays with the folders rather than being drawn between the two
 * halves, so the muted part is exactly the part the eye is allowed to skip.
 */
export const folderOf = (path: string): string => path.slice(0, path.lastIndexOf("/") + 1)

/**
 * The Material icon a file is drawn with, chosen the way the tree chooses it.
 *
 * Name before extension: `package.json` is a Node project, not a JSON file,
 * and the whole reason the theme carries names at all is that a handful of
 * files say more than their suffix does. Anything unrecognised gets the plain
 * document rather than a gap, because a row whose icon is missing reads as a
 * file that failed to load.
 */
export const materialIcon = (path: string): TreeIcon => {
  const name = nameOf(path)
  const byName = MATERIAL_BY_FILE_NAME[name] ?? MATERIAL_BY_FILE_NAME[name.toLowerCase()]
  if (byName !== undefined) return byName

  const dot = name.lastIndexOf(".")
  const extension = dot <= 0 ? "" : name.slice(dot + 1).toLowerCase()
  return MATERIAL_BY_EXTENSION[extension] ?? MATERIAL_FILE
}
