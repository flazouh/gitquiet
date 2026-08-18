import { pullRequestAt } from "./following"

/**
 * Where a link means to go, on GitHub, or nothing where it is not going there.
 *
 * Two spellings, because the interface above is written for a page of GitHub's and
 * uses both: the card writes whole addresses so that copy-link and Cmd-click carry
 * something a browser can use, and the bar writes paths — `/notifications`, a
 * repository's tabs, every row of every menu — because on a page a path is the
 * shortest true thing to write.
 *
 * A path used to be left alone, on the grounds that nothing in the window navigates
 * to one. The bar arrived in the title row and did: pressing the inbox unloaded the
 * app and left GitHub's own notifications page inside a window with no address bar
 * and no way back. So a path is read for what it is — a page of GitHub's — and
 * resolved against GitHub rather than against this webview, whose own origin is a
 * build directory.
 *
 * Nothing for a hash or a `mailto:`, which are not somewhere to go. And nothing for
 * a pull request, which is a screen this window becomes rather than a page anywhere:
 * the list reads the press on the way up and hands it to the card. That handler
 * stands down as soon as the rule above it has answered a press, so claiming a pull
 * request here would be claiming the one link the app is for. See `following.ts`.
 *
 * Its own file rather than a line inside `outside.ts`, for the reason
 * `opensInside.ts` is its own file: that one reaches the main process the moment it
 * is imported, and a decision worth reading back is worth being able to read without
 * a window around it.
 */
export const theirPage = (href: string, resolved?: string | undefined): string | null => {
  if (href.startsWith("http://") || href.startsWith("https://")) return resolved ?? href

  if (!href.startsWith("/") || href.startsWith("//")) return null

  return pullRequestAt(href) === null ? `https://github.com${href}` : null
}
