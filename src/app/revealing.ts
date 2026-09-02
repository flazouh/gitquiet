import { Effect } from "effect"
import type { ChangeType } from "../domain/PullRequest"
import type { RepoRef } from "../domain/PullRequestRef"
import { GitHubGateway } from "../ports/GitHubGateway"
import { halvesToReveal } from "../domain/revealing"
import type { BothHalves } from "../ports/Renderer"
import { keptReads } from "./kept"

/** How one whole file is read, at one commit. */
export type ReadWhole = (sha: string, path: string) => Effect.Effect<string, unknown>

export type Revealer = {
  /**
   * The way to reveal one file's hidden lines, or nothing where there is none.
   *
   * Handed to the renderer, which calls it when a reader presses to see more.
   * Nothing for a file the pull request deleted, which is the renderer being
   * told not to offer rather than being left to fail at the press.
   */
  readonly forFile: (
    path: string,
    change: ChangeType
  ) => (() => PromiseLike<BothHalves>) | undefined
}

/**
 * Every whole file behind a pull request's diffs, each half read once.
 *
 * A pull request's patch holds the hunks and three lines either side, so the
 * rest of every changed file has to be fetched before the renderer can draw
 * it. Both halves are named by a commit rather than by a branch, so what is
 * read can never have changed underneath: a sha names one file for ever, which
 * is what makes keeping it sound rather than merely quick. A file revealed,
 * folded and revealed again therefore costs one pair of reads, and a file
 * nobody reveals costs none.
 *
 * Nothing here knows about React or about GitHub — the read is handed in —
 * which is what lets the caching be tested by counting calls.
 */
export const revealer = (
  read: ReadWhole,
  at: { readonly base: string; readonly head: string }
): Revealer => {
  const kept = keptReads(
    ({ sha, path }: { readonly sha: string; readonly path: string }) => read(sha, path),
    ({ sha, path }) => `${sha}:${path}`
  )

  return {
    forFile: (path, change) => {
      const halves = halvesToReveal(change)
      if (halves === "nothing") return undefined

      /*
       * Both halves at once where both are wanted, because neither waits on the
       * other and a reader who pressed is waiting on the slower of the two
       * rather than on their sum.
       *
       * And both or neither: `before: null` is the renderer's shape for a file
       * that did not exist, so answering it for a file that did would redraw
       * the whole of it as an addition. A half that cannot be read fails the
       * reveal, and the diff the reader already had stays on the screen.
       */
      const both = Effect.map(
        Effect.all([kept.ask({ sha: at.base, path }), kept.ask({ sha: at.head, path })], {
          concurrency: 2
        }),
        ([before, after]): BothHalves => ({ before, after })
      )

      const after = Effect.map(
        kept.ask({ sha: at.head, path }),
        (after): BothHalves => ({ before: null, after })
      )

      return () => Effect.runPromise(halves === "both" ? both : after)
    }
  }
}

/**
 * One whole file at one commit, off GitHub's raw route.
 *
 * `rawFileAt` rather than `fileAt`, which is the same file at a hundredth of
 * the cost: the raw route answers the text and nothing else, where their blob
 * page spends three hundred kilobytes on a rendering, a symbol table and a
 * layout that none of this reads. A sha stands where their route takes a
 * branch, which is what makes the answer the file as it was at that commit.
 */
export const loadWholeFile = Effect.fn("loadWholeFile")(function* (
  repo: RepoRef,
  sha: string,
  path: string
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rawFileAt(repo, sha, path)
})
