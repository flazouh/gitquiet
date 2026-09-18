/**
 * What PHP is, said in node types.
 *
 * Two things about it shape this file. A variable is written as a
 * `variable_name` holding a `name` — `$total` is two nodes, and the inner one
 * carries `total` without the dollar. So the Name a reader presses is the
 * `name`, and that is what gets bound: keying a scope on `$total` and pressing
 * `total` would be a scope nothing could ever be found in.
 *
 * And PHP binds at the function, not at the block. A variable first written
 * inside an `if` or a `foreach` is the same variable after it, which is Python's
 * rule rather than TypeScript's — so `compound_statement` opens no scope, and a
 * `foreach` binds outward.
 *
 * Functions, classes and constants are reached bare, as in Java and Ruby, so
 * their names are bound and a bare `risky()` resolves.
 */

import type { Bound, Dialect, Offering, WritingKind } from "../writings"
import { childrenOf, kindFrom, lastNameIn, pathBefore, type Syntax } from "../syntax"

/**
 * The node types that open a scope.
 *
 * The four that hold code, and the four that hold members. Not
 * `compound_statement`: see the note above, because a block is a scope in the
 * language this resolver was written for and is not one here.
 */
const OPENS: ReadonlySet<string> = new Set([
  "program",
  "function_definition",
  "method_declaration",
  "anonymous_function",
  "anonymous_function_creation_expression",
  "arrow_function",
  "class_declaration",
  "interface_declaration",
  "trait_declaration",
  "enum_declaration"
])

/**
 * The node types that are a name being read.
 *
 * One. A function's name, a class's name and the inside of a `$variable` are all
 * `name`, which is what makes a bare call and a variable answer through the same
 * rule.
 */
const NAMES: ReadonlySet<string> = new Set(["name"])

/** What a declaring node's kind is called, for the card and the outline. */
const KINDS: Readonly<Record<string, WritingKind>> = {
  function_definition: "function",
  anonymous_function: "function",
  anonymous_function_creation_expression: "function",
  arrow_function: "function",
  class_declaration: "class",
  interface_declaration: "type",
  trait_declaration: "type",
  enum_declaration: "type",
  method_declaration: "member",
  property_declaration: "member",
  namespace_use_clause: "import"
}

const kindOf = kindFrom(KINDS)

/**
 * The `name` inside a node, which for a variable is the half without the dollar.
 *
 * A `variable_name` holds one. A `simple_parameter` holds a `variable_name` that
 * holds one. Reaching through both rather than asking for a field, because the
 * shapes differ between a parameter, a property and a plain assignment while the
 * thing being looked for does not.
 */
const nameIn = (node: Syntax | null): Syntax | null => {
  if (node === null) return null
  if (node.type === "name") return node
  for (const child of childrenOf(node)) {
    if (child.type === "name") return child
    if (child.type === "variable_name") {
      const found = nameIn(child)
      if (found !== null) return found
    }
  }
  return null
}

/** The last segment of a qualified name, which is what a `use` binds. */
const DOTTED: ReadonlySet<string> = new Set(["qualified_name", "namespace_name"])

const lastOf = (node: Syntax): Syntax | null => lastNameIn(node, "name", DOTTED)

