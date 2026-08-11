/**
 * Reads the Control Center out of one pull request after another.
 *
 *     ego-browser nodejs < scripts/probe-owed.js
 *
 * Says which Courts the panel drew and what each of their rows reads as. Point
 * `WALK` at the scratch repo's scenarios — `bash scripts/scratch-scenarios.sh`
 * opens one pull request per situation and prints their numbers — or leave it
 * empty to read whatever the tab is already on.
 */

const REPO = "https://github.com/flazouh/ghpro-scratch/pull"

const WALK = [
  [`${REPO}/6`, "since: commits landed after your review"],
  [`${REPO}/7`, "level: you reviewed the newest commit"],
  [`${REPO}/8`, "rewritten: rebased since your review"],
  [`${REPO}/9`, "quiet: nothing owed to anybody"],
  [`${REPO}/10`, "behind: the base has moved on"]
]

const task = await useOrCreateTaskSpace("test gitquiet extension on real PR")
await takeOverTaskSpace(task.id)

/** Opens every folded Court, Settled starting that way and being worth reading here. */
const unfold = async () => {
  await js(String.raw`(() => {
    const root = document.getElementById("gitquiet-root")
    const shadow = root?.shadowRoot ?? root
    const owed = [...(shadow?.querySelectorAll("section") ?? [])].find(
      (one) => one.querySelector("h2")?.textContent === "What is owed"
    )
    for (const head of owed?.querySelectorAll("h3") ?? []) {
      const press = head.querySelector("button")
      if (press?.getAttribute("aria-expanded") === "false") press.click()
    }
    return "done"
  })()`)
  await wait(1)
}

const read = async () =>
  JSON.parse(
    await js(String.raw`(() => {
      const root = document.getElementById("gitquiet-root")
      const shadow = root?.shadowRoot ?? root
      if (root === null) return JSON.stringify({ mounted: false, url: location.pathname })

      const owed = [...shadow.querySelectorAll("section")].find(
        (one) => one.querySelector("h2")?.textContent === "What is owed"
      )
      if (owed === undefined) return JSON.stringify({ mounted: true, panel: false })

      const courts = [...owed.querySelectorAll("h3")].map((head) => {
        const list = head.parentElement?.querySelector("ul")
        return {
          name: head.textContent,
          rows: list === null || list === undefined
            ? "folded"
            : [...list.querySelectorAll("li")].map((row) => row.textContent)
        }
      })

      return JSON.stringify({
        url: location.pathname,
        summary: owed.querySelector("h2")?.parentElement?.textContent ?? null,
        courts: courts.length === 0 ? owed.textContent : courts
      })
    })()`)
  )

if (WALK.length === 0) {
  await unfold()
  cliLog(JSON.stringify(await read(), null, 1))
} else {
  for (const [url, meant] of WALK) {
    await gotoAndWait(url, { timeout: 30, settle: 3 })
    await wait(4)
    await unfold()
    cliLog(`\n### ${meant}\n${JSON.stringify(await read(), null, 1)}`)
  }
}

await handOffTaskSpace(task.id)
