import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { IssueFacts } from "../shared/wire"
import { issueFrom, listedFrom, repositoryFrom } from "./issueSnapshot"

const facts = (): IssueFacts => ({
  id: "I_kwDOIssue",
  owner: "cli",
  repo: "cli",
  number: 78,
  title: "The list forgot my issues",
  markdown: "I cannot find them.",
  html: "<p>I cannot find them.</p>",
  state: "closed",
  closing: "completed",
  openedAt: "2026-08-01T10:00:00Z",
  author: { login: "mira", isAutomated: false, faceUrl: "https://faces/mira.png" },
  labels: [{ name: "bug", colour: "d73a4a", description: "Something is wrong" }],
  assignees: [{ login: "noor", isAutomated: false, faceUrl: null }],
  remarks: [
    {
      id: "IC_kwDORemark",
      author: { login: "mira", isAutomated: false, faceUrl: null },
      body: "Fixed on main.",
      html: "<p>Fixed on main.</p>",
      createdAt: "2026-08-02T10:00:00Z"
    }
  ],
  reactions: [{ kind: "THUMBS_UP", count: 3, viewerReacted: true }],
  allowed: { comment: true, close: false, reopen: true, label: true, assign: true },
  viewer: { login: "flazouh", isAutomated: false, faceUrl: null }
})

describe("an issue, built from what the main process read", () => {
  test("carries the issue itself across, including why it closed", () => {
    const snapshot = issueFrom(facts())

    expect(snapshot.reference).toEqual({ owner: "cli", repo: "cli", number: 78 })
    expect(snapshot.id).toBe("I_kwDOIssue")
    expect(snapshot.title).toBe("The list forgot my issues")
    expect(snapshot.state).toBe("closed")
    expect(snapshot.closing).toEqual(Option.some("completed"))
    expect(snapshot.labels[0]?.colour).toBe("d73a4a")
    expect(snapshot.remarks[0]?.id).toBe("IC_kwDORemark")
    expect(snapshot.allowed.reopen).toBe(true)
    expect(Option.isSome(snapshot.viewer)).toBe(true)
  })

  test("a listed row keeps the address and the count, not the body", () => {
    const row = listedFrom({
      id: "I_1",
      owner: "cli",
      repo: "cli",
      number: 78,
      title: "The list forgot my issues",
      author: { login: "mira", isAutomated: false, faceUrl: null },
      state: "open",
      comments: 4,
      labels: ["bug"],
      raisedAt: "2026-08-01T10:00:00Z"
    })

    expect(row.comments).toBe(4)
    expect(row.labels).toEqual(["bug"])
    expect(row.reference.number).toBe(78)
  })

  test("a repository keeps the owner's face and whether it is empty", () => {
    const repo = repositoryFrom({
      owner: "cli",
      repo: "cli",
      nameWithOwner: "cli/cli",
      faceUrl: "https://faces/cli.png",
      ofAnOrganisation: true,
      isPrivate: false,
      isEmpty: false
    })

    expect(repo.nameWithOwner).toBe("cli/cli")
    expect(repo.ofAnOrganisation).toBe(true)
    expect(Option.getOrNull(repo.faceUrl)).toBe("https://faces/cli.png")
  })
})
