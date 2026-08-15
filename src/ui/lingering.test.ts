import { describe, expect, test } from "bun:test"
import { AHEAD } from "./linkNear"
import { lingerFor, type Lingering, NOTHING, RIPE, type Seen, STALL } from "./lingering"

/** One frame at sixty a second, which is every tick this ever sees in a browser. */
const FRAME = 16

/**
 * Runs the pointer over a series of frames and reports what ripened.
 *
 * Written as a fold rather than a loop in each test because what is under test is the
 * accumulation across frames, and a test that carried the map by hand would be asserting
 * its shape instead of its behaviour.
 */
const across = (
  frames: ReadonlyArray<Seen<string> | null>,
  elapsed: number = FRAME
): { readonly ripened: ReadonlyArray<string>; readonly lingering: Lingering } => {
  const ripened: Array<string> = []
  let lingering = NOTHING

  for (const seen of frames) {
    const step = lingerFor(lingering, seen, elapsed)
    lingering = step.lingering
    if (step.ripe !== null) ripened.push(step.ripe)
  }

  return { ripened, lingering }
}

/**
 * The same link, held at one distance, for a stretch of time.
 *
 * The page carried is the key itself, so what ripens reads as the name of the link.
 */
const held = (key: string, reach: number, millis: number): ReadonlyArray<Seen<string>> =>
  Array.from({ length: Math.round(millis / FRAME) }, () => ({ key, reach, page: key }))

describe("how long the pointer has lingered", () => {
  test("ripens a link the pointer rests on, after the dwell", () => {
    expect(across(held("one", 0, RIPE - FRAME)).ripened).toEqual([])
    expect(across(held("one", 0, RIPE + FRAME)).ripened).toEqual(["one"])
  })

  /*
   * The whole of what the accumulator is for. A pointer that spent eighty milliseconds
   * closing on a link has already told us where it is going, and charging it the full
   * dwell again on arrival throws that away.
   */
  test("counts the time spent approaching, so arriving is already part-way there", () => {
    const approach = [...held("one", AHEAD, 80), ...held("one", AHEAD / 2, 80)]
    const { ripened } = across([...approach, ...held("one", 0, RIPE - FRAME)])

    expect(ripened).toEqual(["one"])
  })

  test("never ripens a link the pointer only sweeps across", () => {
    const sweep = ["one", "two", "three", "four", "five", "six"].flatMap((key) =>
      held(key, 0, FRAME * 2)
    )

    expect(across(sweep).ripened).toEqual([])
  })

  /*
   * A hand resting on a row drifts a few pixels and crosses onto the row beside it and
   * back. The old timer reset on every one of those, so the reader most certain about
   * where they were going was the one least likely to be read ahead for.
   */
  test("keeps what a link has earned when the pointer strays and comes back", () => {
    const wobble = [...held("one", 0, 96), ...held("two", 0, FRAME), ...held("one", 0, 96)]

    expect(across(wobble).ripened).toEqual(["one"])
    // And the same frames are not enough for a link starting from nothing, which is the
    // difference the carried credit makes rather than the length of the wobble.
    expect(across([...held("two", 0, FRAME), ...held("one", 0, 96)]).ripened).toEqual([])
  })

  test("gives up on a link the pointer has left for good", () => {
    const away = [...held("one", 0, 96), ...held("two", 0, 160)]

    expect(across(away).lingering.has("one")).toBe(false)
  })

  /*
   * A tab woken after a minute hands the first frame the whole minute. Charging that to
   * whatever the pointer happens to be over reads a page nobody asked for, so a gap
   * longer than a stutter is worth no more than a stutter.
   */
  test("treats a long gap between frames as one frame", () => {
    const seen: Seen<string> = { key: "one", reach: 0, page: "one" }

    expect(across([seen], 60_000).ripened).toEqual([])
    expect(lingerFor(NOTHING, seen, 60_000).lingering.get("one")).toBe(STALL)
  })

  /*
   * The caller stops offering a link the moment it ripens, because reading a page twice
   * is the thing the whole table of `asked` keys exists to prevent. So this drops what it
   * earned rather than holding a number nobody will ask about again.
   */
  test("lets go of a link once it has ripened", () => {
    const { ripened, lingering } = across(held("one", 0, RIPE + FRAME))

    expect(ripened).toEqual(["one"])
    expect(lingering.has("one")).toBe(false)
  })

  test("earns nothing at all while the pointer is near no link", () => {
    expect(across([null, null, null]).lingering.size).toBe(0)
  })
})
