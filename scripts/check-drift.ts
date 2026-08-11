#!/usr/bin/env bun
import { Effect, Schema } from "effect"
import {
  ChangesRoute,
  HeaderRoute,
  IssueCommentsRoute,
  MergeBoxRoute,
  StatusChecksRoute,
  whyItWouldNotDecode
} from "../src/github/wire"

/**
 * Re-fetches the routes the gateway depends on from live GitHub and decodes
 * them with the same schemas production uses. A shape change fails here rather
 * than reaching a Participant as a broken page.
 *
 * Requires GITHUB_SESSION_COOKIE because these routes authenticate with a
 * browser session. See fixtures/README.md for how to obtain one, and why this
 * runs on demand rather than on every CI run.
 */

const cookie = process.env["GITHUB_SESSION_COOKIE"]
if (cookie === undefined || cookie.length === 0) {
  console.error("GITHUB_SESSION_COOKIE is not set. See fixtures/README.md.")
  process.exit(2)
}

const target = process.env["DRIFT_PULL_REQUEST"] ?? "microsoft/vscode/pull/327442"

const routes = [
  { name: "changes", path: "/changes", schema: ChangesRoute },
  { name: "status_checks", path: "/page_data/status_checks", schema: StatusChecksRoute },
  {
    name: "merge_box",
    path: "/page_data/merge_box?merge_method=MERGE&bypass_requirements=false",
    schema: MergeBoxRoute
  },
  { name: "header", path: "/page_data/header", schema: HeaderRoute },
  { name: "issue_comments", path: "/page_data/issue_comments", schema: IssueCommentsRoute }
] as const

let failed = false

for (const route of routes) {
  const url = `https://github.com/${target}${route.path}`
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Cookie: cookie
    }
  })

  if (!response.ok) {
    console.error(`${route.name}: HTTP ${response.status} from ${url}`)
    failed = true
    continue
  }

  const body: unknown = await response.json()
  const outcome = await Effect.runPromise(
    Effect.result(Schema.decodeUnknownEffect(route.schema)(body))
  )

  if (outcome._tag === "Failure") {
    console.error(`${route.name}: DRIFTED`)
    console.error(whyItWouldNotDecode(outcome.failure))
    failed = true
  } else {
    console.log(`${route.name}: ok`)
  }
}

process.exit(failed ? 1 : 0)
