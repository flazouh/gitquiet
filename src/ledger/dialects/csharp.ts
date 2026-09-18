/**
 * What C# is, said in node types.
 *
 * The nearest thing here to Java: block-scoped, and a method is called with no
 * receiver, so a method's name is bound into the type's scope and a bare
 * `Risky()` resolves. Everything about a Name is an `identifier` — a local, a
 * method, a class and a type argument alike — so this vocabulary has no member
 * node type to leave out of {@link NAMES} and does not try to.
 *
 * Where it differs from Java is in how much of it is a declaration wrapping a
 * declaration. A field and a local are both a `variable_declaration` holding a
 * `variable_declarator` holding the name, and a `using` is an alias and a
 * qualified name side by side rather than a clause with fields — so both are
 * walked for rather than asked for.
 *
 * A member written with `=>` rather than with braces is an
 * `arrow_expression_clause` and not a `block`, which is why both are bodies: a
 * `private int Risky() => Limit;` whose body was not recognised would put
 * `Limit` in the file's outline.
 */

import type { Borrowed, Bound, Dialect, Offering, WritingKind } from "../writings"
import { childrenOf, type Syntax } from "../syntax"

/** The node types that open a scope. */
const OPENS: ReadonlySet<string> = new Set([
  "compilation_unit",
  "namespace_declaration",
  "file_scoped_namespace_declaration",
  "class_declaration",
  "interface_declaration",
  "struct_declaration",
  "record_declaration",
  "record_struct_declaration",
  "enum_declaration",
  "method_declaration",
  "constructor_declaration",
  "destructor_declaration",
  "operator_declaration",
  "conversion_operator_declaration",
  "local_function_statement",
  "lambda_expression",
  "anonymous_method_expression",
  "accessor_declaration",
  "block",
  "for_statement",
  "foreach_statement",
  "catch_clause",
  "using_statement",
  "switch_section"
])

/**
 * The node types that are a name being read.
 *
 * One, as in Java and for the same reason: C# writes a method's name, a field's
 * name and a local's name with the same node and means them the same way.
 */
const NAMES: ReadonlySet<string> = new Set(["identifier"])

/** What a declaring node's kind is called, for the card and the outline. */
const kindOf = (declaring: string): WritingKind => {
  if (
    declaring === "class_declaration" ||
    declaring === "record_declaration" ||
    declaring === "record_struct_declaration" ||
    declaring === "struct_declaration"
  ) {
    return "class"
  }
  if (
    declaring === "interface_declaration" ||
    declaring === "enum_declaration" ||
    declaring === "delegate_declaration"
  ) {
    return "type"
  }
  if (
    declaring === "method_declaration" ||
    declaring === "constructor_declaration" ||
    declaring === "property_declaration" ||
    declaring === "field_declaration" ||
    declaring === "event_field_declaration" ||
    declaring === "enum_member_declaration" ||
    declaring === "indexer_declaration"
  ) {
    return "member"
  }
  if (declaring === "parameter" || declaring === "type_parameter") return "parameter"
  if (declaring === "using_directive") return "import"
  return "value"
}

/**
 * The names a declaration writes down, reached through the declarator that holds
 * each.
 *
 * `int a = 1, b = 2;` is one declaration and two names, and a field is written
 * the same way a local is, which is why one walk answers both.
 */
const declared = function* (node: Syntax): Generator<Syntax> {
  for (const child of childrenOf(node)) {
    if (child.type === "variable_declaration") {
      yield* declared(child)
      continue
    }
    if (child.type !== "variable_declarator") continue
    const name = child.childForFieldName("name") ?? child.namedChild(0)
    if (name !== null && name.type === "identifier") yield name
  }
}

/** The first identifier a node holds, which several shapes here name their own way. */
const firstName = (node: Syntax | null): Syntax | null => {
  if (node === null) return null
  if (node.type === "identifier") return node
  for (const child of childrenOf(node)) {
    if (child.type === "identifier") return child
  }
  return null
}

/** The last segment of a dotted name, which is what a `using` alias stands for. */
const lastOf = (node: Syntax): Syntax | null => {
  if (node.type === "identifier") return node
  if (node.type !== "qualified_name") return null
  const name = node.childForFieldName("name")
  return name === null ? null : lastOf(name)
}

