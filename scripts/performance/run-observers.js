// Run with ego-browser nodejs after starting observer-server.ts.
const fs = await import('node:fs/promises')
const task = await taskSpace('GitQuiet performance optimization')
const page = task.page('p1')
const results = []
await (async () => {
  for (const [index, nodes] of [0, 1000, 100000, 250000, 500000].entries()) {
    for (const version of index % 2 ? ['after', 'before'] : ['before', 'after']) {
      await page.goto(`http://127.0.0.1:43127/?version=${version}`)
      await page.waitForFunction(() => typeof window.runProbe === 'function')
      const result = await page.evaluate(nodes => window.runProbe({ nodes, updates: 40 }), nodes)
      results.push({ version, ...result })
      const output = await page.evaluate(() => window.probeOutput)
      await fs.writeFile(output, JSON.stringify(results, null, 2))
      console.log({ version, ...result })
      if (version === 'after' && result.phases.some(phase => phase.documentQueries !== 0))
        throw new Error('A routine update scanned the document')
      if (version === 'after' && result.phases.find(phase => phase.phase === 'added-links').linkChecks !== result.updates)
        throw new Error('Link work grew beyond the number of added links')
    }
  }
})().finally(async () => {
  await task.finish({ keep: [] })
})
