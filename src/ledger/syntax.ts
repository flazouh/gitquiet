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
