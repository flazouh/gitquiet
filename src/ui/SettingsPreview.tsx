import type { ReactNode } from "react"

/**
 * What each choice looks like, drawn small.
 *
 * A settings menu asks you to picture a diff you cannot see while the menu is
 * over it, and words like "unified" or "bars" only mean something to someone
 * who has already tried both. These are little mockups rather than screenshots:
 * two primitives — a few lines of code, a few rows of a tree — with the one
 * property under discussion turned up, so the difference between two choices is
 * the only thing that moves between two samples.
 */

type Tone = "add" | "del" | "same"

type Line = {
  readonly text: string
  readonly tone?: Tone
  /** The part of the line that changed, when a knob is about that. */
  readonly within?: readonly [number, number]
}

const TONE: Record<Tone, string> = {
  add: "bg-pass-muted",
  del: "bg-fail-muted",
  same: ""
}

const MARK: Record<Tone, string> = { add: "+", del: "−", same: " " }

type CodeProps = {
  readonly lines: ReadonlyArray<Line>
  readonly numbers?: boolean
  readonly marks?: "classic" | "bars" | "none"
  readonly fill?: boolean
  readonly wrap?: boolean
  readonly size?: number
  readonly leading?: number
  readonly palette?: "one-dark" | "github"
}

const Code = ({
  lines,
  numbers = true,
  marks = "classic",
  fill = true,
  wrap = false,
  size = 9,
  leading = 14,
  palette
}: CodeProps) => (
  <div
    className="overflow-hidden rounded border border-line bg-canvas font-mono"
    style={{ fontSize: `${size}px`, lineHeight: `${leading}px` }}
  >
    {lines.map((line, at) => {
      const tone = line.tone ?? "same"
      return (
        <div key={at} className={`flex ${fill ? TONE[tone] : ""}`}>
          {numbers ? (
            <span className="w-4 shrink-0 bg-surface px-1 text-right text-ink-muted">
              {tone === "add" ? "" : at + 1}
            </span>
          ) : null}
          {marks === "bars" ? (
            <span
              className={`w-0.5 shrink-0 ${tone === "add" ? "bg-pass-emphasis" : tone === "del" ? "bg-fail-emphasis" : ""}`}
            />
          ) : null}
          {marks === "classic" ? (
            <span
              className={`w-2 shrink-0 text-center ${tone === "add" ? "text-pass" : tone === "del" ? "text-fail" : "text-ink-muted"}`}
            >
              {MARK[tone]}
            </span>
          ) : null}
          <span
            className={`min-w-0 flex-1 px-1 text-ink ${wrap ? "break-all whitespace-pre-wrap" : "truncate"}`}
          >
            {line.within === undefined ? (
              paint(line.text, palette)
            ) : (
              <>
                {line.text.slice(0, line.within[0])}
                <span className={tone === "del" ? "bg-fail-emphasis/40" : "bg-pass-emphasis/40"}>
                  {line.text.slice(line.within[0], line.within[1])}
                </span>
                {line.text.slice(line.within[1])}
              </>
            )}
          </span>
        </div>
      )
    })}
  </div>
)

/**
 * Two palettes, hand-coloured.
 *
 * Loading Shiki to paint eight words in a tooltip would cost more than the
 * whole menu; these are the four token colours anyone recognises from each
 * theme, on the one line where the difference shows.
 */
const paint = (text: string, palette: CodeProps["palette"]): ReactNode => {
  if (palette === undefined) return text

  const colours =
    palette === "one-dark"
      ? { keyword: "#c678dd", name: "#e06c75", string: "#98c379" }
      : { keyword: "#ff7b72", name: "#79c0ff", string: "#a5d6ff" }
  const [, keyword, name, rest] = /^(\w+) (\w+) = (.*)$/.exec(text) ?? []
  if (keyword === undefined) return text

  return (
    <>
      <span style={{ color: colours.keyword }}>{keyword}</span>{" "}
      <span style={{ color: colours.name }}>{name}</span> ={" "}
      <span style={{ color: colours.string }}>{rest}</span>
    </>
  )
}

