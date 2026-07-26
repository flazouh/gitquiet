import { Option, Schema } from "effect"

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

export const toUrl = (ref: PullRequestRef): string =>
  `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`
