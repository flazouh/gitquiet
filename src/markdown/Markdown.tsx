import type {
  HtmlNode,
  MarkdownBlock,
  MarkdownInline,
  TableAlign,
  TableBlock
} from "./model"
import { parseMarkdown } from "./parse"

export const Markdown = ({ markdown }: { readonly markdown: string }) => {
  const doc = parseMarkdown(markdown)
  return (
    <div className="markdown">
      {doc.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
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
    case "hr":
      return <hr />
    case "code":
      return (
        <pre>
          <code data-language={block.language || undefined}>{block.code}</code>
        </pre>
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
    case "html":
      return <Html node={block} />
  }
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
    case "html":
      return <Html node={node} />
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
      return <img src={node.attrs.src} alt={node.attrs.alt ?? ""} width={node.attrs.width} height={node.attrs.height} />
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
    case "hr":
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
