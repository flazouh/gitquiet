import { Effect } from "effect"
import type { FrontFacts, StandingFacts } from "../shared/wire"
import { graphRead, restRead, restText } from "./api"

const HOME = `
  query Home($owner: String!, $repo: String!, $expression: String!) {
    repository(owner: $owner, name: $repo) {
      viewerPermission
      viewerHasStarred
      description
      stargazerCount
      forkCount
      repositoryTopics(first: 20) { nodes { topic { name } } }
      defaultBranchRef { name }
      isEmpty
      hasIssuesEnabled
      hasDiscussionsEnabled
      hasProjectsEnabled
      hasWikiEnabled
      issues(states: OPEN) { totalCount }
      pullRequests(states: OPEN) { totalCount }
      object(expression: $expression) {
        ... on Commit {
          oid
          history { totalCount }
          tree {
            entries {
              name
              type
            }
          }
        }
      }
    }
  }
`

type HomeAnswer = {
  readonly repository: {
    readonly viewerPermission: string | null
    readonly viewerHasStarred: boolean
    readonly description: string | null
    readonly stargazerCount: number
    readonly forkCount: number
    readonly repositoryTopics: { readonly nodes: ReadonlyArray<{ readonly topic: { readonly name: string } } | null> }
    readonly defaultBranchRef: { readonly name: string } | null
    readonly isEmpty: boolean
    readonly hasIssuesEnabled: boolean
    readonly hasDiscussionsEnabled: boolean
    readonly hasProjectsEnabled: boolean
    readonly hasWikiEnabled: boolean
    readonly issues: { readonly totalCount: number }
    readonly pullRequests: { readonly totalCount: number }
    readonly object: {
      readonly oid: string
      readonly history: { readonly totalCount: number }
      readonly tree: { readonly entries: ReadonlyArray<{ readonly name: string; readonly type: string }> }
    } | null
  } | null
}

const CAN_PUSH = new Set(["ADMIN", "MAINTAIN", "WRITE"])

const kindOf = (type: string): "directory" | "file" | "submodule" => {
  if (type === "tree") return "directory"
  if (type === "commit") return "submodule"
  return "file"
}

const README = /^readme(\.|$)/i

const welcomeName = (names: ReadonlyArray<string>): string | undefined =>
  names.find((name) => README.test(name))

export const readRepoHome = Effect.fn("readRepoHome")(function* (
  token: string,
  owner: string,
  repo: string,
  branch: string | null
) {
  const asked = branch === null || branch === "" ? "HEAD" : branch
  const answer: HomeAnswer = yield* graphRead<HomeAnswer>(token, HOME, {
    owner,
    repo,
    expression: asked
  })

  const found = answer.repository
  if (found === null) {
    return yield* Effect.fail(new Error(`GitHub has no repository ${owner}/${repo}`))
  }

  const resolved = found.defaultBranchRef?.name ?? asked
  const commit = found.object
  const entries = (commit?.tree.entries ?? []).map((one) => ({
    name: one.name,
    path: one.name,
    kind: kindOf(one.type)
  }))

  const readme = welcomeName(entries.map((one) => one.name))
  let welcome: FrontFacts["welcome"] = null
  if (readme !== undefined) {
    const encoded = readme.split("/").map(encodeURIComponent).join("/")
    const html = yield* restText(
      token,
      `/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(resolved)}`,
      "application/vnd.github.html"
    ).pipe(Effect.orElseSucceed(() => ""))
    welcome = { name: readme, path: readme, html, timedOut: false }
  }

  const permission = found.viewerPermission ?? "READ"
  const footing = CAN_PUSH.has(permission) ? "keeper" : "caller"
  const starring = found.viewerHasStarred ? "starred" : "unstarred"

  const facts: FrontFacts = {
    owner,
    repo,
    footing,
    branch: resolved,
    head: commit?.oid ?? "",
    entries,
    welcome,
    about: {
      description: found.description,
      stars: found.stargazerCount,
      forks: found.forkCount,
      topics: found.repositoryTopics.nodes.flatMap((one) => (one === null ? [] : [one.topic.name])),
      starring
    },
    commits: commit?.history.totalCount ?? null
  }
  return facts
})

const COLOUR: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  Java: "#b07219",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Shell: "#89e051",
  C: "#555555",
  "C++": "#f34b7d"
}

