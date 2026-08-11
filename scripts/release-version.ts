const chromeVersion = /^(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){0,3}$/

export const releaseVersion = (tag: string): string => {
  const version = tag.startsWith("v") ? tag.slice(1) : ""
  const parts = version.split(".")
  const valid =
    chromeVersion.test(version) &&
    parts.some((part) => part !== "0") &&
    parts.every((part) => Number(part) <= 65_535)

  if (!valid) throw new Error(`Invalid extension release tag: ${tag}`)
  return version
}

if (import.meta.main) console.log(releaseVersion(process.argv[2] ?? ""))
