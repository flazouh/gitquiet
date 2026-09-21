/**
 * What Go is, said in node types.
 *
 * Nearer to TypeScript than Python is: a block is a scope, and an `if` or a
 * `for` that declares something in its header holds that name to itself. What is
 * its own about Go is mostly in how it spells a declaration — four of them, each
 * with a `_spec` node inside a `_declaration` node, because one keyword can
 * declare a parenthesised list of things:
 *
 *     const ( A = 1; B = 2 )     const_declaration → const_spec, const_spec
 *     var total int              var_declaration   → var_spec
 *     type Box struct { ... }    type_declaration  → type_spec
 *     sum := shape * scale       short_var_declaration
 *
 * A method is written outside the type it belongs to, which no other language
 * here does. Its name is a `field_identifier` — the same node a struct field is
 * — and so it is bound as a member and left out of {@link NAMES}: `b.Draw()`
 * reaches `Draw` through `b` and never as a bare name, which is the rule
 * TypeScript's `property_identifier` already follows.
 */

import type { Borrowed, Bound, Dialect, Offering, WritingKind } from "../writings"
import { childrenOf, kindFrom, textOf, type Syntax } from "../syntax"

/**
 * The node types that open a scope.
 *
 * `block` is here, unlike Python's. So are the statements that can declare in
 * their own header — `if v, err := doer(); err == nil` binds two names that the
 * code after the `if` cannot see, and a `for` with a clause or a range binds the
 * same way.
 */
const OPENS: ReadonlySet<string> = new Set([
  "source_file",
  "function_declaration",
  "method_declaration",
  "func_literal",
  "block",
  "if_statement",
  "for_statement",
  "expression_switch_statement",
  "type_switch_statement",
  "select_statement",
  "communication_case",
  "expression_case",
  "type_case",
  "default_case"
])

/**
 * The node types that are a name being read.
 *
 * `field_identifier` is not one, and that is the whole of the note at the top:
 * it is a struct's field and a method's name, both of which are reached through
 * something rather than written bare. `package_identifier` is not one either —
 * the `fmt` in `fmt.Println` is a package qualifier, and a press on it is a
 * question about an import rather than about a name in this file.
 */
const NAMES: ReadonlySet<string> = new Set(["identifier", "type_identifier"])

/** What a declaring node's kind is called, for the card and the outline. */
const KINDS: Readonly<Record<string, WritingKind>> = {
  function_declaration: "function",
  method_declaration: "function",
  func_literal: "function",
  type_spec: "type",
  type_alias: "type",
  parameter_declaration: "parameter",
  variadic_parameter_declaration: "parameter",
  import_spec: "import"
}

const kindOf = kindFrom(KINDS)

/**
 * The names in a target, which Go writes as a list even when there is one.
 *
 * `sum := 1` and `v, err := doer()` are the same node with one and two children,
 * and `k, v := range rows` is a third. A `_` is a name like any other here and is
 * bound: it is declared, it is what the file says, and a reader pressing one is
 * asking a question whose answer is the line they are on.
 */
const namesIn = function* (list: Syntax | null): Generator<Syntax> {
  if (list === null) return
  if (list.type === "identifier") {
    yield list
    return
  }
  if (list.type === "expression_list") {
    for (const child of childrenOf(list)) {
      if (child.type === "identifier") yield child
    }
  }
}

/** The path an import names, without its quotes. */
const STRINGS: ReadonlySet<string> = new Set(["interpreted_string_literal", "raw_string_literal"])

const pathOf = (node: Syntax | null): string | null => textOf(node, STRINGS)

/**
 * What a `_spec` declares, for the four declarations that hold one.
 *
 * `const`, `var` and `type` each wrap their specs in a declaration node so that
 * one keyword can declare a list. The spec is where the name is, so the
 * declaration binds nothing itself and this is what its children answer.
 */
