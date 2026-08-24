import { Effect, Fiber } from "effect"
import { useEffect, useState } from "react"
import { useMarkdownDraw } from "./runtime"
import type {
  HtmlNode,
  MarkdownBlock,
  MarkdownInline,
  ParseOptions,
  TableAlign,
  TableBlock
} from "./model"
import { parseMarkdown } from "./parse"

export const Markdown = ({
  markdown,
  owner,
  repo,
  branch,
  at
}: {
  readonly markdown: string
  readonly owner?: string
  readonly repo?: string
  /** Which branch a relative address means. Their default branch where nobody says. */
  readonly branch?: string
  /** Where this markdown itself is, so an address beside it is read from beside it. */
  readonly at?: string
}) => {
  const options: ParseOptions = { owner, repo, branch, at }
  const doc = parseMarkdown(markdown, options)
  return (
    <div className="markdown">
      {doc.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
      {doc.footnotes.length > 0 ? (
        <ol className="markdown-footnotes">
          {doc.footnotes.map((note) => (
            <li key={note.id} id={`fn-${note.id}`}>
              {note.blocks.map((block, index) => (
                <Block key={index} block={block} />
              ))}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

const Block = ({ block }: { readonly block: MarkdownBlock }) => {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.depth}` as const
      return (
        <Tag>
          <Inlines nodes={block.children} />
        </Tag>
      )
    }
    case "paragraph":
      return (
        <p>
          <Inlines nodes={block.children} />
        </p>
      )
    case "text":
      return (
        <span>
          <Inlines nodes={block.children} />
        </span>
      )
    case "blockquote":
      return (
        <blockquote>
          {block.blocks.map((child, index) => (
            <Block key={index} block={child} />
          ))}
        </blockquote>
      )
    case "alert":
      return (
        <aside className={`markdown-alert markdown-alert-${block.kind}`} aria-label={block.kind}>
          <p className="markdown-alert-title">{block.kind}</p>
          {block.blocks.map((child, index) => (
            <Block key={index} block={child} />
          ))}
        </aside>
      )
    case "hr":
      return <hr />
    case "code":
      return (
        <CodeFence
          code={block.code}
          language={block.language}
          suggestion={block.language === "suggestion"}
        />
      )
    case "list": {
      const Tag = block.ordered ? "ol" : "ul"
      return (
        <Tag start={block.start ?? undefined}>
          {block.items.map((item, index) => (
            <li key={index}>
              {item.task ? (
                <input type="checkbox" checked={item.checked === true} disabled readOnly />
              ) : null}
              {item.blocks.map((child, childIndex) => (
                <Block key={childIndex} block={child} />
              ))}
            </li>
          ))}
        </Tag>
      )
    }
    case "table":
      return <Table block={block} />
    case "sources":
      // The address is the words as well as the press, so a vetoed one keeps
      // its text and loses only the link — the same rule every other address
      // in this tree follows.
      return (
        <ul className="markdown-sources">
          {block.entries.map((entry, index) => (
            <li key={index}>
              <span className="markdown-sources-label">{`[${entry.label}]:`}</span>{" "}
              {entry.href === null ? entry.said : <a href={entry.href}>{entry.said}</a>}
              {entry.title === null ? null : ` ${entry.title}`}
            </li>
          ))}
        </ul>
      )
    case "html":
      return <Html node={block} />
  }
}

const CodeFence = ({
  code,
  language,
  suggestion
}: {
  readonly code: string
  readonly language: string
  readonly suggestion: boolean
}) => {
  const { highlight, mermaid, syntaxTheme } = useMarkdownDraw()
  /*
   * What was drawn, and what it was drawn from. A fence keeps its place in the
   * tree when the source under it changes — a pull request replaced by the next
   * one, a comment edited — and holding the picture alone showed the old fence's
   * diagram over the new fence's source until the new one was ready. That was one
   * render's worth of wrong before diagrams began waiting for a quiet moment, and
   * is up to two seconds of it now.
   */
  const [drawn, setDrawn] = useState<{ readonly of: string; readonly html: string } | null>(null)
  const html = drawn?.of === code ? drawn.html : null

  useEffect(() => {
    if (suggestion) return
    if (language === "") return
    let cancelled = false
    const work = language === "mermaid" ? mermaid(code) : highlight(code, language, syntaxTheme)
    const asking = Effect.runFork(
      work.pipe(
        Effect.tap((coloured) =>
          Effect.sync(() => {
            if (!cancelled && coloured !== null) setDrawn({ of: code, html: coloured })
          })
        )
      )
    )
    return () => {
      cancelled = true
      Effect.runFork(Fiber.interrupt(asking))
    }
  }, [code, language, suggestion, highlight, mermaid, syntaxTheme])

  if (language === "mermaid") {
    if (html !== null) {
      return <figure className="markdown-mermaid" dangerouslySetInnerHTML={{ __html: html }} />
    }
    return (
      <figure className="markdown-mermaid markdown-mermaid-pending" role="status">
        Drawing diagram
      </figure>
    )
  }

  return (
    <pre className={suggestion ? "markdown-suggestion" : undefined}>
      {html === null ? (
        <code data-language={language || undefined}>{code}</code>
      ) : (
        <code data-language={language || undefined} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </pre>
  )
}

const Table = ({ block }: { readonly block: TableBlock }) => (
  <div className="markdown-table">
    <table>
      <thead>
        <tr>
          {block.header.map((cell, index) => (
            <th key={index} className={alignClass(cell.align)}>
              <Inlines nodes={cell.children} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className={alignClass(cell.align)}>
                <Inlines nodes={cell.children} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const Inlines = ({ nodes }: { readonly nodes: ReadonlyArray<MarkdownInline> }) => (
  <>
    {nodes.map((node, index) => (
      <Inline key={index} node={node} />
    ))}
  </>
)

const Inline = ({ node }: { readonly node: MarkdownInline }) => {
  switch (node.type) {
    case "text":
      return node.text
    case "code":
      return <code>{node.text}</code>
    case "strong":
      return (
        <strong>
          <Inlines nodes={node.children} />
        </strong>
      )
    case "em":
      return (
        <em>
          <Inlines nodes={node.children} />
        </em>
      )
    case "delete":
      return (
        <del>
          <Inlines nodes={node.children} />
        </del>
      )
    case "link":
      return node.href === null ? (
        <Inlines nodes={node.children} />
      ) : (
        <a href={node.href} rel="noopener noreferrer">
          <Inlines nodes={node.children} />
        </a>
      )
    case "image":
      /*
       * Lazy, because a README is read from the top and its shots are usually further down
       * it than the reader ever goes. Nothing here sets a width: the markdown does not carry
       * one, and `markdown.css` holds every picture inside the column it is drawn in.
       */
      return <img src={node.src} alt={node.alt} loading="lazy" />
    case "html":
      return <Html node={node} />
    case "mention":
      return (
        <a href={`https://github.com/${node.login}`} className="markdown-mention">
          @{node.login}
        </a>
      )
    case "issue":
      return (
        <a
          href={`https://github.com/${node.owner}/${node.repo}/issues/${node.number}`}
          className="markdown-issue"
        >
          {`${node.label}`}
        </a>
      )
    case "emoji":
      return (
        <span className="markdown-emoji" title={`:${node.name}:`}>
          {node.character}
        </span>
      )
    case "footnote-ref":
      return (
        <a href={`#fn-${node.id}`} className="markdown-footnote-ref">
          <sup>{node.id}</sup>
        </a>
      )
  }
}

const Html = ({ node }: { readonly node: HtmlNode }) => {
  const children = node.children.map((child, index) =>
    isInline(child) ? <Inline key={index} node={child} /> : <Block key={index} block={child} />
  )

  switch (node.tag) {
    case "br":
      return <br />
    case "img":
      return (
        <img
          src={node.attrs.src}
          alt={node.attrs.alt ?? ""}
          width={node.attrs.width}
          height={node.attrs.height}
          loading="lazy"
        />
      )
    case "source":
      return <source media={node.attrs.media} srcSet={node.attrs.srcset} type={node.attrs.type} />
    case "picture":
      return <picture>{children}</picture>
    case "details":
      return <details open={node.attrs.open !== undefined}>{children}</details>
    case "summary":
      return <summary>{children}</summary>
    case "a":
      return node.attrs.href === undefined ? (
        <>{children}</>
      ) : (
        <a href={node.attrs.href} target={node.attrs.target} rel={node.attrs.rel || "noopener noreferrer"}>
          {children}
        </a>
      )
    default:
      return <>{children}</>
  }
}

const isInline = (node: MarkdownBlock | MarkdownInline): node is MarkdownInline => {
  switch (node.type) {
    case "heading":
    case "paragraph":
    case "table":
    case "list":
    case "blockquote":
    case "alert":
    case "hr":
    case "sources":
      return false
    case "code":
      return !("language" in node)
    case "text":
      return "text" in node
    default:
      return true
  }
}

const alignClass = (align: TableAlign): string | undefined => {
  if (align === "center") return "text-center"
  if (align === "right") return "text-right"
  return undefined
}
