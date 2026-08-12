import { describe, expect, test } from "bun:test"
import { parseMarkdown } from "./parse"

describe("parsing markdown into a document", () => {
  test("reads a heading and the paragraph under it", () => {
    const doc = parseMarkdown("# Ori\n\nA CLI for projects you already have.")

    expect(doc.blocks).toMatchObject([
      { type: "heading", depth: 1, children: [{ type: "text", text: "Ori" }] },
      {
        type: "paragraph",
        children: [{ type: "text", text: "A CLI for projects you already have." }]
      }
    ])
  })

  test("reads a GFM pipe table", () => {
    const doc = parseMarkdown("| Name | Status |\n| --- | --- |\n| Tables | Working |")

    expect(doc.blocks).toMatchObject([
      {
        type: "table",
        header: [
          { align: null, children: [{ type: "text", text: "Name" }] },
          { align: null, children: [{ type: "text", text: "Status" }] }
        ],
        rows: [
          [
            { align: null, children: [{ type: "text", text: "Tables" }] },
            { align: null, children: [{ type: "text", text: "Working" }] }
          ]
        ]
      }
    ])
  })

  test("reads a task list", () => {
    const doc = parseMarkdown("- [x] done\n- [ ] next")

    expect(doc.blocks).toMatchObject([
      {
        type: "list",
        ordered: false,
        items: [
          {
            task: true,
            checked: true,
            blocks: [{ type: "text", children: [{ type: "text", text: "done" }] }]
          },
          {
            task: true,
            checked: false,
            blocks: [{ type: "text", children: [{ type: "text", text: "next" }] }]
          }
        ]
      }
    ])
  })

  test("reads a fenced code block and its language", () => {
    const doc = parseMarkdown("```sh\nori login\n```")

    expect(doc.blocks).toMatchObject([
      { type: "code", language: "sh", meta: "", code: "ori login" }
    ])
  })

  test("keeps an https link", () => {
    const doc = parseMarkdown("[Ori](https://openrouter.ai/labs/ori)")

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          {
            type: "link",
            href: "https://openrouter.ai/labs/ori",
            children: [{ type: "text", text: "Ori" }]
          }
        ]
      }
    ])
  })

  test("drops a javascript: address from a link", () => {
    const doc = parseMarkdown("[x](javascript:alert(1))")

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "link", href: null, children: [{ type: "text", text: "x" }] }
        ]
      }
    ])
  })

  test("keeps a details section and the list written inside it", () => {
    const doc = parseMarkdown("<details>\n<summary>More</summary>\n\n- item\n\n</details>")

    expect(doc.blocks).toMatchObject([
      {
        type: "html",
        tag: "details",
        attrs: {},
        children: [
          {
            type: "html",
            tag: "summary",
            attrs: {},
            children: [{ type: "text", text: "More" }]
          },
          {
            type: "list",
            ordered: false,
            items: [
              {
                task: false,
                checked: null,
                blocks: [{ type: "text", children: [{ type: "text", text: "item" }] }]
              }
            ]
          }
        ]
      }
    ])
  })

  test("keeps a picture whose sources are https", () => {
    const doc = parseMarkdown(
      `<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://example.com/d.svg">
    <img src="https://example.com/l.svg" alt="Open">
  </picture>`
    )

    expect(doc.blocks).toMatchObject([
      {
        type: "html",
        tag: "picture",
        children: [
          {
            type: "html",
            tag: "source",
            attrs: {
              media: "(prefers-color-scheme: dark)",
              srcset: "https://example.com/d.svg"
            },
            children: []
          },
          {
            type: "html",
            tag: "img",
            attrs: { src: "https://example.com/l.svg", alt: "Open" },
            children: []
          }
        ]
      }
    ])
  })

  test("drops a script element and keeps the paragraph after it", () => {
    const doc = parseMarkdown("<script>alert(1)</script>\n\nhello")

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "text", text: "hello" }] }
    ])
  })

  test("unwraps a div and keeps the words inside it", () => {
    const doc = parseMarkdown("<div>kept text</div>")

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "text", text: "kept text" }] }
    ])
  })

  test("drops an image whose source is a javascript: address", () => {
    const doc = parseMarkdown('<img src="javascript:alert(1)" alt="x">')

    expect(doc.blocks).toEqual([])
  })

  test("reads a block quote, a rule, and the usual inline marks", () => {
    const doc = parseMarkdown("> note\n\n---\n\n**bold** and *em* and ~~gone~~ and `code`")

    expect(doc.blocks).toMatchObject([
      {
        type: "blockquote",
        blocks: [{ type: "paragraph", children: [{ type: "text", text: "note" }] }]
      },
      { type: "hr" },
      {
        type: "paragraph",
        children: [
          { type: "strong", children: [{ type: "text", text: "bold" }] },
          { type: "text", text: " and " },
          { type: "em", children: [{ type: "text", text: "em" }] },
          { type: "text", text: " and " },
          { type: "delete", children: [{ type: "text", text: "gone" }] },
          { type: "text", text: " and " },
          { type: "code", text: "code" }
        ]
      }
    ])
  })

  test("keeps a line break written as html", () => {
    const doc = parseMarkdown("see <br> here")

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "see " },
          { type: "html", tag: "br", attrs: {}, children: [] },
          { type: "text", text: " here" }
        ]
      }
    ])
  })

  test("a typical bot footer does not keep a script or a javascript address", () => {
    const doc = parseMarkdown(`## Status

- [x] done
- [ ] next

\`\`\`sh
ori login
\`\`\`

<details>
<summary>More</summary>

See #1945 and @alice.

</details>

<a href="https://app.devin.ai/review">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://static.devin.ai/dark.svg">
    <img src="https://static.devin.ai/light.svg" alt="Open in Devin Review">
  </picture>
</a>

<script>alert(1)</script>
[no](javascript:alert(1))
`)

    const hrefs: Array<string | null> = []
    const tags: Array<string> = []
    const visit = (node: unknown) => {
      if (Array.isArray(node)) {
        for (const child of node) visit(child)
        return
      }
      if (node === null || typeof node !== "object") return
      const rec = node as Record<string, unknown>
      if (typeof rec.href === "string" || rec.href === null) hrefs.push(rec.href)
      if (rec.type === "html" && typeof rec.tag === "string") tags.push(rec.tag)
      if (rec.attrs !== undefined) visit(rec.attrs)
      if (typeof rec.src === "string") hrefs.push(rec.src)
      if (typeof rec.srcset === "string") hrefs.push(rec.srcset)
      for (const value of Object.values(rec)) visit(value)
    }
    visit(doc)

    expect(doc.blocks.length).toBeGreaterThan(0)
    expect(tags).not.toContain("script")
    expect(hrefs.some((href) => href !== null && /^(?:javascript|data|blob|vbscript):/iu.test(href))).toBe(
      false
    )
  })

  test("turns @alice and #12 into GitHub references", () => {
    const doc = parseMarkdown("Thanks @alice for #12", { owner: "ori", repo: "cli" })

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Thanks " },
          { type: "mention", login: "alice" },
          { type: "text", text: " for " },
          { type: "issue", owner: "ori", repo: "cli", number: 12 }
        ]
      }
    ])
  })

  test("turns :rocket: into an emoji", () => {
    const doc = parseMarkdown("ship it :rocket:")

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "ship it " },
          { type: "emoji", name: "rocket", character: "🚀" }
        ]
      }
    ])
  })

  test("reads a GitHub alert", () => {
    const doc = parseMarkdown("> [!NOTE]\n> Be careful")

    expect(doc.blocks).toMatchObject([
      {
        type: "alert",
        kind: "note",
        blocks: [{ type: "paragraph", children: [{ type: "text", text: "Be careful" }] }]
      }
    ])
  })

  test("reads a footnote reference and its definition", () => {
    const doc = parseMarkdown("See this.[^1]\n\n[^1]: the note")

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "See this." },
          { type: "footnote-ref", id: "1" }
        ]
      }
    ])
    expect(doc.footnotes).toMatchObject([
      { id: "1", blocks: [{ type: "paragraph", children: [{ type: "text", text: "the note" }] }] }
    ])
  })
})
