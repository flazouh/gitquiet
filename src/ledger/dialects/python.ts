/**
 * What Python is, said in node types.
 *
 * The second vocabulary, and the first one written against a language that does
 * not share TypeScript's core. Three things are different enough to be worth
 * saying out loud, because getting any of them wrong is a press that lands on
 * somebody else's name:
 *
 *  1. **A block is not a scope.** Python binds at the function, and an `if` or a
 *     `for` body writes into the function around it. `statement_block` is in
 *     TypeScript's {@link OPENS} and `block` is deliberately absent from this
 *     one — a local first assigned inside an `if` is the same local afterwards,
 *     and a resolver that opened a scope there would answer the second mention
 *     with nothing.
 *  2. **A `for` and an `except ... as` bind outward.** Both write their name
 *     into the enclosing function rather than into a scope of their own, which
 *     is the opposite of what they do in TypeScript, so both are `outer` here
 *     and `inner` there. It is why Python can read a loop variable after the
 *     loop and JavaScript's `let` cannot.
 *  3. **A comprehension is a scope**, and has been since Python 3. `[y for y in
 *     rows]` does not leak `y`, so these are the one place a Python name is
 *     hidden from the code around it.
 *
 * An assignment is a binding here and a declaration nowhere: Python has no
 * `const`, so `x = 1` at a module's top level is what a `lexical_declaration`
 * is in TypeScript. That means the same name may be bound many times in one
 * scope, and the first is kept — which is the rule `declaredIn` already applies
 * to an overload, and reads the same way to a reader going top to bottom.
 */

import type { Borrowed, Bound, Dialect, WritingKind } from "../writings"
import { childrenOf, type Syntax } from "../syntax"

/**
 * The node types that open a scope.
 *
 * A function, a class, a lambda, and the four comprehensions. Not `block`, and
 * not `if_statement`, `for_statement`, `while_statement` or `with_statement` —
 * see the note above, because every one of them is a scope in the language this
 * resolver was written for and none of them is one here.
 */
const OPENS: ReadonlySet<string> = new Set([
  "module",
  "function_definition",
  "class_definition",
  "lambda",
  "list_comprehension",
  "set_comprehension",
  "dictionary_comprehension",
  "generator_expression"
])

/**
 * The node types that are a name being read.
 *
 * One, where TypeScript has four. Python writes a type with the same
 * `identifier` it writes a value with — `def f(a: int)` names `int` exactly as
 * it names `a` — so a type annotation needs no rule of its own and following a
 * name in one works because it was never a different kind of node.
 */
const NAMES: ReadonlySet<string> = new Set(["identifier"])

/** What a declaring node's kind is called, for the card and the outline. */
const kindOf = (declaring: string): WritingKind => {
  if (declaring === "function_definition" || declaring === "lambda") return "function"
  if (declaring === "class_definition") return "class"
  if (declaring === "parameters" || declaring === "lambda_parameters") return "parameter"
  if (declaring === "import_statement" || declaring === "import_from_statement") return "import"
  return "value"
}

/**
 * A binding target's names, which is one identifier or a nest of them.
 *
 * `first, second = ...` binds two through a `pattern_list`, `(a, b)` through a
 * `tuple_pattern` and `[a]` through a `list_pattern`, and `*rest` wraps one more
 * time again. Recursive for the same reason TypeScript's is: the shapes nest as
 * deeply as anyone writes them.
 *
 * A `subscript` or an `attribute` on the left of an assignment — `d["k"] = 1`,
 * `self.x = 1` — binds nothing. It writes through a name rather than writing one
 * down, and treating it as a binding would put `d` in the scope a second time
 * and answer every later `d` with the line that happened to store into it.
 */
const boundBy = function* (target: Syntax | null): Generator<Syntax> {
  if (target === null) return
  if (target.type === "identifier") {
    yield target
    return
  }
  if (
    target.type === "pattern_list" ||
    target.type === "tuple_pattern" ||
    target.type === "list_pattern" ||
    target.type === "list_splat_pattern" ||
    target.type === "dictionary_splat_pattern"
  ) {
    for (const child of childrenOf(target)) yield* boundBy(child)
  }
}

/**
 * A parameter's name, whatever shape the parameter is written in.
 *
 * `a`, `a: int`, `a = 1`, `a: int = 1`, `*args`, `**kwargs` are six node types
 * and one name each. The bare `/` and `*` that mark positional-only and
 * keyword-only are parameters that name nothing, and fall out of here by having
 * no identifier to find rather than by being listed.
 */
