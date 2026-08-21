import { Deferred, Effect, Exit } from "effect"
import mermaid from "mermaid"

/**
 * The paperforge palette, as the article preamble declares it.
 *
 * These are the fills themselves, not a tint of them. An earlier version mixed
 * 35% of `--color-ink` into every pastel so a dark pack would darken the figure
 * with the rest of the interface, which produced colours paperforge does not
 * have: pBlue at #75899c, with labels in light ink on it. A paperforge figure is
 * black on a pastel on paper, so the figure carries its own paper with it — see
 * `.markdown-mermaid` in `markdown.css`.
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

/**
 * How much room a box gives the words in it, and how far apart boxes stand.
 *
 * The palette was only half of the borrowing. A template writes `inner sep=5pt`
 * and `minimum height=0.6cm`, which is seven pixels of padding around a label in
 * a box twenty-three pixels tall; mermaid's own numbers are fifteen pixels of
 * padding for a flowchart node and a fixed box of 150 by 65 for a participant,
 * so the same figure came out with a label adrift in the middle of a button. The
 * numbers below are the template's, rounded to whole pixels.
 *
 * `mirrorActors` is off for the same economy. Mermaid repeats every participant
 * along the bottom, which is a second row of boxes carrying nothing new.
 */
export const paperforgeLayout = () => ({
  flowchart: {
    htmlLabels: false,
    curve: "basis" as const,
    /*
     * Drawn at its own size rather than squeezed into the panel. Mermaid's
     * default fits the diagram to whatever it is put in, and this interface puts
     * it in a column of twenty-six rems: a flowchart of four nodes came out at a
     * third of its size, with labels no reader could read. The figure around it
     * scrolls sideways instead — see `markdown.css`.
     */
    useMaxWidth: false,
    padding: 6,
    nodeSpacing: 30,
    rankSpacing: 26,
    diagramPadding: 4
  },
  sequence: {
    useMaxWidth: false,
    width: 100,
    height: 26,
    actorMargin: 40,
    boxMargin: 8,
    boxTextMargin: 4,
    noteMargin: 8,
    messageMargin: 26,
    diagramMarginX: 8,
    diagramMarginY: 8,
    mirrorActors: false
  }
})

let nextId = 0

/**
 * Diagrams already laid out in this document.
 *
 * Mermaid measures every label and edge through the live DOM. Even a four-node
 * flowchart can hold the main thread for half a second. A screen reopened by Back
 * used to pay that cost again for source that had not changed.
 *
 * The deferred is kept as well as the answer. Two copies of one fence mounted
 * in the same React commit then join one layout instead of starting two layouts.
 */
type Drawing = { readonly id: string; readonly svg: string }

const HOW_MANY = 24
const drawings = new Map<string, Drawing | null>()
const drawing = new Map<string, Deferred.Deferred<Drawing | null, never>>()

const idForNextDrawing = (): string => {
  nextId += 1
  return `mermaid-${nextId}`
}

const layOut = (code: string, id: string): Effect.Effect<Drawing | null> =>
  Effect.tryPromise({
    try: () => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: paperforgeTheme(),
        ...paperforgeLayout()
      })
      return mermaid.render(id, code)
    },
    catch: () => "mermaid-failed" as const
  }).pipe(
    Effect.map((drawn) => (drawn.svg === "" ? null : { id, svg: drawn.svg })),
    Effect.orElseSucceed(() => null)
  )

const finish = (code: string, answer: Drawing | null): void => {
  drawings.set(code, answer)

  const oldest = drawings.keys().next()
  if (drawings.size > HOW_MANY && !oldest.done) drawings.delete(oldest.value)
}

const start = (code: string): Deferred.Deferred<Drawing | null, never> => {
  const asking = Deferred.makeUnsafe<Drawing | null, never>()
  drawing.set(code, asking)

  Effect.runFork(
    Effect.exit(layOut(code, idForNextDrawing())).pipe(
      Effect.map((answer) => {
        drawing.delete(code)
        if (Exit.isSuccess(answer)) finish(code, answer.value)
        Deferred.doneUnsafe(asking, answer)
      })
    )
  )

  return asking
}

const remembered = (code: string): Effect.Effect<Drawing | null> =>
  Effect.suspend(() => {
    const had = drawings.get(code)
    if (had !== undefined) {
      drawings.delete(code)
      drawings.set(code, had)
      return Effect.succeed(had)
    }

    return Deferred.await(drawing.get(code) ?? start(code))
  })

export const draw = (code: string): Effect.Effect<string | null> =>
  Effect.suspend(() => {
    const id = idForNextDrawing()
    return remembered(code).pipe(
      Effect.map((drawing) =>
        drawing === null ? null : drawing.svg.replaceAll(drawing.id, id)
      )
    )
  })
