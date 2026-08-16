/**
 * Where a reader is sent the first time, and on which of the reasons the browser
 * gives for running the worker's install listener.
 *
 * A page of the site rather than a page of the extension's, because the onboarding is
 * one screen in three places — the app's first window, this, and `gitquiet.com/welcome`
 * — and the web copy is the one that can mount the screens and run them instead of
 * showing photographs of them. Served also means it is fixed without anybody updating
 * anything.
 *
 * `from=extension` changes the last beat: there is nothing left to install, so it must
 * not end on a button back to the store they have this second come from.
 */
export const WELCOME_AT = "https://gitquiet.com/welcome?from=extension"

/**
 * The address to open for one of the browser's install reasons, or nothing.
 *
 * A function rather than an `if` in the worker, because the wrong answer here is
 * invisible until it has already happened to somebody: `onInstalled` fires on an
 * update as well, and a tab that opens by itself on a Tuesday morning because
 * something updated in the background is what makes people uninstall extensions.
 *
 * The reason is taken as a string. The browser's own union has four members and
 * differs between browsers — Firefox has `browser_update` where Chrome has
 * `chrome_update` — and the rule is the same in all of them: the install, and nothing
 * else.
 */
export const welcomeFor = (reason: string): string | null =>
  reason === "install" ? WELCOME_AT : null
