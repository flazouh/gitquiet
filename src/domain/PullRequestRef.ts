import { Option, Schema } from "effect"

/**
 * A repository, which is as much as some of GitHub's pages are about.
 *
 * A pull request is one of these with a number, and every reference in this
 * codebase is at least this much: it is what the gateway needs to build a URL
 * and what a failure needs to say where it happened. Named separately so that
 * reading a commit — which belongs to the repository — does not have to invent
 * a pull request to ask about it.
 */
export type RepoRef = {
  readonly owner: string
  readonly repo: string
}

export const PullRequestRef = Schema.Struct({
  owner: Schema.String,
  repo: Schema.String,
  number: Schema.Number
})

export type PullRequestRef = typeof PullRequestRef["Type"]

/**
 * Only the pull request's own page, not the tabs beside it. Files, Commits and
 * Checks are GitHub's, and they stay GitHub's: this interface replaces the
 * conversation, which is where knowing what needs you is hard.
 */
const PULL_REQUEST_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/

export const fromPathname = (pathname: string): Option.Option<PullRequestRef> => {
  const match = PULL_REQUEST_PATH.exec(pathname)
  if (match === null) return Option.none()

  const owner = match[1]
  const repo = match[2]
  const number = match[3]
  if (owner === undefined || repo === undefined || number === undefined) {
    return Option.none()
  }

  return Option.some({ owner, repo, number: Number.parseInt(number, 10) })
}

export const sameReference = (left: PullRequestRef, right: PullRequestRef): boolean =>
  left.owner === right.owner && left.repo === right.repo && left.number === right.number

/**
 * The pull request a press is headed for, where that is one other than the page
 * being read. Nothing where the press has nowhere to go, and nothing where the
 * link is not a pull request of ours at all.
 *
 * The address being read is an argument, and that is the whole point of this
 * function. It moves without a document, so the page a reader is on is whatever
 * the address says at the press and never what it said when the script started.
 * Held once at the start, this told a reader standing on #38 that they were still
 * on the #39 they had arrived at: a press headed back to #39 was declined as a
 * press to the page already open, and so fell to a router that was never told the
 * row exists. That router drops about every other one, which the reader met as a
 * press that did nothing, and then as the whole document load this extension is
 * for avoiding.
 */
export const elsewhereThan = (
  addressNow: string,
  linkPath: string
): Option.Option<PullRequestRef> => {
  const wanted = fromPathname(linkPath)
  if (Option.isNone(wanted)) return Option.none()

  const here = fromPathname(addressNow)
  return Option.isSome(here) && sameReference(here.value, wanted.value) ? Option.none() : wanted
}

/**
 * One pull request's name, for keying a map or a store by it.
 *
 * `owner/repo#7`, which is how a person writes it, and unique for the same
 * reason. Here rather than in the three places that had written it out
 * themselves: two of them keyed the branches read by it, one keys the store, and
 * a key spelt two ways is a lookup that silently never matches.
 */
export const keyOf = (reference: PullRequestRef): string =>
  `${reference.owner}/${reference.repo}#${reference.number}`

export const toUrl = (ref: PullRequestRef): string =>
  `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`
