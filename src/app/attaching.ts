import { Effect } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import { GitHubGateway } from "../ports/GitHubGateway"

export const uploadFile = Effect.fn("uploadFile")(function* (reference: RepoRef, file: File) {
  const gateway = yield* GitHubGateway
  return yield* gateway.upload(reference, file)
})
