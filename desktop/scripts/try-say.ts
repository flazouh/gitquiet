import { Effect } from "effect"
import { readCard } from "../src/bun/card"
import { sayOnLines, sayOnThePullRequest } from "../src/bun/say"

/**
 * Both ways of saying something, against a pull request that exists to be probed.
 *
 * This one writes, unlike the rest of the scripts here, so it names what it is
 * about to do and takes the pull request as an argument rather than defaulting to
 * anybody's. What it verifies is the pair of routes and the shape of what comes
 * back — a review comment is answered with a comment and has to be turned into the
 * thread it started, and an issue comment is answered with a comment and stays one.
 *
 *   bun desktop/scripts/try-say.ts flazouh/githubpro#21
 */

const asked = process.argv[2]
if (asked === undefined) throw new Error("Say which pull request: owner/repo#number")

const found = /^([^/]+)\/([^#]+)#(\d+)$/.exec(asked)
if (found === null) throw new Error(`Say it as owner/repo#number, not ${asked}`)

const card = { owner: found[1]!, repo: found[2]!, number: Number(found[3]) }
const token = (await Bun.$`gh auth token`.text()).trim()

const facts = await Effect.runPromise(readCard(token, card))
const file = facts.files.find((one) => one.content === "here" && one.linesAdded > 0)
if (file === undefined) throw new Error("Nothing in this pull request has a line to comment on")

// The first added line in the patch, which is the one place a comment is certain
// to be allowed: GitHub refuse a comment on a line that is not part of the diff.
const added = (file.patch ?? "").split("\n").findIndex((line) => line.startsWith("+") && !line.startsWith("+++"))
const hunk = /@@ -\d+(?:,\d+)? \+(\d+)/.exec(file.patch ?? "")
const line = Number(hunk?.[1] ?? 1) + Math.max(0, added - 1)

console.log(`saying something on ${card.owner}/${card.repo}#${card.number} — ${file.path}:${line}`)

const thread = await Effect.runPromise(
  sayOnLines(token, card, {
    path: file.path,
    line,
    startLine: line,
    body: "Probe from the GitQuiet app: a line comment through the documented API.",
    headSha: facts.headSha
  })
)

console.log(`thread ${thread.id} at ${thread.at?.path}:${thread.at?.line} by ${thread.comments[0]?.author.login}`)

const remark = await Effect.runPromise(
  sayOnThePullRequest(token, card, "Probe from the GitQuiet app: a comment on the pull request itself.")
)

console.log(`remark ${remark.id} by ${remark.author.login} at ${remark.createdAt}`)
