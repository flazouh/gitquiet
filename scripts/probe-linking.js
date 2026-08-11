/**
 * Reads the linking on a pull request GitHub offers to stack, frame by frame.
 *
 *     ego-browser nodejs < scripts/probe-linking.js
 *
 * The strip's rows arrive unlinked and step in, one layer after the next. That
 * runs once in under half a second, so a screenshot of a live page catches
 * whichever frame it happens to catch. This seeks every animation in the strip
 * to a chosen time and shoots there, which is how the travel is measured rather
 * than watched: the row's own step is 16px right and one row down, and at 120ms
 * the layer above the trunk has taken it while the one above that has not.
 *
 * Both axes are read, because the step the layers take is diagonal — a probe
 * that only reported `left` said nothing about the half of the travel that
 * carries a layer down onto the one it sits on. The arm is read beside its row
 * for the same reason: it is the mark that says the two are linked, so when it
 * lands relative to its row is the whole of whether the run reads as linking.
 *
 * The run is restarted by hand before it is read. The strip's animations fill
 * backwards and not forwards — they hand every property back the moment they
 * land — so a browser is entitled to drop them once they have finished, and it
 * does. Taking `t-stack-linking` off the chain and putting it back is the same
 * arrival the strip has when it first appears, with the animations there to be
 * seeked, and it is the only way this measures the run rather than its wreckage.
 *
 * The last pass asks the browser for `prefers-reduced-motion: reduce` and counts
 * what that same restart creates. That number has to be zero, with every row
 * already in its seat, which is the promise at the foot of `stack.css`.
 */

/** `probe-w2 -> probe-w1 -> main`, which GitHub has not stacked. */
const PR = "https://github.com/flazouh/stack-probe/pull/16"

/** Where in the run to look, in milliseconds from the first row starting. */
const FRAMES = [0, 60, 120, 160, 200, 240, 300, 400, 500]

const { writeFileSync } = await import("node:fs")

/**
 * A task space named for this probe and nothing else.
 *
 * Not `ego-space`'s own pointer, which was tried and is wrong here: that file
 * holds one `latest` for the whole machine, so a second agent asking for a space
 * of its own moves it, and this script then drives a browser somebody else is
 * using. Not the strip's space either — that one had been handed to a reader,
 * and a space under a reader's control is a hard stop rather than a slow start.
 * A name only this file says reuses its own and cannot reach anybody else's.
 */
await useOrCreateTaskSpace("githubpro · linking probe")
// Loaded rather than reused, every run. A content script is only exchanged for
// the one `bun run reload` just built when the page it stands on is read again,
// and a probe that reuses the tab it left open measures the build before last.
await gotoAndWait(PR, { timeout: 45, settle: 3 })
await wait(3)

// A task space's tab is hidden, and a hidden document's timeline does not
// advance — every animation sits at time 0 until something asks for a frame.
// That is what makes seeking possible at all, and it is also why this shoots
// once before measuring anything.
await captureScreenshot()

const within = `(document.getElementById("gitquiet-root").shadowRoot ?? document.getElementById("gitquiet-root"))`
const strip = `${within}.querySelector('section[aria-label="Proposed stack"]')`

/** What each row of the strip is called, cut down to the one word that names it. */
const named = `((row) => (row.textContent.match(/#\\d+/) ?? [row.textContent.trim()])[0])`

const box = JSON.parse(
  await js(`(() => {
    const at = ${strip}.getBoundingClientRect()
    return JSON.stringify({
      x: Math.round(at.left) - 8,
      y: Math.round(at.top) - 8,
      width: Math.round(at.width) + 16,
      height: Math.round(at.height) + 16
    })
  })()`)
)

/**
 * The chain arriving again, and how many animations that arrival made.
 *
 * The reflow between the two class changes is what makes it an arrival rather
 * than nothing at all: without it the browser never sees the class leave.
 */
const restart = async () =>
  js(`(() => {
    const chain = ${strip}.querySelector("ol")
    chain.classList.remove("t-stack-linking")
    void chain.offsetWidth
    chain.classList.add("t-stack-linking")
    return chain.getAnimations({ subtree: true }).length
  })()`)

/** Where every row and every arm stands, once the strip is seeked to `at`. */
const readAt = async (at) =>
  JSON.parse(
    await js(`(() => {
    const rows = [...${strip}.querySelectorAll("li")]
    for (const one of ${strip}.getAnimations({ subtree: true })) {
      one.pause()
      one.currentTime = ${at}
    }
    // The top of the first row, so the vertical travel reads as a distance from
    // the head of the chain rather than as a viewport offset nobody can check.
    const head = rows[0].getBoundingClientRect().top
    return JSON.stringify(rows.map((row) => {
      const seat = row.getBoundingClientRect()
      const arm = row.querySelector(".t-stack-mark")
      const drawn = arm === null ? null : getComputedStyle(arm)
      return {
        said: ${named}(row),
        left: Math.round(seat.left),
        down: Math.round(seat.top - head),
        opacity: Number(getComputedStyle(row).opacity).toFixed(2),
        // How far the mark is written, which is its scale about its own top left
        // corner — the whole of what says a joint is closed rather than closing.
        arm: drawn === null ? null : Number(drawn.scale === "none" ? 1 : drawn.scale).toFixed(2)
      }
    }))
  })()`)
  )

const said = (row) =>
  `${row.said} left ${String(row.left).padStart(3)} down ${String(row.down).padStart(3)} opacity ${row.opacity}${row.arm === null ? "" : ` arm ${row.arm}`}`

cliLog(`${await restart()} animations in the chain`)

for (const at of FRAMES) {
  const rows = await readAt(at)

  const shot = await cdp("Page.captureScreenshot", { format: "png", clip: { ...box, scale: 2 } })
  const where = `/tmp/linking-${at}.png`
  writeFileSync(where, Buffer.from(shot.data, "base64"))
  cliLog(`${String(at).padStart(4)}ms  ${rows.map(said).join(" | ")}`)
}

// What a reader who asked their machine for less movement gets: no animations at
// all, and the chain already linked. Emulated rather than assumed, because the
// rules that answer the preference live in a media block nothing else here reads.
await cdp("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }]
})
await gotoAndWait(PR, { timeout: 45, settle: 3 })
await wait(3)
await captureScreenshot()

const still = await restart()
const settled = await readAt(0)
const shot = await cdp("Page.captureScreenshot", { format: "png", clip: { ...box, scale: 2 } })
writeFileSync("/tmp/linking-reduced.png", Buffer.from(shot.data, "base64"))
cliLog(`reduce  ${still} animations  ${settled.map(said).join(" | ")}`)

await cdp("Emulation.setEmulatedMedia", { features: [] })
