/**
 * The one document this extension does its work in, away from GitHub's page.
 *
 * One, and the word is the whole reason this file exists. Chrome permits a
 * single offscreen document per extension and refuses the second with "Only a
 * single offscreen document may be created" — measured in plan 009, which had
 * opened its own beside Mermaid's and found out. Two jobs that each opened one
 * would be two features that worked alone and broke each other the moment a
 * reader used both.
 *
 * So the document is the place, and the jobs are listeners in it. Each is a
 * module of its own that answers its own message and knows nothing about the
 * others; this file is the roof over them.
 *
 * What the jobs have in common is why they are not on the page at all. The
 * document is at the extension's own origin, and that is the only place in this
 * extension where WebAssembly may be compiled: a content script is held to
 * github.com's policy, which refuses it. See `src/diff/shiki.ts` for how that
 * was learnt and `plans/009-can-a-grammar-compile-at-all.md` for the measuring.
 */

import "./mermaid"
import "./ledger"
