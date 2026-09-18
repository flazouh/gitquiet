/**
 * What Ruby is, said in node types.
 *
 * Two things about it are its own. The first it shares with Java: **a method is
 * called with no receiver**, so `risky` written bare inside a class means a
 * method of that class, and a method's name is bound into the class's scope and
 * resolves like a local.
 *
 * The second is that Ruby's two loops disagree with each other. A block — `each
 * { |row| ... }` — holds its parameters and anything first assigned inside it to
 * itself. A `for` does not: `for i in 0..3` leaves `i` readable after the loop
 * ends, which is the one thing `for` does differently from `each` and the reason
 * most Ruby is written with `each`. So a block opens a scope and a `for` binds
 * outward.
 *
 * A constant is its own node type rather than an identifier — `LIMIT`, `Box` and
 * `Shapes` are `constant` and `total` is `identifier` — and both are Names,
 * because a reader presses either.
 *
 * An instance variable is not a Name. `@size` belongs to an object rather than
 * to a scope, and answering it with whichever method happened to assign it first
 * would be pointing a reader at a line that is not the answer.
 */

import type { Borrowed, Bound, Dialect, WritingKind } from "../writings"
import { childrenOf, type Syntax } from "../syntax"

/**
 * The node types that open a scope.
 *
 * A method, a class, a module, and the three things that take a block. Not
 * `body_statement`, which is the body of all four of the first and would make
 * the scope the body rather than the thing — a distinction with no difference
 * here except that a method's parameters are written outside its body.
 */
const OPENS: ReadonlySet<string> = new Set([
  "program",
  "module",
  "class",
  "singleton_class",
  "method",
  "singleton_method",
  "block",
  "do_block",
  "lambda"
])

/**
 * The node types that are a name being read.
 *
 * A constant and an identifier, because Ruby writes a class and a local with
 * different nodes and a reader presses both the same way.
 */
const NAMES: ReadonlySet<string> = new Set(["identifier", "constant"])

/** What a declaring node's kind is called, for the card and the outline. */
const kindOf = (declaring: string): WritingKind => {
  if (declaring === "method" || declaring === "singleton_method" || declaring === "lambda") {
    return "function"
  }
  if (declaring === "class" || declaring === "singleton_class") return "class"
  if (declaring === "module") return "type"
  return "value"
}

/**
 * A binding target's names, which is one or a list of them.
 *
 * `first, second = 1, 2` binds two through a `left_assignment_list`, and a
 * splat wraps one more time. An `instance_variable` or a `call` on the left —
 * `@size = n`, `self.size = n` — binds nothing: both write through something
 * rather than writing a name down.
 */
const boundBy = function* (target: Syntax | null): Generator<Syntax> {
  if (target === null) return
  if (target.type === "identifier" || target.type === "constant") {
    yield target
    return
  }
  if (
    target.type === "left_assignment_list" ||
    target.type === "rest_assignment" ||
    target.type === "destructured_left_assignment"
  ) {
    for (const child of childrenOf(target)) yield* boundBy(child)
  }
}

/** The names a parameter list writes down, whatever shape each parameter is. */
const parameterNames = function* (list: Syntax): Generator<Syntax> {
  for (const parameter of childrenOf(list)) {
    if (parameter.type === "identifier") {
      yield parameter
      continue
    }
    // `a = 1`, `*rest`, `**opts`, `&block`, `a:` — each holds one identifier.
    for (const child of childrenOf(parameter)) {
      if (child.type === "identifier") {
        yield child
        break
      }
    }
  }
}

/** The text a string literal holds, without its quotes. */
const stringOf = (node: Syntax): string | null => {
  if (node.type !== "string") return null
  for (const child of childrenOf(node)) {
    if (child.type === "string_content") return child.text
  }
  return null
}