/** What a node binds, into the scope it sits in and into the scope it opens. */
const bindings = (node: Syntax): { outer: ReadonlyArray<Bound>; inner: ReadonlyArray<Bound> } => {
  const outer: Array<Bound> = []
  const inner: Array<Bound> = []

  switch (node.type) {
    case "class_declaration":
    case "interface_declaration":
    case "struct_declaration":
    case "record_declaration":
    case "record_struct_declaration":
    case "enum_declaration":
    case "delegate_declaration":
    case "method_declaration":
    case "constructor_declaration":
    case "local_function_statement":
    case "property_declaration":
    case "indexer_declaration":
    case "enum_member_declaration": {
      // A method's name goes into the type's scope, which is what makes a bare
      // `Risky()` resolve.
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: kindOf(node.type) })
      break
    }
    case "field_declaration":
    case "event_field_declaration": {
      for (const name of declared(node)) outer.push({ name, kind: "member" })
      break
    }
    case "local_declaration_statement":
    // A `for`'s own initialiser is a bare `variable_declaration` with no
    // statement wrapped around it, so `for (int i = 0; ...)` bound nothing and
    // the counter could not be pressed anywhere in the loop.
    case "variable_declaration": {
      for (const name of declared(node)) outer.push({ name, kind: "value" })
      break
    }
    case "parameter_list":
    case "bracketed_parameter_list": {
      // Outer, for the reason every parameter list here is: it is written inside
      // the method, and the method is the scope.
      for (const parameter of childrenOf(node)) {
        if (parameter.type !== "parameter") continue
        const name = parameter.childForFieldName("name")
        if (name !== null) outer.push({ name, kind: "parameter" })
      }
      break
    }
    case "implicit_parameter": {
      // `z => z * 2`. A lambda with one untyped parameter has no list at all.
      outer.push({ name: node, kind: "parameter" })
      break
    }
    case "type_parameter_list": {
      for (const parameter of childrenOf(node)) {
        if (parameter.type !== "type_parameter") continue
        const name = firstName(parameter)
        if (name !== null) outer.push({ name, kind: "parameter" })
      }
      break
    }
    case "foreach_statement": {
      // Inward: the name belongs to the loop and is gone after it, which is what
      // a block-scoped language does with a `foreach`.
      const name = node.childForFieldName("left")
      if (name !== null && name.type === "identifier") {
        inner.push({ name, kind: "value" })
        break
      }
      // No `left` field on every grammar version, so the loop variable is the
      // identifier written between the type and the `in`.
      for (const child of childrenOf(node)) {
        if (child.type === "identifier") {
          inner.push({ name: child, kind: "value" })
          break
        }
      }
      break
    }
    case "catch_declaration": {
      const name = node.childForFieldName("name") ?? firstName(node)
      if (name !== null) outer.push({ name, kind: "value" })
      break
    }
    case "using_directive": {
      // An alias and a qualified name side by side: `using Widget = App.Other.Thing`
      // binds `Widget`, and a plain `using System.Text` binds nothing a reader
      // can press — the namespace is opened rather than named.
      let alias: Syntax | null = null
      let path: Syntax | null = null
      for (const child of childrenOf(node)) {
        if (child.type === "qualified_name") path = child
        else if (child.type === "identifier" && alias === null && path === null) alias = child
        else if (child.type === "identifier") path = child
      }
      if (alias === null || path === null) break
      const was = lastOf(path)
      const whole = path.text
      const dot = whole.lastIndexOf(".")
      outer.push({
        name: alias,
        kind: "import",
        from: {
          name: was === null ? whole : was.text,
          specifier: dot === -1 ? whole : whole.slice(0, dot)
        }
      })
      break
    }
    default:
      break
  }

  return { outer, inner }
}

/**
 * What a file passes on from somewhere else, which for C# is nothing.
 *
 * There is no re-export, and a plain `using` opens a namespace rather than
 * naming a thing in it — so there is no name to say arrived from where.
 */
const passedOn = function* (_statement: Syntax): Generator<Borrowed> {
  // Nothing, said as a generator so the shape matches every other Dialect.
}

/**
 * Where the file stops offering and starts working.
 *
 * Both shapes of body. A member written `=> Limit` has an
 * `arrow_expression_clause` where one written with braces has a `block`, and
 * missing it would put whatever that expression names into the outline.
 */
const BODIES: ReadonlySet<string> = new Set([
  "block",
  "arrow_expression_clause",
  "lambda_expression"
])

/** The members a class, interface, struct, record or enum offers. */
const membersFor = (node: Syntax): ReadonlyArray<Bound> | null => {
  if (
    node.type !== "class_declaration" &&
    node.type !== "interface_declaration" &&
    node.type !== "struct_declaration" &&
    node.type !== "record_declaration" &&
    node.type !== "record_struct_declaration" &&
    node.type !== "enum_declaration"
  ) {
    return null
  }
  const body = node.childForFieldName("body")
  if (body === null) return []

  const members: Array<Bound> = []
  for (const one of childrenOf(body)) {
    if (one.type === "field_declaration" || one.type === "event_field_declaration") {
      for (const name of declared(one)) members.push({ name, kind: "member" })
      continue
    }
    if (
      one.type === "method_declaration" ||
      one.type === "constructor_declaration" ||
      one.type === "property_declaration" ||
      one.type === "indexer_declaration" ||
      one.type === "enum_member_declaration" ||
      one.type === "class_declaration" ||
      one.type === "interface_declaration" ||
      one.type === "struct_declaration" ||
      one.type === "record_declaration" ||
      one.type === "enum_declaration"
    ) {
      const name = one.childForFieldName("name")
      if (name !== null) members.push({ name, kind: kindOf(one.type) })
    }
  }
  return members
}

/** C#, as one vocabulary. */
/**
 * The node types that are a comment.
 *
 * One node type, which covers `///` as well.
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

export const CSHARP: Dialect = {
  opens: OPENS,
  names: NAMES,
  bindings,
  passedOn,
  comments: COMMENTS,
  offering
}