const parameterName = (parameter: Syntax): Syntax | null => {
  if (parameter.type === "identifier") return parameter
  for (const child of childrenOf(parameter)) {
    if (child.type === "identifier") return child
  }
  return null
}

/** A string literal's text, without its quotes. */
const stringOf = (node: Syntax | null): string | null => {
  if (node === null || node.type !== "string") return null
  for (const child of childrenOf(node)) {
    if (child.type === "string_content") return child.text
  }
  return null
}

/**
 * The specifier a `from ... import` names, written the way Python writes it.
 *
 * `from math import ...` is `math`, and `from .local import ...` is `.local`
 * with its dots kept: the dots are the whole of what makes it relative, and a
 * specifier that dropped them would name a top-level module that may well also
 * exist. `from . import x` is `.` alone, which is this package and is a real
 * answer rather than an empty one.
 */
const moduleOf = (statement: Syntax): string | null => {
  const named = statement.childForFieldName("module_name")
  if (named === null) return null
  if (named.type === "dotted_name") return named.text
  if (named.type === "relative_import") return named.text
  return null
}

/**
 * The names an `import` statement brings in, and what each was called there.
 *
 * `import os` binds `os`. `import os.path` binds `os` and not `path`, because
 * the name the file can then write is `os` — which is why only the first
 * identifier of a dotted name is taken. `import os.path as p` binds `p` alone,
 * and the dotted name is what it was called where it came from.
 */
const importedPlainly = function* (
  statement: Syntax
): Generator<{ readonly name: Syntax; readonly was: string; readonly specifier: string }> {
  for (const child of childrenOf(statement)) {
    if (child.type === "dotted_name") {
      const first = child.namedChild(0)
      if (first !== null) yield { name: first, was: child.text, specifier: child.text }
    }
    if (child.type === "aliased_import") {
      const was = child.childForFieldName("name")
      const alias = child.childForFieldName("alias")
      if (was !== null && alias !== null) {
        yield { name: alias, was: was.text, specifier: was.text }
      }
    }
  }
}

/**
 * The names a `from ... import` brings in.
 *
 * The alias is the name that binds, exactly as it is in TypeScript: `from m
 * import one as two` puts `two` in the file and `one` is what that module calls
 * it. `from m import *` binds nothing this can name and is recorded as the `*`
 * every other star is recorded as.
 */
const importedFrom = function* (
  statement: Syntax
): Generator<{ readonly name: Syntax; readonly was: string }> {
  // By where it starts and not by identity: tree-sitter hands out a fresh
  // JavaScript object per call, so `child === module` is false for the very node
  // it was asked for — and the module's own name was being bound as an import.
  const module = statement.childForFieldName("module_name")
  const moduleAt = module === null
    ? null
    : `${module.startPosition.row}:${module.startPosition.column}`
  for (const child of childrenOf(statement)) {
    if (`${child.startPosition.row}:${child.startPosition.column}` === moduleAt) continue
    if (child.type === "dotted_name") {
      const first = child.namedChild(0)
      if (first !== null) yield { name: first, was: child.text }
    }
    if (child.type === "aliased_import") {
      const was = child.childForFieldName("name")
      const alias = child.childForFieldName("alias")
      if (was !== null && alias !== null) yield { name: alias, was: was.text }
    }
  }
}

/**
 * What a node binds, into the scope it sits in and into the scope it opens.
 *
 * `inner` is empty for every node here, which is the whole of difference 2 in
 * the note at the top: nothing in Python binds into a scope it opens except a
 * function's parameters, and those are written inside the function whose scope
 * it already is.
 */
