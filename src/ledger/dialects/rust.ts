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

import type { Borrowed, Bound, Dialect, WritingKind } from "../writings"
import { childrenOf, type Syntax } from "../syntax"

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
const kindOf = (declaring: string): WritingKind => {
  if (
    declaring === "function_item" ||
    declaring === "function_signature_item" ||
    declaring === "closure_expression"
  ) {
    return "function"
  }
  if (
    declaring === "struct_item" ||
    declaring === "enum_item" ||
    declaring === "trait_item" ||
    declaring === "union_item" ||
    declaring === "type_item"
  ) {
    return "type"
  }
  if (declaring === "parameter" || declaring === "type_parameter") return "parameter"
  if (declaring === "use_declaration") return "import"
  return "value"
}

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
const boundBy = function* (pattern: Syntax | null): Generator<Syntax> {
  if (pattern === null) return
  if (pattern.type === "identifier") {
    yield pattern
    return
  }
  if (
    pattern.type === "tuple_pattern" ||
    pattern.type === "tuple_struct_pattern" ||
    pattern.type === "struct_pattern" ||
    pattern.type === "slice_pattern" ||
    pattern.type === "ref_pattern" ||
    pattern.type === "mut_pattern" ||
    pattern.type === "or_pattern" ||
    pattern.type === "reference_pattern" ||
    pattern.type === "field_pattern" ||
    pattern.type === "captured_pattern"
  ) {
    for (const child of childrenOf(pattern)) yield* boundBy(child)
  }
}

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
        if (parameter.type !== "type_parameter" && parameter.type !== "constrained_type_parameter") {
          continue
        }
        const name = parameter.childForFieldName("left") ?? parameter.namedChild(0)
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
      if (argument !== null) yield_(outer, used(argument, ""))
      break
    }
    default:
      break
  }

  return { outer, inner }
}

/** Pushes a generator's items onto an array. */
const yield_ = (into: Array<Bound>, from: Iterable<Bound>): void => {
  for (const one of from) into.push(one)
}

/**
 * What a file passes on from somewhere else, which for Rust is nothing here.
 *
 * `pub use a::b` is a re-export and is a real thing to record. It is not
 * recorded yet, because a Rust path resolves against a crate rather than against
 * the tree of files an archive holds, and a Borrowed nothing can follow is a
 * Borrowed that only makes a card say less.
 */
const passedOn = function* (_statement: Syntax): Generator<Borrowed> {
  // Nothing, said as a generator so the shape matches every other Dialect.
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
const membersOf = (node: Syntax): ReadonlyArray<Bound> | null => {
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
export const RUST: Dialect = {
  opens: OPENS,
  names: NAMES,
  bindings,
  passedOn,
  bodies: BODIES,
  membersOf
}
