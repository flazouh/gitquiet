/**
 * Where a name is written, inside the one file it is written in.
 *
 * Plan 011: a Name resolves by its scopes and by nothing else. A parameter, a
 * local, a name shadowed by an inner one, a name declared further down the file
 * than it is used — all Sure. A name that came from an import, or that is a
 * property of something, resolves to nothing here, and nothing is the honest
 * answer rather than a guess: 012 is where a Writing may live in another file.
 *
 * Pure, and structural over {@link Syntax}, so all of it is tested against a
 * real TypeScript grammar in `bun test` with no worker and no browser. See
 * `docs/spec/following.md` for the words — Name, Writing, Uses, Sure, Likely.
 */

import { childrenOf, holds, type Spot, type Syntax } from "./syntax"

/** What kind of thing a Writing writes down, for the card and the outline. */
export type WritingKind =
  | "function"
  | "class"
  | "type"
  | "value"
  | "parameter"
  | "import"
  | "member"

/** The one place a Name is written down. Lines and columns are one-based for a reader. */
export type Writing = {
  readonly name: string
  readonly kind: WritingKind
  readonly line: number
  readonly from: number
  readonly to: number
  /** The line it is written on, trimmed, for the card. */
  readonly signature: string
  /** The comment written above it, where there is one. */
  readonly doc: string | null
  /**
   * How this was arrived at. Always Sure in this file: everything here is
   * resolved by scope, and what cannot be is answered with nothing at all.
   */
  readonly sure: true
  /**
   * The file it is written in, where that is not the file that was asked.
   *
   * Only the exact tier fills this: it can follow a name into another file on
   * its own, where this one answers `elsewhere` and leaves the following to
   * whoever knows the repository.
   */
  readonly path?: string
  /** True where a compiler resolved it, rather than a reading of shapes. */
  readonly exact?: boolean
}

/**
 * A name this file borrowed, and where it said it came from.
 *
 * Not a Writing: nothing in this file knows where `./elsewhere` is on disk, and
 * a resolver that guessed would be guessing about a repository it cannot see.
 * What it knows is what the file *states* — the specifier, and the name as the
 * other file writes it, which is not the name this file reads if an alias was
 * used. Turning that into a path is `reaching.ts`, and asking that file is the
 * Ledger's.
 */
export type Borrowed = {
  /** The name as the file it came from writes it. `two`, in `two as three`. */
  readonly name: string
  /** As written: `./elsewhere`, `../domain/repoHome`, `effect`. */
  readonly specifier: string
}

/** Where a Name is written: in this file, or in one this file names. */
export type Found =
  | { readonly at: "here"; readonly writing: Writing }
  | {
      readonly at: "elsewhere"
      readonly borrowed: Borrowed
      /**
       * The other files this one took whole, said as specifiers.
       *
       * Specifiers rather than Borroweds because the name is the one that was
       * pressed and is the same for every one of them — a list of Borroweds
       * would be that name copied, beside a claim the file never made.
       */
      readonly orFrom?: ReadonlyArray<string>
    }

/** One place a Name is used, which is a line and the columns it sits between. */
export type Use = {
  readonly line: number
  readonly from: number
  readonly to: number
}

/**
 * What a language is, to a resolver that does not know any.
 *
 * Four questions, and every one of them is the grammar's vocabulary rather than
 * the walk: which node types open a scope, which are a name being read, what a
 * node binds into the scope around it, and what a statement passes on from
 * somewhere else. `src/ledger/dialects/typescript.ts` is the first answer to
 * them and `src/ledger/dialects/` is where a second language goes.
 *
 * The walk below is the part worth writing once. It was written against one
 * grammar and reads like it did — a scope is a scope, a name resolves to the
 * nearest binding of its spelling, and a file states what it borrowed — none of
 * which is a fact about TypeScript.
 */
