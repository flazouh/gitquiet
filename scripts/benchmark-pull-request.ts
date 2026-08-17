#!/usr/bin/env bun
/**
 * Measures what GitHub's own pull request page costs to open, and what the same
 * pull request costs as data.
 *
 * The numbers in README.md were taken once, by hand, from a live session. A
 * claim nobody can re-take is a claim that quietly rots: GitHub ships changes
 * weekly, and anyone who repeats the measurement and gets a different answer is
 * right and we are not. This runs the measurement instead of remembering it.
 *
 * Every visit is a cold, signed-out one in a throwaway profile, which is the
 * only version a reader can reproduce. Set GITHUB_SESSION_COOKIE to also see
 * what a signed-in participant waits for, which is longer.
 *
 *   bun scripts/benchmark-pull-request.ts
 *   bun scripts/benchmark-pull-request.ts --pull facebook/react/pull/34567 --runs 5
 */

import { connect, findChrome } from "./chrome"

const argument = (name: string, fallback: string): string => {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? fallback : (process.argv[at + 1] ?? fallback)
}

const TARGET = argument("pull", "microsoft/vscode/pull/327442")
const RUNS = Number(argument("runs", "3"))
const HEADLESS = process.argv.includes("--headless")
const PORT = 9333

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * How long to keep counting after the load event. GitHub's page is not finished
 * when it says it is — deferred fragments, the diff, and telemetry all land
 * after, and a reader watching the tab counts that as part of the wait.
 */
const SETTLE = 5000

type Visit = {
  readonly ttfb: number
  readonly load: number
  readonly requestsAtLoad: number
  readonly requests: number
  readonly bytes: number
}

const visit = async (url: string): Promise<Visit> => {
  const profile = `/tmp/gitquiet-bench-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const chrome = Bun.spawn(
    [
      findChrome(),
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      ...(HEADLESS ? ["--headless=new"] : []),
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1440,900",
      "about:blank"
    ],
    { stdout: "ignore", stderr: "ignore" }
  )

  try {
    const version = async (): Promise<{ webSocketDebuggerUrl: string }> => {
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()) as {
            webSocketDebuggerUrl: string
          }
        } catch {
          await sleep(250)
        }
      }
      throw new Error("Chrome never opened its debugging port")
    }

    const browser = await connect((await version()).webSocketDebuggerUrl)
    const created = await browser.send<{ targetId: string }>("Target.createTarget", {
      url: "about:blank"
    })
    const target = (
      (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as ReadonlyArray<{
        id: string
        webSocketDebuggerUrl: string
      }>
    ).find((entry) => entry.id === created.targetId)
    if (target === undefined) throw new Error("The page target vanished")

    const tab = await connect(target.webSocketDebuggerUrl)

    let requests = 0
    let bytes = 0
    tab.on("Network.requestWillBeSent", (params) => {
      const request = params["request"] as { url?: string } | undefined
      if ((request?.url ?? "").startsWith("http")) requests += 1
    })
    tab.on("Network.loadingFinished", (params) => {
      bytes += Number(params["encodedDataLength"] ?? 0)
    })

    await tab.send("Network.enable")
    await tab.send("Page.enable")
    const loaded = tab.once("Page.loadEventFired")
    await tab.send("Page.navigate", { url })
    await loaded

    const requestsAtLoad = requests
    await sleep(SETTLE)

    const timing = await tab.send<{ result: { value?: string } }>("Runtime.evaluate", {
      expression: `JSON.stringify((() => {
        const entry = performance.getEntriesByType("navigation")[0]
        return { ttfb: entry.responseStart, load: entry.loadEventEnd }
      })())`,
      returnByValue: true
    })
    const { ttfb, load } = JSON.parse(timing.result.value ?? "{}") as {
      ttfb: number
      load: number
    }

    tab.close()
    browser.close()
    return { ttfb, load, requestsAtLoad, requests, bytes }
  } finally {
    chrome.kill()
    await sleep(500)
  }
}

/** The routes the gateway reads to open a pull request, as the gateway asks for them. */
const ROUTES = [
  "/changes",
  "/page_data/status_checks",
  "/page_data/merge_box?bypass_requirements=false",
  "/page_data/description",
  "/page_data/header",
  "/page_data/issue_comments"
] as const

type Payload = {
  readonly route: string
  readonly status: number
  readonly bytes: number
  readonly ms: number
}

const payload = async (route: string): Promise<Payload> => {
  const cookie = process.env["GITHUB_SESSION_COOKIE"]
  const started = performance.now()
  const response = await fetch(`https://github.com/${TARGET}${route}`, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(cookie === undefined || cookie.length === 0 ? {} : { Cookie: cookie })
    }
  })
  const body = await response.arrayBuffer()
  return {
    route,
    status: response.status,
    bytes: body.byteLength,
    ms: Math.round(performance.now() - started)
  }
}

const median = (numbers: ReadonlyArray<number>): number => {
  const sorted = [...numbers].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

const round = (value: number): number => Math.round(value)
const thousands = (value: number): string => value.toLocaleString("en-US")
const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`

const url = `https://github.com/${TARGET}`
console.log(`Measuring ${url}`)
console.log(`${RUNS} cold visits, signed ${process.env["GITHUB_SESSION_COOKIE"] ? "in" : "out"}\n`)

const visits: Array<Visit> = []
for (let run = 1; run <= RUNS; run++) {
  const measured = await visit(url)
  visits.push(measured)
  console.log(
    `  run ${run}: ${round(measured.ttfb)}ms to first byte, ` +
      `${round(measured.load)}ms to load, ` +
      `${measured.requestsAtLoad} requests at load, ` +
      `${measured.requests} after ${SETTLE / 1000}s, ` +
      `${kb(measured.bytes)}`
  )
}

const ttfb = round(median(visits.map((each) => each.ttfb)))
const load = round(median(visits.map((each) => each.load)))
const atLoad = round(median(visits.map((each) => each.requestsAtLoad)))
const settled = round(median(visits.map((each) => each.requests)))
const transferred = round(median(visits.map((each) => each.bytes)))

console.log("\nThe same pull request as data:")
const payloads: Array<Payload> = []
for (const route of ROUTES) {
  const measured = await payload(route)
  payloads.push(measured)
  console.log(
    `  ${measured.route.padEnd(58)} ${String(measured.status).padStart(3)}  ` +
      `${kb(measured.bytes).padStart(10)}  ${measured.ms}ms`
  )
}

const refused = payloads.filter((each) => each.status !== 200)
const changes = payloads.find((each) => each.route === "/changes")
const dataBytes = payloads.reduce((total, each) => total + each.bytes, 0)

console.log(`\n${"-".repeat(72)}`)
console.log(`Median of ${RUNS} cold visits to ${TARGET}\n`)
console.log(`  ${thousands(ttfb)}ms to first byte`)
console.log(`  ${thousands(load)}ms to load`)
console.log(`  ${atLoad} requests at load, ${settled} after ${SETTLE / 1000}s`)
console.log(`  ${kb(transferred)} over the wire`)
console.log(
  `\n  As data: ${payloads.length} requests, ${kb(dataBytes)}` +
    (changes === undefined ? "" : ` — the diff alone is ${kb(changes.bytes)}`)
)

if (refused.length > 0) {
  console.log(
    `\n  ${refused.length} route(s) answered ${refused.map((each) => each.status).join(", ")}. ` +
      `Set GITHUB_SESSION_COOKIE to measure them; see fixtures/README.md.`
  )
}
