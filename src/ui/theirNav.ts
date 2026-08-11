import type { Tab } from "../domain/tabs"
import { tabsInRow } from "../github/repoTabs"
import { BAR_ID } from "./barSlot"
import { ROOT_ID } from "./mount"

/**
 * GitHub's repository nav, read rather than reproduced.
 *
 * The bar in `docs/spec/top-bar.md` carries Code, Issues and Pull requests itself and puts the
 * rest behind the repository's name, which could have been written as a list of nine tabs and
 * nine addresses. It is read off their own row instead, for three reasons the probe made
 * plain: not every repository has all nine — Discussions, Actions and Projects can each be
 * switched off — Insights does not live at `/insights` but at `/network/dependencies`, and a
 * tab GitHub adds next year would otherwise become a page a reader can no longer reach from
 * our bar. Reading it means the menu is always exactly their row, and never a stale copy of it.
 *
 * `nav[aria-label="Repository"]` is the hook, measured by `scripts/probe-repo-nav-dom.js`:
 * that label is stable where every class name around it — `prc-UnderlineNav-ItemsList-oj8gN`
 * today — carries Primer's per-deploy hash. The row sits inside `header.GlobalNav`, which is
 * why one gate takes both of their rows away.
 */
export type { Tab }

/**
 * Their row, and not one of ours that happens to be labelled the same.
 *
 * Our own bar renders a nav of repository tabs too, and on a soft navigation both are in the
 * document at once — theirs hidden by the gate, ours standing in it. A reader would never see
 * the difference; a rule that read ours as theirs would grow a menu of its own links every
 * time the page changed.
 */
const theirRow = (page: ParentNode): Element | undefined => {
  const rows = [...page.querySelectorAll('nav[aria-label="Repository"]')]
  return rows.find((row) => row.closest(`#${ROOT_ID}, #${BAR_ID}`) === null)
}

/**
 * Their repository tabs, in their order, or nothing on a page that has no such row — which is
 * every page outside a repository, Home among them.
 */
export const repositoryTabs = (page: ParentNode): ReadonlyArray<Tab> => {
  const row = theirRow(page)

  // The same parser the gateway uses on a fetched document. Two of these would show one row
  // before their header hydrates and a different one after.
  return row === undefined ? [] : tabsInRow(row)
}

/**
 * What the address alone can say, for the moment before their row exists.
 *
 * Their nav is inside the header their own React hydrates, so it is often absent when the first
 * screen renders and it is replaced rather than updated on a soft navigation. The strip drew
 * nothing in that gap: a bar standing in a repository with no way into that repository, above a
 * page that had already replaced theirs.
 *
 * Two tabs, because two is what an address can promise. Every repository has its own page and
 * its pull requests. Issues can be switched off — `octo-org/octo-repo` has them off, and
 * their `/issues` sends the reader to the code tab — so a third tab here would be a link that
 * lands somewhere else. No counts either: the numbers are theirs, and an invented one is worse
 * than none.
 *
 * This is a stopgap and never the answer where their row can be read. Theirs carries the counts,
 * the tabs this repository actually has, and Insights at `/network/dependencies`, which no list
 * of names would guess. See {@link repositoryTabs}.
 */
export const tabsWeCanName = (
  inside: { readonly owner: string; readonly repo: string },
  path: string
): ReadonlyArray<Tab> => {
  const root = `/${inside.owner}/${inside.repo}`

  return [
    { name: "Code", href: root, here: readingTheCode(inside, path) },
    { name: "Pull requests", href: `${root}/pulls`, here: pullIsAt(within(inside, path)) }
  ]
}

/** The `/owner/repo` an address starts with, where it starts with one at all. */
const ROOT = /^(?:https?:\/\/[^/]+)?\/([^/?#]+)\/([^/?#]+)/

const rootOf = (href: string): string | undefined => {
  const found = ROOT.exec(href)

  return found === null ? undefined : `/${found[1]}/${found[2]}`.toLowerCase()
}

/**
 * Whether a row read out of their header is this repository's row.
 *
 * The one question a read of their nav cannot answer by succeeding. GitHub
 * changes the address before it replaces the row, so a read taken on a soft
 * navigation between repositories finds the row of the repository just left —
 * full, valid, and about somewhere else. Taken as the answer it put `oven-sh/bun`
 * addresses under the name `octo-org/hello-world`, and a reader pressing Pull
 * requests on the new repository landed back on the old one.
 *
 * One entry of the repository is enough. Their row carries what they like in it,
 * and a `Projects` link pointing at an organisation page is not a reason to throw
 * away the counts and Insights for the address-derived pair.
 *
 * Case is theirs to choose. `github.com/OVEN-SH/Bun` serves the same repository as
 * `github.com/oven-sh/bun`, and a strip that went blank on the capital letters a
 * reader typed would be reporting a fault of its own making.
 */
export const theirRowIsFor = (
  inside: { readonly owner: string; readonly repo: string },
  tabs: ReadonlyArray<Tab>
): boolean => {
  const root = `/${inside.owner}/${inside.repo}`.toLowerCase()

  return tabs.some((tab) => rootOf(tab.href) === root)
}

/**
 * Whether the address is the repository's own page, or a file inside it.
 *
 * Asked of the address rather than of their row, because their row lies about this. A
 * repository with Issues switched off still answers `/owner/repo/issues`, and on that page
 * GitHub marks Code as the current tab — so a bar that believed them put "you are here" on
 * the repository's name while the reader was reading a list of issues. Measured on
 * `octo-org/octo-repo`, whose issues are off.
 */
export const readingTheCode = (
  inside: { readonly owner: string; readonly repo: string },
  path: string
): boolean => {
  const rest = within(inside, path)
  return (
    rest === "" || (rest !== undefined && (rest.startsWith("/tree/") || rest.startsWith("/blob/")))
  )
}

/**
 * What the address says after the repository's name, or nothing where it names another one.
 *
 * A reader on `/other/thing/pulls` is somewhere else entirely, and a bar that marked our Pull
 * requests as the page being read would be pointing at a page nobody is on.
 */
const within = (
  inside: { readonly owner: string; readonly repo: string },
  path: string
): string | undefined => {
  const root = `/${inside.owner}/${inside.repo}`
  return path === root || path.startsWith(`${root}/`) ? path.slice(root.length) : undefined
}

/** Their own tab for the pull requests, which is current on one of them as well as on the list. */
const pullIsAt = (rest: string | undefined): boolean =>
  rest !== undefined &&
  (rest === "/pulls" || rest.startsWith("/pulls/") || rest.startsWith("/pull/"))
