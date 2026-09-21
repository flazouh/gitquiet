/**
 * What a repository's `go.mod` files say its Go modules are called.
 *
 * A Go import names a module and then a folder inside it, and nothing in the
 * import says where one stops. `github.com/gin-gonic/gin/render` is the module
 * `github.com/gin-gonic/gin` and its folder `render`, and only `go.mod` says so.
 * Read, it answers three layouts a guess cannot: a package at the root of the
 * repository, a module kept in a folder of it, and an import of somebody else's
 * module whose last folder happens to be spelled like one of these.
 */

/** Somebody else's code kept inside this repository, or the Go tool's own test fixtures. */
const NOT_OURS = /(^|\/)(vendor|testdata|node_modules)\//u

/** The module a `go.mod` declares, or nothing where it declares none. */
export const goModuleOf = (text: string): string | null => {
  const line = /^\s*module\s+"?([^\s"]+)"?/mu.exec(text)
  return line?.[1] ?? null
}

/** Whether a path is a `go.mod` this repository wrote. */
export const isGoMod = (path: string): boolean =>
  (path === "go.mod" || path.endsWith("/go.mod")) && !NOT_OURS.test(path)

/**
 * Every module in a repository, with the folder it is rooted at.
 *
 * The root folder is the empty string, as a path with no folder in front of it.
 */
export const goModulesIn = (files: ReadonlyMap<string, string>): ReadonlyMap<string, string> => {
  const modules = new Map<string, string>()
  for (const [path, text] of files) {
    if (!isGoMod(path)) continue
    const module = goModuleOf(text)
    if (module === null) continue
    modules.set(module, path === "go.mod" ? "" : path.slice(0, -"/go.mod".length))
  }
  return modules
}
