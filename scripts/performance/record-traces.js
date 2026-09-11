// Run through launch-traces.ts; Ego does not forward caller environment variables.
// Configuration is local: .tmp/perf-observers/trace-config.json.
const fs = await import('node:fs/promises')
const path = await import('node:path')
const root = globalThis.GITQUIET_PROBE_ROOT
if (!root) throw new Error('Run bun scripts/performance/launch-traces.ts')
const config = JSON.parse(await fs.readFile(path.join(root, '.tmp/perf-observers/trace-config.json'), 'utf8'))
const output = path.join(root, '.tmp', config.outputName ?? 'performance-traces')
await fs.mkdir(output, { recursive: true })
const task = await taskSpace(config.spaceId)
const control = task.page(config.controlPage)
const page = task.page(config.measurePage)
const browser = await task.cdp('Target.attachToBrowserTarget')
const inventory = () => control.evaluate(() => new Promise(resolve => {
  chrome.developerPrivate.getExtensionsInfo({ includeDisabled: true }, items =>
    resolve(items.filter(item => /gitquiet/i.test(item.name)).map(item => ({ id: item.id, state: item.state, path: item.path }))))
}))
const enable = (id, enabled) => control.evaluate(({ id, enabled }) => new Promise((resolve, reject) => {
  chrome.management.setEnabled(id, enabled, () => {
    const error = chrome.runtime.lastError
    if (error) reject(new Error(error.message))
    else resolve()
  })
}), { id, enabled })
const originals = await inventory()
const loaded = []
const results = []
const pageState = () => page.evaluate(() => ({
  ...__probe, timeOrigin: performance.timeOrigin,
  visibility: document.visibilityState, focused: document.hasFocus(),
  nodes: document.querySelectorAll('*').length, roots: document.querySelectorAll('#gitquiet-root').length,
  navigation: performance.getEntriesByType('navigation').map(e => ({
    responseStart: e.responseStart, responseEnd: e.responseEnd, domContentLoaded: e.domContentLoadedEventEnd
  }))
}))
const trace = async (name, action) => {
  if (config.captureTrace === false) return action()
  await page.events()
  await page.cdp('Tracing.start', {
    categories: 'toplevel,devtools.timeline,blink.user_timing,loading,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.cpu_profiler',
    transferMode: 'ReturnAsStream', streamCompression: 'none'
  })
  return action().finally(async () => {
    await page.cdp('Tracing.end')
    let complete
    for (let attempt = 0; attempt < 100 && !complete; attempt++) {
      complete = (await page.events()).find(event => event.method === 'Tracing.tracingComplete')
      if (!complete) await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!complete) throw new Error('Trace completion event did not arrive')
    const handle = complete.params.stream
    const file = await fs.open(path.join(output, `${name}.trace.json`), 'w')
    await (async () => {
      for (;;) {
        const chunk = await page.cdp('IO.read', { handle, size: 8_388_608 })
        await file.write(chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : chunk.data)
        if (chunk.eof) break
      }
    })().finally(async () => {
      await file.close()
      await page.cdp('IO.close', { handle })
    })
    if (complete.params.dataLossOccurred) throw new Error(`Trace data was lost: ${name}`)
  })
}
const preload = `
performance.mark('load:start');
window.__probe = { rootAt:null, diffAt:null, lcp:[], shifts:[], longFrames:[], events:[] };
for(const type of ['largest-contentful-paint','layout-shift','long-animation-frame','event']) {
 if(!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
 new PerformanceObserver(list=>{for(const e of list.getEntries()) {
  if(type==='largest-contentful-paint') __probe.lcp.push({at:e.startTime,size:e.size,tag:e.element?.tagName,owned:!!document.getElementById('gitquiet-root')?.contains(e.element)});
  if(type==='layout-shift'&&!e.hadRecentInput) __probe.shifts.push({at:e.startTime,value:e.value});
  if(type==='long-animation-frame') __probe.longFrames.push({at:e.startTime,duration:e.duration,blocking:e.blockingDuration,scripts:e.scripts.map(s=>({url:s.sourceURL,function:s.sourceFunctionName,duration:s.duration}))});
  if(type==='event') __probe.events.push({name:e.name,at:e.startTime,duration:e.duration,processing:e.processingEnd-e.processingStart});
 }}).observe({type,buffered:true,durationThreshold:16});
}
const timer=setInterval(()=>{
 const root=document.getElementById('gitquiet-root');
 if(root&&__probe.rootAt===null) __probe.rootAt=performance.now();
 const diff=root?.querySelector('diffs-container')?.shadowRoot?.querySelector('pre');
 if(diff?.textContent?.length&&root.querySelector('file-tree-container')) {
  __probe.diffAt=performance.now();performance.mark('load:end');clearInterval(timer);
 }
},50);
setTimeout(()=>clearInterval(timer),30000);`

