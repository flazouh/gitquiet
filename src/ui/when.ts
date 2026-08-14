/**
 * How long ago, in the fewest characters that still say it.
 *
 * A commit list is read for its shape — three this morning, then nothing for a
 * week — and full timestamps in every row bury that shape in digits. Anything
 * older than a month stops being "ago" to a reader and becomes a date, so it is
 * printed as one.
 */
export const ageOf = (iso: string, now: Date = new Date()): string => {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ""

  const seconds = Math.round((now.getTime() - then.getTime()) / 1000)
  if (seconds < 60) return "just now"

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days < 31) return `${days}d ago`

  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

/**
 * How recently, as a colour the age can wear.
 *
 * Green is today, amber is this week, muted is this month, and quieter than that
 * is older. The buckets follow the same cuts `ageOf` already speaks in, so a
 * reader scanning the column sees the same shape the words describe.
 */
export const freshnessOf = (iso: string, now: Date = new Date()): string => {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return "text-ink-muted"

  const hours = (now.getTime() - then.getTime()) / 3_600_000
  if (hours < 24) return "text-pass"
  if (hours < 24 * 7) return "text-busy"
  if (hours < 24 * 31) return "text-ink-muted"
  return "text-ink-muted/50"
}

/**
 * The day something happened, as a date and never as a distance.
 *
 * For a list read down a column rather than a row read on its own. "2 years ago" and
 * "3 years ago" are the same three words to somebody scanning thirty rows, and the
 * question those rows are being read for — which of these is the maintained one — is
 * answered by 2019 sitting under 2026.
 *
 * The year is dropped inside the current one, where it is the same digits on every row
 * and says nothing.
 */
export const dayOf = (iso: string, now: Date = new Date()): string => {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ""

  return then.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: then.getFullYear() === now.getFullYear() ? undefined : "numeric"
  })
}

/** The whole timestamp, for the hover that answers "yes, but exactly when". */
export const momentOf = (iso: string): string => {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return iso

  return then.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
}
