/**
 * What TypeScript and JavaScript are, said in node types.
 *
 * Everything here is the grammar's vocabulary and nothing here is the resolver:
 * which node types open a scope, which are a name being read, what a declaring
 * node binds and where an import brought it from. `src/ledger/writings.ts` walks
 * a tree with no opinion about any of it, which is what lets a second language
 * be a second file rather than a second resolver.
 *
 * TypeScript, TSX and JavaScript share one of these. The three grammars differ
 * in what they accept — `<T>x` is an assertion in one and an element in another
 * — and not in what they call a `lexical_declaration`, so one vocabulary reads
 * all three. A language that does not share their core, which is every other
 * language, gets its own file beside this one.
 */

import type { Borrowed, Bound, Dialect, Offering, WritingKind } from "../writings"
import { childrenOf, kindFrom, namesUnder, textOf, type Syntax } from "../syntax"

/**
 * The node types that open a scope.
 *
 * A function opens one of its own rather than leaving its parameters to the body
 * block: the parameters are not written inside the block, and a reader asking
 * about one is asking about the function. The block nests inside it, so a local
 * shadowing a parameter still wins.
 *
 * `class_declaration` is here so that a class's own name is visible inside it,
 * which is what a recursive type or a static factory needs. `class_body` is not:
 * a member is reached through an object and never as a bare name, so putting one
 * in a scope would answer `held` with `this.held`'s Writing anywhere in the file.
 */
const OPENS: ReadonlySet<string> = new Set([
  "program",
  "statement_block",
  "function_declaration",
  "function_expression",
  "function",
  "arrow_function",
  "generator_function",
  "generator_function_declaration",
  "method_definition",
  "class_declaration",
  "class",
  "for_statement",
  "for_in_statement",
  "catch_clause",
  /*
   * A declaration with no body is still a scope.
   *
   * These are what a `.d.ts` is made of, and what an interface, an overload and
   * an abstract method are made of everywhere else — and not one of them was
   * here. A node that opens no scope leaks what it binds into the nearest one
   * that does, which is usually the file, so every `<T>` in a file collapsed
   * onto the first `<T>` and so did every parameter sharing a name.
   *
   * Found in `p-limit`'s own `index.d.ts`: pressing `Arguments` on line 133
   * answered with an `Arguments` on line 53, declared by a different signature
   * entirely. A press on a name is then a press on somebody else's name, which
   * is worse than no answer — the reader is taken somewhere and told it is the
   * place. A body is where the code is, not where the scope is.
   */
  "function_signature",
  "method_signature",
  "abstract_method_signature",
  "call_signature",
  "construct_signature",
  "index_signature",
  "abstract_class_declaration"
])

/** The node types that are a name being read rather than a word inside something else. */
const NAMES: ReadonlySet<string> = new Set([
  "identifier",
  "type_identifier",
  "shorthand_property_identifier",
  "shorthand_property_identifier_pattern"
])

/**
 * A binding pattern's names, which is one identifier or a dozen.
 *
 * `const { picked, ...rest } = ...` binds two, `const [first] = ...` binds one,
 * and both are patterns rather than identifiers. Recursive because a pattern
 * holds patterns: destructuring nests as deeply as anyone cares to write it.
 */
const boundBy = namesUnder(
  new Set(["identifier", "shorthand_property_identifier_pattern"]),
  new Set([
    "object_pattern",
    "array_pattern",
    "rest_pattern",
    "assignment_pattern",
    "pair_pattern",
    "required_parameter",
    "optional_parameter"
  ]),
  // `{ a: b }` binds `b` and reads `a` off the object, so the value field is the
  // one that binds. A parameter holds its name under `pattern`, beside its type.
  (node) =>
    node.type === "pair_pattern"
      ? node.childForFieldName("value")
      : node.type.endsWith("_parameter")
        ? node.childForFieldName("pattern")
        : null
)

/**
 * What a declaring node's kind is called, for the card and the outline.
 *
 * A signature with no body is a member like any other: an interface's and an
 * abstract class's are written that way, and they are what a reader presses in
 * a `.d.ts`.
 */
