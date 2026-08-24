import { Option } from "effect"
import type { Answering } from "../../src/domain/answering"
import { ProfileScreen, type Owned } from "../../src/ui/ProfileScreen"
import { settled, STORE, type View } from "../view"
import { PERSON_REPOSITORIES, PROFILE_PERSON } from "./personRepos"

const ANSWERING: Answering = {
  reviews: 8,
  replies: 14,
  pulls: 3,
  places: 7,
  last: Option.some("2026-08-12T10:00:00Z"),
  days: 90
}

const OWNED: Owned = {
  rows: PERSON_REPOSITORIES,
  reading: false,
  capped: true
}

export const PROFILE_VIEW: View = {
  name: "profile",
  caption:
    "A person's recent answers and active repositories, with the limits of the public record shown beside them",
  ...STORE,
  draw: () => (
    <ProfileScreen
      login={PROFILE_PERSON.login}
      answering={settled(ANSWERING)}
      owned={settled(OWNED)}
      who={PROFILE_PERSON}
      signedIn={() => true}
      onStepAside={() => {}}
      now={new Date("2026-08-14T12:00:00Z")}
    />
  )
}
