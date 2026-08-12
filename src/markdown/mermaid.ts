import { Effect } from "effect"
import mermaid from "mermaid"

/**
 * The paperforge palette, as the article preamble declares it.
 *
 * These are the fills themselves, not a tint of them. The first version mixed
 * 35% of `--color-ink` into every pastel so a dark pack would darken the
 * diagram with the rest of the interface, which produced a figure in colours
 * paperforge does not have: pBlue at #75899c, and labels in light ink on it. A
 * paperforge figure is black on a pastel on paper, so the figure carries its
 * own paper with it — see `.markdown-mermaid` in `markdown.css`.
 */
const PASTELS = {
  blue: "#b4d2f0",
  green: "#b4e6c8",
  yellow: "#ffebb4",
  orange: "#ffd2aa",
  purple: "#d2bef0",
  gray: "#dcdce1",
  red: "#f5bebe"
} as const

/** `black!40`, the one border colour every template draws with. */
const EDGE = "#999999"

/** `black!60`, for arrows and connecting lines. */
const ARROW = "#666666"

/** The text colour on every pastel fill. */
const INK = "#000000"

/** The paper a figure is printed on. */
const PAPER = "#ffffff"

export const paperforgeTheme = () => ({
  /*
   * The one thing not taken from the article, which sets its figures in the body
   * serif at \scriptsize. Read at 14px inside a sans interface, that looks like a
   * figure pasted in from somewhere else.
   *
   * Stated here rather than in `markdown.css` because mermaid writes its own
   * stylesheet into the SVG and scopes it by the diagram's id, which no class
   * selector of ours can outweigh. The variable resolves against the root, so a
   * pack that changes the interface font changes the labels with it.
   */
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  primaryColor: PASTELS.blue,
  secondaryColor: PASTELS.green,
  tertiaryColor: PASTELS.yellow,
  primaryTextColor: INK,
  secondaryTextColor: INK,
  tertiaryTextColor: INK,
  primaryBorderColor: EDGE,
  secondaryBorderColor: EDGE,
  tertiaryBorderColor: EDGE,
  lineColor: ARROW,
  textColor: INK,
  mainBkg: PASTELS.blue,
  nodeBorder: EDGE,
  background: PAPER,
  clusterBkg: PASTELS.purple,
  clusterBorder: EDGE,
  titleColor: INK,
  /* Paperforge writes an edge label as plain text over the paper, with white
     casing under it so a crossing line stays crisp. */
  edgeLabelBackground: PAPER,
  noteBkgColor: PASTELS.orange,
  noteTextColor: INK,
  noteBorderColor: EDGE,
  errorBkgColor: PASTELS.red,
  errorTextColor: INK,
  actorBkg: PASTELS.blue,
  actorBorder: EDGE,
  actorTextColor: INK,
  actorLineColor: ARROW,
  signalColor: ARROW,
  signalTextColor: INK,
  labelBoxBkgColor: PASTELS.green,
  labelBoxBorderColor: EDGE,
  labelTextColor: INK
})

let nextId = 0

export const draw = (code: string): Effect.Effect<string | null> =>
  Effect.tryPromise({
    try: () => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: paperforgeTheme(),
        /*
         * Drawn at its own size rather than squeezed into the panel. Mermaid's
         * default fits the diagram to whatever it is put in, and this interface
         * puts it in a column of twenty-six rems: a flowchart of four nodes came
         * out at a third of its size, with labels no reader could read. The
         * figure around it scrolls sideways instead — see `markdown.css`.
         */
        flowchart: { htmlLabels: false, curve: "basis", useMaxWidth: false }
      })
      nextId += 1
      return mermaid.render(`mermaid-${nextId}`, code)
    },
    catch: () => "mermaid-failed" as const
  }).pipe(
    Effect.map((drawn) => (drawn.svg === "" ? null : drawn.svg)),
    Effect.orElseSucceed(() => null)
  )
