/**
 * What Rust is, said in node types.
 *
 * Block-scoped, like Go and unlike Python, and with more places that open a
 * scope than either: a `match` arm binds the names its pattern names, an `if
 * let` binds for the length of its branch, and a closure binds its parameters.
 * Each of those is a scope a reader can see the edge of, and a resolver that
 * missed one would answer a name inside it with whatever the file declared
 * outside — which is the one failure worth more than all the others put
 * together.
 *
 * `impl Box` is a scope of its own rather than part of `Box`. A method is
 * written inside it and the type is written elsewhere, so a type's methods are
 * not reachable from the type in the way a class's are — the outline offers each
 * `impl` block where it stands, which is where a reader is looking for it.
 *
 * A name a `use` brings in is followed by nothing here yet: a Rust path is not a
 * file path, and `std::io::Read` resolves against a crate rather than against a
 * tree of files. What the file borrowed is recorded, so the answer can arrive
 * later without the vocabulary changing.
 */

import type { Bound, Dialect, Offering, WritingKind } from "../writings"
import { childrenOf, kindFrom, namesUnder, type Syntax } from "../syntax"

/**
 * The node types that open a scope.
 *
 * `match_arm` and `if_expression` are the two worth naming: both bind through a
 * pattern rather than through a declaration, and both hold what they bind to one
 * branch. `let_declaration` is not here — a `let` binds into the block around it
 * and a second `let` of the same name shadows the first, which is the ordinary
 * rule this walk already applies by keeping the first of a spelling in a scope.
 */
const OPENS: ReadonlySet<string> = new Set([
  "source_file",
  "function_item",
  // A signature with no body is still a scope: it binds its parameters and its
  // generics exactly as a function with one does. The same rule TypeScript's
  // `function_signature` is here for.
  "function_signature_item",
  "closure_expression",
  "block",
  "for_expression",
  "while_expression",
  "loop_expression",
  "if_expression",
  "match_arm",
  "impl_item",
  "trait_item",
  "struct_item",
  "enum_item",
  "union_item",
  "mod_item"
])

/**
 * The node types that are a name being read.
 *
 * `field_identifier` is not one, for the reason it is not one in Go: a field is
 * reached through the thing that holds it. `primitive_type` is not one either —
 * `i32` is a keyword wearing a type's clothes, and there is nowhere to follow it
 * to.
 */
const NAMES: ReadonlySet<string> = new Set(["identifier", "type_identifier"])

/** What a declaring node's kind is called, for the card and the outline. */
const KINDS: Readonly<Record<string, WritingKind>> = {
  function_item: "function",
  function_signature_item: "function",
  closure_expression: "function",
  struct_item: "type",
  enum_item: "type",
  trait_item: "type",
  union_item: "type",
  type_item: "type",
  parameter: "parameter",
  type_parameter: "parameter",
  use_declaration: "import"
}

const kindOf = kindFrom(KINDS)

/**
 * A pattern's names, which is one identifier or a nest of them.
 *
 * `let (a, b) = ...`, `Some(v)`, `Point { x, y }` and `[first, ..]` all bind
 * through shapes that hold shapes, so this is recursive for the same reason
 * every other one here is.
 *
 * A `scoped_identifier` inside a pattern binds nothing: the `Some` of `Some(v)`
 * names a variant that exists elsewhere, and only what it holds is written down
 * here. Which is why a tuple struct pattern is walked for its own children
 * rather than taken whole.
 */
const boundBy = namesUnder(
  new Set(["identifier"]),
  new Set([
    "tuple_pattern",
    "tuple_struct_pattern",
    "struct_pattern",
    "slice_pattern",
    "ref_pattern",
    "mut_pattern",
    "or_pattern",
    "reference_pattern",
    "field_pattern",
    "captured_pattern"
  ])
)

/**
 * What one `use` tree brings into the file, and where each name came from.
 *
 * `use a::b::C` binds `C` and says it came from `a::b`, which is the split every
 * Borrowed is: the last segment is the name the other module writes, and what
 * comes before it is where. `use a::b::C as D` binds `D` and says the same
 * about `C`. `use a::{b, c}` is a prefix and a list, and each member of the list
 * is read against that prefix.
 *
 * None of these is followed yet — a Rust path resolves against a crate and not
 * against the tree of files an archive holds — and all of them are recorded, so
 * the answer can arrive later without this changing.
 */