export const readStanding = Effect.fn("readStanding")(function* (
  token: string,
  owner: string,
  repo: string
) {
  const [hands, languages, releases, deployments] = yield* Effect.all(
    [
      restRead<ReadonlyArray<{
        readonly login: string
        readonly avatar_url: string
        readonly html_url: string
        readonly contributions?: number
      }>>(token, `/repos/${owner}/${repo}/contributors?per_page=14`).pipe(Effect.orElseSucceed(() => [])),
      restRead<Record<string, number>>(token, `/repos/${owner}/${repo}/languages`).pipe(
        Effect.orElseSucceed(() => ({}))
      ),
      restRead<ReadonlyArray<{
        readonly name: string
        readonly published_at: string | null
        readonly html_url: string
        readonly tag_name: string
      }>>(token, `/repos/${owner}/${repo}/releases?per_page=1`).pipe(Effect.orElseSucceed(() => [])),
      restRead<ReadonlyArray<{
        readonly id: number
        readonly environment: string
        readonly created_at: string
      }>>(token, `/repos/${owner}/${repo}/deployments?per_page=5`).pipe(Effect.orElseSucceed(() => []))
    ],
    { concurrency: 4 }
  )

  const bytes = Object.values(languages).reduce((sum, n) => sum + n, 0)
  const tongues = Object.entries(languages).map(([name, count]) => ({
    name,
    share: bytes === 0 ? 0 : count / bytes,
    colour: COLOUR[name] ?? "#ededed",
    url: `https://github.com/${owner}/${repo}/search?l=${encodeURIComponent(name)}`
  }))

  const latest = releases[0]
  const landings: Array<{ readonly name: string; readonly state: string; readonly url: string }> = []
  for (const one of deployments) {
    const statuses = yield* restRead<ReadonlyArray<{ readonly state: string; readonly environment: string | null }>>(
      token,
      `/repos/${owner}/${repo}/deployments/${one.id}/statuses?per_page=1`
    ).pipe(Effect.orElseSucceed(() => []))
    landings.push({
      name: one.environment,
      state: statuses[0]?.state ?? "unknown",
      url: `https://github.com/${owner}/${repo}/deployments/${encodeURIComponent(one.environment)}`
    })
  }

  const facts: StandingFacts = {
    hands: hands.map((one) => ({
      login: one.login,
      called: one.login,
      url: one.html_url,
      face: one.avatar_url
    })),
    handCount: hands.length === 0 ? null : hands.length,
    handsUrl: `https://github.com/${owner}/${repo}/graphs/contributors`,
    tongues,
    shipped:
      latest === undefined
        ? null
        : {
            name: latest.name === "" ? latest.tag_name : latest.name,
            at: latest.published_at ?? "",
            url: latest.html_url
          },
    shippedUrl: `https://github.com/${owner}/${repo}/releases`,
    landings,
    landingsUrl: `https://github.com/${owner}/${repo}/deployments`,
    leaning: null,
    leaningFaces: [],
    leaningUrl: null,
    parcels: null,
    parcelsUrl: null
  }
  return facts
})

const TABS = `
  query Tabs($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      hasIssuesEnabled
      hasDiscussionsEnabled
      hasProjectsEnabled
      hasWikiEnabled
      issues(states: OPEN) { totalCount }
      pullRequests(states: OPEN) { totalCount }
    }
  }
`

type TabsAnswer = {
  readonly repository: {
    readonly hasIssuesEnabled: boolean
    readonly hasDiscussionsEnabled: boolean
    readonly hasProjectsEnabled: boolean
    readonly hasWikiEnabled: boolean
    readonly issues: { readonly totalCount: number }
    readonly pullRequests: { readonly totalCount: number }
  } | null
}

export const readTabs = Effect.fn("readTabs")(function* (
  token: string,
  owner: string,
  repo: string
) {
  const answer: TabsAnswer = yield* graphRead<TabsAnswer>(token, TABS, { owner, repo })
  const found = answer.repository
  if (found === null) {
    return yield* Effect.fail(new Error(`GitHub has no repository ${owner}/${repo}`))
  }

  const root = `https://github.com/${owner}/${repo}`
  const tabs: Array<{ name: string; href: string; count?: number; here: boolean }> = [
    { name: "Code", href: root, here: true }
  ]
  if (found.hasIssuesEnabled) {
    tabs.push({ name: "Issues", href: `${root}/issues`, count: found.issues.totalCount, here: false })
  }
  tabs.push({
    name: "Pull requests",
    href: `${root}/pulls`,
    count: found.pullRequests.totalCount,
    here: false
  })
  tabs.push({ name: "Actions", href: `${root}/actions`, here: false })
  if (found.hasProjectsEnabled) tabs.push({ name: "Projects", href: `${root}/projects`, here: false })
  if (found.hasWikiEnabled) tabs.push({ name: "Wiki", href: `${root}/wiki`, here: false })
  if (found.hasDiscussionsEnabled) tabs.push({ name: "Discussions", href: `${root}/discussions`, here: false })
  tabs.push({ name: "Security", href: `${root}/security`, here: false })
  tabs.push({ name: "Insights", href: `${root}/network/dependencies`, here: false })
  return tabs
})
