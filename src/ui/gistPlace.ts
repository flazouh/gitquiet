import { Option } from "effect"
import { gistListIn, gistViewIn } from "../domain/gist"
import type { Place } from "./place"

/**
 * Where the gist screens go, which is the whole page.
 *
 * Kept out of `src/ui/place.ts` on purpose. That module is `github.com`'s router: its
 * `placeOwning` walks `BY_ADDRESS` for the shell, and every `owns` in it builds
 * `https://github.com${path}`. A gist address on that host is not a gist address, so a
 * Place answering for one has no business in that list — the shell would never ask it,
 * and anything that did ask would get the wrong answer for `/{owner}`, which is a
 * person's profile there and a gist list here.
 *
 * The machinery is the same though. Nothing in `mount.ts` or `shell/screen.tsx` names a
 * host: a Place is a name, a question about an address, and where to stand. So these
 * two are ordinary Places that happen to answer about a different host, and
 * `standAScreen` takes them exactly as it takes `THE_PULLS` or `NOTICES`.
 *
 * See `plans/007-give-the-gists-a-screen.md`.
 */

/**
 * Both of these stand on the body, which is what `plans/006` calls a full-replacement
 * screen: a page of the reader's own things, with no chrome of GitHub's they still need.
 *
 * `regions` is empty rather than naming their `#gist-pjax-container`. Standing inside
 * their container would leave GitHub's header above ours and put this screen in the
 * second of that plan's two kinds — which is the kind for a page where GitHub's
 * surrounding page is still the reader's context, and a gist list is not that.
 */
const WHOLE_PAGE = {
  regions: [] as ReadonlyArray<string>,
  fallback: "body",
  stages: ["body"] as ReadonlyArray<string>,
  bands: [] as ReadonlyArray<string>
}

/**
 * The address as the parsers want it, which is the whole thing rather than the path.
 *
 * `Place.owns` is handed a path and a search because that is what the shell has at the
 * moment it asks. Both gist parsers host-gate, so they need the host put back, and it
 * is this one by construction: nothing but `gist.content.ts` stands these.
 */
const gistAddress = (path: string, search: string = ""): string =>
  `https://gist.github.com${path}${search}`

/** A reader's own gists, one page of them. */
export const GIST_LIST: Place = {
  ...WHOLE_PAGE,
  name: "gist-list",
  owns: (path, search) => Option.isSome(gistListIn(gistAddress(path, search)))
}

/** One gist. */
export const GIST_VIEW: Place = {
  ...WHOLE_PAGE,
  name: "gist-view",
  owns: (path, search) => Option.isSome(gistViewIn(gistAddress(path, search)))
}

/**
 * Which of the two a gist address is, or nothing where it is neither.
 *
 * The order matters and is the reason this is a function rather than a list walked by
 * the caller: `/{owner}` and `/{owner}/{id}` are told apart by segment count, and asking
 * the view first is what keeps a list address from matching it. Both parsers already
 * refuse the other's shape, so this is belt and braces — but the shell's own router
 * makes the same choice explicitly, and a reader comparing the two should find them
 * agreeing.
 */
export const gistPlaceOwning = (path: string, search: string = ""): Place | null => {
  if (GIST_VIEW.owns(path, search)) return GIST_VIEW
  if (GIST_LIST.owns(path, search)) return GIST_LIST
  return null
}