const KINDS: Readonly<Record<string, WritingKind>> = {
  function_declaration: "function",
  function_expression: "function",
  function_signature: "function",
  function: "function",
  generator_function: "function",
  generator_function_declaration: "function",
  arrow_function: "function",
  class_declaration: "class",
  class: "class",
  abstract_class_declaration: "class",
  type_alias_declaration: "type",
  interface_declaration: "type",
  enum_declaration: "type",
  required_parameter: "parameter",
  optional_parameter: "parameter",
  import_statement: "import",
  method_definition: "member",
  public_field_definition: "member",
  method_signature: "member",
  abstract_method_signature: "member",
  property_signature: "member"
}

const kindOf = kindFrom(KINDS)

/**
 * What a node binds into the scope it is written in.
 *
 * `outer` is that: a function's own name is readable by the code around it, and
 * a parameter list is written inside the function, whose scope is the one its
 * parameters belong to. `inner` is the one exception — a node that binds into
 * the scope *it opens* rather than the one it sits in, which is what a `for` and
 * a `catch` do with the name in their header.
 */
const bindings = (node: Syntax): { outer: ReadonlyArray<Bound>; inner: ReadonlyArray<Bound> } => {
  const kind = kindOf(node.type)
  const outer: Array<Bound> = []
  const inner: Array<Bound> = []

  switch (node.type) {
    case "function_declaration":
    case "generator_function_declaration":
    case "class_declaration":
    // A declaration with no body writes its name down exactly as one with a
    // body does. Neither was bound before, so neither could be followed: the
    // functions a `.d.ts` offers were invisible to the outline and to a press.
    case "function_signature":
    case "abstract_class_declaration": {
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind })
      break
    }
    case "type_alias_declaration":
    case "interface_declaration":
    case "enum_declaration": {
      const name = node.childForFieldName("name")
      if (name !== null) outer.push({ name, kind })
      break
    }
    case "lexical_declaration":
    case "variable_declaration": {
      for (const declarator of childrenOf(node)) {
        if (declarator.type !== "variable_declarator") continue
        // The value decides the kind: `const one = () => ...` is a function to
        // everyone who reads it, and calling it a value in the outline would be
        // true about the binding and useless about the file.
        const value = declarator.childForFieldName("value")
        const written = value === null ? "value" : kindOf(value.type)
        for (const name of boundBy(declarator.childForFieldName("name"))) {
          outer.push({ name, kind: written })
        }
      }
      break
    }
    case "import_statement": {
      const specifier = stringOf(node.childForFieldName("source"))
      for (const { name, was } of imported(node)) {
        outer.push({
          name,
          kind: "import",
          ...(specifier === null ? {} : { from: { name: was, specifier } })
        })
      }
      break
    }
    case "formal_parameters": {
      // Outer, and the word is not a slip: a parameter list is written inside
      // its function, and the function is the scope. So the scope a parameter
      // binds into is the one this node is sitting in.
      for (const parameter of childrenOf(node)) {
        for (const name of boundBy(parameter)) outer.push({ name, kind: "parameter" })
      }
      break
    }
    case "type_parameters": {
      // Outer, for the same reason `formal_parameters` is: a generic's list is
      // written inside the function or class it belongs to, and that node is
      // the scope. `<T, U extends T>` binds two, and the `extends` is a use of
      // the first rather than a binding of its own — which the `name` field
      // settles, because it is the name and not the constraint.
      //
      // Without this a generic was not a name at all. `<Secret,>(one: Secret)`
      // resolved all three mentions to whatever `Secret` the file declared
      // outside, so pressing a type parameter walked to an unrelated type, and
      // that type's Uses counted every generic in the file that happened to
      // share its spelling — a count of a word rather than of a name, which is
      // the one thing this module exists to avoid.
      for (const parameter of childrenOf(node)) {
        if (parameter.type !== "type_parameter") continue
        const name = parameter.childForFieldName("name")
        if (name !== null) outer.push({ name, kind: "parameter" })
      }
      break
    }
    case "for_in_statement": {
      const left = node.childForFieldName("left")
      for (const name of boundBy(left)) inner.push({ name, kind: "value" })
      break
    }
    case "catch_clause": {
      const parameter = node.childForFieldName("parameter")
      for (const name of boundBy(parameter)) inner.push({ name, kind: "value" })
      break
    }
    default:
      break
  }

  return { outer, inner }
}

/**
 * The names an import statement brings in.
 *
 * All three shapes: the default, the named ones, and the namespace. An alias is
 * the name that binds — `import { two as three }` puts `three` in the file and
 * not `two`, and a resolver that took the first identifier of the specifier
 * would send a reader to a name their file never mentions.
 */
