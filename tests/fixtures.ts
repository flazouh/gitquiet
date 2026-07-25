import { readFileSync } from "node:fs"

export type FixtureName =
  | "changes"
  | "status-checks"
  | "merge-box"
  | "approved-changes"
  | "approved-status-checks"
  | "merge-box-approved"

/**
 * Fixtures are returned as `unknown` on purpose: decoders must earn their
 * types from the payload rather than being handed them by the loader.
 */
export const loadFixture = (name: FixtureName): unknown => {
  const path = new URL(`../fixtures/github/${name}.json`, import.meta.url)
  const contents: string = readFileSync(path, "utf8")
  return JSON.parse(contents)
}

export const draftWithBotFindings = {
  changes: loadFixture("changes"),
  statusChecks: loadFixture("status-checks"),
  mergeBox: loadFixture("merge-box")
}

export const mergedWithApproval = {
  changes: loadFixture("approved-changes"),
  statusChecks: loadFixture("approved-status-checks"),
  mergeBox: loadFixture("merge-box-approved")
}
