/**
 * Starts Vite + Electrobun together for view HMR, which is what `bun run dev` is.
 *
 * The default development run, because a window that has to be restarted to see a
 * changed component is a window nobody makes small changes in. `dev:bundled` is
 * the same app loading Electrobun's own bundle, kept for the times the question is
 * about the bundle rather than about the interface.
 *
 * Run `bun run css` first (the `dev` script does) so fonts, the diff engine, and
 * the bundled fallback view exist. Vite owns Tailwind during the session;
 * Electrobun probes it when `GITQUIET_HMR=1` (see `mainViewUrl.ts`).
 */

const cwd = import.meta.dir + "/.."
const env = {
  ...process.env,
  GITQUIET_HMR: "1",
  GITQUIET_INSPECT: process.env["GITQUIET_INSPECT"] ?? "50505",
  GITQUIET_VITE: process.env["GITQUIET_VITE"] ?? "http://127.0.0.1:5173"
}

const children = [
  Bun.spawn(["bunx", "vite", "--config", "vite.config.ts"], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env
  }),
  Bun.spawn(["bunx", "electrobun", "dev"], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env
  })
]

const stop = () => {
  for (const child of children) {
    try {
      child.kill()
    } catch {
      // already gone
    }
  }
}

process.on("SIGINT", stop)
process.on("SIGTERM", stop)

const codes = await Promise.all(children.map((child) => child.exited))
stop()
process.exit(codes.find((code) => code !== 0) ?? 0)
