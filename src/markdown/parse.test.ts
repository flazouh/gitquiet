import { describe, expect, test } from "bun:test"
import { parseMarkdown } from "./parse"
import { proxiedImages } from "./github"

describe("parsing markdown into a document", () => {
  test("reuses a document when its source and address context have not changed", () => {
    const source = "# Cached\n\n[File](docs/file.ts)"
    const options = { owner: "openrouter", repo: "ori", branch: "main", at: "README.md" }

    const first = parseMarkdown(source, options)
    const second = parseMarkdown(source, { ...options })

    expect(second).toBe(first)
  })

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

  test("drops a bot's bookkeeping comment and keeps the words after it", () => {
    const doc = parseMarkdown(
      '<!-- devin-review-comment {"id": "BUG_0001", "file_path": "src/a.ts", "start_line": 504} -->\n\nPi setup guarantees are now checked'
    )

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "text", text: "Pi setup guarantees are now checked" }] }
    ])
  })

  test("drops an html comment written inside a line", () => {
    const doc = parseMarkdown("before <!-- a note between machines --> after")

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "before " },
          { type: "text", text: " after" }
        ]
      }
    ])
  })

  test("drops an html comment even where a tag is written inside it", () => {
    const doc = parseMarkdown("<!-- <script>alert(1)</script> <b>bold</b> -->\n\nhello")

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

  test("keeps an image and the words that describe it", () => {
    const doc = parseMarkdown("![The working set](https://example.com/shot.png)")

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [{ type: "image", src: "https://example.com/shot.png", alt: "The working set" }]
      }
    ])
  })

  test("drops an image whose address is not one a reader may follow", () => {
    const doc = parseMarkdown("![x](javascript:alert)")

    expect(doc.blocks).toMatchObject([{ type: "paragraph", children: [] }])
  })

  /*
   * A README says `site/public/store/working-set.png`, which is a file in the repository
   * rather than an address. GitHub's own rendering points those at their raw host, and a
   * parse that leaves them alone hands the page an address that resolves against whatever
   * the reader happens to be standing on.
   */
  test("reads a relative image as a file in the repository the markdown belongs to", () => {
    const doc = parseMarkdown("![The working set](site/public/store/working-set.png)", {
      owner: "flazouh",
      repo: "gitquiet"
    })

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          {
            type: "image",
            src: "https://raw.githubusercontent.com/flazouh/gitquiet/HEAD/site/public/store/working-set.png"
          }
        ]
      }
    ])
  })

  test("reads a relative image written as html the same way", () => {
    const doc = parseMarkdown('<img src="./docs/shot.png" alt="A shot">', {
      owner: "flazouh",
      repo: "gitquiet"
    })

    expect(doc.blocks).toMatchObject([
      {
        type: "html",
        tag: "img",
        attrs: { src: "https://raw.githubusercontent.com/flazouh/gitquiet/HEAD/docs/shot.png" }
      }
    ])
  })

  test("reads it from the branch it was given, where it was given one", () => {
    const doc = parseMarkdown("![A shot](docs/shot.png)", {
      owner: "flazouh",
      repo: "gitquiet",
      branch: "next"
    })

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          {
            type: "image",
            src: "https://raw.githubusercontent.com/flazouh/gitquiet/next/docs/shot.png"
          }
        ]
      }
    ])
  })

  test("reads an address written in a file as beside that file", () => {
    const doc = parseMarkdown("![A shot](images/one.png)", {
      owner: "flazouh",
      repo: "gitquiet",
      at: "docs/guide.md"
    })

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          {
            type: "image",
            src: "https://raw.githubusercontent.com/flazouh/gitquiet/HEAD/docs/images/one.png"
          }
        ]
      }
    ])
  })

  test("steps back out of that directory where the address says to", () => {
    const doc = parseMarkdown("![A shot](../site/one.png)", {
      owner: "flazouh",
      repo: "gitquiet",
      at: "docs/guide.md"
    })

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          {
            type: "image",
            src: "https://raw.githubusercontent.com/flazouh/gitquiet/HEAD/site/one.png"
          }
        ]
      }
    ])
  })

  test("reads every address in a source's set the same way", () => {
    const doc = parseMarkdown(
      `<picture>
    <source media="(prefers-color-scheme: dark)" srcset="site/dark.svg 1x, site/dark@2x.svg 2x">
    <img src="site/light.svg" alt="Open">
  </picture>`,
      { owner: "flazouh", repo: "gitquiet" }
    )

    expect(doc.blocks).toMatchObject([
      {
        type: "html",
        tag: "picture",
        children: [
          {
            tag: "source",
            attrs: {
              srcset:
                "https://raw.githubusercontent.com/flazouh/gitquiet/HEAD/site/dark.svg 1x, https://raw.githubusercontent.com/flazouh/gitquiet/HEAD/site/dark@2x.svg 2x"
            }
          },
          {
            tag: "img",
            attrs: { src: "https://raw.githubusercontent.com/flazouh/gitquiet/HEAD/site/light.svg" }
          }
        ]
      }
    ])
  })

  test("leaves an address alone where there is no repository to read it from", () => {
    // A comment box drawing its own preview has no repository behind it. An address left as
    // written is one the reader can still see; one pointed at a guessed repository is not.
    const doc = parseMarkdown("![A shot](docs/shot.png)")

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "image", src: "docs/shot.png" }] }
    ])
  })

  test("leaves an address that already says where it is", () => {
    const doc = parseMarkdown("![A shot](https://example.com/shot.png)", {
      owner: "flazouh",
      repo: "gitquiet"
    })

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "image", src: "https://example.com/shot.png" }] }
    ])
  })

  /*
   * A README says `[Cross-tool analysis](analysis/index.md)`, which is a file in the repository
   * rather than an address. GitHub's own rendering points those at their blob view, and a parse
   * that leaves them alone hands the page an address that resolves against the front page the
   * reader is standing on — `github.com/{owner}/analysis/index.md`, a repository that is not there.
   */
  test("reads a relative link as a file in the repository the markdown belongs to", () => {
    const doc = parseMarkdown("[Cross-tool analysis](analysis/index.md)", {
      owner: "LukasParke",
      repo: "tui-patterns"
    })

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          {
            type: "link",
            href: "https://github.com/LukasParke/tui-patterns/blob/HEAD/analysis/index.md"
          }
        ]
      }
    ])
  })

  test("reads a relative link from the branch and the file it was given", () => {
    const doc = parseMarkdown("[a guide](../guide.md)", {
      owner: "flazouh",
      repo: "gitquiet",
      branch: "next",
      at: "docs/reading.md"
    })

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "link", href: "https://github.com/flazouh/gitquiet/blob/next/guide.md" }
        ]
      }
    ])
  })

  test("leaves a fragment link alone, since it is an anchor in this rendering", () => {
    const doc = parseMarkdown("[usage](#usage)", { owner: "flazouh", repo: "gitquiet" })

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "link", href: "#usage" }] }
    ])
  })

  test("leaves a rooted or schemed link alone, as a picture's is", () => {
    const doc = parseMarkdown("[home](https://example.com) and [root](/octo/repo)", {
      owner: "flazouh",
      repo: "gitquiet"
    })

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "link", href: "https://example.com" },
          { type: "text", text: " and " },
          { type: "link", href: "/octo/repo" }
        ]
      }
    ])
  })

  test("leaves a relative link alone where there is no repository to read it from", () => {
    const doc = parseMarkdown("[a guide](docs/guide.md)")

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "link", href: "docs/guide.md" }] }
    ])
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

  test("keeps link reference definitions as a sources block instead of dropping them", () => {
    // The lexer consumes these to power the reference links above, and a
    // renderer that stops there cuts real content: a document whose References
    // section is nothing but definitions ends at an empty heading.
    const doc = parseMarkdown(
      "## References\n\n[0]: https://example.com/versioning\n[1]: https://example.com/union \"SDK union\""
    )

    expect(doc.blocks).toMatchObject([
      { type: "heading", depth: 2 },
      {
        type: "sources",
        entries: [
          { label: "0", said: "https://example.com/versioning", href: "https://example.com/versioning", title: null },
          { label: "1", said: "https://example.com/union", href: "https://example.com/union", title: "SDK union" }
        ]
      }
    ])
  })

  test("groups a run of definitions into one block, blank lines and all", () => {
    const doc = parseMarkdown(
      "[the docs][0]\n\n[0]: https://example.com/a\n\n[1]: https://example.com/b"
    )

    expect(doc.blocks).toMatchObject([
      {
        type: "paragraph",
        children: [{ type: "link", href: "https://example.com/a" }]
      },
      {
        type: "sources",
        entries: [{ label: "0" }, { label: "1" }]
      }
    ])
  })

  test("keeps the words of a definition whose address may not be followed", () => {
    const doc = parseMarkdown("[bad]: javascript:alert(1)")

    expect(doc.blocks).toMatchObject([
      { type: "sources", entries: [{ label: "bad", said: "javascript:alert(1)", href: null }] }
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

/*
 * React's README opens `# [React](https://react.dev/) &middot; [![GitHub license](…)`.
 * Marked keeps an entity as it was written, and text drawn by React is drawn as it is
 * given, so the heading read "React &middot;" where GitHub's reads "React ·".
 */
describe("reading the entities markdown is allowed to have", () => {
  test("draws a named or numbered entity as the character it names", () => {
    const doc = parseMarkdown("React &middot; &copy; &#169; &#x2014; &amp;")

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "text", text: "React · © © — &" }] }
    ])
  })

  test("leaves code as it was written, where an entity is what it says", () => {
    const doc = parseMarkdown("`&middot;`")

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "code", text: "&middot;" }] }
    ])
  })

  test("never turns an entity into markup", () => {
    const doc = parseMarkdown("a &lt;img src=x onerror=alert(1)&gt; b")

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "text", text: "a <img src=x onerror=alert(1)> b" }] }
    ])
  })

  test("reads an image's words and an html attribute the same way", () => {
    const doc = parseMarkdown('![Tom &amp; Jerry](https://example.com/a.png)\n\n<img src="https://example.com/b.png?x=1&amp;y=2" alt="A &middot; B">')

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "image", alt: "Tom & Jerry" }] },
      { type: "html", tag: "img", attrs: { src: "https://example.com/b.png?x=1&y=2", alt: "A · B" } }
    ])
  })

  test("still refuses a script address spelled with entities", () => {
    const doc = parseMarkdown('<a href="jav&#x61;script:alert(1)">x</a>')

    expect(JSON.stringify(doc.blocks)).not.toContain("javascript")
  })
})

