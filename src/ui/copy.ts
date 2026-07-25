import type { AttentionKind, Court } from "../domain/Attention"

export const courtName = (court: Court): string => {
  switch (court) {
    case "your-move":
      return "Your Move"
    case "waiting-on-others":
      return "Waiting On Others"
    case "settled":
      return "Settled"
  }
}

const nouns: Record<AttentionKind, readonly [string, string]> = {
  thread: ["thread", "threads"],
  finding: ["bot finding", "bot findings"],
  file: ["file", "files"],
  check: ["check", "checks"],
  review: ["review", "reviews"],
  "merge-blocker": ["merge blocker", "merge blockers"]
}

export const rowName = (kind: AttentionKind, count: number): string => {
  const [one, many] = nouns[kind]
  return `${count} ${count === 1 ? one : many}`
}

export const yourMoveSummary = (count: number): string =>
  count === 0
    ? "Nothing needs you"
    : count === 1
      ? "1 thing needs you"
      : `${count} things need you`
