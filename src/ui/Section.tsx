/**
 * A section of the column that says what this pull request is.
 *
 * All four look the same on purpose: a titled box with a line of summary in its
 * header, so the eye runs down one edge rather than learning four layouts. Its
 * own file for that reason: sameness across the panels is the point, and a
 * shell each panel could reach in and adjust would not stay the same for long.
 */
export const Section = ({
  name,
  summary,
  tone = "plain",
  children
}: {
  readonly name: string
  readonly summary?: React.ReactNode
  readonly tone?: "plain" | "bad"
  readonly children: React.ReactNode
}) => (
  <section
    aria-label={name}
    // Never shrunk: a flex child left to its own devices gives up its height to
    // its neighbours, which is how opening the description once squashed CI and
    // the conversation into two bars.
    className={`shrink-0 overflow-hidden rounded-md border ${
      tone === "bad" ? "border-fail" : "border-line"
    }`}
  >
    <div
      className={`flex items-center gap-2 border-b px-3 py-2 ${
        tone === "bad" ? "border-fail bg-fail-muted" : "border-line bg-surface"
      }`}
    >
      <h2 className="text-xs font-semibold">{name}</h2>
      {summary === undefined ? null : (
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{summary}</span>
      )}
    </div>
    {children}
  </section>
)
