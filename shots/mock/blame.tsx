import type { RepoRef } from "../../src/domain/PullRequestRef"
import type { Blamed, Commit } from "../../src/domain/blame"
import { BlameScreen } from "../../src/ui/BlameScreen"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { daysAgo } from "./when"

/**
 * A file's blame, with two commits told once each rather than five times over.
 *
 * `oven-sh/bun`'s README, read live on 2026-09-01: five consecutive lines carry four
 * distinct commits and the first of those four returns for a third line further down,
 * which is the repeat this screen exists to draw thin instead of telling the same
 * story again.
 */

const REPO: RepoRef = { owner: "oven-sh", repo: "bun" }

const LOGO_COMMIT: Commit = {
  oid: "f0c283c632816143d8eb3a9dc9ed41d326dcbde1",
  message: "Add Bun logo",
  authorAvatarUrl: "https://avatars.githubusercontent.com/u/5665358?s=80&v=4",
  committerName: "Jarred Sumner",
  committedDate: daysAgo(365 * 3)
}

const DOMAIN_COMMIT: Commit = {
  oid: "55a9cccac06403fe1486168378246b34a957f0a1",
  message: "bun.sh -> bun.com (#20909)",
  authorAvatarUrl: "https://avatars.githubusercontent.com/u/709451?s=80&v=4",
  committerName: "GitHub",
  committedDate: daysAgo(60)
}

const REVERT_COMMIT: Commit = {
  oid: "784022785dc62482f82dc5b2ce0833c03c34d901",
  message: "revert the last commit",
  authorAvatarUrl: "https://avatars.githubusercontent.com/u/24465214?s=80&v=4",
  committerName: "dave caruso",
  committedDate: daysAgo(820)
}

const DOCS_COMMIT: Commit = {
  oid: "18362505429f99662f4423264147896d23313dbe",
  message: "Docs tweaks (#2160)",
  authorAvatarUrl: "https://avatars.githubusercontent.com/u/3084745?s=80&v=4",
  committerName: "GitHub",
  committedDate: daysAgo(1290)
}

const BLAMED: Blamed = {
  ranges: [
    { start: 1, end: 1, commitOid: LOGO_COMMIT.oid },
    { start: 2, end: 2, commitOid: DOMAIN_COMMIT.oid },
    { start: 3, end: 3, commitOid: LOGO_COMMIT.oid },
    { start: 4, end: 4, commitOid: REVERT_COMMIT.oid },
    { start: 5, end: 6, commitOid: DOCS_COMMIT.oid }
  ],
  commits: new Map([
    [LOGO_COMMIT.oid, LOGO_COMMIT],
    [DOMAIN_COMMIT.oid, DOMAIN_COMMIT],
    [REVERT_COMMIT.oid, REVERT_COMMIT],
    [DOCS_COMMIT.oid, DOCS_COMMIT]
  ]),
  ignoreRevsPresent: true,
  lines: [
    '<p align="center">',
    '  <a href="https://bun.com"><img src="https://github.com/user-attachments/assets/logo.png" alt="Logo" height=170></a>',
    "</p>",
    '<h1 align="center">Bun</h1>',
    "",
    '<p align="center">'
  ]
}

export const BLAME_VIEW: View = {
  name: "blame",
  caption:
    "Who wrote each line and when, with a commit told once rather than once per line it touched",
  ...STORE,
  draw: () => (
    <BlameScreen
      repo={REPO}
      branch="main"
      path="README.md"
      load={settled(BLAMED)}
      preload={alreadyKnown(BLAMED)}
      recallRepositories={nothingRemembered()}
      signedIn={() => true}
      onStepAside={() => {}}
    />
  )
}
