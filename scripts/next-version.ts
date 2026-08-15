/**
 * The next tag to cut, counted from the last one.
 *
 * A release carries no commit here. Nothing in the repository records a version
 * — `package.json` stays at `0.0.0`, and both manifests read `RELEASE_VERSION`
 * at build time — so the tag is the only place a version is written, and the
 * only thing to read the previous one from. That is what lets a release be a
 * tag and nothing else: no bump commit, no changelog to merge, no second push
 * that CI has to green a second time.
 */

/** Three parts, each without a leading zero, which is what `major.minor.patch` means. */
const countable = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

/** Both stores reject a version part above this, so a tag that would reach it is refused here. */
const CEILING = 65_535

export type Bump = "major" | "minor" | "patch"

export const nextVersion = (latest: string, bump: Bump): string => {
  if (bump !== "major" && bump !== "minor" && bump !== "patch") {
    throw new Error(`Unknown bump: ${bump}`)
  }

  // No tag yet. `v0.0.0` is not a version any store accepts, so the first
  // release is the first minor whichever bump was asked for.
  if (latest === "") return "v0.1.0"

  const counted = countable.exec(latest)
  if (counted === null) throw new Error(`Cannot count up from tag: ${latest}`)

  const [major, minor, patch] = [
    Number(counted[1]),
    Number(counted[2]),
    Number(counted[3])
  ]

  const raised =
    bump === "major"
      ? [major + 1, 0, 0]
      : bump === "minor"
        ? [major, minor + 1, 0]
        : [major, minor, patch + 1]

  if (raised.some((part) => part > CEILING)) {
    throw new Error(`Version part above ${CEILING}: ${latest} ${bump}`)
  }

  return `v${raised.join(".")}`
}

if (import.meta.main) {
  console.log(nextVersion(process.argv[2] ?? "", (process.argv[3] ?? "") as Bump))
}
