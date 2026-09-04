import { Effect, Option } from "effect"
import { decodeEvents, happeningsIn } from "../../../src/github/activity"
import type { Press, PressKind } from "../../../src/domain/notices"
import { restEmpty, restRead, restWrite } from "./api"

const KIND: Record<string, PressKind> = {
  mark: "mark",
  unmark: "unmark",
  archive: "archive",
  unarchive: "unarchive",
  subscribe: "subscribe",
  unsubscribe: "unsubscribe",
  star: "star",
  unstar: "unstar"
}

const pressesFor = (id: string): ReadonlyArray<Press> =>
  (Object.keys(KIND) as ReadonlyArray<PressKind>).map((kind) => ({
    kind,
    route: "rest",
    token: "",
    ids: [id]
  }))

const numberIn = (url: string | null): string | null => {
  if (url === null) return null
  const found = /\/(issues|pulls|pull)\/(\d+)/.exec(url)
  return found?.[2] ?? null
}

type RestNotice = {
  readonly id: string
  readonly unread: boolean
  readonly updated_at: string
  readonly reason: string
  readonly subject: {
    readonly title: string
    readonly url: string | null
    readonly type: string
  }
  readonly repository: { readonly full_name: string }
}

export const readNotices = Effect.fn("readNotices")(function* (token: string, query: string) {
  const asked = new URLSearchParams(query)
  const all = asked.get("query")?.includes("is:unread") === true ? "false" : "true"
  const listed = yield* restRead<ReadonlyArray<RestNotice>>(
    token,
    `/notifications?all=${all}&per_page=50`
  )

  return listed.map((one) => ({
    id: one.id,
    url: one.subject.url ?? `https://github.com/${one.repository.full_name}`,
    repository: one.repository.full_name,
    number: numberIn(one.subject.url),
    title: one.subject.title,
    reason: one.reason,
    standing: (one.subject.type === "PullRequest" ? "open" : "unknown") as
      | "open"
      | "merged"
      | "closed"
      | "unknown",
    unread: one.unread,
    subscribed: true,
    movedAt: one.updated_at,
    participants: [],
    presses: pressesFor(one.id)
  }))
})

export const pressNotice = Effect.fn("pressNotice")(function* (token: string, press: Press) {
  const id = press.ids[0]
  if (id === undefined) return

  switch (press.kind) {
    case "mark":
      yield* restEmpty(token, `/notifications/threads/${id}`, "PATCH")
      return
    case "unmark":
      yield* restWrite(token, `/notifications/threads/${id}`, { unread: true }, "PATCH")
      return
    case "subscribe":
      yield* restWrite(token, `/notifications/threads/${id}/subscription`, { ignored: false }, "PUT")
      return
    case "unsubscribe":
      yield* restEmpty(token, `/notifications/threads/${id}/subscription`, "DELETE")
      return
    case "archive":
    case "unarchive":
      yield* restEmpty(token, `/notifications/threads/${id}`, "PATCH")
      return
    case "star":
    case "unstar":
      return
  }
})

export const readPerson = Effect.fn("readPerson")(function* (token: string, login: string) {
  const who = yield* restRead<{
    readonly login: string
    readonly name: string | null
    readonly bio: string | null
    readonly avatar_url: string | null
    readonly company: string | null
    readonly location: string | null
    readonly followers: number
    readonly following: number
    readonly blog: string | null
    readonly html_url: string
    readonly public_repos: number
  }>(token, `/users/${login}`)

  return {
    login: who.login,
    name: who.name,
    bio: who.bio,
    faceUrl: who.avatar_url,
    company: who.company,
    location: who.location,
    followers: String(who.followers),
    following: String(who.following),
    site: who.blog === null || who.blog === "" ? null : who.blog,
    ways: [] as ReadonlyArray<{ readonly label: string; readonly url: string }>,
    sponsorAt: null as string | null,
    tally: { repositories: String(who.public_repos), stars: null as string | null }
  }
})

export const readPersonRepositories = Effect.fn("readPersonRepositories")(function* (
  token: string,
  login: string,
  page: number
) {
  const listed = yield* restRead<
    ReadonlyArray<{
      readonly name: string
      readonly full_name: string
      readonly owner: { readonly login: string }
      readonly description: string | null
      readonly topics?: ReadonlyArray<string>
      readonly language: string | null
      readonly stargazers_count: number
      readonly forks_count: number
      readonly pushed_at: string | null
      readonly archived: boolean
      readonly fork: boolean
      readonly parent?: { readonly full_name: string } | null
      readonly private: boolean
    }>
  >(token, `/users/${login}/repos?per_page=30&page=${page}&sort=updated`)

  return {
    rows: listed.map((one) => ({
      owner: one.owner.login,
      repo: one.name,
      nameWithOwner: one.full_name,
      description: one.description,
      topics: one.topics ?? [],
      language: one.language === null ? null : { name: one.language, colour: "#ededed" },
      stars: one.stargazers_count,
      forks: one.forks_count,
      pushedAt: one.pushed_at,
      isArchived: one.archived,
      isFork: one.fork,
      forkedFrom: one.parent?.full_name ?? null,
      isPrivate: one.private
    })),
    more: listed.length === 30
  }
})

export const readActivity = Effect.fn("readActivity")(function* (token: string, login: string) {
  const raw = yield* restRead<unknown>(token, `/users/${login}/events?per_page=30`)
  const events = yield* decodeEvents(raw)
  return happeningsIn(events).map((one) => ({
    kind: one.kind,
    at: one.at,
    by: one.by.map((who) => ({ login: who.login, faceUrl: Option.getOrNull(who.faceUrl) })),
    repo: one.repo,
    ref: Option.getOrNull(one.ref),
    howMany: Option.getOrNull(one.howMany),
    howOften: one.howOften,
    number: Option.getOrNull(one.number),
    title: Option.getOrNull(one.title),
    url: one.url
  }))
})
