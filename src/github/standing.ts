/**
 * What a repository stands on, read off `/owner/repo/_sidebar`.
 *
 * One request for the whole of it — contributors, languages, releases,
 * deployments, dependents and packages — because that is how GitHub serves it
 * and four kilobytes is less than any two of those would cost apart.
 *
 * Every section is decoded as absent rather than as empty where GitHub sends
 * `null`, which it does constantly: a repository nobody depends on, a private
 * one with no deployments, one that has never shipped. The screen draws nothing
 * for an absent section, so the difference is the whole of what stops a bare
 * repository showing six empty headings.
 */

import { Option } from "effect"
import type { Hand, Landing, Shipped, Standing, Tongue } from "../domain/repoHome"
import { SidebarRoute } from "./wire"
import { whereverItIs } from "./wherever"

export const decodeSidebar = whereverItIs(SidebarRoute)

/** GitHub's own grey for a language it has no colour for. */
const UNCOLOURED = "#8b949e"

const handsFrom = (side: SidebarRoute["contributors"]): ReadonlyArray<Hand> =>
  (side?.contributors ?? []).map((one) => ({
    login: one.login,
    called: one.profileName ?? one.login,
    url: one.profilePath,
    face: one.avatarUrl
  }))

/**
 * The language bar, in the order GitHub sends it.
 *
 * Which is descending by share, and is the order the bar has to be drawn in for
 * the widest band to be the first one. Not sorted again here: a re-sort that
 * agrees with the input on every payload seen is a line that only earns its
 * place the day GitHub changes, and on that day it would hide the change.
 */
const tonguesFrom = (side: SidebarRoute["languages"]): ReadonlyArray<Tongue> => {
  const owner = side?.ownerLogin
  const repo = side?.repoName

  return (side?.languages ?? []).map((one) => ({
    name: one.name,
    share: one.percentage,
    colour: one.color ?? UNCOLOURED,
    url:
      owner === undefined || owner === null || repo === undefined || repo === null
        ? `/search?q=language%3A${encodeURIComponent(one.searchAlias ?? one.name)}`
        : `/${owner}/${repo}/search?l=${encodeURIComponent(one.searchAlias ?? one.name)}`
  }))
}

const landingsFrom = (side: SidebarRoute["deployments"]): ReadonlyArray<Landing> =>
  (side?.environments ?? []).map((one) => ({
    name: one.name,
    state: one.state ?? "unknown",
    url: one.path
  }))

const shippedFrom = (side: SidebarRoute["releases"]): Option.Option<Shipped> => {
  const latest = side?.latestRelease
  if (latest === undefined || latest === null) return Option.none()
  return Option.some({ name: latest.name, at: latest.publishedAt, url: latest.path })
}

/**
 * A count of nothing is nothing.
 *
 * Zero packages is the state of nearly every repository on GitHub, and a
 * heading that says so is a heading spent on a fact the reader did not ask
 * about. Their own sidebar hides the section too.
 */
const someCount = (count: number | null | undefined): Option.Option<number> =>
  typeof count === "number" && count > 0 ? Option.some(count) : Option.none()

export const standingFrom = (route: SidebarRoute): Standing => ({
  hands: handsFrom(route.contributors),
  handCount: someCount(route.contributors?.contributorCount),
  handsUrl: Option.fromNullishOr(route.contributors?.contributorsPath),
  tongues: tonguesFrom(route.languages),
  shipped: shippedFrom(route.releases),
  shippedUrl: Option.fromNullishOr(route.releases?.releasesPath),
  landings: landingsFrom(route.deployments),
  landingsUrl: Option.fromNullishOr(route.deployments?.deploymentsPath),
  leaning: someCount(route.usedBy?.dependentCount),
  leaningFaces: (route.usedBy?.dependents ?? []).map((one) => one.avatarUrl),
  leaningUrl: Option.fromNullishOr(route.usedBy?.dependentsPath),
  parcels: someCount(route.packages?.packageCount),
  parcelsUrl: Option.fromNullishOr(route.packages?.packagesPath)
})
