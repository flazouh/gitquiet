import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { loadFixture } from "../../tests/fixtures"
import { repositoriesFrom } from "./repositories"

/**
 * Their filter route's answer as it actually arrived, trimmed to five of the hundred and
 * fifty-four a live account had.
 */
const said = loadFixture("filtered-repositories")

const read = () => Effect.runPromise(repositoriesFrom(said))

describe("reading the repositories GitHub's own filter answers with", () => {
  test("decodes every repository it listed", async () => {
    const repositories = await read()

    expect(repositories).toHaveLength(5)
    expect(repositories.every((one) => one.nameWithOwner.includes("/"))).toBe(true)
  })

  test("keeps the owner and the repository apart, since both are needed to address it", async () => {
    const [first] = await read()

    expect(first?.nameWithOwner).toBe(`${first?.owner}/${first?.repo}`)
  })

  test("carries the owner's face, which is what the collapsed Rail draws", async () => {
    const repositories = await read()

    expect(repositories.some((one) => Option.isSome(one.faceUrl))).toBe(true)
  })

  test("knows an organisation's repository from a person's", async () => {
    const repositories = await read()

    // The live account has both, which is the case worth having a fixture for: their
    // `ownerType` is the only thing that says which, and it is the difference between
    // "your repositories" and "everything you can reach".
    expect(repositories.some((one) => one.ofAnOrganisation)).toBe(true)
  })

  test("knows which are private", async () => {
    const repositories = await read()

    expect(repositories.some((one) => one.isPrivate)).toBe(true)
  })

  test("refuses a payload that is not theirs, rather than inventing repositories", async () => {
    const outcome = await Effect.runPromise(
      repositoriesFrom({ repositories: [{ name: "octo-repo" }] }).pipe(
        Effect.map(() => "decoded" as const),
        Effect.catch(() => Effect.succeed("refused" as const))
      )
    )

    expect(outcome).toBe("refused")
  })
})
