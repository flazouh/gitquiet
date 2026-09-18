import type { WritingKind } from "./writings"

/**
 * What this side of the Ledger needs a syntax tree to be, and no more than that.
 *
 * Tree-sitter's own `Node` satisfies it, and so would anything else with the same
 * five questions — which is the point. The resolver is the part of Following
 * where the care goes, it is pure, and it is the part most worth testing without
 * a parser, a worker or a browser anywhere near it. A structural type is what
 * keeps `web-tree-sitter` out of every file but the one that loads it.
 *
 * `parent` is deliberately absent. Tree-sitter has one; walking down and
 * carrying the scope along is how the resolver is written anyway, and a type
 * that asked for it would be a type only tree-sitter could satisfy.
 */
export type Syntax = {
  readonly type: string
  readonly text: string
  readonly startPosition: Spot
  readonly endPosition: Spot
  readonly namedChildCount: number
  readonly namedChild: (at: number) => Syntax | null
  readonly childForFieldName: (name: string) => Syntax | null
}

/** Tree-sitter's own coordinates: both zero-based, the column in UTF-16 units. */
export type Spot = { readonly row: number; readonly column: number }

/** The named children, as something that can be walked rather than indexed. */
export const childrenOf = function* (node: Syntax): Generator<Syntax> {
  for (let at = 0; at < node.namedChildCount; at++) {
    const child = node.namedChild(at)
    if (child !== null) yield child
  }
}

/** Whether a spot is inside a node, with the end exclusive as a range's end is. */
export const holds = (node: Syntax, at: Spot): boolean => {
  const after = node.startPosition.row < at.row ||
    (node.startPosition.row === at.row && node.startPosition.column <= at.column)
  const before = node.endPosition.row > at.row ||
    (node.endPosition.row === at.row && node.endPosition.column > at.column)
  return after && before
}

/**
 * What a declaring node's kind is called, read off a table.
 *
 * Every vocabulary answers this the same way — a node type in, a WritingKind
 * out, `"value"` for anything unlisted — and each used to write that as a chain
 * of `if`s. Nine chains came to about two hundred lines saying what nine tables
 * say, and a table is the thing a reader wants to check a language against.
 */
export const kindFrom =
  (kinds: Readonly<Record<string, WritingKind>>) =>
  (declaring: string): WritingKind =>
    kinds[declaring] ?? "value"

/**
 * The extension a path is written under, lowercased, or nothing.
 *
 * Read off the last segment so that `a.b/c` has none, and off the last dot so
 * that `Component.test.tsx` is `tsx` and `.d.ts` is `ts` — the plain rule already
 * holds for that one. A name whose only dot leads it is not an extension:
 * `.gitignore` is a name, and reading it as one gave a dotfile a grammar it had
 * no business having.
 *
 * Three places asked this and three spelled it differently; one of the three had
 * no last-segment guard, so `a.b/c` answered `b/c`.
 */
export const extensionOf = (path: string): string | null => {
  const name = path.slice(path.lastIndexOf("/") + 1)
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return null
  return name.slice(dot + 1).toLowerCase()
}

/**
 * The text a string literal holds, without the quotes around it.
 *
 * Every grammar here wraps a string's text in a child of its own and calls that
 * child something slightly different — `string_fragment` in TypeScript,
 * `string_content` in Python, Ruby, PHP and C++, and `*_content` in Go, which
 * has two kinds of string literal. So the caller says which wrappers count as a
 * string and this finds the one child inside.
 *
 * Nothing where the node is not a string at all, which is how a caller asks
 * "is this a string, and what does it say" in one question.
 */
export const textOf = (node: Syntax | null, wrappers: ReadonlySet<string>): string | null => {
  if (node === null || !wrappers.has(node.type)) return null
  for (const child of childrenOf(node)) {
    if (child.type.endsWith("_content") || child.type === "string_fragment") return child.text
  }
  return null
}

/**
 * The last name in a dotted path, which is the name an import binds.
 *
 * `java.util.Map.Entry` binds `Entry`, `App.Other.Thing` binds `Thing` and
 * `App\\Other\\Thing` binds the same. Three grammars spell the wrapper three
 * ways — `scoped_identifier`, `qualified_name` — and two spell the leaf
 * `identifier` where the third spells it `name`, so the caller says which is
 * which and the walk is the same.
 *
 * Walked rather than asked for by field, because PHP's qualified name holds its
 * segments as siblings with no `name` field to ask for.
 */
export const lastNameIn = (
  node: Syntax,
  leaf: string,
  wrappers: ReadonlySet<string>
): Syntax | null => {
  if (node.type === leaf) return node
  if (!wrappers.has(node.type)) return null
  const named = node.childForFieldName("name")
  if (named !== null) return lastNameIn(named, leaf, wrappers)
  let last: Syntax | null = null
  for (const child of childrenOf(node)) {
    if (child.type === leaf || wrappers.has(child.type)) last = child
  }
  return last === null ? null : lastNameIn(last, leaf, wrappers)
}

/**
 * A dotted path split into where it came from and nothing else.
 *
 * `java.util.Map` is `java.util`, and a path with one segment came from nowhere
 * this can name, which is itself. Written once because three vocabularies did
 * the same `lastIndexOf` and `slice` with two different separators.
 */
export const pathBefore = (whole: string, separator: string): string => {
  const at = whole.lastIndexOf(separator)
  return at === -1 ? whole : whole.slice(0, at)
}

/**
 * A walk down a binding shape to the names at the bottom of it.
 *
 * Four vocabularies wrote the same recursion: if this node is a name, yield it;
 * if it is a shape that holds names, go into it; otherwise it binds nothing.
 * Only the two sets of node types differ, so they are what is handed in.
 *
 * `through` is for the one shape that is not "look at every child". `{ a: b }`
 * binds `b` and reads `a` off the object, and a parameter with a type holds its
 * name under a field — in both, one child is the binding and the others are
 * not. A vocabulary with no such shape leaves it out.
 */
export const namesUnder = (
  leaves: ReadonlySet<string>,
  wrappers: ReadonlySet<string>,
  through?: (node: Syntax) => Syntax | null
): ((node: Syntax | null) => Generator<Syntax>) => {
  const walk = function* (node: Syntax | null): Generator<Syntax> {
    if (node === null) return
    if (leaves.has(node.type)) {
      yield node
      return
    }
    if (!wrappers.has(node.type)) return
    const one = through === undefined ? null : through(node)
    if (one !== null) {
      yield* walk(one)
      return
    }
    for (const child of childrenOf(node)) yield* walk(child)
  }
  return walk
}
