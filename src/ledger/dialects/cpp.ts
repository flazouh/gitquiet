/**
 * What C++ is, said in node types.
 *
 * Block-scoped, and a function or a member is called with no receiver, so both
 * are bound and a bare `risky()` or `size_` resolves.
 *
 * What is its own about C++ is the declarator. A name is not a child of the
 * thing that declares it; it is at the bottom of a stack of wrappers that say
 * what the name is — `int *p` is a `pointer_declarator`, `int &r` a
 * `reference_declarator`, `int a[3]` an `array_declarator`, `int f(int)` a
 * `function_declarator`, and `int x = 1` an `init_declarator` around any of
 * them. So every name here is reached by walking down through whatever is in the
 * way, and never by asking a declaration for a field it does not have.
 *
 * `field_identifier` is left out of {@link NAMES} while a field is still bound.
 * That pair is deliberate: a bare `size_` inside a method is written as an
 * `identifier` and resolves through the binding, and `other.size_` is written as
 * a `field_identifier` and answers nothing — because what `other` is takes types
 * to know, and answering it with this class's own field would point a reader at
 * a line that is not the answer.
 */

import type { Borrowed, Bound, Dialect, WritingKind } from "../writings"
import { childrenOf, type Syntax } from "../syntax"

/** The node types that open a scope. */
const OPENS: ReadonlySet<string> = new Set([
  "translation_unit",
  "namespace_definition",
  "function_definition",
  "lambda_expression",
  "template_declaration",
  "class_specifier",
  "struct_specifier",
  "union_specifier",
  "enum_specifier",
  "compound_statement",
  "for_statement",
  "for_range_loop",
  "while_statement",
  "if_statement",
  "switch_statement",
  "catch_clause"
])

/**
 * The node types that are a name being read.
 *
 * `field_identifier` is not one, though a field is bound — see the note at the
 * top, because the pair is what lets a bare member resolve while a qualified one
 * stays silent rather than guessing.
 */
const NAMES: ReadonlySet<string> = new Set(["identifier", "type_identifier"])

/** What a declaring node's kind is called, for the card and the outline. */
const kindOf = (declaring: string): WritingKind => {
  if (declaring === "function_definition" || declaring === "lambda_expression") return "function"
  if (declaring === "class_specifier" || declaring === "struct_specifier") return "class"
  if (
    declaring === "union_specifier" ||
    declaring === "enum_specifier" ||
    declaring === "alias_declaration" ||
    declaring === "type_definition"
  ) {
    return "type"
  }
  if (declaring === "parameter_declaration" || declaring === "type_parameter_declaration") {
    return "parameter"
  }
  return "value"
}

/**
 * The name at the bottom of a declarator, whatever is stacked on top of it.
 *
 * `*`, `&`, `&&`, `[]`, `()`, `= 1` and a parenthesis each wrap the name one
 * more time, and a declaration hands over the outermost. Walking down through
 * them is the whole of reading C++ declarations: there is no field to ask for
 * because the shape is a stack rather than a record.
 *
 * A `function_declarator` is walked into as well, which is how `int f(int)`
 * gives `f` — its parameters are a sibling of the name rather than something
 * this has to step over.
 */
const nameOf = (declarator: Syntax | null): Syntax | null => {
  if (declarator === null) return null
  if (
    declarator.type === "identifier" ||
    declarator.type === "type_identifier" ||
    declarator.type === "field_identifier"
  ) {
    return declarator
  }
  if (
    declarator.type === "init_declarator" ||
    declarator.type === "pointer_declarator" ||
    declarator.type === "reference_declarator" ||
    declarator.type === "array_declarator" ||
    declarator.type === "function_declarator" ||
    declarator.type === "parenthesized_declarator" ||
    declarator.type === "structured_binding_declarator" ||
    declarator.type === "qualified_identifier"
  ) {
    const inner = declarator.childForFieldName("declarator")
    const found = nameOf(inner)
    if (found !== null) return found
    // A `reference_declarator` has no `declarator` field on every grammar
    // version, and a structured binding holds a list rather than one name.
    for (const child of childrenOf(declarator)) {
      const deeper = nameOf(child)
      if (deeper !== null) return deeper
    }
  }
  return null
}

/** Every name a declaration writes, since one declaration may write several. */
const declared = function* (node: Syntax, kind: WritingKind): Generator<Bound> {
  for (const child of childrenOf(node)) {
    if (
      child.type === "init_declarator" ||
      child.type === "pointer_declarator" ||
      child.type === "reference_declarator" ||
      child.type === "array_declarator" ||
      child.type === "function_declarator" ||
      child.type === "parenthesized_declarator" ||
      child.type === "identifier" ||
      child.type === "field_identifier"
    ) {
      const name = nameOf(child)
      if (name !== null) yield { name, kind }
    }
  }
}

