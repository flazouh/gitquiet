/**
 * Which pull request somebody is on their way to, recorded at the moment they
 * press rather than discovered when the address catches up.
 *
 * Between the press and the address changing, GitHub spends about one and a
 * third seconds fetching. Everything needed to draw the pull request is already
 * known at the start of that: the link says which one it is, and its contents
 * are usually already in the store from the hover. Waiting for the address is
 * waiting for permission to do work that could already be done.
 *
 * Written to the window shared by every script this extension runs in the page.
 * Content scripts of one extension share an isolated world, so the small script
 * that saw the press and the interface the worker injects afterwards are
 * looking at the same object — and GitHub's own page cannot see it, which a
 * `data-` attribute could not promise.
 */
type World = Window & { githubproOpening?: string }

export const intendTo = (target: Window, path: string): void => {
  ;(target as World).githubproOpening = path
}

export const intendedPath = (target: Window): string | null =>
  (target as World).githubproOpening ?? null

/**
 * Forgotten as soon as it is acted on. An intention is about one press, and a
 * stale one would send a later arrival to the wrong pull request.
 */
export const forgetIntent = (target: Window): void => {
  delete (target as World).githubproOpening
}