export type Dialect = {
  /** The node types that open a scope. */
  readonly opens: ReadonlySet<string>
  /** The node types that are a name being read rather than a word inside something else. */
  readonly names: ReadonlySet<string>
  /**
   * What a node binds, into the scope it sits in and into the scope it opens.
   *
   * `outer` is a function's own name and its parameters; `inner` is the one a
   * `for` or a `catch` writes into the scope it opens rather than the one around
   * it. A language with neither returns two empty lists for that node.
   */
  readonly bindings: (
    node: Syntax
  ) => {
    readonly outer: ReadonlyArray<Bound>
    readonly inner: ReadonlyArray<Bound>
  }
  /**
   * Whether a name this file binds nowhere may be looked for in the files it
   * took whole, given the node it was pressed on and the node above it.
   *
   * Absent for most languages, and absent is the safe answer. A file that takes
   * another whole — `require_relative`, `#include` — says nothing about which
   * names came from it, so pointing a bare name at one is a guess. It is only
   * worth making where a guess cannot be wrong in the ordinary case:
   *
   *  - **C++ may.** A member is a `field_identifier` and is not a Name at all,
   *    so a bare identifier really is a free name.
   *  - **Ruby may, except through a receiver.** `x.risky` writes `risky` as the
   *    same `identifier` a free name uses, and what `x` is takes types to know.
   *  - **Go may not.** Its imports are used qualified — `shapes.Area` — so a
   *    bare name in Go is a name of its own package, written in a sibling file
   *    this never reads. Answering it with an imported package's name of the
   *    same spelling is the one mistake this feature exists to prevent.
   *  - **TypeScript may not.** `export * from` is a re-export: it passes names
   *    on rather than reading them, so nothing here arrived that way.
   */
  readonly looksWhole?: (name: Syntax, above: Syntax | null) => boolean
  /**
   * The package a name is read through, where it is written after one.
   *
   * Go uses what it imports qualified: `shapes.Area`, `shapes.Box`. The second
   * half is the name a reader presses and the first half says which import it
   * came through, so the answer is that import's, with the pressed name. A
   * qualifier this file binds as anything but an import is a value, and what a
   * value's member is takes types to know, so it answers nothing.
   *
   * Absent where a language has no such spelling, and nothing is asked.
   */
  readonly qualifierOf?: (name: Syntax, above: Syntax | null) => Syntax | null
  /**
   * The name an import binds where no node in the file says it.
   *
   * A Go import with no alias binds its package's name, which Go reads off the
   * package and not the file. That is usually the last part of the path, and
   * this says how it is usually spelled otherwise.
   */
  readonly namedBy?: (specifier: string) => string
  /**
   * What a statement passes on from somewhere else, which is a re-export.
   *
   * Absent where the language has none. Five of the ten carried an empty
   * generator to satisfy the shape, which is five files saying nothing in a way
   * that reads like they say something.
   */
  readonly passedOn?: (statement: Syntax) => Iterable<Borrowed>
  /**
   * The node types that are a comment.
   *
   * `comment` in most grammars, and not in all of them: Rust writes
   * `line_comment`, `block_comment` and `doc_comment`, and Java writes the first
   * two. Asked for rather than known, because a walk that knew would be a walk
   * that silently found no documentation in two of the ten languages.
   */
  readonly comments: ReadonlySet<string>
  /**
   * What a node offers the outline, and whether to look inside it.
   *
   * Three answers, because the outline has three cases and not two. A class
   * offers its members and is not walked into. A body offers nothing and is not
   * walked into either — that is where the file stops offering and starts
   * working. Anything else answers nothing and the walk carries on.
   *
   * Asked of the node rather than read off its type because a body is not always
   * a node type of its own. Every body in Ruby is a `body_statement`, a method's
   * and a class's alike, so no set of node types can tell them apart and only the
   * thing around it can.
   */
  readonly offering: (node: Syntax) => Offering | null
}

/** What a node offers the outline. See {@link Dialect.offering}. */
export type Offering =
  | { readonly at: "members"; readonly members: ReadonlyArray<Bound> }
  | { readonly at: "working" }

/** A name, the node that wrote it, and what kind of writing that was. */
export type Bound = {
  readonly name: Syntax
  readonly kind: WritingKind
  /** Where it came from, on an import and nowhere else. */
  readonly from?: Borrowed
}

