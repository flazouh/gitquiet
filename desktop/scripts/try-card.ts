import { Effect } from "effect"
import { readCard, readPatches } from "../src/bun/card"

const token = (await Bun.$`gh auth token`.text()).trim()
const card = { owner: "cli", repo: "cli", number: 14003 }

const facts = await Effect.runPromise(readCard(token, card))
console.log("title:", facts.title)
console.log("state:", facts.state, "| author:", facts.author.login, "| viewer:", facts.viewerLogin)
console.log("branches:", facts.baseBranch, "<-", facts.headBranch, facts.headSha.slice(0, 7))
console.log("files:", facts.files.length, "| with content:", facts.files.filter((f) => f.content === "here").length)
console.log("first file:", JSON.stringify({ ...facts.files[0], patch: facts.files[0]?.patch?.slice(0, 50) }))
console.log("unasked file:", JSON.stringify(facts.files.find((f) => f.content === "unasked") ?? null))
console.log("commits:", facts.commits.length, "| checks:", facts.checks.length, "| threads:", facts.threads.length, "| remarks:", facts.remarks.length, "| reviews:", facts.reviews.length)
console.log("check sample:", JSON.stringify(facts.checks.slice(0, 2)))
console.log("thread sample:", JSON.stringify(facts.threads[0]?.at), facts.threads[0]?.comments.length, "comments")
console.log("review sample:", JSON.stringify(facts.reviews.slice(0, 2)))
console.log("merge:", JSON.stringify(facts.merge))

const asked = facts.files.filter((f) => f.content === "unasked").slice(0, 2).map((f) => f.path)
if (asked.length > 0) {
  const got = await Effect.runPromise(readPatches(token, card, asked))
  console.log("patches asked:", asked.length, "got:", got.length, "| first:", got[0]?.patch?.slice(0, 40))
}