const bindings = (node: Syntax): { outer: ReadonlyArray<Bound>; inner: ReadonlyArray<Bound> } => {
  const outer: Array<Bound> = []
  const inner: Array<Bound> = []

  switch (node.type) {
    case "function_definition":
    case "class_definition": {
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: kindOf(node.type) })
      break
    }
    case "parameters":
    case "lambda_parameters": {
      // Outer, and the word is not a slip: a parameter list is written inside
      // its function, and the function is the scope. The same reason
      // TypeScript's `formal_parameters` is outer.
      for (const parameter of childrenOf(node)) {
        const name = parameterName(parameter)
        if (name !== null) outer.push({ name, kind: "parameter" })
      }
      break
    }
    case "assignment":
    case "augmented_assignment": {
      // The value decides the kind, so `f = lambda x: x` is a function in the
      // outline rather than a value — the same judgement TypeScript makes about
      // `const f = () => {}`.
      const value = node.childForFieldName("right")
      const written = value === null ? "value" : kindOf(value.type)
      for (const name of boundBy(node.childForFieldName("left"))) {
        outer.push({ name, kind: written })
      }
      break
    }
    case "named_expression": {
      // The walrus. `if (n := read()) > 0` binds `n` in the function around it,
      // which is the entire reason the operator exists.
      for (const name of boundBy(node.childForFieldName("name"))) {
        outer.push({ name, kind: "value" })
      }
      break
    }
    case "for_statement":
    case "for_in_clause": {
      // Outward, unlike TypeScript's `for_in_statement`. A Python loop variable
      // is readable after the loop, and a comprehension's is held in by the
      // comprehension being a scope rather than by the clause binding inward.
      for (const name of boundBy(node.childForFieldName("left"))) {
        outer.push({ name, kind: "value" })
      }
      break
    }
    case "as_pattern": {
      // `except E as err` and `with open(f) as handle`, which are one node type
      // and bind the same way: outward, into the function.
      const alias = node.childForFieldName("alias")
      if (alias !== null) {
        for (const name of childrenOf(alias)) {
          if (name.type === "identifier") outer.push({ name, kind: "value" })
        }
      }
      break
    }
    case "import_statement": {
      for (const { name, was, specifier } of importedPlainly(node)) {
        outer.push({ name, kind: "import", from: { name: was, specifier } })
      }
      break
    }
    case "import_from_statement": {
      const specifier = moduleOf(node)
      for (const { name, was } of importedFrom(node)) {
        outer.push({
          name,
          kind: "import",
          ...(specifier === null ? {} : { from: { name: was, specifier } })
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
 * What a file passes on from somewhere else, which in Python is nothing.
 *
 * There is no `export { one } from "./two"`. A module re-exports by importing a
 * name and letting it sit in its own namespace, which this already records as
 * an import and as a Borrowed — so a barrel is followed here by the ordinary
 * road rather than by a second one.
 */
const passedOn = function* (_statement: Syntax): Generator<Borrowed> {
  // Nothing, said as a generator so the shape matches every other Dialect.
}

/**
 * Where the file stops offering and starts working.
 *
 * One node type does every body in Python: a function's, a class's, an `if`'s
 * and a `for`'s are all `block`. A class's is reached by {@link membersOf}
 * before the walk ever gets here, which is why one word is enough.
 */
const BODIES: ReadonlySet<string> = new Set([
  "block",
  // A comprehension and a lambda hold their names to themselves, and an outline
  // that offered `y` out of `[y for y in rows]` would be offering the file a
  // name the file does not have.
  "lambda",
  "list_comprehension",
  "set_comprehension",
  "dictionary_comprehension",
  "generator_expression"
])

/**
 * The members a class offers, or nothing where this is not a class.
 *
 * Its methods, and the names assigned at its top level — `size = 4` written in
 * a class body is a class attribute and is exactly what a reader is looking for
 * in an outline. An assignment nested any deeper is inside an `if` or a loop and
 * is the author's business, so only the body's own children are read.
 */
const membersOf = (node: Syntax): ReadonlyArray<Bound> | null => {
  if (node.type !== "class_definition") return null
  const body = node.childForFieldName("body")
  if (body === null) return null

  const members: Array<Bound> = []
  for (const statement of childrenOf(body)) {
    if (statement.type === "function_definition") {
      const name = statement.childForFieldName("name")
      if (name !== null) members.push({ name, kind: "member" })
      continue
    }
    // `size = 4` arrives wrapped in the expression_statement every bare
    // expression in Python is wrapped in.
    const inner = statement.type === "expression_statement" ? statement.namedChild(0) : statement
    if (inner === null || inner.type !== "assignment") continue
    for (const name of boundBy(inner.childForFieldName("left"))) {
      members.push({ name, kind: "member" })
    }
  }
  return members
}

/** Python, as one vocabulary. */
export const PYTHON: Dialect = {
  opens: OPENS,
  names: NAMES,
  bindings,
  passedOn,
  bodies: BODIES,
  membersOf
}

/** Only for the tests, which check the pieces as well as the whole. */
export const forTesting = { stringOf }
