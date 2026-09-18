/**
 * What Java is, said in node types.
 *
 * Block-scoped, and the nearest of the four to TypeScript. One thing about it is
 * its own and changes what a Name means: **Java calls its own methods without a
 * receiver.** `risky()` inside a class is a bare `identifier` that means a method
 * of that class, so a method's name is bound into the class's scope and resolves
 * like any other name.
 *
 * That is the opposite of every other vocabulary here. TypeScript, Go and Rust
 * each reach a member through the thing that holds it and each keeps its member
 * node type out of {@link NAMES} for that reason. Java writes a method's name
 * with the same `identifier` it writes a local with, and means it the same way.
 *
 * A field is the same story: `size` inside a method is the field, and `this.size`
 * is the same field said the long way.
 */

import type { Borrowed, Bound, Dialect, WritingKind } from "../writings"
import { childrenOf, type Syntax } from "../syntax"

/**
 * The node types that open a scope.
 *
 * A class is one so that its own name and its members are readable inside it,
 * which is what a bare method call needs. A `for`, an enhanced `for` and a
 * `catch` each hold what their header declares.
 */
const OPENS: ReadonlySet<string> = new Set([
  "program",
  "class_declaration",
  "interface_declaration",
  "enum_declaration",
  "record_declaration",
  "annotation_type_declaration",
  "method_declaration",
  "constructor_declaration",
  "compact_constructor_declaration",
  "lambda_expression",
  "block",
  "constructor_body",
  "static_initializer",
  "for_statement",
  "enhanced_for_statement",
  "catch_clause",
  "switch_block",
  "try_with_resources_statement"
])

/**
 * The node types that are a name being read.
 *
 * Two, and no member node type is missing from the list: Java has none to leave
 * out. A method's name, a field's name and a local's name are all `identifier`,
 * which is exactly why a bare call resolves here and does not in the others.
 */
const NAMES: ReadonlySet<string> = new Set(["identifier", "type_identifier"])

/** What a declaring node's kind is called, for the card and the outline. */
const kindOf = (declaring: string): WritingKind => {
  if (declaring === "class_declaration" || declaring === "record_declaration") return "class"
  if (
    declaring === "interface_declaration" ||
    declaring === "enum_declaration" ||
    declaring === "annotation_type_declaration"
  ) {
    return "type"
  }
  if (
    declaring === "method_declaration" ||
    declaring === "constructor_declaration" ||
    declaring === "compact_constructor_declaration" ||
    declaring === "field_declaration" ||
    declaring === "enum_constant"
  ) {
    return "member"
  }
  if (declaring === "formal_parameter" || declaring === "type_parameter") return "parameter"
  if (declaring === "import_declaration") return "import"
  return "value"
}

/**
 * The names a declarator list writes down.
 *
 * `int a = 1, b = 2;` is one declaration and two names, and a field is written
 * the same way a local is — which is why one walk answers both.
 */
const declared = function* (node: Syntax): Generator<Syntax> {
  for (const child of childrenOf(node)) {
    if (child.type !== "variable_declarator") continue
    const name = child.childForFieldName("name")
    if (name !== null) yield name
  }
}

/** The last segment of a dotted name, which is the name an import binds. */
const lastOf = (path: Syntax): Syntax | null => {
  if (path.type === "identifier") return path
  if (path.type === "scoped_identifier") {
    const name = path.childForFieldName("name")
    return name === null ? null : lastOf(name)
  }
  return null
}

