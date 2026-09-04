import { Option } from "effect"
import type { Marks } from "../../../src/domain/commitList"
import type { Stack } from "../../../src/domain/PullRequest"
import type { Front, Standing } from "../../../src/domain/repoHome"
import { inReadingOrder } from "../../../src/domain/repoHome"
import type { Suggesting } from "../../../src/domain/suggesting"
import type { Tab } from "../../../src/domain/tabs"
import type {
  FrontFacts,
  MarkFacts,
  StackFacts,
  StandingFacts,
  SuggestingFacts
} from "../shared/wire"

export const stackFrom = (facts: StackFacts | null | undefined): Option.Option<Stack> => {
  if (facts === null || facts === undefined || facts.layers.length < 2) return Option.none()

  return Option.some({
    number: facts.number,
    floor: Option.fromNullishOr(facts.floor),
    layers: facts.layers.map((one) => ({
      reference: { owner: one.owner, repo: one.repo, number: one.number },
      title: one.title,
      headBranch: one.headBranch,
      state: one.state,
      seat: one.seat
    }))
  })
}

export const frontFrom = (facts: FrontFacts): Front => ({
  repo: { owner: facts.owner, repo: facts.repo },
  footing: facts.footing,
  branch: facts.branch,
  head: facts.head,
  entries: inReadingOrder(
    facts.entries.map((one) => ({
      name: one.name,
      path: one.path,
      kind: one.kind,
      touched: Option.none()
    }))
  ),
  welcome: Option.fromNullishOr(facts.welcome),
  about: {
    description: Option.fromNullishOr(facts.about.description),
    stars: Option.fromNullishOr(facts.about.stars),
    forks: Option.fromNullishOr(facts.about.forks),
    topics: facts.about.topics,
    starring: facts.about.starring
  },
  commits: Option.fromNullishOr(facts.commits)
})

export const standingFrom = (facts: StandingFacts): Standing => ({
  hands: facts.hands,
  handCount: Option.fromNullishOr(facts.handCount),
  handsUrl: Option.fromNullishOr(facts.handsUrl),
  tongues: facts.tongues,
  shipped: Option.fromNullishOr(facts.shipped),
  shippedUrl: Option.fromNullishOr(facts.shippedUrl),
  landings: facts.landings,
  landingsUrl: Option.fromNullishOr(facts.landingsUrl),
  leaning: Option.fromNullishOr(facts.leaning),
  leaningFaces: facts.leaningFaces,
  leaningUrl: Option.fromNullishOr(facts.leaningUrl),
  parcels: Option.fromNullishOr(facts.parcels),
  parcelsUrl: Option.fromNullishOr(facts.parcelsUrl)
})

export const suggestingFrom = (facts: SuggestingFacts): Suggesting => facts

export const tabsFrom = (
  facts: ReadonlyArray<{ readonly name: string; readonly href: string; readonly count?: number; readonly here: boolean }>
): ReadonlyArray<Tab> => facts

export const marksFrom = (facts: ReadonlyArray<MarkFacts>): Marks =>
  new Map(facts.map((one) => [one.sha, { checks: Option.fromNullishOr(one.checks), verified: one.verified, comments: one.comments }]))