/** What a node binds, into the scope it sits in and into the scope it opens. */
const bindings = (node: Syntax): { outer: ReadonlyArray<Bound>; inner: ReadonlyArray<Bound> } => {
  const outer: Array<Bound> = []
  const inner: Array<Bound> = []

  switch (node.type) {
    case "module":
    case "class": {
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: kindOf(node.type) })
      break
    }
    case "method":
    case "singleton_method": {
      // Into the scope around it, which is what makes a bare `risky` resolve.
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind: "function" })
      break
    }
    case "assignment": {
      const value = node.childForFieldName("right")
      const written = value !== null && value.type === "lambda" ? "function" : "value"
      for (const name of boundBy(node.childForFieldName("left"))) {
        outer.push({ name, kind: written })
      }
      break
    }
    case "method_parameters":
    case "block_parameters":
    case "lambda_parameters": {
      // Outer, for the reason every parameter list here is: it is written inside
      // the method or the block, and that is the scope.
      for (const name of parameterNames(node)) outer.push({ name, kind: "parameter" })
      break
    }
    case "for": {
      // Outward, and this is the whole of difference two: a `for` leaves its
      // name behind where `each` does not.
      for (const child of childrenOf(node)) {
        if (child.type === "identifier" || child.type === "left_assignment_list") {
          for (const name of boundBy(child)) outer.push({ name, kind: "value" })
          break
        }
      }
      break
    }
    case "exception_variable": {
      // `rescue StandardError => err`. Outward, into the method: Ruby leaves it
      // readable after the `begin` it was caught in.
      for (const child of childrenOf(node)) {
        if (child.type === "identifier") outer.push({ name: child, kind: "value" })
      }
      break
    }
    default:
      break
  }

  return { outer, inner }
}

/**
 * What a file passes on from somewhere else, which for Ruby is what it required.
 *
 * `require_relative 'local/helper'` names a file, and is the nearest thing this
 * language has to an import. It binds no name — Ruby loads the file and whatever
 * it defined is simply there afterwards — so it is said as a Borrowed of `*`,
 * which is what every other star here means.
 *
 * A plain `require` is not recorded: it names a gem rather than a file in this
 * repository, and following it leaves the repository.
 */
const passedOn = function* (statement: Syntax): Generator<Borrowed> {
  if (statement.type !== "call") return
  const name = statement.childForFieldName("method")
  if (name === null || name.text !== "require_relative") return

  const args = statement.childForFieldName("arguments")
  if (args === null) return
  for (const one of childrenOf(args)) {
    const path = stringOf(one)
    if (path !== null) yield { name: "*", specifier: path }
  }
}

/**
 * Where the file stops offering, which Ruby says through {@link membersOf}.
 *
 * Empty on purpose. Every body in this language is a `body_statement` — a
 * method's, a class's and a module's alike — so stopping at that node type would
 * stop at all three and a module's classes would never be offered. What stops
 * the outline instead is a method answering with no members at all, which ends
 * the walk exactly where the file stops offering and nowhere else.
 */
const BODIES: ReadonlySet<string> = new Set<string>()

/**
 * The members a class offers, or nothing where the walk should carry on.
 *
 * Three answers rather than two. A class answers with its methods and its
 * constants. A method answers with an empty list, which offers nothing and ends
 * the walk there — that is what keeps a local out of the outline. A module
 * answers with nothing at all, so the walk goes into it and the classes written
 * inside are offered with their own members under them.
 */
const membersOf = (node: Syntax): ReadonlyArray<Bound> | null => {
  if (
    node.type === "method" ||
    node.type === "singleton_method" ||
    node.type === "block" ||
    node.type === "do_block" ||
    node.type === "lambda"
  ) {
    return []
  }
  if (node.type !== "class" && node.type !== "singleton_class") return null

  const body = node.childForFieldName("body")
  if (body === null) return []

  const members: Array<Bound> = []
  for (const one of childrenOf(body)) {
    if (one.type === "method" || one.type === "singleton_method") {
      const name = one.childForFieldName("name")
      if (name !== null) members.push({ name, kind: "member" })
      continue
    }
    if (one.type === "assignment") {
      for (const name of boundBy(one.childForFieldName("left"))) {
        members.push({ name, kind: "member" })
      }
    }
  }
  return members
}

/** Ruby, as one vocabulary. */
export const RUBY: Dialect = {
  opens: OPENS,
  names: NAMES,
  bindings,
  passedOn,
  bodies: BODIES,
  membersOf
}
