import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Option } from "effect"
import { sittingsIn } from "../domain/sittings"
import type { InvolvedPullRequest, Shelf } from "../domain/workingSet"
import { WorkingSet } from "../ui/WorkingSet"
import { Supplied } from "./supplied"

/**
 * What the extension's own shell hands down, asked of the extension's own shell.
 *
 * The set and the pack are each resolved in one place, and both places are given
 * their answer here rather than in `art.tsx` or `Theme.tsx`. So a test of those two
 * functions passes while the thing a reader actually installs draws the other set:
 * the wiring is the part that can be wrong, and this is the wiring.
 *
 * GitHub's glyphs and GitHub's canvas, because this shell is the one standing on
 * GitHub's page. The window's shell is asked the opposite question in
 * `desktop/src/view/`.
 */

afterEach(cleanup)

const involved: InvolvedPullRequest = {
  reference: { owner: "flazouh", repo: "octo-repo", number: 1 },
  id: "1000",
  title: "a pull request",
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  shelf: Option.some<Shelf>("needs-action"),
  why: Option.none(),
  readByViewer: true,
  comments: 3,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-01T00:00:00Z",
  changedAt: "2026-07-01T00:00:00Z",
  headSha: "sha1",
  channels: [],
  checks: Option.none(),
  reviewed: Option.none(),
  size: Option.none()
}

describe("the shell the extension mounts", () => {
  test("draws the interface in GitHub's own glyphs, because it is drawn on their page", async () => {
    render(
      <Supplied>
        <WorkingSet sittings={sittingsIn([involved], () => Option.none())} onOpen={() => {}} />
      </Supplied>
    )

    await screen.findByText("a pull request")

    // Octicons name themselves in the markup, which is what makes the question
    // answerable without reaching for a path.
    expect(document.querySelectorAll("svg.octicon").length).toBeGreaterThan(0)
  })
})
