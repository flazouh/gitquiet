import { describe, expect, test } from "bun:test"

const sheet = await Bun.file(new URL("./stack.css", import.meta.url)).text()

/** The rules a chain nobody has made reaches, and no other drawing of a stack does. */
const linking = (() => {
  const opens = sheet.indexOf(".t-stack-linking")
  const shuts = sheet.indexOf("@media (prefers-reduced-motion: reduce)")
  expect(opens).toBeGreaterThan(-1)
  expect(shuts).toBeGreaterThan(opens)
  return sheet.slice(opens, shuts)
})()

/** What the same file promises a reader who has asked their machine for less movement. */
const stillness = sheet.slice(sheet.indexOf("@media (prefers-reduced-motion: reduce)"))

/** Every rule of the linking that starts an animation, by the selector that carries it. */
const animated = [...linking.matchAll(/(\.t-stack-linking[^{]*)\{([^}]*)\}/g)]
  .filter((rule) => (rule[2] ?? "").includes("animation:"))
  .map((rule) => (rule[1] ?? "").trim().replace(/\s+/g, " "))

/**
 * The one animated stack in the interface, read as text rather than through a browser.
 *
 * There is no browser here, and the things worth protecting are decisions rather than computed
 * styles. `motion.test.ts` guards the sheet next door the same way and for the same reason: a
 * rule that quietly takes the wrong property, or one added later that nobody remembered to
 * answer under `prefers-reduced-motion`, is cheap to catch here and expensive to notice by eye.
 */
describe("a chain that does not exist yet, linking up", () => {
  test("moves its layers with the two properties that cost no layout", () => {
    // The rows sit in a grid whose gutter and tier are drawn in `margin-left`, three pixels above
    // a pull request header. Animating any of that would relayout the header on every frame of an
    // entrance, and the step is exactly as legible taken in a transform.
    expect(linking).not.toMatch(/\n\s*(margin|padding|inset|left|top|right|bottom|width|height)[\w-]*:/)
  })

  test("writes its arm with `scale`, which composes with the pixel it is nudged by", () => {
    // The mark is placed a pixel below the middle of its row, because a corner arrow turning up
    // and to the left sits high in its own viewBox. `transform` in a keyframe would replace that
    // placement rather than compose with it, and every arrow in the chain would read high while
    // it was arriving.
    expect(linking).toMatch(/@keyframes t-stack-arm \{[^]*?scale:/)
    expect(linking).not.toMatch(/@keyframes t-stack-arm \{[^]*?transform:/)
    expect(sheet).toMatch(/\.t-stack-up > li > \.t-stack-mark \{[^}]*translate: 0 1px/)
  })

  test("names every duration and curve rather than writing one out", () => {
    // Two copies of a number are two chances to be inconsistent. `motion.css` is where a
    // millisecond is chosen; this file spends what is chosen there.
    expect(linking).not.toMatch(/animation[^;]*\d+ms/)
    expect(linking).not.toMatch(/animation[^;]*cubic-bezier/)
  })

  test("stops the stagger climbing, so the deepest chain still lands inside the run", () => {
    // `--stack-tier` climbs as far as the window draws, and a beat per tier taken literally puts
    // the top of a five layer chain past half a second. The step goes on climbing; the turn does
    // not. `t-row-in` caps its own the same way.
    const beats = [...linking.matchAll(/animation-delay:([^;]*);/g)].map(([, said]) => said)

    expect(beats).not.toHaveLength(0)
    for (const beat of beats) expect(beat).toMatch(/min\(var\(--stack-tier, 0\), \d+\)/)
  })

  test("stands still for a reader who asked for less movement", () => {
    // The assembling is this strip's argument, so it has more to lose here than anything else in
    // the interface — and a reader who has asked for no travel is owed the finished chain rather
    // than the argument. Every rule that starts something has to be answered, including the next
    // one somebody adds.
    expect(animated).not.toHaveLength(0)
    for (const selector of animated) {
      expect(stillness.replace(/\s+/g, " ")).toContain(selector)
    }
    expect(stillness).toMatch(/animation: none/)
  })
})