const specNames = function* (spec: Syntax): Generator<Bound> {
  if (spec.type === "const_spec" || spec.type === "var_spec") {
    for (const child of childrenOf(spec)) {
      if (child.type === "identifier") yield { name: child, kind: "value" }
    }
    return
  }
  if (spec.type === "type_spec" || spec.type === "type_alias") {
    const name = spec.childForFieldName("name")
    if (name !== null) yield { name, kind: "type" }
  }
}

/** What a node binds, into the scope it sits in and into the scope it opens. */
const bindings = (node: Syntax): { outer: ReadonlyArray<Bound>; inner: ReadonlyArray<Bound> } => {
  const outer: Array<Bound> = []
  const inner: Array<Bound> = []

  switch (node.type) {
    case "function_declaration": {
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: "function" })
      break
    }
    case "method_declaration": {
      // A member, and bound so the outline can offer it. It is a
      // `field_identifier`, which is not a Name, so nothing ever resolves a bare
      // word to it — see the note on {@link NAMES}.
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: "member" })
      break
    }
    case "const_declaration":
    case "var_declaration":
    case "type_declaration": {
      for (const spec of childrenOf(node)) outer.push(...specNames(spec))
      break
    }
    case "short_var_declaration": {
      const value = node.childForFieldName("right")
      const written = value === null ? "value" : kindOfValue(value)
      for (const name of namesIn(node.childForFieldName("left"))) {
        outer.push({ name, kind: written })
      }
      break
    }
    case "range_clause": {
      for (const name of namesIn(node.childForFieldName("left"))) {
        outer.push({ name, kind: "value" })
      }
      break
    }
    case "parameter_list": {
      // Outer, for the reason every parameter list here is: it is written inside
      // the function, and the function is the scope. A method's receiver is a
      // `parameter_list` too, which is how `b` in `func (b *Box) Draw()` binds
      // with no case of its own.
      for (const parameter of childrenOf(node)) {
        if (
          parameter.type !== "parameter_declaration" &&
          parameter.type !== "variadic_parameter_declaration"
        ) {
          continue
        }
        for (const child of childrenOf(parameter)) {
          if (child.type === "identifier") outer.push({ name: child, kind: "parameter" })
        }
      }
      break
    }
    case "type_parameter_list": {
      for (const parameter of childrenOf(node)) {
        if (parameter.type !== "type_parameter_declaration") continue
        for (const child of childrenOf(parameter)) {
          if (child.type === "type_identifier") outer.push({ name: child, kind: "parameter" })
        }
      }
      break
    }
    case "import_declaration": {
      for (const spec of childrenOf(node)) {
        if (spec.type === "import_spec_list") {
          for (const one of childrenOf(spec)) outer.push(...importedBy(one))
          continue
        }
        outer.push(...importedBy(spec))
      }
      break
    }
    case "labeled_statement": {
      const label = node.childForFieldName("label")
      if (label !== null) outer.push({ name: label, kind: "value" })
      break
    }
    default:
      break
  }

  return { outer, inner }
}

/**
 * What a single `import_spec` binds.
 *
 * A bare `"github.com/x/y"` binds `y`, the last segment of the path, because
 * that is the name the file may then write — Go says it rather than the file
 * doing so, which is the one place here a binding has no node of its own. An
 * alias replaces it, `.` brings the names in unqualified and `_` binds nothing a
 * reader can press.
 */
const importedBy = function* (spec: Syntax): Generator<Bound> {
  if (spec.type !== "import_spec") return
  const path = pathOf(spec.childForFieldName("path"))
  if (path === null) return

  const alias = spec.childForFieldName("name")
  if (alias !== null) {
    if (alias.type === "blank_identifier" || alias.type === "dot") return
    yield { name: alias, kind: "import", from: { name: "*", specifier: path } }
    return
  }
  // No node holds the implied name, so nothing can be pressed on it and nothing
  // is bound. What the file borrowed is still said, by `passedOn`.
}

/** What a value says about the kind of the name it is given to. */
const kindOfValue = (value: Syntax): WritingKind =>
  value.type === "func_literal" ? "function" : kindOf(value.type)