/**
 * What one scope declares, gathered by walking it and stopping at the scopes
 * inside it.
 *
 * Keyed by nothing. The first version of this walked the file once, built a map
 * from node to scope and looked the node up — which answered `undefined` for
 * every name in the file, because tree-sitter hands out a fresh JavaScript
 * object each time a child is asked for. Two objects for one node are not equal
 * and never will be, so a `Map` keyed by node is a map that is never hit. This
 * asks a node what it declares instead of asking a table what a node is.
 */
const declaredIn = (scope: Syntax, dialect: Dialect): Map<string, Bound> => {
  const declared = new Map<string, Bound>()

  // Already there stays: an overload, or a `var` written twice, is one name to a
  // reader, and the first is the one a file read top to bottom shows them.
  const keep = (bound: Bound): void => {
    if (!declared.has(bound.name.text)) declared.set(bound.name.text, bound)
  }

  for (const bound of dialect.bindings(scope).inner) keep(bound)

  const walk = (node: Syntax): void => {
    for (const bound of dialect.bindings(node).outer) keep(bound)
    // A nested scope's insides are its own business. Its name, where it has one,
    // was taken on the line above before this returned.
    if (dialect.opens.has(node.type)) return
    for (const child of childrenOf(node)) walk(child)
  }
  for (const child of childrenOf(scope)) walk(child)

  return declared
}

/** What a scope declares, worked out once per lookup rather than per name. */
type Memo = Map<string, Map<string, Bound>>

/** A node's place in the file, which is the one thing about it that is stable. */
const idOf = (node: Syntax): string =>
  `${node.startPosition.row}:${node.startPosition.column}:${node.endPosition.row}:${node.endPosition.column}:${node.type}`

const declarationsOf = (scope: Syntax, memo: Memo, dialect: Dialect): Map<string, Bound> => {
  const id = idOf(scope)
  const held = memo.get(id)
  if (held !== undefined) return held

  const declared = declaredIn(scope, dialect)
  memo.set(id, declared)
  return declared
}

/** The smallest named node holding the spot, and the chain of nodes down to it. */
const pathTo = (root: Syntax, at: Spot): ReadonlyArray<Syntax> => {
  const path: Array<Syntax> = []
  let node: Syntax | null = holds(root, at) ? root : null

  while (node !== null) {
    path.push(node)
    let next: Syntax | null = null
    for (const child of childrenOf(node)) {
      if (holds(child, at)) {
        next = child
        break
      }
    }
    node = next
  }
  return path
}

/** One node turned into the Writing a reader is shown. */
const written = (name: Syntax, kind: WritingKind, lines: ReadonlyArray<string>): Writing => ({
  name: name.text,
  kind,
  line: name.startPosition.row + 1,
  from: name.startPosition.column + 1,
  to: name.endPosition.column + 1,
  signature: (lines[name.startPosition.row] ?? "").trim(),
  doc: null,
  sure: true
})

/**
 * The Writing for the Name at a spot, or nothing.
 *
 * Nothing is a real answer and the common one: a property, a keyword, a string,
 * a name that came from another file. The interface draws no underline for it,
 * because an underline that leads nowhere is worse than none.
 *
 * The spot is the renderer's own — both zero-based — because that is what the
 * token events hand over. What comes back is one-based, because that is what a
 * reader and an address both mean by a line.
 */
export const writingAt = (
  root: Syntax,
  source: string,
  at: Spot,
  dialect: Dialect
): Found | null =>
  found(root, source, at, new Map(), dialect, commentsBy(root, dialect), onceWhole(root, dialect))

/**
 * The same, with the scopes it worked out kept, for a caller asking many times.
 *
 * The path from the root to the Name is the scope chain, read from the inside
 * out — every scope the Name is in is a node it is inside, and nothing else is.
 * Which is why shadowing needs no rule of its own here: the inner scope is
 * simply the one asked first.
 */
