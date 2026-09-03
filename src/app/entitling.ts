/**
 * What the browser tab says, on the pages this extension answers itself.
 *
 * Nothing used to say it. GitHub writes the title on the pages their router
 * serves, and this extension navigates around that router — so after an
 * in-place switch the tab went on wearing the previous page's words, verified
 * live: standing on one repository with another repository's title.
 *
 * Two layers, because the truth arrives in two stages. {@link titleAt} is what
 * the address alone can say and is set the moment the address is the page —
 * a name, a number, a tab's word. The `*Entitled` builders are what a screen
 * can add once it has read — a repository's description, a pull request's own
 * words — and each screen says its own when the read lands.
 */

import type { Wanted } from "./screens"

/** The two path segments every repository page starts with, or nothing. */
const repoIn = (path: string): string | null => {
  const [owner, repo] = path.split("/").filter((part) => part.length > 0)
  return owner === undefined || repo === undefined ? null : `${owner}/${repo}`
}

/** The segments after `/owner/repo`, however the page spells them. */
const tail = (path: string): ReadonlyArray<string> =>
  path.split("/").filter((part) => part.length > 0).slice(2)

/** `Word · owner/repo`, or nothing where the address has no repository in it. */
const onRepo = (path: string, word: string): string | null => {
  const repo = repoIn(path)
  return repo === null ? null : `${word} · ${repo}`
}

/**
 * The title an address earns the moment it is the page, before anything is read.
 *
 * Keyed on the page the shell already routed rather than parsed again from
 * scratch: the routing table has decided what the address is, and this only has
 * to spell it. Nothing for a wall — an organisation's sign-on is served under
 * the address of the page it is refusing, and naming that page would title a
 * refusal as its content. Nothing, too, for an address missing the parts its
 * page needs: a wrong name is worse than the stale one.
 */
export const titleAt = (what: Wanted, path: string): string | null => {
  const repo = repoIn(path)
  const rest = tail(path)

  switch (what) {
    case "compare": {
      // Their own words for it, which a reader coming back to the tab is looking for:
      // "Comparing main...next · owner/repo". The range is spelt from the address
      // rather than parsed, because a title is wanted before anything is read.
      if (repo === null) return null
      const range = rest.slice(1).join("/")
      return range === "" ? repo : `Comparing ${decodeURIComponent(range)} · ${repo}`
    }
    case "repo-home": {
      if (repo === null) return null
      // A file wears its own name; the tree and the front page are the repository.
      if (rest[0] === "blob") {
        const name = rest[rest.length - 1]
        return name === undefined || name.length === 0 ? repo : `${name} · ${repo}`
      }
      return repo
    }
    case "blame": {
      const name = rest[rest.length - 1]
      return repo === null
        ? null
        : name === undefined || name.length === 0
          ? `Blame · ${repo}`
          : `Blame of ${name} · ${repo}`
    }
    case "pull-request": {
      const number = rest[0] === "pull" ? rest[1] : undefined
      return repo === null || number === undefined
        ? null
        : `Pull Request #${number} · ${repo}`
    }
    case "issue": {
      const number = rest[0] === "issues" ? rest[1] : undefined
      return repo === null || number === undefined ? null : `Issue #${number} · ${repo}`
    }
    case "commit": {
      const sha = rest[0] === "commit" ? rest[1] : undefined
      return repo === null || sha === undefined
        ? null
        : `Commit ${sha.slice(0, 7)} · ${repo}`
    }
    case "run": {
      const id = rest[0] === "actions" && rest[1] === "runs" ? rest[2] : undefined
      return repo === null || id === undefined ? null : `Run ${id} · ${repo}`
    }
    case "commits":
      return onRepo(path, "Commits")
    case "repo-pulls":
      return onRepo(path, "Pull requests")
    case "repo-issues":
      return onRepo(path, "Issues")
    case "actions":
      return onRepo(path, "Actions")
    case "releases":
      return onRepo(path, "Releases")
    case "discussion": {
      /*
       * Their own title for it, which is the number and the repository. The name of the
       * discussion is not in the address, so it cannot be here: a title is wanted before
       * anything is read, and a wrong name is worse than a stale one.
       */
      const number = rest[1]
      return repo === null || number === undefined ? null : `Discussion #${number} · ${repo}`
    }
    case "discussions": {
      /*
       * The category, where the address names one, because that is the page the reader chose
       * and the one they are looking for in a row of tabs. Their own word for it, spelt from
       * the slug rather than from a read: a title is wanted before anything is read.
       */
      if (repo === null) return null
      const slug = rest[0] === "discussions" && rest[1] === "categories" ? rest[2] : undefined
      return slug === undefined || slug === ""
        ? `Discussions · ${repo}`
        : `${decodeURIComponent(slug)} · Discussions · ${repo}`
    }
    case "raise":
      return onRepo(path, "New issue")
    case "working-set":
      // The dashboard at `/` and the pull request list at `/pulls` are one
      // screen on two of GitHub's pages; the title keeps their two names.
      return path === "/" ? "GitHub" : "Pull requests"
    case "issues":
      return "Issues"
    case "notifications":
      return "Notifications"
    case "profile": {
      const [login] = path.split("/").filter((part) => part.length > 0)
      return login ?? null
    }
    case "person-repos": {
      const [login] = path.split("/").filter((part) => part.length > 0)
      return login === undefined ? null : `Repositories · ${login}`
    }
    case "sign-on":
      return null
  }
}

/** `owner/repo: description`, which is the sentence GitHub's own page titles with. */
export const repoEntitled = (
  repo: { readonly owner: string; readonly repo: string },
  description: string | null
): string =>
  description === null || description.length === 0
    ? `${repo.owner}/${repo.repo}`
    : `${repo.owner}/${repo.repo}: ${description}`

export const pullRequestEntitled = (
  reference: { readonly owner: string; readonly repo: string; readonly number: number },
  title: string
): string =>
  `${title} · Pull Request #${reference.number} · ${reference.owner}/${reference.repo}`

export const issueEntitled = (
  reference: { readonly owner: string; readonly repo: string; readonly number: number },
  title: string
): string => `${title} · Issue #${reference.number} · ${reference.owner}/${reference.repo}`
