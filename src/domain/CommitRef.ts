import { Option } from "effect"

/**
 * One commit of a repository, which is all the page about it needs to be read.
 *
 * No pull request in it: a commit belongs to the repository, and the page
 * GitHub serves for one is reachable from a branch, a tag, a blame view and a
 * notification, most of which have no pull request to name.
 */
export type CommitRef = {
  readonly owner: string
  readonly repo: string
  readonly sha: string
}

/**
 * Only a commit named as one.
 *
 * `/commits/...` is the list, and a commit opened inside a pull request is that
 * pull request's page, which the interface already has. Seven characters is
 * what their own links abbreviate to and forty is a whole one.
 *
 * GitHub also resolves `/commit/main`, and this deliberately does not: a branch
 * is a moving name, nothing links to a commit that way, and matching bare words
 * here would claim every path shaped like this one.
 */
const COMMIT_PATH = /^\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})\/?$/i

export const fromPathname = (pathname: string): Option.Option<CommitRef> => {
  const match = COMMIT_PATH.exec(pathname)
  if (match === null) return Option.none()

  const owner = match[1]
  const repo = match[2]
  const sha = match[3]
  if (owner === undefined || repo === undefined || sha === undefined) return Option.none()

  return Option.some({ owner, repo, sha })
}

export const toUrl = (ref: CommitRef): string =>
  `https://github.com/${ref.owner}/${ref.repo}/commit/${ref.sha}`
