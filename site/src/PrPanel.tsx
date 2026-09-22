/**
 * A React-composed quiet PR screen for the hero — built UI, not a screenshot.
 *
 * Sober dark glass, Luminar-like craft. Built UI — not a product PNG.
 */

const GLASS = "rgba(12, 12, 12, 0.72)"
const LINE = "rgba(156, 168, 168, 0.14)"
const MUTE = "#9ca8a8"
const SAND = "#848478"
const INK = "#f2f2ee"

const DiffLine = ({
  kind,
  n,
  text
}: {
  readonly kind: "ctx" | "add" | "del"
  readonly n: number
  readonly text: string
}) => {
  const tone =
    kind === "add"
      ? "bg-[rgba(108,120,120,0.18)] text-[#c5cece]"
      : kind === "del"
        ? "bg-[rgba(96,96,84,0.22)] text-[#b0b0a4]"
        : "text-[#9ca8a8]"
  const mark = kind === "add" ? "+" : kind === "del" ? "-" : " "
  return (
    <div className={`flex gap-3 px-3 py-[3px] font-mono text-[11px] leading-[1.55] ${tone}`}>
      <span className="w-7 shrink-0 select-none text-right tabular text-[#6c7878]/">{n}</span>
      <span className="w-3 shrink-0 select-none text-[#6c7878]">{mark}</span>
      <span className="min-w-0 truncate">{text}</span>
    </div>
  )
}

const Thread = ({
  who,
  body,
  when
}: {
  readonly who: string
  readonly body: string
  readonly when: string
}) => (
  <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: LINE, background: "rgba(19,19,21,0.65)" }}>
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] font-medium" style={{ color: INK }}>
        {who}
      </span>
      <span className="text-[11px]" style={{ color: SAND }}>
        {when}
      </span>
    </div>
    <p className="m-0 mt-1.5 text-[12px] leading-relaxed" style={{ color: MUTE }}>
      {body}
    </p>
  </div>
)

const Check = ({
  ok,
  label
}: {
  readonly ok: boolean
  readonly label: string
}) => (
  <div className="flex items-center gap-2 text-[12px]" style={{ color: MUTE }}>
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
      style={{
        background: ok ? "rgba(108,120,120,0.35)" : "rgba(96,96,84,0.4)",
        color: ok ? "#c5cece" : "#b0b0a4"
      }}
      aria-hidden
    >
      {ok ? "✓" : "·"}
    </span>
    {label}
  </div>
)

export const PrPanel = () => (
  <aside
    aria-hidden
    className="relative flex w-full max-w-[520px] flex-col overflow-hidden rounded-[20px] border shadow-[0_32px_80px_-28px_rgba(0,0,0,0.65)] backdrop-blur-md sm:rounded-[22px]"
    style={{
      background: GLASS,
      borderColor: "rgba(156,168,168,0.16)",
      color: INK
    }}
  >
    {/* Title bar */}
    <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: LINE }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#606054" }} />
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#6c7878" }} />
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#848478" }} />
      <span className="ml-2 truncate text-[12px]" style={{ color: MUTE }}>
        flazouh/gitquiet · pull/412
      </span>
    </div>

    {/* PR header */}
    <div className="border-b px-4 py-4" style={{ borderColor: LINE }}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
          style={{ background: "rgba(108,120,120,0.28)", color: "#c5cece" }}
        >
          Needs you
        </span>
        <span className="text-[12px]" style={{ color: SAND }}>
          Open
        </span>
      </div>
      <h2 className="m-0 mt-2 text-[17px] font-semibold leading-snug tracking-[-0.02em]">
        Quiet the review surface on long threads
      </h2>
      <p className="m-0 mt-1.5 text-[12px]" style={{ color: MUTE }}>
        into <span style={{ color: INK }}>main</span> · 3 files · +48 -19
      </p>
    </div>

    {/* Checks + threads */}
    <div className="grid gap-3 border-b px-4 py-3 sm:grid-cols-[1fr_1.15fr]" style={{ borderColor: LINE }}>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: SAND }}>
          Checks
        </p>
        <Check ok label="typecheck" />
        <Check ok label="site build" />
        <Check ok={false} label="awaiting review" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: SAND }}>
          Threads
        </p>
        <Thread who="maya" when="2h" body="Can we keep the CTA mono? The blue read as a different product." />
        <Thread who="you" when="40m" body="Switched to near-black / white. Diff below." />
      </div>
    </div>

    {/* Faux diff */}
    <div className="min-h-0 flex-1 overflow-hidden pb-3 pt-2">
      <p className="m-0 px-4 pb-2 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: SAND }}>
        site/src/Page.tsx
      </p>
      <DiffLine kind="ctx" n={41} text={`export const Page = () => (`} />
      <DiffLine kind="del" n={42} text={`  <img src={recycledProductPng} />`} />
      <DiffLine kind="add" n={42} text={`  <PrPanel />`} />
      <DiffLine kind="ctx" n={43} text={`)`} />
      <DiffLine kind="add" n={58} text={`{/* composed UI — no product PNG */}`} />
    </div>
  </aside>
)
