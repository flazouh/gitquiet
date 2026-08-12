export type MarkdownDocument = {
  readonly blocks: ReadonlyArray<MarkdownBlock>
}

export type MarkdownBlock =
  | HeadingBlock
  | ParagraphBlock
  | TableBlock
  | ListBlock
  | TextBlock
  | CodeBlock
  | HtmlNode
  | BlockquoteBlock
  | HrBlock

export type HeadingBlock = {
  readonly type: "heading"
  readonly depth: 1 | 2 | 3 | 4 | 5 | 6
  readonly children: ReadonlyArray<MarkdownInline>
}

export type ParagraphBlock = {
  readonly type: "paragraph"
  readonly children: ReadonlyArray<MarkdownInline>
}

export type MarkdownInline = TextInline | LinkInline | HtmlNode | StrongInline | EmInline | DeleteInline | CodeInline

export type TextInline = {
  readonly type: "text"
  readonly text: string
}

export type LinkInline = {
  readonly type: "link"
  readonly href: string | null
  readonly children: ReadonlyArray<MarkdownInline>
}

export type StrongInline = {
  readonly type: "strong"
  readonly children: ReadonlyArray<MarkdownInline>
}

export type EmInline = {
  readonly type: "em"
  readonly children: ReadonlyArray<MarkdownInline>
}

export type DeleteInline = {
  readonly type: "delete"
  readonly children: ReadonlyArray<MarkdownInline>
}

export type CodeInline = {
  readonly type: "code"
  readonly text: string
}

export type TableAlign = "left" | "center" | "right" | null

export type TableCell = {
  readonly align: TableAlign
  readonly children: ReadonlyArray<MarkdownInline>
}

export type TableBlock = {
  readonly type: "table"
  readonly header: ReadonlyArray<TableCell>
  readonly rows: ReadonlyArray<ReadonlyArray<TableCell>>
}

export type TextBlock = {
  readonly type: "text"
  readonly children: ReadonlyArray<MarkdownInline>
}

export type ListItem = {
  readonly task: boolean
  readonly checked: boolean | null
  readonly blocks: ReadonlyArray<MarkdownBlock>
}

export type ListBlock = {
  readonly type: "list"
  readonly ordered: boolean
  readonly start: number | null
  readonly items: ReadonlyArray<ListItem>
}

export type CodeBlock = {
  readonly type: "code"
  readonly code: string
  readonly language: string
  readonly meta: string
}

export type HtmlNode = {
  readonly type: "html"
  readonly tag: string
  readonly attrs: Readonly<Record<string, string>>
  readonly children: ReadonlyArray<MarkdownBlock | MarkdownInline>
}

export type BlockquoteBlock = {
  readonly type: "blockquote"
  readonly blocks: ReadonlyArray<MarkdownBlock>
}

export type HrBlock = {
  readonly type: "hr"
}
