/**
 * The rows a QA pass keeps leaving open, checked on real pages.
 *
 * Not one feature: the handful of scenarios that are cheap to reach and easy to
 * skip, gathered so they are run rather than reasoned about. Each answers `ok`,
 * `open` or a problem, and nothing here reports silence as success.
 *
 *     bun run build && bun scripts/probe-qa-rows.ts
 */
import { PANES, withExtension } from "./chrome"

const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`
const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

type Row = { readonly row: string; readonly says: string }
const rows: Array<Row> = []
const note = (row: string, says: string) => {
  rows.push({ row, says })
  console.log(`${says.startsWith("FAIL") ? "FAIL" : says.startsWith("open") ? "open" : "ok  "}  ${row}: ${says}`)
}

const session = await withExtension("https://github.com/flazouh/gitquiet/issues", EXTENSION)

/** What the interface has drawn, as text, once it has drawn anything. */
const drawn = async (within = 25_000): Promise<string> => {
  for (let waited = 0; waited < within; waited += 500) {
    const text = await session.evaluate<string>(`
      (() => {
        const root = document.getElementById("gitquiet-host");
        const inner = root && root.shadowRoot;
        return inner ? (inner.textContent || "") : "";
      })()
    `)
    if (text.length > 40) return text
    await sleep(500)
  }
  return ""
}

const screenFor = () =>
  session.evaluate<string | null>(`
    (() => {
      const root = document.getElementById("gitquiet-host");
      const inner = root && root.shadowRoot && root.shadowRoot.querySelector("#gitquiet-root");
      return inner ? inner.getAttribute("data-gitquiet-for") : null;
    })()
  `)

try {
  // E6 — the issues list draws at all, which is the whole of the row.
  const issues = await drawn()
  const onIssues = await screenFor()
  note(
    "issues list",
    issues.length === 0
      ? "FAIL drew nothing within 25s"
      : `drew the ${onIssues ?? "?"} screen, ${issues.length} characters`
  )

  // E4 — a filter that narrows, typed into the box the screen offers.
  const box = await session.evaluate<boolean>(`
    (() => {
      ${PANES}
      const root = document.getElementById("gitquiet-host");
      const found = root && root.shadowRoot ? root.shadowRoot.querySelector("input") : null;
      if (!found) return false;
      found.focus();
      return true;
    })()
  `)
  if (!box) note("a filter that narrows", "open  no filter box on this screen")
  else {
    await session.tab.send("Input.insertText", { text: "is:closed" })
    await sleep(4000)
    const after = await drawn(8000)
    note(
      "a filter that narrows",
      after.includes("is:closed") ? "the box holds the terms and the list redrew" : "FAIL the terms did not reach the box"
    )

    // E5 — a filter nothing can match says so, rather than drawing an empty frame.
    await session.evaluate(`
      (() => {
        const root = document.getElementById("gitquiet-host");
        const input = root.shadowRoot.querySelector("input");
        input.focus();
        input.select();
      })()
    `)
    await session.tab.send("Input.insertText", { text: "zzzznothingmatchesthis" })
    await sleep(5000)
    const empty = await drawn(8000)
    note(
      "a filter matching nothing",
      /nothing|no issues|none|0 issues/i.test(empty) ? "says so in words" : "open  could not tell an empty state from a slow one"
    )
  }

  console.log(JSON.stringify({ rows, problems: session.problems().slice(0, 3) }, null, 1))
} finally {
  session.stop()
}
