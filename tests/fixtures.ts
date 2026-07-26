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
const loadFixtureText = (name: FixtureName): string =>
  readFileSync(new URL(`../fixtures/github/${name}.json`, import.meta.url), "utf8")

export const loadFixture = (name: FixtureName): unknown => JSON.parse(loadFixtureText(name))

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

/**
 * A pull request that deletes a file.
 *
 * GitHub calls that `REMOVED` on this route. Both recordings happen to contain
 * only modifications, so neither says so — the case was found on a real private
 * pull request whose payload had three hundred and eight of them and not one
 * `DELETED`, the value we had guessed at. The rewrite is textual because
 * fixtures are deliberately `unknown`: reaching into one to change a field would
 * mean asserting the shape the decoder is supposed to establish.
 */
export const withADeletedFile = {
  changes: JSON.parse(
    loadFixtureText("changes").replace('"changeType":"MODIFIED"', '"changeType":"REMOVED"')
  ) as unknown,
  statusChecks: loadFixture("status-checks"),
  mergeBox: loadFixture("merge-box")
}