const imported = function* (
  statement: Syntax
): Generator<{ readonly name: Syntax; readonly was: string }> {
  for (const clause of childrenOf(statement)) {
    if (clause.type !== "import_clause") continue
    for (const part of childrenOf(clause)) {
      // `import Whole from "./whole"` reads whatever that file exports as its
      // default, whose name there is `default` and not `Whole`.
      if (part.type === "identifier") yield { name: part, was: "default" }
      if (part.type === "namespace_import") {
        for (const name of childrenOf(part)) {
          if (name.type === "identifier") yield { name, was: "*" }
        }
      }
      if (part.type === "named_imports") {
        for (const specifier of childrenOf(part)) {
          if (specifier.type !== "import_specifier") continue
          const was = specifier.childForFieldName("name")
          const alias = specifier.childForFieldName("alias")
          const name = alias ?? was
          if (name !== null && was !== null) yield { name, was: was.text }
        }
      }
    }
  }
  // A clause-less import — `import "./side-effect"` — binds nothing, and the
  // loop above is how that is said rather than a case of its own.
}

/**
 * What a file passes on from somewhere else: `export { one } from "./two"`.
 *
 * A borrow like any other, and it was not recorded at all — which is what broke
 * a barrel. `index.ts` re-exporting a name from the file beside it said it
 * borrowed nothing, so it was a file that merely held the word and was offered
 * as **Likely**; and every file importing that name *through* the barrel
 * resolved its specifier to `index.ts`, which is not where the name is written,
 * and was Likely too. A repository that puts a barrel in front of a folder —
 * which is most of them — had a list of guesses where it should have had a list
 * of facts.
 *
 * Not a binding, which is why this is its own walk rather than a case in
 * {@link bindings}. `export { one } from "./two"` does not put `one` in this
 * file's scope: nothing here can refer to it, the file does not write it, and
 * the outline must not offer it. It says only that a name arrives here from
 * there, which is exactly what a Borrowed is.
 */
const passedOn = function* (statement: Syntax): Generator<Borrowed> {
  if (statement.type !== "export_statement") return

  // The source is what tells a re-export from an ordinary `export { one }`,
  // which passes nothing on and is somebody else's question.
  const specifier = stringOf(statement.childForFieldName("source"))
  if (specifier === null) return

  let named = false
  for (const clause of childrenOf(statement)) {
    if (clause.type !== "export_clause") continue
    named = true
    for (const one of childrenOf(clause)) {
      if (one.type !== "export_specifier") continue
      // The name as the *other* file writes it: `export { Two as Three }` is
      // this file offering `Three` and that file writing `Two`.
      const was = one.childForFieldName("name")
      if (was !== null) yield { name: was.text, specifier }
    }
  }

  // `export * from "./star"`, which passes on everything that file writes —
  // the same `*` an `import *` records, and read the same way by `sureness`.
  if (!named) yield { name: "*", specifier }
}

/** A string literal's text, without its quotes. */
const STRINGS: ReadonlySet<string> = new Set(["string"])

const stringOf = (node: Syntax | null): string | null => textOf(node, STRINGS)

/** Where the file stops offering and starts working. */
const BODIES: ReadonlySet<string> = new Set(["statement_block"])

/**
 * The members a class offers, or nothing where this is not a class.
 *
 * A member with no body is a member: an interface's and an abstract class's are
 * what a reader presses in a `.d.ts`, and they are written as signatures.
 */
const membersFor = (node: Syntax): ReadonlyArray<Bound> | null => {
  if (
    node.type !== "class_declaration" &&
    node.type !== "class" &&
    node.type !== "abstract_class_declaration"
  ) {
    return null
  }
  const body = node.childForFieldName("body")
  if (body === null) return null

  const members: Array<Bound> = []
  for (const member of childrenOf(body)) {
    const name = member.childForFieldName("name")
    if (name === null) continue
    if (member.type !== "method_definition" && member.type !== "public_field_definition") continue
    members.push({ name, kind: "member" })
  }
  return members
}

/**
 * The node types that are a comment.
 *
 * One node type, for all three grammars.
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

/**
 * The three grammars, as one vocabulary.
 *
 * Named for what it reads rather than for one of the three, because a `.js` file
 * is read by this exactly as a `.ts` file is.
 */
export const TYPESCRIPT: Dialect = {
  opens: OPENS,
  names: NAMES,
  bindings,
  passedOn,
  comments: COMMENTS,
  offering
}
