/**
 * Store-asset sheet.
 *
 * Marketing product PNGs were nuked in the ground-up rebuild.
 * This page keeps the icon + typographic promo frames on the sober bed so the
 * entry still builds. Reintroduce product frames later from live fixtures or
 * fresh captures — do not reload deleted public shot files.
 */
import { mount } from "./mount"
import { Bed } from "./Bed"
import { INK, MUTED, PAPER } from "@/ui/bed"
import { Mark, Wordmark } from "@/ui/Mark"
import "@fontsource-variable/inter"
import "./index.css"

const Frame = ({
  name,
  width,
  height,
  note,
  children
}: {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly note: string
  readonly children: React.ReactNode
}) => (
  <figure style={{ margin: "0 0 48px" }}>
    <figcaption
      style={{ color: MUTED, fontSize: 12, letterSpacing: "0.06em", padding: "0 0 8px" }}
    >
      {name} · {width}×{height} · {note}
    </figcaption>
    <div data-asset={name} style={{ width, height, overflow: "hidden", position: "relative" }}>
      {children}
    </div>
  </figure>
)

const Icon = () => (
  <div style={{ display: "grid", placeItems: "center", width: 128, height: 128 }}>
    <Mark size={128} />
  </div>
)

const TypeCard = ({
  width,
  height,
  rotation,
  dek
}: {
  readonly width: number
  readonly height: number
  readonly rotation: number
  readonly dek?: string
}) => (
  <Bed saturated rotation={rotation} scale={1.2} style={{ width, height }}>
    <div
      style={{
        height: "100%",
        boxSizing: "border-box",
        padding: "48px 56px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 24
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Mark size={48} color={INK} />
        <Wordmark size={32} color={INK} />
      </div>
      <p
        style={{
          margin: 0,
          maxWidth: 520,
          fontSize: Math.min(48, width / 18),
          lineHeight: 1.05,
          letterSpacing: "-0.035em",
          fontWeight: 600,
          color: INK
        }}
      >
        A faster, quieter GitHub.
      </p>
      {dek ? (
        <p style={{ margin: 0, maxWidth: 480, fontSize: 20, lineHeight: 1.45, color: MUTED }}>
          {dek}
        </p>
      ) : null}
    </div>
  </Bed>
)

mount(
  "sheet",
  <div style={{ padding: 48, background: PAPER, minHeight: "100vh" }}>
    <Frame name="icon-128" width={128} height={128} note="transparent, 96 of 128 drawn">
      <Icon />
    </Frame>
    <Frame name="promo-tile" width={440} height={280} note="type only — shots nuked">
      <TypeCard
        width={440}
        height={280}
        rotation={18}
        dek="Pull requests filed by next action. Not an AI reviewer."
      />
    </Frame>
    <Frame name="marquee" width={1400} height={560} note="type only — shots nuked">
      <TypeCard
        width={1400}
        height={560}
        rotation={196}
        dek="Every pull request you are in, one quieter screen."
      />
    </Frame>
    <Frame name="social-card" width={1200} height={630} note="og:image candidate — type only">
      <TypeCard
        width={1200}
        height={630}
        rotation={38}
        dek="Pull requests, issues, commits and checks—filed by what needs you."
      />
    </Frame>
  </div>
)
