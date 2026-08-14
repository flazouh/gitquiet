import { Option } from "effect"
import type { Opened } from "../domain/repoHome"
import { BlobRoute } from "./wire"
import { whereverItIs } from "./wherever"

export const decodeBlob = whereverItIs(BlobRoute)

/**
 * One file, out of the payload of the page GitHub renders for it.
 *
 * The path comes from the address rather than from the payload. GitHub says the
 * file's own name in three places and none of them is the path from the root of
 * the repository, which is what the tree beside the pane marks its rows by.
 */
export const openedFrom = (route: BlobRoute, path: string): Opened => {
  const styled = route.payload["codeViewBlobLayoutRoute.StyledBlob"]
  const rendered = route.payload.codeViewBlobRoute?.richText

  return {
    path,
    lines: styled.rawLines ?? [],
    // An empty rendering is nothing rendered. Their field is null for a file
    // they do not render and an empty string for one that renders to nothing,
    // and a pane switched to an empty article is a pane that looks broken.
    rendered: rendered === null || rendered === undefined || rendered === ""
      ? Option.none()
      : Option.some(rendered)
  }
}
