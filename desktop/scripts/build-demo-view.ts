/**
 * The demo's own page, made out of the real one.
 *
 * Demo mode runs against invented data in the main process, but it opens the
 * same window on the same origin, reading the same `localStorage`. The first run
 * came up saying "Nothing matches that": the author filter left on the real list
 * excluded every invented row. It goes wrong in the other direction too — a
 * filter typed on camera, or a card cached for a pull request that does not
 * exist, would be written into the reader's own session.
 *
 * So the demo gets a `localStorage` of its own, in memory, that dies with the
 * window. It has to be installed in the head: the scheme script below it reads
 * storage before any module is loaded, and a sandbox installed after the first
 * read is not a sandbox.
 *
 * A second page rather than a flag on the address, which was the first attempt:
 * Electrobun's scheme handler resolves `views://main/index.html` to a file and
 * answers nothing at all for that name with `?demo=1` or `#demo` after it.
 *
 * Generated rather than written, so `index.html` stays the only page anybody
 * edits and the demo cannot quietly fall a year behind it.
 */

/*
 * The methods are hidden from enumeration on purpose: the first version answered
 * `Object.keys(localStorage)` with `getItem`, `setItem` and the rest of itself,
 * which is six things nobody kept. What is kept lives in a Map beside the object
 * rather than on it, so enumeration answers with nothing instead — a difference
 * from the real thing that only a caller walking the keys would see, and there is
 * no such caller.
 */
const SANDBOX = `    <!-- Written by scripts/build-demo-view.ts. Edit index.html instead. -->
    <script>
      const held = new Map()
      const of = (key) => String(key)
      const sandbox = {}
      const hidden = (name, value) =>
        Object.defineProperty(sandbox, name, { value, enumerable: false })

      hidden("getItem", (key) => (held.has(of(key)) ? held.get(of(key)) : null))
      hidden("setItem", (key, value) => void held.set(of(key), String(value)))
      hidden("removeItem", (key) => void held.delete(of(key)))
      hidden("clear", () => held.clear())
      hidden("key", (at) => Array.from(held.keys())[at] ?? null)
      Object.defineProperty(sandbox, "length", {
        enumerable: false,
        get: () => held.size
      })

      Object.defineProperty(window, "localStorage", { configurable: true, value: sandbox })
    </script>
`

const here = new URL("../src/view/", import.meta.url)
const page = await Bun.file(new URL("index.html", here)).text()

const head = page.indexOf("<head>")
if (head === -1) throw new Error("index.html has no <head> to put the sandbox in.")

const at = head + "<head>".length
const demo = `${page.slice(0, at)}\n${SANDBOX}${page.slice(at)}`

await Bun.write(new URL("demo.html", here), demo)
console.log("built src/view/demo.html")