const found = (
  root: Syntax,
  source: string,
  at: Spot,
  memo: Memo,
  dialect: Dialect,
  comments: ReadonlyMap<number, Syntax>,
  /**
   * Worked out once by the caller, for the reason the comments are.
   *
   * `usesIn` asks this once per mention of a name, and walking the tree for the
   * file's borrows on each of those is the same shape as the quadratic
   * {@link commentsBy} was written to remove.
   */
  whole: () => ReadonlyArray<Borrowed>
): Found | null => {
  const path = pathTo(root, at)
  const name = path.at(-1)
  if (name === undefined) return null

  // Asked before the name is, because `shapes.Box` is never the file's own `Box`.
  const qualifier = dialect.qualifierOf?.(name, path.at(-2) ?? null) ?? null
  if (qualifier !== null) return throughQualifier(name, qualifier, path, memo, dialect, whole)

  if (!dialect.names.has(name.type)) return null

  const bound = boundIn(path, name.text, memo, dialect)
  if (bound !== undefined) {
    // An import binds the name, and where it was written is in another file.
    // What this file knows is what it states, which is enough for whoever can
    // read that file to finish the question. Pointing a reader at the import
    // line instead would be a Follow to the line they are already looking at.
    if (bound.kind === "import") {
      return bound.from === undefined ? null : { at: "elsewhere", borrowed: bound.from }
    }
    const lines = source.split("\n")
    return {
      at: "here",
      writing: docked(written(bound.name, bound.kind, lines), bound.name, comments, lines)
    }
  }

  /*
   * Bound nowhere in this file, which for two of the ten languages is where the
   * answer starts rather than where it stops.
   *
   * C++'s `#include` and Ruby's `require_relative` bring in everything another
   * file writes and name none of it, so a name that came through one is a name
   * this file never binds. What the file does say is which files it took whole.
   *
   * Only where the Dialect says a guess cannot be wrong in the ordinary case,
   * which is the whole of {@link Dialect.looksWhole}: a bare name in Go is a
   * name of its own package and not of an imported one, and answering it with an
   * imported package's name of the same spelling would be a press landing on
   * somebody else's name.
   */
  if (dialect.looksWhole === undefined) return null
  if (!dialect.looksWhole(name, path.at(-2) ?? null)) return null

  const took = whole()
  const first = took[0]
  if (first === undefined) return null
  return {
    at: "elsewhere",
    borrowed: { name: name.text, specifier: first.specifier },
    ...(took.length > 1 ? { orFrom: took.slice(1).map((one) => one.specifier) } : {})
  }
}

/**
 * The nearest binding of a spelling, from the innermost scope on the path out.
 *
 * The path from the root to the Name is the scope chain read from the inside
 * out, which is why shadowing needs no rule of its own: the inner scope is
 * simply the one asked first.
 */
const boundIn = (
  path: ReadonlyArray<Syntax>,
  text: string,
  memo: Memo,
  dialect: Dialect
): Bound | undefined => {
  for (let step = path.length - 1; step >= 0; step--) {
    const node = path[step]
    if (node === undefined || !dialect.opens.has(node.type)) continue
    const bound = declarationsOf(node, memo, dialect).get(text)
    if (bound !== undefined) return bound
  }
  return undefined
}

/**
 * A name read through a package: `Area` in `shapes.Area`.
 *
 * The qualifier is looked up where the name is, since it is written beside it.
 * An alias is bound, as an import, and says its path. A plain import binds no
 * node, so the qualifier is bound nowhere and is matched against the name each
 * import implies. Anything else the qualifier is bound as is a value, and see
 * {@link Dialect.qualifierOf} for why that answers nothing.
 */
const throughQualifier = (
  name: Syntax,
  qualifier: Syntax,
  path: ReadonlyArray<Syntax>,
  memo: Memo,
  dialect: Dialect,
  whole: () => ReadonlyArray<Borrowed>
): Found | null => {
  const bound = boundIn(path, qualifier.text, memo, dialect)
  if (bound !== undefined) {
    if (bound.kind !== "import" || bound.from === undefined) return null
    return { at: "elsewhere", borrowed: { name: name.text, specifier: bound.from.specifier } }
  }
  const through = whole().find((one) => dialect.namedBy?.(one.specifier) === qualifier.text)
  return through === undefined
    ? null
    : { at: "elsewhere", borrowed: { name: name.text, specifier: through.specifier } }
}

/**
 * The same, worked out at most once however many times it is asked for.
 *
 * Most presses land on a name the file binds and never reach the fallback, so
 * the walk is worth not making; a sweep that reaches it once reaches it for
 * every mention, so it is worth not making twice.
 */
