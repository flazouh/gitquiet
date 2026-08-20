import type { Effect, Option } from "effect"
import { useCallback } from "react"
import type { Destination } from "../domain/Settings"
import type { PullRequestRef } from "../domain/PullRequestRef"
import type { RowDoing } from "../domain/doable"
import type { RepositoryActivity } from "../domain/activity"
import { ranked, type Repository } from "../domain/repositories"
import type { Sitting } from "../domain/sittings"
import type { Profile } from "../keys/commands"
import { Activity } from "./Activity"
import { Repositories } from "./Repositories"
import { WorkingSetScreen } from "./WorkingSetScreen"
import { useUpdated } from "./useUpdated"
import { type Load, useLive } from "./useLive"
import { useSettings } from "./useSettings"

/**
 * GitHub's home page, as three Destinations and a Rail.
 *
 * This exists to keep three things in one place that would otherwise be spread across a
 * screen module, a list and a strip of navigation: which Destination the reader is on, how
 * wide their Rail is, and the two reads that only matter once they press something. All
 * three are the reader's own state rather than the page's, which is why they are remembered
 * in the settings record and not in the address — pushing our own address onto `/` would
 * put a page in GitHub's history that their soft navigation knows nothing about.
 *
 * The Working Set is still the page underneath. `WorkingSetScreen` holds that read, draws
 * the Courts and hands the Rail the repositories it already knows; this only adds the other
 * two Destinations and the choice between them.
 */
export type HomeProps = {
  readonly load: Load<ReadonlyArray<Sitting>>
  readonly preload?: () => Effect.Effect<Option.Option<ReadonlyArray<Sitting>>>
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string
  readonly onOpen: (reference: PullRequestRef) => void
  readonly onStepAside: () => void
  readonly ask?: (
    doing: RowDoing,
    reference: PullRequestRef
  ) => Effect.Effect<void, unknown>
  readonly keys?: Profile
  /** Every repository the reader has: the Repositories Destination, and the Rail's filter. */
  readonly repositories: Load<ReadonlyArray<Repository>>
  readonly rememberedRepositories?: () => Effect.Effect<
    Option.Option<ReadonlyArray<Repository>>
  >
  /** What happened elsewhere. Only ever read once somebody asks for it. */
  readonly activity: Load<ReadonlyArray<RepositoryActivity>>
  readonly rememberedActivity?: () => Effect.Effect<
    Option.Option<ReadonlyArray<RepositoryActivity>>
  >
  /** Who the reader is, for the Rail's menu. */
  readonly participant?: { readonly login: string; readonly faceUrl: Option.Option<string> }
}

export const Home = ({
  load,
  preload,
  where,
  onOpen,
  onStepAside,
  ask,
  keys,
  repositories,
  rememberedRepositories,
  activity,
  rememberedActivity,
  participant
}: HomeProps) => {
  const { settings, change } = useSettings()

  const everything = useLive(repositories, rememberedRepositories)
  const known = everything.read.status === "ready" ? everything.read.value : undefined
  useUpdated(everything.catchingUp, known, "Repositories updated")

  // Both written against whatever the settings are at the moment of the press rather than
  // against this render's copy of them: pressing a Destination and then narrowing the Rail
  // are two changes a second apart, and each spreading its own stale snapshot is how one of
  // them silently undid the other.
  const goTo = useCallback(
    (destination: Destination) =>
      change((current) => ({ ...current, home: { ...current.home, destination } })),
    [change]
  )

  const remember = useCallback(
    (narrow: boolean) =>
      change((current) => ({
        ...current,
        home: { ...current.home, rail: narrow ? "narrow" : "wide" }
      })),
    [change]
  )

  const pin = useCallback(
    (pinned: ReadonlyArray<string>) => change((current) => ({ ...current, pinned })),
    [change]
  )

  return (
    <WorkingSetScreen
      load={load}
      preload={preload}
      where={where}
      onOpen={onOpen}
      onStepAside={onStepAside}
      ask={ask}
      keys={keys}
      home
      destination={settings.home.destination}
      onDestination={goTo}
      collapsed={settings.home.rail === "narrow"}
      pinned={settings.pinned}
      onPinned={pin}
      onCollapsed={remember}
      participant={participant}
      repositories={known}
      elsewhere={(which, atWork) =>
        which === "repositories" ? (
          <Repositories
            // Ranked here rather than by the read, because the order wants the Working Set's
            // own fold: the repositories a reader has a pull request in are the ones they
            // came looking for, and everything else is alphabetical so it stays put.
            repositories={ranked(known ?? [], atWork)}
            atWork={atWork}
            waiting={everything.read.status !== "ready"}
            keys={keys}
          />
        ) : (
          // Mounted only now, which is what keeps the read that costs a rate limit from
          // being spent on a Destination nobody pressed.
          <Elsewhere read={activity} remembered={rememberedActivity} />
        )
      }
    />
  )
}

/** Activity, read the moment it is asked for and not before. */
const Elsewhere = ({
  read,
  remembered
}: {
  readonly read: Load<ReadonlyArray<RepositoryActivity>>
  readonly remembered?: () => Effect.Effect<Option.Option<ReadonlyArray<RepositoryActivity>>>
}) => {
  const live = useLive(read, remembered)
  useUpdated(
    live.catchingUp,
    live.read.status === "ready" ? live.read.value : undefined,
    "Activity updated"
  )

  return (
    <Activity
      activity={live.read.status === "ready" ? live.read.value : []}
      waiting={live.read.status !== "ready"}
    />
  )
}
