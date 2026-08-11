import type { Row } from "./Menu"

/**
 * The Participant menu, in one place because two things now draw it.
 *
 * Three rows, where GitHub's own account menu has thirty. The difference is not tidiness:
 * every row here is somewhere a reader goes on a working day, and none of them advertises a
 * plan. Both the Rail and the bar offer it, and a reader finding two rows in one and three in
 * the other would have found a bug rather than a design.
 *
 * The way back to GitHub's own page was a fourth row and is not here any more. It is the one
 * control this interface cannot afford to hide, being what a reader reaches for when something
 * of ours is drawn badly, and it was inside two menus and on two screens under three different
 * names. It is a button at the right of the bar now — see `Bar.tsx` — which is on every page
 * this extension draws, in the same corner on all of them.
 */
export const participantRows = ({ login }: { readonly login: string }): ReadonlyArray<Row> => [
  { name: "Your profile", where: `/${login}`, art: "person" },
  { name: "Settings", where: "/settings/profile", art: "settings" },
  { name: "Sign out", where: "/logout", art: "sign-out" }
]