type Row = {
  readonly name: string
  readonly depth?: number
  readonly folder?: boolean
  readonly tail?: ReactNode
  readonly tick?: boolean
  readonly colour?: string
}

type TreeProps = {
  readonly rows: ReadonlyArray<Row>
  readonly gap?: number
  readonly icons?: "material" | "plain"
  readonly width?: number
  readonly pinned?: string
  readonly search?: boolean
}

const Tree = ({ rows, gap = 2, icons = "material", width, pinned, search }: TreeProps) => (
  <div
    className="overflow-hidden rounded border border-line bg-canvas text-[9px] leading-[13px]"
    style={width === undefined ? undefined : { width: `${width}px` }}
  >
    {search ? (
      <div className="border-b border-line px-1 py-0.5 text-ink-muted">⌕ filter files</div>
    ) : null}
    {pinned === undefined ? null : (
      <div className="border-b border-line bg-surface px-1 py-0.5 text-ink-muted">{pinned}</div>
    )}
    {rows.map((row) => (
      <div
        key={row.name + (row.depth ?? 0)}
        className="flex items-center gap-1 px-1"
        style={{ paddingTop: gap, paddingBottom: gap, paddingLeft: 4 + (row.depth ?? 0) * 8 }}
      >
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-[2px]"
          style={{
            background:
              icons === "plain" ? "var(--fgColor-muted)" : (row.colour ?? "var(--fgColor-accent)")
          }}
        />
        <span className="min-w-0 flex-1 truncate text-ink">{row.name}</span>
        {row.tick ? <span className="shrink-0 text-ink-muted">✓</span> : null}
        {row.tail}
      </div>
    ))}
  </div>
)

const counts = (added: number, deleted: number) => (
  <span className="shrink-0 tabular-nums">
    <span className="text-pass">+{added}</span> <span className="text-fail">−{deleted}</span>
  </span>
)

const EDIT: ReadonlyArray<Line> = [
  { text: "const port = 8080", tone: "del" },
  { text: "const port = 3000", tone: "add" },
  { text: "listen(port)" }
]

const FILES: ReadonlyArray<Row> = [
  { name: "src", folder: true, colour: "var(--fgColor-attention)" },
  { name: "server.ts", depth: 1 },
  { name: "index.css", depth: 1, colour: "var(--fgColor-done)" }
]

/**
 * One sample per choice, keyed by knob.
 *
 * A knob missing from here shows its explanation and nothing else, which is the
 * right answer for anything a picture cannot settle.
 */