/** What a node binds, into the scope it sits in and into the scope it opens. */
const bindings = (node: Syntax): { outer: ReadonlyArray<Bound>; inner: ReadonlyArray<Bound> } => {
  const outer: Array<Bound> = []
  const inner: Array<Bound> = []

  switch (node.type) {
    case "class_declaration":
    case "interface_declaration":
    case "enum_declaration":
    case "record_declaration":
    case "annotation_type_declaration":
    case "method_declaration":
    case "constructor_declaration": {
      // A method's name goes into the class's scope, which is what makes a bare
      // `risky()` resolve. See the note at the top.
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: kindOf(node.type) })
      break
    }
    case "field_declaration": {
      for (const name of declared(node)) outer.push({ name, kind: "member" })
      break
    }
    case "local_variable_declaration": {
      for (const name of declared(node)) outer.push({ name, kind: "value" })
      break
    }
    case "enum_constant": {
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: "member" })
      break
    }
    case "formal_parameters":
    case "inferred_parameters": {
      // Outer, for the reason every parameter list here is: it is written inside
      // the method, and the method is the scope.
      for (const parameter of childrenOf(node)) {
        if (parameter.type === "identifier") {
          outer.push({ name: parameter, kind: "parameter" })
          continue
        }
        if (parameter.type !== "formal_parameter" && parameter.type !== "spread_parameter") continue
        const name = parameter.childForFieldName("name")
        if (name !== null) outer.push({ name, kind: "parameter" })
      }
      break
    }
    case "type_parameters": {
      for (const parameter of childrenOf(node)) {
        if (parameter.type !== "type_parameter") continue
        for (const child of childrenOf(parameter)) {
          if (child.type === "type_identifier") {
            outer.push({ name: child, kind: "parameter" })
            break
          }
        }
      }
      break
    }
    case "enhanced_for_statement": {
      // `for (String row : rows())`. Inward: the name is the loop's and is gone
      // after it, which is what a block-scoped language does with a `for`.
      const name = node.childForFieldName("name")
      if (name !== null) inner.push({ name, kind: "value" })
      break
    }
    case "catch_clause": {
      // Walked for rather than asked for: a `catch_clause` has no field naming
      // its parameter, so `childForFieldName("parameter")` answers nothing and
      // every caught name went unbound.
      for (const child of childrenOf(node)) {
        if (child.type !== "catch_formal_parameter") continue
        const name = child.childForFieldName("name")
        if (name !== null) inner.push({ name, kind: "value" })
      }
      break
    }
    case "import_declaration": {
      for (const child of childrenOf(node)) {
        if (child.type !== "scoped_identifier" && child.type !== "identifier") continue
        const name = lastOf(child)
        if (name === null) continue
        const whole = child.text
        const dot = whole.lastIndexOf(".")
        outer.push({
          name,
          kind: "import",
          from: {
            name: name.text,
            specifier: dot === -1 ? whole : whole.slice(0, dot)
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

/**
 * What a file passes on from somewhere else, which for Java is nothing.
 *
 * There is no re-export. A name arrives through an `import`, which is a binding
 * and is recorded as one.
 */
const passedOn = function* (_statement: Syntax): Generator<Borrowed> {
  // Nothing, said as a generator so the shape matches every other Dialect.
}

/** Where the file stops offering and starts working. */
const BODIES: ReadonlySet<string> = new Set([
  "block",
  "constructor_body",
  "lambda_expression",
  "static_initializer"
])

/**
 * The members a class, interface, enum or record offers.
 *
 * Its methods, its fields, its constructors and its enum constants. A nested
 * type is offered too, by its own name, because a reader looking at an outline
 * wants to see that it is there.
 */
const membersOf = (node: Syntax): ReadonlyArray<Bound> | null => {
  if (
    node.type !== "class_declaration" &&
    node.type !== "interface_declaration" &&
    node.type !== "enum_declaration" &&
    node.type !== "record_declaration" &&
    node.type !== "annotation_type_declaration"
  ) {
    return null
  }
  const body = node.childForFieldName("body")
  if (body === null) return null

  const members: Array<Bound> = []
  const take = (holder: Syntax): void => {
    for (const one of childrenOf(holder)) {
      if (one.type === "enum_body_declarations") {
        take(one)
        continue
      }
      if (one.type === "field_declaration") {
        for (const name of declared(one)) members.push({ name, kind: "member" })
        continue
      }
      if (
        one.type === "method_declaration" ||
        one.type === "constructor_declaration" ||
        one.type === "enum_constant" ||
        one.type === "class_declaration" ||
        one.type === "interface_declaration" ||
        one.type === "enum_declaration" ||
        one.type === "record_declaration"
      ) {
        const name = one.childForFieldName("name")
        if (name !== null) members.push({ name, kind: kindOf(one.type) })
      }
    }
  }
  take(body)
  return members
}

/** Java, as one vocabulary. */
export const JAVA: Dialect = {
  opens: OPENS,
  names: NAMES,
  bindings,
  passedOn,
  bodies: BODIES,
  membersOf
}