/** What a node binds, into the scope it sits in and into the scope it opens. */
const bindings = (node: Syntax): { outer: ReadonlyArray<Bound>; inner: ReadonlyArray<Bound> } => {
  const outer: Array<Bound> = []
  const inner: Array<Bound> = []

  switch (node.type) {
    case "function_definition":
    case "method_declaration":
    case "class_declaration":
    case "interface_declaration":
    case "trait_declaration":
    case "enum_declaration": {
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: kindOf(node.type) })
      break
    }
    case "const_declaration": {
      for (const element of childrenOf(node)) {
        if (element.type !== "const_element") continue
        const name = nameIn(element)
        if (name !== null) outer.push({ name, kind: "value" })
      }
      break
    }
    case "property_declaration": {
      for (const element of childrenOf(node)) {
        if (element.type !== "property_element") continue
        const name = nameIn(element)
        if (name !== null) outer.push({ name, kind: "member" })
      }
      break
    }
    case "assignment_expression": {
      const left = node.childForFieldName("left")
      if (left !== null && left.type === "variable_name") {
        const value = node.childForFieldName("right")
        const written =
          value !== null && (value.type === "arrow_function" || value.type === "anonymous_function")
            ? "function"
            : "value"
        const name = nameIn(left)
        if (name !== null) outer.push({ name, kind: written })
      }
      break
    }
    case "formal_parameters":
    case "simple_parameter": {
      // Outer, for the reason every parameter list here is: it is written inside
      // the function, and the function is the scope. A promoted constructor
      // parameter — `public function __construct(private int $size)` — is a
      // parameter and a property at once, and is bound as the parameter it is
      // written as.
      for (const parameter of childrenOf(node)) {
        if (
          parameter.type !== "simple_parameter" &&
          parameter.type !== "variadic_parameter" &&
          parameter.type !== "property_promotion_parameter"
        ) {
          continue
        }
        const name = nameIn(parameter)
        if (name !== null) outer.push({ name, kind: "parameter" })
      }
      break
    }
    case "foreach_statement": {
      // Outward: PHP binds at the function, so the name a `foreach` writes is
      // readable after the loop it was written by.
      for (const child of childrenOf(node)) {
        if (child.type !== "variable_name" && child.type !== "pair") continue
        const name = nameIn(child)
        if (name !== null) outer.push({ name, kind: "value" })
      }
      break
    }
    case "catch_clause": {
      for (const child of childrenOf(node)) {
        if (child.type !== "variable_name") continue
        const name = nameIn(child)
        if (name !== null) outer.push({ name, kind: "value" })
      }
      break
    }
    case "namespace_use_declaration": {
      // `use App\\Other\\{Alpha, Beta}` nests its clauses one level down, under a
      // `namespace_use_group`, with the prefix written beside it as a sibling.
      // There is no `namespace_use_group_clause` in this grammar, so looking for
      // one left every name in a group unbound.
      const group = childrenOf(node)
      const clauses: Array<{ readonly clause: Syntax; readonly under: string }> = []
      let prefix = ""
      for (const child of group) {
        if (child.type === "namespace_name" || child.type === "qualified_name") {
          prefix = child.text
          continue
        }
        if (child.type === "namespace_use_group") {
          for (const one of childrenOf(child)) {
            if (one.type === "namespace_use_clause") clauses.push({ clause: one, under: prefix })
          }
          continue
        }
        if (child.type === "namespace_use_clause") clauses.push({ clause: child, under: "" })
      }

      for (const { clause, under } of clauses) {
        // A clause inside a group is a bare `name` and is its own path: there is
        // no qualified name under it, and requiring one skipped every member.
        let path: Syntax | null = null
        let alias: Syntax | null = null
        for (const child of childrenOf(clause)) {
          if (child.type === "qualified_name" || child.type === "namespace_name") path = child
          else if (child.type !== "name") continue
          else if (path === null) path = child
          else alias = child
        }
        if (path === null) continue
        const was = lastOf(path)
        const name = alias ?? was
        if (name === null) continue
        const whole = under === "" ? path.text : `${under}\\${path.text}`
        outer.push({
          name,
          kind: "import",
          from: {
            name: was === null ? name.text : was.text,
            specifier: pathBefore(whole, "\\")
          }
        })
      }
      break
    }
    default:
      break
  }

  return { outer, inner }
}

/** Where the file stops offering and starts working. */
const BODIES: ReadonlySet<string> = new Set(["compound_statement", "arrow_function"])

/** The members a class, interface, trait or enum offers. */
const membersFor = (node: Syntax): ReadonlyArray<Bound> | null => {
  if (
    node.type !== "class_declaration" &&
    node.type !== "interface_declaration" &&
    node.type !== "trait_declaration" &&
    node.type !== "enum_declaration"
  ) {
    return null
  }
  const body = node.childForFieldName("body")
  if (body === null) return []

  const members: Array<Bound> = []
  for (const one of childrenOf(body)) {
    if (one.type === "method_declaration") {
      const name = one.childForFieldName("name")
      if (name !== null) members.push({ name, kind: "member" })
      continue
    }
    if (one.type === "property_declaration" || one.type === "const_declaration") {
      for (const element of childrenOf(one)) {
        if (element.type !== "property_element" && element.type !== "const_element") continue
        const name = nameIn(element)
        if (name !== null) members.push({ name, kind: "member" })
      }
      continue
    }
    if (one.type === "enum_case") {
      const name = one.childForFieldName("name")
      if (name !== null) members.push({ name, kind: "member" })
    }
  }
  return members
}

/** PHP, as one vocabulary. */
/**
 * The node types that are a comment.
 *
 * One node type, for all three spellings this language has.
 */
const COMMENTS: ReadonlySet<string> = new Set(["comment"])

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

export const PHP: Dialect = {
  opens: OPENS,
  names: NAMES,
  bindings,
  comments: COMMENTS,
  offering
}