/**
 * What a file passes on, which for Go is what its imports brought in.
 *
 * Go has no re-export. This is used instead to say what the file borrowed at
 * all, because an import with no alias binds a name no node holds — the last
 * segment of the path — and a Borrowed is how that is said without inventing a
 * node to hang it on.
 */
const passedOn = function* (statement: Syntax): Generator<Borrowed> {
  if (statement.type !== "import_spec") return
  // Plain imports only. An alias is bound and says its path there; `_` brings in
  // nothing a file can write; `.` brings names in bare, which Go never follows
  // (see `looksWhole`). Offered here, each lent its package's name to a
  // qualifier that could only have been something of this package's own.
  if (statement.childForFieldName("name") !== null) return
  const path = pathOf(statement.childForFieldName("path"))
  if (path === null) return
  yield { name: "*", specifier: path }
}

/** Where the file stops offering and starts working. */
const BODIES: ReadonlySet<string> = new Set(["block", "func_literal"])

/**
 * The members a type offers, or nothing where this is not one.
 *
 * A struct's fields and an interface's methods. A struct's methods are not here
 * and cannot be: Go writes them outside the type, as their own declarations, and
 * the outline offers each where it is written.
 */
const membersFor = (node: Syntax): ReadonlyArray<Bound> | null => {
  if (node.type !== "type_spec") return null
  const type = node.childForFieldName("type")
  if (type === null) return null
  if (type.type !== "struct_type" && type.type !== "interface_type") return null

  const members: Array<Bound> = []
  const walk = (holder: Syntax): void => {
    for (const child of childrenOf(holder)) {
      if (child.type === "field_declaration_list") {
        walk(child)
        continue
      }
      if (child.type === "field_declaration" || child.type === "method_elem") {
        for (const part of childrenOf(child)) {
          if (part.type === "field_identifier") members.push({ name: part, kind: "member" })
        }
      }
    }
  }
  walk(type)
  return members
}

/**
 * The package a name is read through: `shapes` in `shapes.Area` and `shapes.Box`.
 *
 * A call or a value is a `selector_expression`, whose field is a
 * `field_identifier`; a type is a `qualified_type`, whose name is a
 * `type_identifier`. Told apart from the half before them by type alone, so no
 * node has to be compared with another. Only a bare identifier qualifies:
 * `a.b.C` reaches `C` through a value, which is not a package.
 */
const qualifierOf = (name: Syntax, above: Syntax | null): Syntax | null => {
  if (above === null) return null
  if (above.type === "selector_expression" && name.type === "field_identifier") {
    const operand = above.childForFieldName("operand")
    return operand?.type === "identifier" ? operand : null
  }
  if (above.type === "qualified_type" && name.type === "type_identifier") {
    return above.childForFieldName("package")
  }
  return null
}

/**
 * The name a package is used by, from the path it is imported by.
 *
 * The last part of the path, as Go's convention has it, less the spellings a
 * package path wears that its name cannot: a major version, `/v2` or `.v3`, and
 * the `go-` or `.go` a repository adds to say what language it is in. A package
 * that breaks the convention is aliased by whoever imports it, and an alias is
 * bound and never asked here.
 */
const namedBy = (specifier: string): string => {
  const parts = specifier.split("/").filter((part) => part !== "")
  const last = parts.length > 1 && /^v\d+$/u.test(parts.at(-1)!) ? parts.at(-2)! : (parts.at(-1) ?? "")
  return last
    .replace(/\.v\d+$/u, "")
    .replace(/^go-/u, "")
    .replace(/[.-]go$/u, "")
    .replace(/-/gu, "")
}

/** Go, as one vocabulary. */
/**
 * The node types that are a comment.
 *
 * One node type, for a line comment and a block comment alike.
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

export const GO: Dialect = {
  opens: OPENS,
  names: NAMES,
  bindings,
  passedOn,
  qualifierOf,
  namedBy,
  comments: COMMENTS,
  offering
}