const splitOf = (path: Syntax): { readonly name: Syntax; readonly from: string } | null => {
  if (path.type === "identifier" || path.type === "type_identifier") {
    return { name: path, from: "" }
  }
  if (path.type !== "scoped_identifier") return null
  const last = path.childForFieldName("name")
  const prefix = path.childForFieldName("path")
  if (last === null) return null
  return { name: last, from: prefix === null ? "" : prefix.text }
}

/** Every name one `use` tree brings in, read against the prefix it sits under. */
const used = function* (node: Syntax, under: string): Generator<Bound> {
  const joined = (from: string): string =>
    under === "" ? from : from === "" ? under : `${under}::${from}`

  if (node.type === "use_as_clause") {
    const alias = node.childForFieldName("alias")
    const what = node.childForFieldName("path")
    if (alias === null || what === null) return
    const split = splitOf(what)
    yield {
      name: alias,
      kind: "import",
      from: {
        name: split === null ? what.text : split.name.text,
        specifier: joined(split === null ? "" : split.from)
      }
    }
    return
  }

  if (node.type === "scoped_use_list" || node.type === "use_list") {
    const prefix = node.childForFieldName("path")
    const list = node.childForFieldName("list") ?? (node.type === "use_list" ? node : null)
    const deeper = joined(prefix === null ? "" : prefix.text)
    if (list === null) return
    for (const one of childrenOf(list)) yield* used(one, deeper)
    return
  }

  if (node.type === "use_wildcard") {
    return
  }

  const split = splitOf(node)
  if (split === null) return
  yield {
    name: split.name,
    kind: "import",
    from: { name: split.name.text, specifier: joined(split.from) }
  }
}

/** What a node binds, into the scope it sits in and into the scope it opens. */
const bindings = (node: Syntax): { outer: ReadonlyArray<Bound>; inner: ReadonlyArray<Bound> } => {
  const outer: Array<Bound> = []
  const inner: Array<Bound> = []

  switch (node.type) {
    case "function_item":
    case "function_signature_item":
    case "struct_item":
    case "enum_item":
    case "trait_item":
    case "union_item":
    case "type_item":
    case "const_item":
    case "static_item":
    case "mod_item": {
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: kindOf(node.type) })
      break
    }
    case "let_declaration": {
      const value = node.childForFieldName("value")
      const written =
        value !== null && value.type === "closure_expression" ? "function" : "value"
      for (const name of boundBy(node.childForFieldName("pattern"))) {
        outer.push({ name, kind: written })
      }
      break
    }
    case "parameters":
    case "closure_parameters": {
      // Outer, for the reason every parameter list here is: it is written inside
      // the function, and the function is the scope.
      for (const parameter of childrenOf(node)) {
        if (parameter.type === "self_parameter") continue
        const pattern = parameter.childForFieldName("pattern")
        for (const name of boundBy(pattern ?? parameter)) {
          outer.push({ name, kind: "parameter" })
        }
      }
      break
    }
    case "type_parameters": {
      for (const parameter of childrenOf(node)) {
        if (parameter.type === "type_identifier") {
          outer.push({ name: parameter, kind: "parameter" })
          continue
        }
        // `T: Clone` is a `type_parameter` with a `trait_bounds` child, not a
        // `constrained_type_parameter` — there is no such node in this grammar,
        // and neither shape has a `left` field, so that branch bound nothing.
        // `const N: usize` is its own node and was missed entirely.
        if (parameter.type === "const_parameter") {
          for (const child of childrenOf(parameter)) {
            if (child.type === "identifier") {
              outer.push({ name: child, kind: "parameter" })
              break
            }
          }
          continue
        }
        if (parameter.type !== "type_parameter") continue
        const name = parameter.namedChild(0)
        if (name !== null && name.type === "type_identifier") {
          outer.push({ name, kind: "parameter" })
        }
      }
      break
    }
    case "for_expression": {
      // Inward: a Rust loop variable belongs to the loop and is gone after it,
      // which is the opposite of Python and the same as `let`.
      for (const name of boundBy(node.childForFieldName("pattern"))) {
        inner.push({ name, kind: "value" })
      }
      break
    }
    case "let_condition": {
      // `if let Some(v) = maybe()`. The `if_expression` around it is the scope,
      // and this node sits inside it, so outward is into that branch.
      for (const name of boundBy(node.childForFieldName("pattern"))) {
        outer.push({ name, kind: "value" })
      }
      break
    }
    case "match_arm": {
      const pattern = node.childForFieldName("pattern")
      for (const name of boundBy(pattern)) inner.push({ name, kind: "value" })
      // A bare `n => n` is a pattern that is one identifier, which `boundBy`
      // reaches only through the `match_pattern` that wraps it.
      if (pattern !== null && pattern.type === "match_pattern") {
        for (const child of childrenOf(pattern)) {
          for (const name of boundBy(child)) inner.push({ name, kind: "value" })
        }
      }
      break
    }
    case "use_declaration": {
      const argument = node.childForFieldName("argument")
      // Under nothing: the argument is the whole path, and `used` splits it.
      if (argument !== null) outer.push(...used(argument, ""))
      break
    }
    default:
      break
  }

  return { outer, inner }
}

