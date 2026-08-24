export type MarkdownDocument = {
  readonly blocks: ReadonlyArray<MarkdownBlock>
  readonly footnotes: ReadonlyArray<Footnote>
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
  | AlertBlock
  | SourcesBlock

export type HeadingBlock = {
  readonly type: "heading"
  readonly depth: 1 | 2 | 3 | 4 | 5 | 6
  readonly children: ReadonlyArray<MarkdownInline>
}

export type ParagraphBlock = {
  readonly type: "paragraph"
  readonly children: ReadonlyArray<MarkdownInline>
}

export type MarkdownInline =
  | TextInline
  | LinkInline
  | ImageInline
  | HtmlNode
  | StrongInline
  | EmInline
  | DeleteInline
  | CodeInline
  | MentionInline
  | IssueInline
  | EmojiInline
  | FootnoteRefInline

export type TextInline = {
  readonly type: "text"
  readonly text: string
}

export type LinkInline = {
  readonly type: "link"
  readonly href: string | null
  readonly children: ReadonlyArray<MarkdownInline>
}

/**
 * A picture, which on the page most readers meet first is most of what is on it.
 *
 * The alt text is not optional here even though it is in the markdown, because a picture
 * with nothing said about it is a gap in a screen reader's account of the page. An empty
 * string is the honest answer where the writer gave none, and it is what `<img alt="">`
 * means: decoration, skip it.
 */
export type ImageInline = {
  readonly type: "image"
  readonly src: string
  readonly alt: string
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

export type MentionInline = {
  readonly type: "mention"
  readonly login: string
}

export type IssueInline = {
  readonly type: "issue"
  readonly owner: string
  readonly repo: string
  readonly number: number
  readonly label: string
}

export type EmojiInline = {
  readonly type: "emoji"
  readonly name: string
  readonly character: string
}

export type FootnoteRefInline = {
  readonly type: "footnote-ref"
  readonly id: string
}

export type Footnote = {
  readonly id: string
  readonly blocks: ReadonlyArray<MarkdownBlock>
}

export type AlertKind = "note" | "tip" | "important" | "warning" | "caution"

export type AlertBlock = {
  readonly type: "alert"
  readonly kind: AlertKind
  readonly blocks: ReadonlyArray<MarkdownBlock>
}

export type ParseOptions = {
  readonly owner?: string
  readonly repo?: string
  /**
   * Which commit or branch a relative address means, where the caller knows.
   *
   * Left out, a relative address is read from `HEAD`, which their raw host resolves to
   * whatever the repository's default branch is. That is right for a README on a front
   * page and for the body of an issue, and wrong only for markdown read out of a branch
   * that is not the default one, where the caller has the ref to hand and can say so.
   */
  readonly branch?: string
  /**
   * The path of the file this markdown was read out of, from the root of the repository.
   *
   * A README beside its pictures writes `images/one.png`, and that means beside the README
   * rather than at the top of the repository. Left out, an address is read from the root,
   * which is where GitHub reads the body of an issue or a comment from: those are not files
   * and have no directory to be beside.
   */
  readonly at?: string
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

/**
 * A run of link reference definitions, kept where the writer put them.
 *
 * The lexer consumes these lines to power the reference links above, and every
 * renderer that stops there draws nothing for them — which is right for a
 * definition tucked between paragraphs and wrong for the common case: a
 * References section that is nothing but definitions, ending the document at
 * an empty heading. The addresses are the section's content, so they stay.
 */
export type SourcesBlock = {
  readonly type: "sources"
  readonly entries: ReadonlyArray<SourceEntry>
}

export type SourceEntry = {
  /** The label the body cites, as written between its brackets. */
  readonly label: string
  /** The address as the writer spelt it, which is what the row shows. */
  readonly said: string
  /** The same address once vetted, or nothing where it may not be followed. */
  readonly href: string | null
  readonly title: string | null
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
