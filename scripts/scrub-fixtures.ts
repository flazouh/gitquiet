/**
 * Takes the session-scoped tokens out of the recorded payloads.
 *
 * The fixtures in `fixtures/` and `tests/fixtures/` are real responses, recorded
 * from a logged-in browser. GitHub hands a signed-in page a handful of values
 * that belong to that session rather than to the data: a CSRF token on every
 * form, an HMAC on every analytics click, a signed channel name for live
 * updates, an upload token, and a signed URL for each private image. All of
 * them expire, none of them is read by any code here, and none of them has any
 * business being in a public repository.
 *
 * Two things are kept while the value goes. The field keeps its shape, so a
 * schema that reads a string still reads one. And two tokens that differed on
 * the page still differ afterwards, because a page carries a token per form and
 * there are tests that tell one form from another by exactly that.
 *
 * Run it after recording a fixture, before committing it:
 *
 *     bun scripts/scrub-fixtures.ts
 *
 * It is idempotent, and `--check` makes it report instead of write, which is
 * what CI runs.
 */

import { Glob } from "bun"

/** Where a recording can land. Everything else is written by hand. */
const RECORDED = ["fixtures/**/*.json", "tests/fixtures/**/*.html", "docs/spec/*.html"]

type Rule = {
	readonly what: string
	/** Group 1 is the field and its punctuation. Group 2 is the value to take out. */
	readonly find: RegExp
	/** Closes the value again, where the pattern consumed the closing quote. */
	readonly close: string
	readonly placeholder: (n: number) => string
}

const RULES: readonly Rule[] = [
	{
		what: "signed URLs for private images",
		find: /([?&]jwt=)([A-Za-z0-9._-]{20,})/g,
		close: "",
		placeholder: (n) => `redacted-jwt-${n}`,
	},
	{
		what: "CSRF tokens on forms",
		find: /(authenticity_token"\s*(?:value=|:\s*)")([^"]{8,})"/g,
		close: '"',
		placeholder: (n) => `redacted-authenticity-token-${n}`,
	},
	{
		what: "analytics click HMACs",
		// Kept as 64 hex characters, which is what the field is on the page.
		find: /(auth_hydro_click_hmac\\?"\s*:\s*\\?")([0-9a-f]{32,})/g,
		close: "",
		placeholder: (n) => n.toString(16).padStart(64, "0"),
	},
	{
		what: "signed channel names for live updates",
		find: /("aliveChannel"\s*:\s*")([^"]{16,})"/g,
		close: '"',
		placeholder: (n) => `redacted-alive-channel-${n}`,
	},
	{
		what: "upload tokens",
		find: /("uploadToken"\s*:\s*")([^"]{16,})"/g,
		close: '"',
		placeholder: (n) => `redacted-upload-token-${n}`,
	},
]

/**
 * True where the value is already a stand-in rather than something GitHub
 * issued. Some fixtures were scrubbed by hand before this script existed, and
 * their names say what the token is for, which is worth more than a number.
 *
 * A stand-in is one character repeated, or kebab case with no capitals. Every
 * real value fails both: a CSRF token and a signed URL carry capitals, and an
 * HMAC is unbroken hex with no hyphen in it.
 */
const alreadyAStandIn = (value: string): boolean =>
	/^(.)\1*$/.test(value) || /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(value)

const check = process.argv.includes("--check")

const paths = (await Promise.all(RECORDED.map((p) => Array.fromAsync(new Glob(p).scan("."))))).flat().sort()

const counted = new Map<string, number>()
const touched: string[] = []

for (const path of paths) {
	const before = await Bun.file(path).text()
	let after = before

	for (const rule of RULES) {
		// Numbered per file and per field, keyed by the value, so one token that
		// appeared twice stays one token and two that differed stay two.
		const given = new Map<string, string>()

		after = after.replace(rule.find, (whole, field: string, value: string) => {
			if (alreadyAStandIn(value)) return whole

			const stand = given.get(value) ?? rule.placeholder(given.size + 1)
			given.set(value, stand)

			// Counted by what changes, not by what matches. A placeholder can
			// match the pattern that wrote it, and counting matches would have
			// `--check` report work to do on a tree that has none.
			const written = field + stand + rule.close
			if (written !== whole) counted.set(rule.what, (counted.get(rule.what) ?? 0) + 1)
			return written
		})
	}

	if (after === before) continue
	touched.push(path)
	if (!check) await Bun.write(path, after)
}

for (const [what, n] of counted) console.log(`${String(n).padStart(4)}  ${what}`)

if (touched.length === 0) {
	console.log(`${paths.length} recordings, nothing left to take out.`)
	process.exit(0)
}

console.log(`\n${touched.length} of ${paths.length} recordings:`)
for (const path of touched) console.log(`  ${path}`)

if (check) {
	console.log("\nRun `bun scripts/scrub-fixtures.ts` and commit the result.")
	process.exit(1)
}
