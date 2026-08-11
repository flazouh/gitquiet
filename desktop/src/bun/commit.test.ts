import { describe, expect, test } from "bun:test"
import { commitFromRest } from "./commit"

const rest = {
  sha: "3d3c42e5aac5ba805825da76410c181273ba90b1",
  commit: {
    message: "Bump actions/checkout\n\nFrom 5 to 7.",
    author: { name: "dependabot", date: "2026-07-01T12:00:00Z" }
  },
  author: { login: "dependabot[bot]", avatar_url: "https://avatars.example/bot" },
  files: [
    {
      filename: ".github/workflows/ci.yml",
      sha: "abc",
      status: "modified",
      additions: 1,
      deletions: 1,
      changes: 2,
      patch: "@@ -1 +1 @@\n-uses: actions/checkout@v5\n+uses: actions/checkout@v7"
    },
    {
      filename: "logo.png",
      sha: "def",
      status: "added",
      additions: 0,
      deletions: 0,
      changes: 0
    },
    {
      filename: "huge.txt",
      sha: "ghi",
      status: "modified",
      additions: 4000,
      deletions: 0,
      changes: 4000
    }
  ]
}

describe("commitFromRest", () => {
  test("maps the commit and embeds patches GitHub sent", () => {
    const detail = commitFromRest(rest)

    expect(detail.sha).toBe(rest.sha)
    expect(detail.abbreviatedSha).toBe("3d3c42e")
    expect(detail.headline).toBe("Bump actions/checkout")
    expect(detail.bodyHtml).toContain("From 5 to 7.")
    expect(detail.author).toBe("dependabot[bot]")
    expect(detail.avatarUrl).toBe("https://avatars.example/bot")
    expect(detail.createdAt).toBe("2026-07-01T12:00:00Z")
    expect(detail.files).toHaveLength(3)
    expect(detail.files[0]).toMatchObject({
      path: ".github/workflows/ci.yml",
      content: "here",
      changeType: "modified"
    })
    expect(detail.files[0]?.patch).toContain("actions/checkout@v7")
  })

  test("marks binaries and withheld patches the way the card does", () => {
    const detail = commitFromRest(rest)

    expect(detail.files[1]).toMatchObject({ path: "logo.png", content: "binary", patch: null })
    expect(detail.files[2]).toMatchObject({ path: "huge.txt", content: "withheld", patch: null })
  })

  test("falls back to the commit author when GitHub has no user", () => {
    const detail = commitFromRest({ ...rest, author: null })

    expect(detail.author).toBe("dependabot")
    expect(detail.avatarUrl).toBeNull()
  })
})
