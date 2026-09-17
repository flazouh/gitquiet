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
  | { readonly at: "elsewhere"; readonly borrowed: Borrowed }

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
  /** What a statement passes on from somewhere else, which is a re-export. */
  readonly passedOn: (statement: Syntax) => Iterable<Borrowed>
}

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
): Found | null => found(root, source, at, new Map(), dialect)

/**
 * The same, with the scopes it worked out kept, for a caller asking many times.
 *
 * The path from the root to the Name is the scope chain, read from the inside
 * out — every scope the Name is in is a node it is inside, and nothing else is.
 * Which is why shadowing needs no rule of its own here: the inner scope is
 * simply the one asked first.
 */
const found = (root: Syntax, source: string, at: Spot, memo: Memo, dialect: Dialect): Found | null => {
  const path = pathTo(root, at)
  const name = path.at(-1)
  if (name === undefined || !dialect.names.has(name.type)) return null

  const lines = source.split("\n")

  for (let step = path.length - 1; step >= 0; step--) {
    const node = path[step]
    if (node === undefined || !dialect.opens.has(node.type)) continue

    const bound = declarationsOf(node, memo, dialect).get(name.text)
    if (bound === undefined) continue
    // An import binds the name, and where it was written is in another file.
    // What this file knows is what it states, which is enough for whoever can
    // read that file to finish the question. Pointing a reader at the import
    // line instead would be a Follow to the line they are already looking at.
    if (bound.kind === "import") {
      return bound.from === undefined ? null : { at: "elsewhere", borrowed: bound.from }
    }
    return {
      at: "here",
      writing: docked(written(bound.name, bound.kind, lines), bound.name, root, lines)
    }
  }
  return null
}

/**
 * The comment written above a Writing, where the line before it is one.
 *
 * What a reader wants on the card is the sentence somebody wrote about this,
 * and in this codebase that sentence is always directly above. Found by walking
 * rather than by reading the line, because a comment is a node and reading text
 * upwards would take a `//` inside a string with it.
 */
const docked = (
  writing: Writing,
  name: Syntax,
  root: Syntax,
  lines: ReadonlyArray<string>
): Writing => {
  const wanted = name.startPosition.row
  let found: Syntax | null = null

  const walk = (node: Syntax): void => {
    if (node.type === "comment" && node.endPosition.row < wanted) {
      // The nearest one above, and only if nothing but the declaration's own
      // opening lines sit between: a comment four lines up belongs to whatever
      // is four lines up.
      if (found === null || node.endPosition.row > found.endPosition.row) found = node
    }
    for (const child of childrenOf(node)) walk(child)
  }
  walk(root)

  if (found === null) return writing
  const comment = found as Syntax
  const gap = wanted - comment.endPosition.row
  if (gap > 2) return writing
  // A declaration is usually `export const` on the line the comment is above,
  // so one line of slack, and a second for a decorator or an `export` of its own.
  for (let row = comment.endPosition.row + 1; row < wanted; row++) {
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
    .map((line) => line.replace(/^\s*(\/\/\/?|\*)?\s?/, "").trimEnd())
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

  const walk = (node: Syntax): void => {
    if (dialect.names.has(node.type) && node.text === writing.name) {
      const here = found(root, source, node.startPosition, memo, dialect)
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

  const walk = (node: Syntax): void => {
    if (dialect.names.has(node.type)) {
      mentions.push({
        name: node.text,
        line: node.startPosition.row + 1,
        from: node.startPosition.column + 1,
        to: node.endPosition.column + 1
      })
    }

    const { outer, inner } = dialect.bindings(node)
    for (const bound of [...outer, ...inner]) {
      declares.add(bound.name.text)
      if (bound.from !== undefined) borrows.push(bound.from)
    }

    // A re-export borrows without binding, so it is walked for on its own and
    // adds to `borrows` and to nothing else. See {@link passedOn}.
    for (const from of dialect.passedOn(node)) borrows.push(from)

    for (const child of childrenOf(node)) walk(child)
  }
  walk(root)

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

  const walk = (node: Syntax, inside: boolean): void => {
    if (!inside) {
      const { outer } = dialect.bindings(node)
      for (const bound of outer) {
        // What a file borrowed and what its functions were handed are both
        // bindings and neither is something the file offers. A parameter
        // belongs to the one function that takes it, and a reader looking for
        // the shape of a file is not looking for an argument list.
        if (bound.kind === "import" || bound.kind === "parameter") continue
        found.push(docked(written(bound.name, bound.kind, lines), bound.name, root, lines))
      }
    }

    if (node.type === "class_body") {
      for (const member of childrenOf(node)) {
        const name = member.childForFieldName("name")
        if (name === null) continue
        if (member.type !== "method_definition" && member.type !== "public_field_definition") {
          continue
        }
        found.push(docked(written(name, "member", lines), name, root, lines))
      }
      return
    }

    // Anything with a body of its own is where the file stops offering and
    // starts working. Its insides are the author's business.
    const deeper = inside || node.type === "statement_block"
    for (const child of childrenOf(node)) walk(child, deeper)
  }

  walk(root, false)
  return found.sort((one, two) => one.line - two.line || one.from - two.from)
}
