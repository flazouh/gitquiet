/**
 * What a person has done lately on work that is not theirs.
 *
 * The only question a reader brings to a stranger's profile: a pull request is sitting
 * there, and they want to know whether this person answers anybody. The contribution
 * calendar is used as the proxy for it and is a bad one — 200 commits to your own
 * repository and no reply to a soul in three months is a wall of green, and so is the
 * reverse — so the acts that are somebody answering are counted on their own.
 *
 * Three acts count, and they are the three a maintainer performs: a review on somebody
 * else's pull request, a reply on somebody else's issue or pull request, and a pull
 * request opened on somebody else's repository. A push to their own work is not an
 * answer to anybody, and neither is a star.
 *
 * Built from public events, so it is honestly public and honestly partial: private work
 * is not in it, and neither is anything older than the window GitHub serves. Both are
 * said on the screen rather than hidden. See `docs/spec/profile.md`.
 */

import { Option } from "effect"
import type { Happening } from "./activity"

/**
 * How many days back this counts.
 *
 * Ninety, because that is the window their public events cover: a longer one would be a
 * count over a period nobody can see the whole of, which reads as a smaller number
 * rather than as a shorter record.
 */
export const WINDOW = 90

/** The three acts that are somebody answering, and how they are counted. */
const COUNTED = {
  reviewed: "reviews",
  commented: "replies",
  opened: "pulls"
} as const satisfies Partial<Record<Happening["kind"], string>>

type Counted = keyof typeof COUNTED

const isCounted = (kind: Happening["kind"]): kind is Counted => kind in COUNTED

/** What somebody has done lately on other people's work. */
export type Answering = {
  /** Reviews left on other people's pull requests. */
  readonly reviews: number
  /** Replies on other people's issues and pull requests. */
  readonly replies: number
  /** Pull requests opened on other people's repositories. */
  readonly pulls: number
  /** How many repositories of other people's those acts were spread over. */
  readonly places: number
  /** When the last of them was, or nothing where there were none. */
  readonly last: Option.Option<string>
  /** The window counted, in days, so the screen can say what the numbers cover. */
  readonly days: number
}

const NOBODY: Answering = {
  reviews: 0,
  replies: 0,
  pulls: 0,
  places: 0,
  last: Option.none(),
  days: WINDOW
}

/** Whether one act is somebody answering, rather than working on their own things. */
const elsewhere = (one: Happening, login: string): boolean =>
  one.repo.owner.toLowerCase() !== login.toLowerCase()

/**
 * How much of an answer somebody has been lately.
 *
 * Nothing is ranked and nothing is scored. Three counts, the repositories they were
 * spread over and the day of the last one is the whole answer, and a reader draws their
 * own conclusion from it — which is the difference between this and the green squares.
 */
export const answering = (
  events: ReadonlyArray<Happening>,
  login: string,
  now: Date,
  days: number = WINDOW
): Answering => {
  const from = now.getTime() - days * 24 * 60 * 60 * 1000
  const counted = events.filter(
    (one) =>
      isCounted(one.kind) && elsewhere(one, login) && new Date(one.at).getTime() >= from
  )

  if (counted.length === 0) return { ...NOBODY, days }

  const tally = { reviews: 0, replies: 0, pulls: 0 }
  const places = new Set<string>()
  let last = counted[0]?.at ?? ""

  for (const one of counted) {
    if (!isCounted(one.kind)) continue
    // Runs are folded together upstream, so one line can be six acts. See `Happening`.
    tally[COUNTED[one.kind]] += one.howOften
    places.add(`${one.repo.owner}/${one.repo.repo}`.toLowerCase())
    if (one.at > last) last = one.at
  }

  return {
    ...tally,
    places: places.size,
    last: last === "" ? Option.none() : Option.some(last),
    days
  }
}