await (async () => {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
  await page.cdp('Network.enable')
  await page.cdp('Network.setCacheDisabled', { cacheDisabled: true })
  // Calibration measures the browser's frame delivery without GitHub or GitQuiet.
  for (const blocked of config.captureTrace === false ? [] : [false, true]) {
    await page.goto('about:blank')
    await page.cdp('Page.bringToFront')
    await trace(`calibration-${blocked ? 'blocked' : 'idle'}`, () => page.evaluate(async blocked => {
      document.body.innerHTML = '<div style="width:100px;height:100px;background:blue"></div>'
      performance.mark('calibration:start')
      const animation = document.body.firstChild.animate([{ width: '100px' }, { width: '300px' }], { duration: 2000 })
      if (blocked) setTimeout(() => { const until = performance.now() + 180; while (performance.now() < until) {} }, 500)
      await animation.finished
      performance.mark('calibration:end')
    }, blocked))
  }
  for (const original of originals) if (original.state === 'ENABLED') await enable(original.id, false)
  for (const build of config.builds) {
    const { id } = await cdp('Extensions.loadUnpacked', { path: build.path }, browser.sessionId)
    loaded.push({ ...build, id })
    await enable(id, false)
  }
  await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: preload })
  for (const scenario of config.cases) for (let repeat = 0; repeat < config.repeats; repeat++) {
    for (const build of repeat % 2 ? [...loaded].reverse() : loaded) {
      // A URL with a fragment can reuse the previous document and its old content script.
      await page.goto('about:blank')
      const previousOrigin = await page.evaluate(() => performance.timeOrigin)
      await enable(build.id, true)
      const active = (await inventory()).filter(item => item.state === 'ENABLED')
      if (active.length !== 1 || active[0].id !== build.id) throw new Error('Expected exactly one enabled GitQuiet copy')
      const name = `${scenario.name}-${repeat}-${build.name}`
      const result = await trace(name, async () => {
        await page.goto(scenario.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        if (await page.evaluate(() => performance.timeOrigin) === previousOrigin) throw new Error('Expected a new document')
        await page.cdp('Page.bringToFront')
        await page.waitForFunction(() => window.__probe?.diffAt !== null && window.__probe?.diffAt !== undefined, undefined, { timeout: 30000 })
        if (config.startupOnly) return {
          name, repeat, scenario: scenario.name, build: build.name, extensionId: build.id, page: await pageState()
        }
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, Math.max(0, 7000 - performance.now()))))
        const points = await page.evaluate(() => {
          const tree = document.querySelector('file-tree-container').shadowRoot.querySelector('[data-file-tree-virtualized-scroll]')
          const button = document.querySelector('button[aria-label="How the files are drawn"]')
          window.__tree = tree; window.__button = button
          const center = e => { const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2} }
          return {tree:center(tree),button:center(button)}
        })
        const scrollTree = async phase => {
          await page.evaluate(phase => { __tree.scrollTop=0; performance.mark(`${phase}:start`) }, phase)
          await page.cdp('Input.synthesizeScrollGesture', { ...points.tree, yDistance: -1200, speed: 800, gestureSourceType: 'mouse' })
          const down = await page.evaluate(() => __tree.scrollTop)
          await page.cdp('Input.synthesizeScrollGesture', { ...points.tree, yDistance: 1200, speed: 800, gestureSourceType: 'mouse' })
          await page.evaluate(phase => performance.mark(`${phase}:end`), phase)
          return down
        }
        let down
        if (config.containmentExperiment) {
          for (const contained of repeat % 2 ? [true, false] : [false, true]) {
            await page.evaluate(contained => { document.querySelector('file-tree-container').style.contain=contained?'layout paint style':'' }, contained)
            const position = await scrollTree(contained ? 'contained-scroll' : 'scroll')
            if (!contained) down = position
          }
          await page.evaluate(() => { document.querySelector('file-tree-container').style.contain='' })
        } else down = await scrollTree('scroll')
        await page.evaluate(() => performance.mark('panel:start'))
        for (let cycle=0;cycle<3;cycle++) {
          await page.mouse.click(points.button.x, points.button.y)
          await page.waitForFunction(() => __button.getAttribute('data-state')==='open')
          await page.evaluate(() => { window.__dialog=document.getElementById(__button.getAttribute('aria-controls')) })
          await page.keyboard.press('Escape')
          await page.waitForFunction(() => !__dialog?.isConnected && __button.getAttribute('data-state')==='closed')
        }
        await page.evaluate(() => performance.mark('panel:end'))
        let interactions
        if (config.interactions) {
          const diffPoint = await page.evaluate(() => {
            window.__drawing=document.querySelector('[data-file][aria-hidden="false"]')
            const r=__drawing.getBoundingClientRect()
            __drawing.scrollTop=0
            performance.mark('diff-scroll:start')
            return {x:r.x+r.width/2,y:r.y+r.height/2}
          })
          await page.cdp('Input.synthesizeScrollGesture', {...diffPoint,yDistance:-1000,speed:800,gestureSourceType:'mouse'})
          const diffScroll = await page.evaluate(() => __drawing.scrollTop)
          await page.cdp('Input.synthesizeScrollGesture', {...diffPoint,yDistance:1000,speed:800,gestureSourceType:'mouse'})
          await page.evaluate(() => performance.mark('diff-scroll:end'))
          const nextPoint = await page.evaluate(() => {
            const root=document.getElementById('gitquiet-root')
            const button=root.querySelector('button[aria-label="Next file"]')
            if (!button || button.disabled) throw new Error('Selection probe needs at least two files')
            window.__selection=[]
            let began, previous
            window.__selectionStart=()=>{
              previous=root.querySelector('[data-file][aria-hidden="false"]')?.getAttribute('data-file')
              began=performance.now()
            }
            button.addEventListener('pointerdown',__selectionStart)
            window.__nextButton=button
            const checkSelection=()=>{
              if(began===undefined)return
              const drawing=root.querySelector('[data-file][aria-hidden="false"]')
              const file=drawing?.getAttribute('data-file')
              if(file&&file!==previous&&drawing.querySelector('diffs-container')?.shadowRoot?.querySelector('pre')?.textContent?.length){
                __selection.push({file,ms:performance.now()-began});began=undefined
              }
            }
            window.__selectionObserver=new MutationObserver(checkSelection)
            window.__selectionTimer=setInterval(checkSelection,20)
            __selectionObserver.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-hidden']})
            const r=button.getBoundingClientRect()
            performance.mark('selection:start')
            return {x:r.x+r.width/2,y:r.y+r.height/2}
          })
          for(let index=0;index<5;index++) {
            await page.mouse.click(nextPoint.x,nextPoint.y)
            await page.waitForFunction(count=>__selection.length===count,index+1,{timeout:15000})
          }
          interactions=await page.evaluate(diffScroll=>{
            performance.mark('selection:end')
            __selectionObserver.disconnect()
            clearInterval(__selectionTimer)
            __nextButton.removeEventListener('pointerdown',__selectionStart)
            return {diffScroll,selections:__selection}
          },diffScroll)
        }
        return { name, repeat, scenario: scenario.name, build: build.name, extensionId: build.id, scrolledTo: down,
          interactions,
          page: await pageState(),
          heap: await page.cdp('Runtime.getHeapUsage'), dom: await page.cdp('Memory.getDOMCounters') }
      })
      results.push(result)
      await fs.writeFile(path.join(output, 'runs.json'), JSON.stringify({config,results},null,2))
      console.log({ name, diffAt:result.page.diffAt, scrolledTo:result.scrolledTo, roots:result.page.roots })
      await enable(build.id, false)
    }
  }
})().finally(async () => {
  // Attempt every cleanup action even when one extension operation fails.
  const disabled = await Promise.allSettled(loaded.map(build => enable(build.id, false)))
  const removed = await Promise.allSettled(loaded
    .filter(build => !originals.some(item => item.id === build.id))
    .map(build => cdp('Extensions.uninstall', { id: build.id }, browser.sessionId)))
  const restored = await Promise.allSettled(originals.map(original =>
    enable(original.id, original.state === 'ENABLED')))
  const failures = [...disabled, ...removed, ...restored].filter(result => result.status === 'rejected')
  if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Extension cleanup failed')
})