/*
 * GitHub's page allows pictures only from its own hosts, and our README is drawn inside
 * it, so `img.shields.io` was refused and every badge was its alt text. GitHub's own
 * rendering fetches the same picture through its proxy, at an address signed on their
 * side that we cannot make, and says which picture it stands for.
 */
describe("pictures from a host GitHub's page refuses", () => {
  const proxied = new Map([
    ["https://img.shields.io/badge/license-MIT-blue.svg", "https://camo.githubusercontent.com/7013/6874"]
  ])

  test("are fetched through GitHub's proxy where their rendering says how", () => {
    const doc = parseMarkdown(
      '[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](x)\n\n<img src="https://img.shields.io/badge/license-MIT-blue.svg">',
      { proxied }
    )

    expect(JSON.stringify(doc.blocks)).not.toContain("img.shields.io")
    expect(JSON.stringify(doc.blocks).match(/camo\.githubusercontent\.com\/7013\/6874/g)?.length).toBe(2)
  })

  test("are left as written where their rendering does not name them", () => {
    const doc = parseMarkdown("![npm](https://img.shields.io/npm/v/react.svg)", { proxied })

    expect(doc.blocks).toMatchObject([
      { type: "paragraph", children: [{ type: "image", src: "https://img.shields.io/npm/v/react.svg" }] }
    ])
  })

  test("are read out of GitHub's rendering, entities and all", () => {
    const html =
      '<p><a href="x"><img src="https://camo.githubusercontent.com/aa/bb" alt="npm" data-canonical-src="https://img.shields.io/npm/v/react.svg?style=flat&amp;x=1" style="max-width: 100%;"></a>' +
      '<img src="/facebook/react/raw/main/logo.png" alt="logo"></p>'

    expect([...proxiedImages(html)]).toEqual([
      ["https://img.shields.io/npm/v/react.svg?style=flat&x=1", "https://camo.githubusercontent.com/aa/bb"]
    ])
  })
})
