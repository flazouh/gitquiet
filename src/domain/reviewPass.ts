import { Option } from "effect"
import type { FileDiff } from "./PullRequest"

export type Read = {
  readonly path: string
  readonly mark: string
}

/**
 * Facts from one traversal of a pull request.
 *
 * A push cannot make these facts false. The current snapshot decides whether
 * each recorded patch is still the patch on the screen.
 */
export type Pass = {
  readonly from: string
  readonly at: number
  readonly reads: ReadonlyArray<Read>
}

export type Now = {
  readonly head: string
  readonly at: number
}

export type Act = {
  readonly kind: "read"
  readonly path: string
  readonly mark: string
}

/** Record one act, opening the Review Pass where this is its first act. */
export const acted = (pass: Option.Option<Pass>, act: Act, now: Now): Pass => {
  const before = Option.getOrElse(pass, () => ({
    from: now.head,
    at: now.at,
    reads: []
  }))
  const withoutThisPath = before.reads.filter((read) => read.path !== act.path)

  return {
    ...before,
    reads: [...withoutThisPath, { path: act.path, mark: act.mark }]
  }
}

export type Footing = "read" | "unread" | "changed" | "unloaded"

/** Where one current file stands against a Review Pass. */
export const footingOf = (
  pass: Pass,
  path: string,
  current: Option.Option<string>
): Footing => {
  if (Option.isNone(current)) return "unloaded"

  const read = pass.reads.find((one) => one.path === path)
  if (read === undefined) return "unread"
  return read.mark === current.value ? "read" : "changed"
}

/**
 * The patch somebody read, as a small durable mark.
 *
 * GitHub's `pathDigest` is SHA-256 of the path and does not move when content
 * changes. Reviewed State must use the patch itself or it never expires.
 */
export const markOf = (diff: FileDiff): string => {
  const patch = JSON.stringify([
    diff.isBinary,
    diff.isTruncated,
    diff.lines.map((line) => [
      line.kind,
      line.text,
      Option.getOrNull(line.beforeLine),
      Option.getOrNull(line.afterLine)
    ])
  ])

  // FNV-1a 64 is a bookmark, not a security signature. It is synchronous,
  // stable in every browser, and small enough to keep once per file.
  let mark = 14_695_981_039_346_656_037n
  for (let at = 0; at < patch.length; at += 1) {
    mark ^= BigInt(patch.charCodeAt(at))
    mark = BigInt.asUintN(64, mark * 1_099_511_628_211n)
  }

  return mark.toString(16).padStart(16, "0")
}
