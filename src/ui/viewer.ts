import { Option } from "effect"

/**
 * Whoever GitHub says is here, read off the page rather than asked for.
 *
 * Their own markup carries it on every page, signed in or out, so this costs no
 * request and cannot itself fail. `author:me` in a filter and the failure screen's
 * "you are signed out" are the same fact asked twice.
 */
export const loginOnPage = (): string | undefined => {
  const said = document.querySelector('meta[name="user-login"]')?.getAttribute("content") ?? ""
  return said === "" ? undefined : said
}

/** Whether anybody is signed in at all. */
export const viewerOnPage = (): boolean => loginOnPage() !== undefined

/**
 * Whether a login is the reader's own.
 *
 * Case-insensitively, because a login is written however it was typed and means the same
 * account either way. False where nobody is signed in, which is right: a page of somebody
 * called the same as nobody is still somebody else's.
 */
export const isViewer = (login: string): boolean => {
  const mine = loginOnPage()
  return mine !== undefined && mine.toLowerCase() === login.toLowerCase()
}

/**
 * The reader's own face, which their page also carries.
 *
 * Their header draws it on every page, so the Rail's menu can show whose account it is
 * without a request. None where their markup has changed, which is a menu with an initial
 * in it rather than a menu that failed.
 */
export const faceOnPage = (): string | undefined => {
  const found = document.querySelector<HTMLImageElement>(
    'img.avatar-user[src], img[data-testid="github-avatar"][src]'
  )
  const said = found?.getAttribute("src") ?? ""
  return said === "" ? undefined : said
}

/** Who the reader is, as the Rail's menu needs them: a login, and a face where there is one. */
export const participantOnPage = ():
  | { readonly login: string; readonly faceUrl: Option.Option<string> }
  | undefined => {
  const login = loginOnPage()
  if (login === undefined) return undefined

  return { login, faceUrl: Option.fromNullishOr(faceOnPage()) }
}
