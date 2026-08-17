import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Bed } from "./Bed"
import { HERO_SHADOW, INK, MUTED, PAPER, SCREEN_EDGE, SCREEN_SHADOW } from "./brand"
import { Mark, Wordmark } from "./Mark"
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
    <div
      data-asset={name}
      style={{ width, height, overflow: "hidden", position: "relative" }}
    >
      {children}
    </div>
  </figure>
)

const ProductShot = ({
  src,
  width,
  height,
  rotate = 0,
  shadow = SCREEN_SHADOW,
  radius = 14
}: {
  readonly src: string
  readonly width: number
  readonly height: number
  readonly rotate?: number
  readonly shadow?: string
  readonly radius?: number
}) => (
  <img
    src={src}
    alt=""
    width={width}
    height={height}
    draggable={false}
    style={{
      display: "block",
      width,
      height,
      objectFit: "cover",
      objectPosition: "top left",
      borderRadius: radius,
      boxShadow: shadow,
      border: `1px solid ${SCREEN_EDGE}`,
      transform: rotate === 0 ? undefined : `rotate(${rotate}deg)`,
      background: "#fafafa"
    }}
  />
)

const shot = (name: string) => `/shots/${name}@2x.png`

const Icon = () => (
  <div style={{ display: "grid", placeItems: "center", width: 128, height: 128 }}>
    <Mark size={128} />
  </div>
)

const PromoTile = () => (
  <Bed saturated rotation={18} scale={1.15} style={{ width: 440, height: 280 }}>
    <div
      style={{
        height: "100%",
        boxSizing: "border-box",
        padding: "22px 22px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Mark size={36} color={INK} />
        <Wordmark size={28} color={INK} />
      </div>
      <div
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          overflow: "hidden"
        }}
      >
        <ProductShot
          src={shot("working-set")}
          width={396}
          height={200}
          radius={12}
          shadow={HERO_SHADOW}
        />
      </div>
    </div>
  </Bed>
)

const Marquee = () => (
  <Bed saturated rotation={196} scale={1.35} style={{ width: 1400, height: 560 }}>
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 1.15fr",
        alignItems: "center",
        gap: 48,
        padding: "0 72px 0 88px",
        boxSizing: "border-box"
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Mark size={72} color={INK} />
          <Wordmark size={52} color={INK} />
        </div>
        <p
          style={{
            margin: 0,
            maxWidth: 520,
            fontSize: 32,
            lineHeight: 1.2,
            letterSpacing: "-0.025em",
            fontWeight: 560,
            color: INK
          }}
        >
          GitHub is where your work lives. GitQuiet is where you do it.
        </p>
      </div>
      <div style={{ position: "relative", height: 460 }}>
        <div
          style={{
            position: "absolute",
            right: 24,
            top: 18,
            transform: "rotate(3.5deg)",
            opacity: 0.92
          }}
        >
          <ProductShot
            src={shot("pull-request")}
            width={520}
            height={325}
            radius={16}
            shadow={SCREEN_SHADOW}
          />
        </div>
        <div
          style={{
            position: "absolute",
            right: 72,
            bottom: 8,
            transform: "rotate(-2deg)"
          }}
        >
          <ProductShot
            src={shot("working-set")}
            width={560}
            height={350}
            radius={16}
            shadow={HERO_SHADOW}
          />
        </div>
      </div>
    </div>
  </Bed>
)

const StoreScreenshot = ({
  view,
  caption
}: {
  readonly view: string
  readonly caption: string
}) => (
  <Bed saturated rotation={42 + view.length * 7} scale={1.2} style={{ width: 1280, height: 800 }}>
    <div
      style={{
        height: "100%",
        boxSizing: "border-box",
        padding: "36px 44px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 18
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Mark size={28} color={INK} />
          <Wordmark size={22} color={INK} />
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 18,
            lineHeight: 1.3,
            letterSpacing: "-0.015em",
            color: INK,
            fontWeight: 520,
            textAlign: "right",
            maxWidth: 720
          }}
        >
          {caption}
        </p>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "stretch", minHeight: 0 }}>
        <div style={{ flex: 1, borderRadius: 16, overflow: "hidden", boxShadow: HERO_SHADOW }}>
          <ProductShot
            src={shot(view)}
            width={1192}
            height={668}
            radius={16}
            shadow="none"
          />
        </div>
      </div>
    </div>
  </Bed>
)

const SocialCard = () => (
  <Bed saturated rotation={38} scale={1.25} style={{ width: 1200, height: 630 }}>
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 1.05fr",
        gap: 40,
        padding: "56px 56px 0 64px",
        boxSizing: "border-box"
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Mark size={56} color={INK} />
          <Wordmark size={36} color={INK} />
        </div>
        <p
          style={{
            margin: 0,
            maxWidth: 440,
            fontSize: 60,
            lineHeight: 1.02,
            letterSpacing: "-0.04em",
            fontWeight: 600,
            color: INK
          }}
        >
          A faster, quieter GitHub.
        </p>
        <p
          style={{
            margin: 0,
            maxWidth: 430,
            fontSize: 21,
            lineHeight: 1.45,
            fontWeight: 400,
            color: MUTED
          }}
        >
          GitHub is where your work lives. GitQuiet is where you do it.
        </p>
      </div>
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 0, top: 24, transform: "rotate(-2.5deg)" }}>
          <ProductShot
            src={shot("working-set")}
            width={620}
            height={520}
            radius={18}
            shadow={HERO_SHADOW}
          />
        </div>
      </div>
    </div>
  </Bed>
)

const LISTING_SHOTS = [
  {
    view: "working-set",
    caption: "Every pull request you are in, sorted by next action."
  },
  {
    view: "pull-request",
    caption: "Review one PR as a queue of what is still unresolved."
  },
  {
    view: "issues",
    caption: "Issues in the same four groups: needs you, waiting, running, settled."
  },
  {
    view: "actions",
    caption: "Actions runs grouped by what is still failing."
  },
  {
    view: "repo-home",
    caption: "Repo home with the same attention model."
  },
  {
    view: "commits",
    caption: "Commits without leaving the review flow."
  },
  {
    view: "issue",
    caption: "One issue, opened as a working screen."
  },
  {
    view: "run",
    caption: "A single Actions run, readable at a glance."
  },
  {
    view: "repo-pulls",
    caption: "Pull requests for one repository."
  },
  {
    view: "repo-issues",
    caption: "Issues for one repository."
  },
  {
    view: "commit",
    caption: "One commit, read like a pull request."
  },
  {
    view: "raise",
    caption: "Raise an issue with two fields, not eight."
  }
] as const

const sheet = document.getElementById("sheet")
if (sheet === null) throw new Error("the sheet is missing from assets.html")

createRoot(sheet).render(
  <StrictMode>
    <div style={{ padding: 48, background: PAPER, minHeight: "100vh" }}>
      <Frame name="icon-128" width={128} height={128} note="transparent, 96 of 128 drawn">
        <Icon />
      </Frame>
      <Frame name="promo-tile" width={440} height={280} note="required by the store">
        <PromoTile />
      </Frame>
      <Frame name="marquee" width={1400} height={560} note="needed to be featured">
        <Marquee />
      </Frame>
      <Frame name="social-card" width={1200} height={630} note="og:image for the site">
        <SocialCard />
      </Frame>
      {LISTING_SHOTS.map(({ view, caption }) => (
        <Frame
          key={view}
          name={view}
          width={1280}
          height={800}
          note="store screenshot on the bed"
        >
          <StoreScreenshot view={view} caption={caption} />
        </Frame>
      ))}
    </div>
  </StrictMode>
)
