import { Effect } from "effect"
import type { Answered, Card, MergeWay } from "../shared/wire"
import {
  demoFront,
  demoMakeStack,
  demoStanding,
  demoSuggesting,
  demoTabs,
  demoUpload,
  demoWrite
} from "./demo"
import { readCommitMarks } from "./history"
import { readRepoHome, readStanding, readTabs } from "./home"
import { makeStack, mergeStack } from "./stack"
import { readSuggesting, uploadFile } from "./talk"
import { readSize } from "./write"

type Said = <A>(work: Effect.Effect<A, unknown>) => Promise<Answered<A>>
type FromGitHubOrDemo = <A>(
  demo: () => Effect.Effect<A, unknown>,
  read: (token: string) => Effect.Effect<A, unknown>
) => Effect.Effect<A, unknown>

const bytesOf = (encoded: string): Uint8Array => {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * The repository and stack reads the card and the other screens share.
 *
 * Kept out of `index.ts` so that file does not grow past a thousand lines each
 * time a documented route is wired. The token branch stays here, same as there.
 */
export const screenRequests = (said: Said, fromGitHubOrDemo: FromGitHubOrDemo) => ({
  repoHome: (asked: { readonly owner: string; readonly repo: string; readonly branch: string | null }) =>
    said(
      fromGitHubOrDemo(
        () => demoFront(asked.owner, asked.repo, asked.branch),
        (token) => readRepoHome(token, asked.owner, asked.repo, asked.branch)
      )
    ),

  standing: (asked: { readonly owner: string; readonly repo: string }) =>
    said(fromGitHubOrDemo(demoStanding, (token) => readStanding(token, asked.owner, asked.repo))),

  tabs: (asked: { readonly owner: string; readonly repo: string }) =>
    said(
      fromGitHubOrDemo(
        () => demoTabs(asked.owner, asked.repo),
        (token) => readTabs(token, asked.owner, asked.repo)
      )
    ),

  suggesting: (asked: { readonly owner: string; readonly repo: string }) =>
    said(fromGitHubOrDemo(demoSuggesting, (token) => readSuggesting(token, asked.owner, asked.repo))),

  upload: (asked: {
    readonly owner: string
    readonly repo: string
    readonly name: string
    readonly type: string
    readonly bytes: string
    readonly width?: number
    readonly height?: number
  }) =>
    said(
      fromGitHubOrDemo(
        () => demoUpload(asked.owner, asked.repo, asked.name, asked.width, asked.height),
        (token) =>
          uploadFile(
            token,
            asked.owner,
            asked.repo,
            asked.name,
            asked.type,
            bytesOf(asked.bytes),
            asked.width,
            asked.height
          )
      )
    ),

  commitMarks: (asked: { readonly owner: string; readonly repo: string; readonly rest: string }) =>
    said(
      fromGitHubOrDemo(
        () => Effect.succeed([]),
        (token) => readCommitMarks(token, asked.owner, asked.repo, asked.rest)
      )
    ),

  mergeStack: (asked: Card & { readonly method: MergeWay }) =>
    said(
      fromGitHubOrDemo(
        () => demoWrite(asked, { doing: "merge", method: asked.method }),
        (token) => mergeStack(token, asked, asked.method)
      )
    ),

  makeStack: (asked: Card) =>
    said(fromGitHubOrDemo(demoMakeStack, (token) => makeStack(token, asked))),

  pullSize: (asked: Card) =>
    said(fromGitHubOrDemo(() => Effect.succeed({ added: 0, deleted: 0 }), (token) => readSize(token, asked)))
})
