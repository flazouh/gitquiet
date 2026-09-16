/**
 * The one element of ours in their document, and the shadow root everything stands in.
 *
 * Every screen, the bar, the overlays: all of it is drawn inside a shadow root
 * hanging off a single `div` that is a child of `body`. Two things follow from
 * that, and they are the whole reason for this file.
 *
 * **Their stylesheets stop reaching us.** Seventy-one of them on a pull request,
 * sixty-odd of those carrying `:has()` rules whose subject is `body` or `main`.
 * In their document, one element appended into our tree cost 9.485ms of style
 * recalculation because Chrome re-matched it against all of that. Inside a shadow
 * root it is 5.105ms, and with their sheets disabled as well it is 0.022ms.
 * `docs/plan/restyle-scope.md` has the table and how it was taken.
 *
 * **We stop reading their markup.** Standing in their layout meant naming the
 * region to stand in and the regions to hide — `[class*="PullRequestHeader"]`,
 * hashed per deploy, rotting silently — and then an audit that guessed when the
 * naming had rotted. A host of our own needs none of it: one rule hides every
 * top-level box that is not this one, and it names nothing of theirs.
 *
 * The shadow root is open. Nothing here depends on it being closed, and a closed
 * one would put our own tree out of reach of the probes that photograph it.
 */
import { Effect } from "effect"
import { OUTSIDE } from "./mount"

export const HOST_ID = "gitquiet-host"

/**
 * The stylesheet every shadow root of ours adopts, constructed once.
 *
 * Constructed rather than a `<link>`: a link inside a shadow root is fetched per
 * root and blocks that root's first paint, and the same sheet object adopted into
 * many roots is parsed once for all of them. Ours is ninety kilobytes and seven
 * hundred and sixty-nine rules, and it is not what makes a keystroke expensive —
 * measured at 0.036ms a mutation with their sheets off, against 9.485ms with them
 * on. See `docs/plan/restyle-scope.md`.
 */
let sheet: CSSStyleSheet | null = null

/**
 * `:root` is the document's element and a shadow root has none.
 *
 * Our custom properties are declared on `:root`, which inside a shadow tree
 * matches nothing at all — every colour would fall back and the interface would
 * paint unstyled. `:host` is the same declaration in the place a shadow root can
 * see it. Done on the text once, when the sheet is built, rather than in the
 * source: the same stylesheet is still served to the screens that run as their own
 * documents, where `:root` is right.
 */
const forAShadowRoot = (css: string): string => css.replace(/:root\b/g, ":host")

/**
 * The sheet, built from the stylesheet the build already publishes.
 *
 * Read once and kept: the second screen a reader opens finds it built. Two asks
 * that race both fetch, which costs one extra read of a file the browser already
 * has from the extension's own origin, and the later one wins harmlessly.
 */
export const theSheet = (href: string): Effect.Effect<CSSStyleSheet, unknown> =>
  Effect.gen(function* () {
    if (sheet !== null) return sheet

    const said = yield* Effect.tryPromise({ try: () => fetch(href), catch: (cause) => cause })
    const css = yield* Effect.tryPromise({ try: () => said.text(), catch: (cause) => cause })

    const built = new CSSStyleSheet()
    built.replaceSync(forAShadowRoot(css))
    sheet = built
    return built
  })

/** The sheet if it has already been built, for a caller that cannot wait. */
export const theSheetIfReady = (): CSSStyleSheet | null => sheet

/**
 * The host and its shadow root, made once and found thereafter.
 *
 * Marked {@link OUTSIDE} because it is furniture of ours living in `body`, which
 * is what that mark is for — and because the gate rule reads it rather than the
 * id, so anything else of ours that has to sit in their document is covered by
 * the same word.
 */
/**
 * The host this document has had, whether or not it is still in the page.
 *
 * Kept because the host is a child of `body`, and `body`'s children are not ours:
 * GitHub replaces them wholesale on a soft navigation, and a test does the same
 * when it stands a fresh page. Looking the host up by id and building a new one
 * when the lookup fails is the obvious thing and it is wrong — a new host is a
 * new shadow root, a new stage, a new bar slot, and every React portal still
 * pointing into the old one. Measured on the resumption test: eight hosts built
 * in one file, the bar portalled into the shadow root of the second and asserted
 * against the eighth, which is a bar the reader would simply not have.
 *
 * So the host is remembered and put back. The shadow root survives with it, and
 * with the shadow root everything standing in it.
 */
const hosts = new WeakMap<Document, HTMLElement>()