const SAMPLES: Record<string, (choice: string) => ReactNode> = {
  layout: (choice) =>
    choice === "split" ? (
      <div className="flex gap-1">
        <Code lines={[{ text: "port = 8080", tone: "del" }, { text: "listen(port)" }]} />
        <Code lines={[{ text: "port = 3000", tone: "add" }, { text: "listen(port)" }]} />
      </div>
    ) : (
      <Code lines={EDIT} />
    ),
  longLines: (choice) => (
    <Code
      wrap={choice === "wrap"}
      lines={[{ text: 'const greeting = "hello to everyone reading this line"', tone: "add" }]}
    />
  ),
  syntax: (choice) => (
    <Code
      palette={choice === "github" ? "github" : "one-dark"}
      lines={[{ text: 'const name = "widget"' }, { text: 'const kind = "button"' }]}
    />
  ),
  textSize: (choice) => (
    <Code
      size={choice === "small" ? 8 : choice === "medium" ? 10 : 12}
      leading={choice === "small" ? 12 : choice === "medium" ? 15 : 18}
      lines={EDIT}
    />
  ),
  lineNumbers: (choice) => <Code numbers={choice === "on"} lines={EDIT} />,
  fill: (choice) => <Code fill={choice === "on"} marks="bars" lines={EDIT} />,
  withinLine: (choice) => (
    <Code
      lines={[
        { text: "const port = 8080", tone: "del", within: within(choice, "del") },
        { text: "const port = 3000", tone: "add", within: within(choice, "add") }
      ]}
    />
  ),
  marks: (choice) => (
    <Code marks={choice as "classic" | "bars" | "none"} fill={false} lines={EDIT} />
  ),
  separators: (choice) => (
    <div className="overflow-hidden rounded border border-line bg-canvas font-mono text-[9px] leading-[14px]">
      <div className="bg-surface px-1 text-ink-muted">
        {choice === "metadata"
          ? "@@ -14,7 +14,9 @@ start()"
          : choice === "line-info"
            ? "⋯ 12 unchanged lines"
            : choice === "line-info-basic"
              ? "⋯ 12 lines"
              : "⋯"}
      </div>
      <div className="px-1 text-ink">listen(port)</div>
    </div>
  ),
  context: (choice) => (
    <Code
      lines={[
        ...Array.from({ length: choice === "3" ? 1 : choice === "10" ? 2 : 4 }, (_, at) => ({
          text: `  setUp(${at + 1})`
        })),
        { text: "const port = 3000", tone: "add" as const },
        ...Array.from({ length: choice === "3" ? 1 : choice === "10" ? 2 : 4 }, () => ({
          text: "  listen(port)"
        }))
      ]}
    />
  ),
  expansion: (choice) => (
    <div className="overflow-hidden rounded border border-line bg-canvas font-mono text-[9px] leading-[14px]">
      <div className="bg-surface px-1 text-ink-accent">↕ show {choice} more lines</div>
      <div className="px-1 text-ink">const port = 3000</div>
    </div>
  ),
  prose: (choice) =>
    choice === "on" ? (
      <div className="rounded border border-line bg-canvas px-1.5 py-1">
        <div className="bg-pass-muted text-[11px] font-semibold text-ink">The widget</div>
        <div className="text-[9px] text-ink-muted">A button that does one thing.</div>
      </div>
    ) : (
      <Code
        marks="classic"
        lines={[
          { text: "# The widget", tone: "add" },
          { text: "A button that does one thing.", tone: "add" }
        ]}
      />
    ),
  density: (choice) => (
    <Tree rows={FILES} gap={choice === "compact" ? 1 : choice === "default" ? 3 : 5} />
  ),
  icons: (choice) => <Tree rows={FILES} icons={choice as "material" | "plain"} />,
  width: (choice) => (
    <div className="flex gap-1">
      <Tree rows={FILES} width={choice === "narrow" ? 56 : choice === "medium" ? 76 : 100} />
      <Code lines={EDIT} numbers={false} />
    </div>
  ),
  counts: (choice) => (
    <Tree
      rows={FILES.map((row, at) =>
        choice === "on" && at > 0 ? { ...row, tail: counts(at * 3, at) } : row
      )}
    />
  ),
  ticks: (choice) => (
    <Tree rows={FILES.map((row, at) => ({ ...row, tick: choice === "on" && at === 1 }))} />
  ),
  flatten: (choice) =>
    choice === "on" ? (
      <Tree rows={[{ name: "src/main/java", folder: true }, { name: "App.java", depth: 1 }]} />
    ) : (
      <Tree
        rows={[
          { name: "src", folder: true },
          { name: "main", depth: 1, folder: true },
          { name: "java", depth: 2, folder: true },
          { name: "App.java", depth: 3 }
        ]}
      />
    ),
  folders: (choice) =>
    choice === "open" ? (
      <Tree rows={FILES} />
    ) : (
      <Tree rows={[{ name: "src", folder: true }, { name: "tests", folder: true }]} />
    ),
  search: (choice) => <Tree rows={FILES} search={choice === "on"} />,
  sticky: (choice) => (
    <Tree
      rows={[{ name: "server.ts" }, { name: "routes.ts" }]}
      pinned={choice === "on" ? "src" : undefined}
    />
  )
}

const within = (choice: string, tone: Tone): readonly [number, number] | undefined => {
  if (choice === "none") return undefined
  // "const port = 8080": the whole number, or only the digits that differ.
  if (choice === "char") return tone === "del" ? [13, 15] : [13, 15]
  return [13, 17]
}

/** The sample for one choice, or nothing when a picture would not settle it. */
export const sampleOf = (knob: string, choice: string): ReactNode =>
  SAMPLES[knob]?.(choice) ?? null
