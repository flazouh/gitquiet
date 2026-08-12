import { describe, expect, it } from "bun:test"
import type { Check } from "../domain/PullRequest"
import { runsBehind, tolerating } from "./tolerance"

const check = (name: string, state: Check["state"], url: string): Check => ({
  name,
  state,
  isRequired: false,
  summary: "",
  url,
  durationSeconds: 3
})

const RUN = "/o/r/actions/runs/17"
const OTHER = "/o/r/actions/runs/18"

describe("the runs worth asking the outcome of", () => {
  it("is the run behind each failing Actions check, once", () => {
    expect(
      runsBehind([
        check("lint", "failed", `${RUN}/job/1`),
        check("test", "failed", `${RUN}/job/2`),
        check("build", "failed", `${OTHER}/job/3`)
      ])
    ).toEqual([RUN, OTHER])
  })

  it("is nothing where every check passed, so nothing is asked", () => {
    expect(runsBehind([check("lint", "succeeded", `${RUN}/job/1`)])).toEqual([])
  })

  it("leaves out a check that is not a job of a run", () => {
    expect(runsBehind([check("netlify", "failed", "https://netlify.com/deploys/9")])).toEqual([])
  })
})

describe("a failing check under a run that succeeded", () => {
  it("is tolerated, and the others are left as GitHub said them", () => {
    const checks = [
      check("flaky", "failed", `${RUN}/job/1`),
      check("test", "failed", `${OTHER}/job/2`),
      check("lint", "succeeded", `${RUN}/job/3`)
    ]

    const said = tolerating(checks, new Map([[RUN, "succeeded" as const], [OTHER, "failed" as const]]))

    expect(said.map((one) => one.state)).toEqual(["tolerated", "failed", "succeeded"])
  })

  it("stays a failure while the run it belongs to is still going", () => {
    const checks = [check("test", "failed", `${RUN}/job/1`)]

    expect(tolerating(checks, new Map([[RUN, "running" as const]]))[0]!.state).toBe("failed")
  })

  it("stays a failure where no outcome came back for its run", () => {
    const checks = [check("test", "failed", `${RUN}/job/1`)]

    expect(tolerating(checks, new Map())[0]!.state).toBe("failed")
  })
})