/** The text an include names, without its quotes or angle brackets. */
const includedPath = (node: Syntax): string | null => {
  for (const child of childrenOf(node)) {
    if (child.type !== "string_literal") continue
    for (const part of childrenOf(child)) {
      if (part.type === "string_content") return part.text
    }
  }
  return null
}

/** What a node binds, into the scope it sits in and into the scope it opens. */
const bindings = (node: Syntax): { outer: ReadonlyArray<Bound>; inner: ReadonlyArray<Bound> } => {
  const outer: Array<Bound> = []
  const inner: Array<Bound> = []

  switch (node.type) {
    case "function_definition": {
      // Into the scope around it, which is what makes a bare `risky()` resolve.
      const name = nameOf(node.childForFieldName("declarator"))
      if (name !== null) outer.push({ name, kind: "function" })
      break
    }
    case "declaration": {
      for (const bound of declared(node, "value")) outer.push(bound)
      break
    }
    case "field_declaration": {
      // Bound, though a `field_identifier` is not a Name. See the note at the
      // top: this is what lets a bare `size_` inside a method resolve.
      for (const bound of declared(node, "member")) outer.push(bound)
      break
    }
    case "class_specifier":
    case "struct_specifier":
    case "union_specifier":
    case "enum_specifier": {
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: kindOf(node.type) })
      break
    }
    case "alias_declaration":
    case "type_definition": {
      const name = node.childForFieldName("name") ?? nameOf(node.childForFieldName("declarator"))
      if (name !== null) outer.push({ name, kind: "type" })
      break
    }
    case "parameter_list": {
      // Outer, for the reason every parameter list here is: it is written inside
      // the function, and the function is the scope.
      for (const parameter of childrenOf(node)) {
        if (
          parameter.type !== "parameter_declaration" &&
          parameter.type !== "optional_parameter_declaration"
        ) {
          continue
        }
        const name = nameOf(parameter.childForFieldName("declarator"))
        if (name !== null) outer.push({ name, kind: "parameter" })
      }
      break
    }
    case "template_parameter_list": {
      for (const parameter of childrenOf(node)) {
        if (
          parameter.type !== "type_parameter_declaration" &&
          parameter.type !== "variadic_type_parameter_declaration"
        ) {
          continue
        }
        for (const child of childrenOf(parameter)) {
          if (child.type === "type_identifier") {
            outer.push({ name: child, kind: "parameter" })
            break
          }
        }
      }
      break
    }
    case "for_range_loop": {
      // Inward: the name belongs to the loop, as it does in every block-scoped
      // language here.
      const name = nameOf(node.childForFieldName("declarator"))
      if (name !== null) inner.push({ name, kind: "value" })
      break
    }
    case "enumerator": {
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: "member" })
      break
    }
    default:
      break
  }

  return { outer, inner }
}

/**
 * What a file passes on from somewhere else, which for C++ is what it included.
 *
 * `#include "local/helper.h"` names a file in this repository and is the nearest
 * thing this language has to an import. It binds no name — the preprocessor
 * pastes the file in and whatever it declared is simply there — so it is said as
 * a Borrowed of `*`, which is what every other star here means.
 *
 * `#include <vector>` is not recorded: angle brackets mean the compiler's own
 * search path, which is not this repository.
 */
const passedOn = function* (statement: Syntax): Generator<Borrowed> {
  if (statement.type !== "preproc_include") return
  const path = includedPath(statement)
  if (path !== null) yield { name: "*", specifier: path }
}

/** Where the file stops offering and starts working. */
const BODIES: ReadonlySet<string> = new Set(["compound_statement", "lambda_expression"])

/** The members a class, struct, union or enum offers. */
const membersOf = (node: Syntax): ReadonlyArray<Bound> | null => {
  if (
    node.type !== "class_specifier" &&
    node.type !== "struct_specifier" &&
    node.type !== "union_specifier" &&
    node.type !== "enum_specifier"
  ) {
    return null
  }
  const body = node.childForFieldName("body")
  if (body === null) return []

  const members: Array<Bound> = []
  for (const one of childrenOf(body)) {
    if (one.type === "field_declaration") {
      for (const bound of declared(one, "member")) members.push(bound)
      continue
    }
    if (one.type === "function_definition" || one.type === "declaration") {
      const name = nameOf(one.childForFieldName("declarator"))
      if (name !== null) members.push({ name, kind: "member" })
      continue
    }
    if (one.type === "enumerator") {
      const name = one.childForFieldName("name")
      if (name !== null) members.push({ name, kind: "member" })
    }
  }
  return members
}

/** C++, as one vocabulary. */
export const CPP: Dialect = {
  opens: OPENS,
  names: NAMES,
  bindings,
  passedOn,
  bodies: BODIES,
  membersOf
}