export const theHost = (target: Document): { host: HTMLElement; shadow: ShadowRoot } => {
  const had = target.getElementById(HOST_ID) ?? hosts.get(target) ?? null
  const host = had ?? target.createElement("div")
  if (had === null) {
    host.id = HOST_ID
    host.setAttribute(OUTSIDE, "")
    hosts.set(target, host)
  }

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" })
  if (sheet !== null && !shadow.adoptedStyleSheets.includes(sheet)) {
    shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet]
  }

  /*
   * Wherever there is to put it, and moved into `body` once there is one.
   *
   * This runs at `document_start`, where the parser has produced the root element
   * and nothing else: `document.body` is null, and reaching for `.append` on it
   * throws out of the first render — the whole interface gone, on a page the gate
   * rule has already emptied. Measured exactly that way on the first run of this:
   * every box of theirs hidden and no host to put ours in, which is a blank page.
   *
   * `documentElement` holds it in the meantime. The host is found again on every
   * ask, so the first ask after the parser reaches `<body>` puts it where it
   * belongs, and the shadow root and everything standing in it come along with it.
   */
  const where = target.body ?? target.documentElement
  if (host.parentNode !== where) where.append(host)

  return { host, shadow }
}

export const STAGE_ID = "gitquiet-stage"

/**
 * The element every screen stands on, inside the shadow root.
 *
 * An element rather than the shadow root itself, and only because of what asks:
 * the standing code reads `parentElement`, appends siblings and sweeps for what
 * is leaving, and a `ShadowRoot` is a `DocumentFragment` with no parent and no
 * `closest`. One `div` under the boundary keeps every one of those working
 * unchanged, and moves nothing but where they are looked for.
 */
export const theStage = (target: Document): HTMLElement => {
  const { shadow } = theHost(target)
  const had = shadow.getElementById(STAGE_ID)
  if (had !== null) return had

  const stage = target.createElement("div")
  stage.id = STAGE_ID
  shadow.append(stage)
  return stage
}

/**
 * Where anything of ours is looked for, which is no longer their document.
 *
 * Nothing is made by asking. A lookup that stood the host up would put an empty
 * host on every page this extension merely passes through, and the gate rule
 * would then hide a page we are not drawing.
 */
export const ourTree = (target: Document): ShadowRoot | null =>
  target.getElementById(HOST_ID)?.shadowRoot ?? null

/** Puts the sheet into a root that was made before it had been built. */
export const dressShadow = (shadow: ShadowRoot, built: CSSStyleSheet): void => {
  if (shadow.adoptedStyleSheets.includes(built)) return
  shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, built]
}

/**
 * Their stylesheets, off while we own the page and back on when we hand it over.
 *
 * The measured share of the cost: 9.485ms a mutation with them on, 0.036ms with
 * them off, in the same place with nothing else changed. They are dead weight
 * while every box they style is hidden, and `disabled` is one property and
 * reversible, so nothing of theirs is destroyed by this.
 *
 * Ours are left alone by their href: the extension serves them from its own
 * origin, and nothing of GitHub's is published from there.
 */
export const theirStyles = (target: Document, on: boolean): number => {
  let touched = 0
  for (const sheet of target.styleSheets) {
    const owner = sheet.ownerNode
    if (owner instanceof Element && owner.hasAttribute(OUTSIDE)) continue
    if ((sheet.href ?? "").startsWith("chrome-extension://")) continue

    // `disabled` is readable and writable on a cross-origin sheet; it is
    // `cssRules` that refuses, and nothing here asks for those.
    if (sheet.disabled === !on) continue
    sheet.disabled = !on
    touched += 1
  }
  return touched
}

/** Watching for the sheets that arrive after the page has been taken. */
let watching: MutationObserver | null = null

/**
 * Their sheets off, and kept off as more of them arrive.
 *
 * Turning them off once is not enough and the number says how far off: at
 * `document_start`, when a page is claimed, GitHub has published a handful of its
 * stylesheets and adds the rest as it hydrates — measured at forty-nine off and
 * twenty-two still on by the time a pull request had drawn, which left a mutation
 * costing 4.822ms instead of 0.022ms. The ones that arrive late are the ones that
 * carry the `:has()` rules.
 *
 * So the head is watched for as long as we hold the page. The observer is cheap —
 * it wakes on added nodes and does nothing unless a sheet came with them — and it
 * is disconnected the moment the page is handed back, which is also when every
 * sheet is put back on.
 */
export const keepTheirStylesOff = (target: Document): void => {
  theirStyles(target, false)
  if (watching !== null) return

  watching = new MutationObserver(() => void theirStyles(target, false))
  watching.observe(target.documentElement, { childList: true, subtree: true })
}

/** Their sheets back on, and the watch let go. */
export const letTheirStylesBack = (target: Document): void => {
  watching?.disconnect()
  watching = null
  theirStyles(target, true)
}