const onceWhole = (root: Syntax, dialect: Dialect): (() => ReadonlyArray<Borrowed>) => {
  let held: ReadonlyArray<Borrowed> | undefined
  return () => {
    if (held === undefined) held = wholeFileBorrows(root, dialect)
    return held
  }
}

/**
 * The files this one borrowed whole, which name nothing they brought in.
 *
 * Only the `*` ones: a named borrow binds the name it brought and is found by
 * the walk above long before this. Walked on demand rather than kept, because
 * most presses land on a name the file does bind and never ask.
 */
const wholeFileBorrows = (root: Syntax, dialect: Dialect): ReadonlyArray<Borrowed> => {
  if (dialect.passedOn === undefined) return []
  const whole: Array<Borrowed> = []
  const walk = (node: Syntax): void => {
    for (const from of dialect.passedOn!(node)) {
      if (from.name === "*") whole.push(from)
    }
    for (const child of childrenOf(node)) walk(child)
  }
  walk(root)
  return whole
}

/**
 * The row a comment's text ends on, which is not always where the node ends.
 *
 * Rust's `line_comment` takes the newline that ends it into its own text, so a
 * `///` written directly above a function has an end row equal to the function's
 * own — and looking one row up for it found nothing, which is why Rust had no
 * documentation on any card. Counting the row the text ends on rather than the
 * row the node ends on answers both shapes with one rule.
 */
const endRowOf = (node: Syntax): number =>
  node.text.endsWith("\n") ? node.endPosition.row - 1 : node.endPosition.row

/**
 * Every comment in a file, by the row it ends on.
 *
 * Walked once per file rather than once per Writing, which is the whole of this.
 * {@link docked} used to walk the tree from the root looking for the nearest
 * comment above one name, and it was called for every name in the file — so
 * reading a file cost the size of the file times the number of things in it.
 * Measured on this repository's own fixture repeated: 14KB took 83ms and 27KB
 * took 297ms, which is four times the work for twice the file and is the shape
 * of a quadratic rather than of a cost.
 *
 * A row rather than a range because {@link docked} only ever asks about the row
 * above a name and the one above that — a comment further up belongs to whatever
 * is further up. The first comment to end on a row wins, which is what walking
 * in tree order used to give.
 */
const commentsBy = (root: Syntax, dialect: Dialect): ReadonlyMap<number, Syntax> => {
  const byRow = new Map<number, Syntax>()
  const walk = (node: Syntax): void => {
    if (dialect.comments.has(node.type)) {
      const row = endRowOf(node)
      if (!byRow.has(row)) byRow.set(row, node)
    }
    for (const child of childrenOf(node)) walk(child)
  }
  walk(root)
  return byRow
}

/**
 * The comment written above a Writing, where the line before it is one.
 *
 * What a reader wants on the card is the sentence somebody wrote about this,
 * and in this codebase that sentence is always directly above. Found among the
 * comments rather than by reading the line, because a comment is a node and
 * reading text upwards would take a `//` inside a string with it.
 */
const docked = (
  writing: Writing,
  name: Syntax,
  comments: ReadonlyMap<number, Syntax>,
  lines: ReadonlyArray<string>
): Writing => {
  const wanted = name.startPosition.row

  // The row above, then the one above that. A declaration is usually on the line
  // the comment is above, so one line of slack, and a second for a blank line
  // between the two.
  const above = comments.get(wanted - 1)
  const higher = above === undefined ? comments.get(wanted - 2) : undefined
  const comment = above ?? higher
  if (comment === undefined) return writing

  for (let row = endRowOf(comment) + 1; row < wanted; row++) {
    if ((lines[row] ?? "").trim() !== "") return writing
  }

  return { ...writing, doc: clean(comment.text) }
}