/** Where the file stops offering and starts working. */
const BODIES: ReadonlySet<string> = new Set(["block", "closure_expression"])

/**
 * The members a type or an `impl` offers, or nothing where this is neither.
 *
 * A struct's fields, an enum's variants, and the functions written in a `trait`
 * or an `impl`. An `impl` is where a type's methods actually live in Rust, so
 * this is the only way the outline offers them at all.
 */
/** The node types that hold members, checked before any field is asked for. */
const HOLDS_MEMBERS: ReadonlySet<string> = new Set([
  "struct_item",
  "union_item",
  "enum_item",
  "impl_item",
  "trait_item"
])

const membersFor = (node: Syntax): ReadonlyArray<Bound> | null => {
  // The type first: this is asked of every node in the file, and a field lookup
  // is a call across the WebAssembly boundary.
  if (!HOLDS_MEMBERS.has(node.type)) return null
  const body = node.childForFieldName("body")
  if (body === null) return null

  if (node.type === "struct_item" || node.type === "union_item") {
    const members: Array<Bound> = []
    for (const field of childrenOf(body)) {
      for (const part of childrenOf(field)) {
        if (part.type === "field_identifier") members.push({ name: part, kind: "member" })
      }
    }
    return members
  }
  if (node.type === "enum_item") {
    const members: Array<Bound> = []
    for (const variant of childrenOf(body)) {
      if (variant.type !== "enum_variant") continue
      const name = variant.childForFieldName("name") ?? variant.namedChild(0)
      if (name !== null) members.push({ name, kind: "member" })
    }
    return members
  }
  if (node.type === "impl_item" || node.type === "trait_item") {
    const members: Array<Bound> = []
    for (const one of childrenOf(body)) {
      if (
        one.type !== "function_item" &&
        one.type !== "function_signature_item" &&
        one.type !== "const_item" &&
        one.type !== "type_item"
      ) {
        continue
      }
      const name = one.childForFieldName("name")
      if (name !== null) members.push({ name, kind: "member" })
    }
    return members
  }
  return null
}

/** Rust, as one vocabulary. */
/**
 * The node types that are a comment.
 *
 * Three, where most grammars have one. `///` is a `doc_comment` and is exactly what a reader wants on the card, so missing these meant Rust had no documentation at all.
 */
const COMMENTS: ReadonlySet<string> = new Set(["line_comment", "block_comment", "doc_comment"])

/**
 * What a node offers the outline: its members, nothing, or no answer.
 *
 * A body answers `working`, which ends the walk there and is what keeps a local
 * out of the outline. See {@link Dialect.offering}.
 */
const offering = (node: Syntax): Offering | null => {
  if (BODIES.has(node.type)) return { at: "working" }
  const members = membersFor(node)
  return members === null ? null : { at: "members", members }
}

export const RUST: Dialect = {
  opens: OPENS,
  names: NAMES,
  bindings,
  comments: COMMENTS,
  offering
}
