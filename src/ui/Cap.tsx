import type { Chord } from "../keys/commands"
import { useArt } from "./art"

/** `Escape` is what the browser calls it and `Esc` is what a key cap says. */
const capOf = (key: string): string => (key === "Escape" ? "Esc" : key)

/**
 * The modifiers, written as the keys they are.
 *
 * The symbols rather than the words, because they are what is printed on the key the
 * reader is about to hold down. `⌘` is the only one the tables ask for today; the rest
 * are here because a chord that gains a `⇧` should not need this file reopened.
 */
const MODIFIERS = ["⌘", "⇧", "⌥", "⌃"] as const

const MOD = "⌘"

/**
 * The presses a chord is, which is one for a letter and two for a sequence.
 *
 * `g d` is a key and then another key, and a single cap with a space in the
 * middle of it reads as a key with a space on it. Split here rather than at every
 * call site, because the table is the one place a sequence is written and the
 * space in it is already how a reader says it out loud.
 */
const pressesIn = (chord: Chord): ReadonlyArray<string> =>
  chord.split(" ").filter((press) => press.length > 0)

/**
 * The keys held down together in one press, which is what a group is.
 *
 * `⌘K` is two keys and one press: a thumb on one, a finger on the other, at the same
 * moment. Written as a single cap it was a cap with two things on it — a glyph the
 * height of the box beside a letter that had to shrink to fit next to it — and it read
 * as one key with a picture on it rather than as the two keys a hand actually does.
 *
 * A group says the true thing and costs nothing: the same caps as everywhere else, set
 * closer together than the gap between presses. Which is the whole grammar of this
 * component — tight means together, loose means then — and it is why the parsing lives
 * here rather than at the six call sites that write a chord.
 */
const keysIn = (press: string): ReadonlyArray<string> => {
  const held: Array<string> = []
  let rest = press

  while (rest.length > 0 && MODIFIERS.some((mod) => rest.startsWith(mod))) {
    const mod = MODIFIERS.find((one) => rest.startsWith(one)) ?? ""
    held.push(mod)
    rest = rest.slice(mod.length)
  }

  return rest.length > 0 ? [...held, capOf(rest)] : held
}

/**
 * A key, drawn as one — and drawn without an edge.
 *
 * On a button as well as in the sheet: a shortcut nobody is told about is a
 * shortcut nobody uses, and the moment to learn that `s` moves on is while
 * reaching for the button that does it. The cap is quiet enough to skip and close
 * enough to read, so the button still says what it does first.
 *
 * Borderless because that is the paradigm both shells already spend a file
 * enforcing: `src/ui/quiet.css` takes the borders off our cards, fields, menus
 * and rows on GitHub's page, and `desktop/src/view/style.css` does the same in the
 * window. Neither knew about this component, so the one control small enough to be
 * mistaken for a typo kept its outline in both. A component that starts borderless
 * is a component no override file has to hear about, which is the direction this
 * should keep going: separation by fill, corner and space, never by a line.
 *
 * What replaces the edge is the tint the packs already use for a control, so this
 * follows the reader into every appearance without naming a colour.
 *
 * The corner is four pixels flat rather than a radius token, which is the one place
 * this file spends a value. The two shells disagree about what the small one means —
 * three pixels on GitHub's page, six in the window — and a cap is eighteen pixels
 * tall, where six is halfway to a circle and reads as a dot with a letter in it. The
 * shape has to be the same key in both, so it is stated once.
 *
 * `onEmphasis` for a cap sitting on a filled button, where a tint of the ink would
 * disappear into the fill: a darkening of what is underneath reads as an inset key
 * on any colour.
 */
export const Cap = ({
  chord,
  tone = "plain"
}: {
  readonly chord: Chord
  readonly tone?: "plain" | "onEmphasis"
}) => {
  const art = useArt()
  const Mod = art.command
  const presses = pressesIn(chord)

  return (
    /*
     * The outer `kbd` is the chord, the ones inside it are its presses, and inside
     * a press are the keys held together — which is how HTML says both a sequence
     * and a combination. It carries no dress of its own: caps with a gap between
     * them, or one cap and no gap to show.
     *
     * The gap is the grammar. Six pixels between presses and two between the keys
     * of one press, so `g d` reads as a key and then a key while `⌘K` reads as one
     * reach of one hand, without a word or a plus sign to say which.
     *
     * Except that saying nothing is not the same as having nothing said for you.
     * This interface is a guest on GitHub's page, and Primer dresses the `kbd`
     * element itself — a fill, a one pixel border, a six pixel corner and an
     * inset shadow under the bottom edge. A cap that only sets what it wants
     * inherits the rest of that, and a `kbd` holding a `kbd` inherits it twice:
     * the box around the box, with a rim under each, that this looked like on a
     * pull request while looking right in the window.
     *
     * So both elements state the whole of their dress, including the parts that are
     * nothing: no border, no shadow, no padding on the chord and a fill named even
     * where it is transparent. A class beats an element selector, so saying it is
     * enough — the fault was never that our rule lost, it was that on four
     * properties we had no rule at all and their base sheet was unopposed.
     *
     * Measured on a pull request page with the extension's own stylesheet: strip
     * these four and the cap comes back wearing `rgb(38, 44, 54)`, a one pixel
     * border, a six pixel corner and `3px 5px` of their padding.
     *
     * Worth carrying in the window too, where nothing is reaching in: a component
     * that cannot be dressed from outside is the borderless paradigm actually held,
     * rather than a file of overrides chasing whoever we are a guest of this month.
     */
    <kbd className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 shadow-none">
      {presses.map((press, at) => {
        const keys = keysIn(press)
        // A press of one key is that key. The group only exists where there is
        // something to group, so a lone `s` is not a wrapper around a wrapper.
        const cap = (key: string, which: number) => (
          <kbd
            // The position, because a chord may press the same key twice.
            key={`${key}-${which}`}
            // Eighteen square before the padding, so `m` and `Esc` down a sheet are
            // a column of one shape rather than a ragged row of two.
            //
            // `pb-px` because centring the line box is not centring the letter: the
            // mono face keeps room under the baseline for a `y` that a `c` never
            // uses, so a lowercase glyph lands a pixel low in a box this small. The
            // padding takes that pixel back off the bottom.
            className={`inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-[4px] border-0 px-1 pt-0 pb-px font-mono text-[0.6875rem] leading-none shadow-none ${
              tone === "onEmphasis" ? "bg-black/20 text-ink-on-emphasis" : "bg-hover text-ink-muted"
            }`}
          >
            {key === MOD ? <Mod size={11} className="shrink-0" /> : key}
          </kbd>
        )

        if (keys.length === 1 && keys[0] !== undefined) return cap(keys[0], at)

        return (
          // The group: keys held at the same moment, set closer to each other than
          // to the press beside them. `kbd` inside `kbd` is how HTML says a
          // combination, and the gap is how a reader sees one.
          <kbd
            key={`${press}-${at}`}
            className="inline-flex items-center gap-0.5 border-0 bg-transparent p-0 shadow-none"
          >
            {keys.map(cap)}
          </kbd>
        )
      })}
    </kbd>
  )
}