/** A comment as prose: the fences, the stars and the slashes taken off. */
const clean = (comment: string): string =>
  comment
    .replace(/^\/\*\*?/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    // `#` as well as `//`: Python, Ruby and PHP all write a comment that way,
    // and a card that kept the marker showed the reader "# What it is for."
    .map((line) => line.replace(/^\s*(\/\/\/?|#+|\*)?\s?/, "").trimEnd())
    .join("\n")
    .trim()

/**
 * Everywhere in this file that means the same Writing.
 *
 * Every Name of that text is resolved rather than counted: `shape` inside a
 * function that declares its own `shape` is a different thing with the same
 * spelling, and a count that included it would be a count of a word rather than
 * of a name. The one test nobody should be able to delete.
 */
export const usesIn = (
  root: Syntax,
  source: string,
  writing: Writing,
  dialect: Dialect
): ReadonlyArray<Use> => {
  const uses: Array<Use> = []
  // One memo for the whole sweep. Without it every occurrence of the name walks
  // the file's scope again, which is the same answer worked out as many times as
  // the word appears.
  const memo: Memo = new Map()
  // And one comment index, for the same reason. Built per answer, this walked
  // the whole tree once for every use of the name — which is the cost the note
  // on `commentsBy` says was taken out of `writingsIn`, left in the hot path.
  const comments = commentsBy(root, dialect)
  const whole = onceWhole(root, dialect)

  const walk = (node: Syntax): void => {
    if (dialect.names.has(node.type) && node.text === writing.name) {
      const here = found(root, source, node.startPosition, memo, dialect, comments, whole)
      if (
        here !== null &&
        here.at === "here" &&
        here.writing.line === writing.line &&
        here.writing.from === writing.from
      ) {
        uses.push({
          line: node.startPosition.row + 1,
          from: node.startPosition.column + 1,
          to: node.endPosition.column + 1
        })
      }
    }
    for (const child of childrenOf(node)) walk(child)
  }
  walk(root)

  return uses
}

/**
 * The Writing this file gives a name, for a file that borrowed it.
 *
 * The other half of Following across files. One file says "I read `two` from
 * `./whole`"; this is what `./whole` is asked, and it answers with the one
 * Writing of that name the file offers.
 *
 * `default` is what an unnamed export is called by everyone who imports it, and
 * `*` is a whole module. Neither is a name in the file, so both answer with the
 * file's first Writing — which is the honest best a reader can be given without
 * reading what the export actually is, and is nearly always right for the
 * one-thing-per-file this codebase and most others are written in.
 */
export const writingNamed = (
  root: Syntax,
  source: string,
  name: string,
  dialect: Dialect
): Writing | null => {
  const offered = writingsIn(root, source, dialect)
  if (name === "default" || name === "*") return offered[0] ?? null

  return offered.find((writing) => writing.name === name) ?? null
}

/**
 * One mention of a name: where a word that could be a name appears.
 *
 * Not yet a Use. Whether it means a particular Writing is a question about
 * scopes and imports; this is only where the word is, which is what a Ledger can
 * afford to keep for every file in a repository.
 */
export type Mention = {
  readonly name: string
  readonly line: number
  readonly from: number
  readonly to: number
}

/** What one file says about the world outside it, for a Ledger to keep. */
export type Told = {
  /** What the file offers: its declarations and its classes' members. */
  readonly writings: ReadonlyArray<Writing>
  /** Every word in it that could be a name, with where it is. */
  readonly mentions: ReadonlyArray<Mention>
  /** Every name bound anywhere in it, locals and parameters included. */
  readonly declares: ReadonlyArray<string>
  /** What it borrowed, and from where. */
  readonly borrows: ReadonlyArray<Borrowed>
}

/** Where a word is, as a Mention of it. */
const mentionOf = (node: Syntax): Mention => ({
  name: node.text,
  line: node.startPosition.row + 1,
  from: node.startPosition.column + 1,
  to: node.endPosition.column + 1
})

/**
 * Everything a Ledger keeps about one file, in one walk.
 *
 * Three questions asked together rather than three walks: a repository is read
 * whole, and the difference between walking a file once and walking it four
 * times is the difference between three seconds and twelve.
 *
 * What is deliberately *not* here is which mention means which Writing. That
 * needs the scopes, which needs the file, and a Ledger that resolved every name
 * in every file at reading time would be doing the work of every question
 * nobody asked. The mentions are the candidates; `docs/spec/following.md` says
 * what turns one into a Sure or a Likely.
 */
export const toldBy = (root: Syntax, source: string, dialect: Dialect): Told => {
  const mentions: Array<Mention> = []
  const declares = new Set<string>()
  const borrows: Array<Borrowed> = []
  /** Names read through something, kept until it is known which of those are packages. */
  const qualified: Array<{ readonly mention: Mention; readonly through: string }> = []
  /** What this file calls the packages it imported: an alias, or the name the path implies. */
  const packages = new Set<string>()

  const walk = (node: Syntax, above: Syntax | null): void => {
    const qualifier = dialect.qualifierOf?.(node, above) ?? null
    if (qualifier !== null) qualified.push({ mention: mentionOf(node), through: qualifier.text })
    else if (dialect.names.has(node.type)) mentions.push(mentionOf(node))

    const { outer, inner } = dialect.bindings(node)
    for (const bound of [...outer, ...inner]) {
      declares.add(bound.name.text)
      if (bound.from === undefined) continue
      borrows.push(bound.from)
      if (bound.kind === "import") packages.add(bound.name.text)
    }

    // A re-export borrows without binding, so it is walked for on its own and
    // adds to `borrows` and to nothing else. See {@link passedOn}.
    if (dialect.passedOn !== undefined) {
      for (const from of dialect.passedOn(node)) {
        borrows.push(from)
        if (dialect.namedBy !== undefined) packages.add(dialect.namedBy(from.specifier))
      }
    }

    for (const child of childrenOf(node)) walk(child, node)
  }
  walk(root, null)

  /*
   * A name read through a package is a use of that package's name: `Area` in
   * `shapes.Area`. Read through anything else it is a value's member, and
   * counting it would make every `.Close()` in a file that imports a package a
   * Sure use of that package's `Close` — so it is left out, as a field was.
   */
  for (const one of qualified) {
    if (packages.has(one.through)) mentions.push(one.mention)
  }
  // In the order they are written, which is the order a panel lists them in.
  if (qualified.length > 0) mentions.sort((a, b) => a.line - b.line || a.from - b.from)

  return {
    writings: writingsIn(root, source, dialect),
    mentions,
    declares: [...declares],
    borrows
  }
}

/**
 * The Writings this file holds, in the order they are written.
 *
 * The outline, which is the cheapest proof the resolver works and the thing a
 * reader opens to find their way around a file they did not write. What is in
 * it is what the file *offers*: its own declarations and its classes' members.
 * A local inside a function is not — a reader looking for the shape of a file
 * does not want its every temporary — and neither is an import, which is a name
 * this file borrowed rather than one it wrote.
 */
export const writingsIn = (
  root: Syntax,
  source: string,
  dialect: Dialect
): ReadonlyArray<Writing> => {
  const lines = source.split("\n")
  const found: Array<Writing> = []
  // Once for the file, not once for each thing in it. See {@link commentsBy}.
  const comments = commentsBy(root, dialect)

  // No `inside` flag any more: the walk stops at a body rather than carrying on
  // through it offering nothing, so anything it reaches is something the file
  // offers. That also settles a nested class — its members used to be offered
  // out of a function body while the class itself was hidden, because the
  // members were read before the flag was consulted.
  const walk = (node: Syntax): void => {
    const { outer } = dialect.bindings(node)
    for (const bound of outer) {
      // What a file borrowed and what its functions were handed are both
      // bindings and neither is something the file offers. A parameter belongs
      // to the one function that takes it, and a reader looking for the shape of
      // a file is not looking for an argument list.
      if (bound.kind === "import" || bound.kind === "parameter") continue
      found.push(docked(written(bound.name, bound.kind, lines), bound.name, comments, lines))
    }

    // A class offers its members and nothing else of what is inside it; a body
    // offers nothing at all. Neither is walked into.
    const offering = dialect.offering(node)
    if (offering !== null) {
      if (offering.at === "members") {
        for (const member of offering.members) {
          found.push(docked(written(member.name, member.kind, lines), member.name, comments, lines))
        }
      }
      return
    }

    for (const child of childrenOf(node)) walk(child)
  }

  walk(root)
  return found.sort((one, two) => one.line - two.line || one.from - two.from)
}
