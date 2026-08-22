import json, collections, math, os, sys
from datetime import datetime

D = os.path.dirname(os.path.abspath(__file__))
AI = {'coderabbitai':'CodeRabbit','cursor':'Cursor Bugbot','chatgpt-codex-connector':'OpenAI Codex',
      'copilot-pull-request-reviewer':'GitHub Copilot','cubic-dev-ai':'cubic','greptile-apps':'Greptile',
      'gemini-code-assist':'Gemini Code Assist','claude':'Claude','devin-ai-integration':'Devin',
      'sourcery-ai':'Sourcery','macroscopeapp':'Macroscope','fullsend-ai-review':'FullSend',
      'qodo-code-review':'Qodo','qodo-free-for-open-source-projects':'Qodo','qodo-app-for-konflux-ci':'Qodo',
      'qodo-for-redhat-appstudio':'Qodo','qodo-for-stolostron':'Qodo','rhdh-qodo-merge':'Qodo',
      'qodo-for-securesign':'Qodo','gitar-bot':'Gitar','kilo-code-bot':'Kilo','ellipsis-dev':'Ellipsis',
      'sweep-ai':'Sweep','codiumai-pr-agent-free':'Qodo','entelligence-ai-pr-reviews':'Entelligence'}
NONAI = {'github-advanced-security','github-actions','sentry','sentry-warden','clickhouse-gh','deepsource-io',
         'codescene-delta-analysis','aikido-pr-checks','gitstream-cm','github-code-quality',
         'wso2-engineering','twenty-ci-bot-public','codecov','sonarqubecloud','netlify','vercel',
         'dependabot','renovate','pre-commit-ci','snyk-bot','semgrep-code','codefactor-io'}

def wilson(k, n, z=1.96):
    if n == 0: return (0.0, 0.0, 0.0)
    p = k/n; d = 1 + z*z/n; c = (p + z*z/(2*n))/d
    h = z*math.sqrt(p*(1-p)/n + z*z/(4*n*n))/d
    return (p, max(0.0, c-h), min(1.0, c+h))
def ts(x): return datetime.fromisoformat(x.replace('Z','+00:00')) if x else None

rows = [json.loads(l) for l in open(f'{D}/threads.jsonl')]
seen = set(); T = []
for r in rows:
    k = (r['repo'], r['pr'], r['path'], r['oline'], r['sline'], r['author'], r['created'])
    if k in seen: continue
    seen.add(k); T.append(r)
for r in T:
    a = r['author']
    r['kind'] = 'ai' if a in AI else ('otherbot' if (r['atype']=='Bot' or a in NONAI) else 'human')

ai = [r for r in T if r['kind']=='ai']; hu = [r for r in T if r['kind']=='human']
ob = [r for r in T if r['kind']=='otherbot']
unk = collections.Counter(r['author'] for r in T if r['kind']=='otherbot' and r['author'] not in NONAI)

print('='*84)
print(f"CORPUS  raw={len(rows)}  deduped={len(T)}  |  AI-bot={len(ai)}  human={len(hu)}  other-bot={len(ob)}")
print(f"        repos={len({r['repo'] for r in T})}  PRs={len({(r['repo'],r['pr']) for r in T})}  "
      f"PRs w/ AI={len({(r['repo'],r['pr']) for r in ai})}")
print(f"        thread-page truncation: {sum(1 for r in T if r['thread_trunc'])} rows "
      f"({sum(1 for r in T if r['thread_trunc'])/len(T)*100:.2f}%)")
print('='*84)
if unk: print('unclassified bot logins (excluded from AI set):', dict(unk.most_common(12)))

def tbl(title, rows_, group, minn=30):
    print(f'\n{title}')
    print(f'{"actor":22s} {"n":>6s} {"stale%":>7s} {"95% CI":>15s} {"resolv%":>8s} {"stale&unres%":>13s} {"95% CI":>15s}')
    g = collections.defaultdict(list)
    for r in rows_: g[group(r)].append(r)
    for name, rs in sorted(g.items(), key=lambda kv: -len(kv[1])):
        n = len(rs)
        if n < minn: continue
        p, lo, hi = wilson(sum(1 for r in rs if r['outdated']), n)
        pr_ = wilson(sum(1 for r in rs if r['resolved']), n)[0]
        su, sl, sh = wilson(sum(1 for r in rs if r['outdated'] and not r['resolved']), n)
        print(f'{name:22s} {n:6d} {p*100:6.1f}% [{lo*100:5.1f},{hi*100:5.1f}] {pr_*100:7.1f}% '
              f'{su*100:12.1f}% [{sl*100:5.1f},{sh*100:5.1f}]')

tbl('### 1. STALE RATE + RESOLUTION, per AI bot', ai, lambda r: AI[r['author']])
tbl('### 1b. CONTROL: bots vs humans', T,
    lambda r: {'ai':'ALL AI BOTS','human':'HUMANS (control)','otherbot':'NON-AI BOTS'}[r['kind']])

print('\n### 1c. CONFOUND CONTROLS')
bypr = collections.defaultdict(lambda: {'ai':[], 'human':[]})
for r in T:
    if r['kind'] in ('ai','human'): bypr[(r['repo'],r['pr'])][r['kind']].append(r)
both = {k:v for k,v in bypr.items() if v['ai'] and v['human']}
A = [r for v in both.values() for r in v['ai']]; H = [r for v in both.values() for r in v['human']]
print(f'\n  (a) WITHIN-PR PAIRED, PRs carrying both a bot and a human thread: n_PR={len(both)}')
for lab, rs in (('AI bots', A), ('Humans', H)):
    p, lo, hi = wilson(sum(1 for r in rs if r['outdated']), len(rs))
    print(f'      {lab:9s} n={len(rs):6d}  stale={p*100:5.1f}%  [{lo*100:.1f},{hi*100:.1f}]')

print('\n  (b) BY POSITION IN PR LIFECYCLE (thread opened at x% of PR lifespan)')
buck = collections.defaultdict(lambda: collections.defaultdict(list))
for r in T:
    if r['kind'] not in ('ai','human'): continue
    end = r.get('pr_closed') or r.get('pr_updated')
    if not end: continue
    t0, t1, tc = ts(r['pr_created']), ts(end), ts(r['created'])
    span = (t1-t0).total_seconds()
    if span <= 0: continue
    f = (tc-t0).total_seconds()/span
    b = '0-10%' if f<=.10 else '10-33%' if f<=.33 else '33-66%' if f<=.66 else '66-100%'
    buck[b][r['kind']].append(r)
print(f'      {"bucket":9s} {"AI n":>7s} {"AI stale":>9s}   {"Hum n":>6s} {"Hum stale":>10s}')
for b in ['0-10%','10-33%','33-66%','66-100%']:
    a_, h_ = buck[b]['ai'], buck[b]['human']
    pa = wilson(sum(1 for r in a_ if r['outdated']), len(a_))[0]*100 if a_ else float('nan')
    ph = wilson(sum(1 for r in h_ if r['outdated']), len(h_))[0]*100 if h_ else float('nan')
    print(f'      {b:9s} {len(a_):7d} {pa:8.1f}%   {len(h_):6d} {ph:9.1f}%')

print('\n  (c) BY PR SIZE (changed files) - tests "staleness is churn, not bots"')
def fb(n): return '1-2' if n<=2 else '3-9' if n<=9 else '10-29' if n<=29 else '30+'
cb = collections.defaultdict(lambda: collections.defaultdict(list))
for r in T:
    if r['kind'] in ('ai','human'): cb[fb(r['pr_files'])][r['kind']].append(r)
print(f'      {"files":9s} {"AI n":>7s} {"AI stale":>9s}   {"Hum n":>6s} {"Hum stale":>10s}')
for b in ['1-2','3-9','10-29','30+']:
    a_, h_ = cb[b]['ai'], cb[b]['human']
    pa = wilson(sum(1 for r in a_ if r['outdated']), len(a_))[0]*100 if a_ else float('nan')
    ph = wilson(sum(1 for r in h_ if r['outdated']), len(h_))[0]*100 if h_ else float('nan')
    print(f'      {b:9s} {len(a_):7d} {pa:8.1f}%   {len(h_):6d} {ph:9.1f}%')

print('\n  (d) BY PR STATE')
sb = collections.defaultdict(lambda: collections.defaultdict(list))
for r in T:
    if r['kind'] in ('ai','human'): sb[r['pr_state']][r['kind']].append(r)
print(f'      {"state":9s} {"AI n":>7s} {"AI stale":>9s}   {"Hum n":>6s} {"Hum stale":>10s}')
for st in ['OPEN','MERGED','CLOSED']:
    a_, h_ = sb[st]['ai'], sb[st]['human']
    if not a_ and not h_: continue
    pa = wilson(sum(1 for r in a_ if r['outdated']), len(a_))[0]*100 if a_ else float('nan')
    ph = wilson(sum(1 for r in h_ if r['outdated']), len(h_))[0]*100 if h_ else float('nan')
    print(f'      {st:9s} {len(a_):7d} {pa:8.1f}%   {len(h_):6d} {ph:9.1f}%')

print('\n  (e) PER-REPO stale rate spread (AI threads, repos with n>=100) - clustering check')
rp = collections.defaultdict(list)
for r in ai: rp[r['repo']].append(r)
vals = []
for k, rs in sorted(rp.items(), key=lambda kv: -len(kv[1])):
    if len(rs) < 100: continue
    p = wilson(sum(1 for r in rs if r['outdated']), len(rs))[0]
    vals.append(p)
    print(f'      {p*100:5.1f}%  n={len(rs):5d}  {k}')
if vals:
    vs = sorted(vals)
    print(f'      -> across {len(vs)} repos: min={vs[0]*100:.1f}% median={vs[len(vs)//2]*100:.1f}% max={vs[-1]*100:.1f}%')

print('\n### 3. THREADS PER PR, per bot (denominator = PRs that bot actually commented on)')
print(f'{"bot":22s} {"PRs":>6s} {"threads":>8s} {"mean":>6s} {"median":>7s} {"p90":>5s} {"max":>5s}')
byb = collections.defaultdict(collections.Counter)
for r in ai: byb[AI[r['author']]][(r['repo'], r['pr'])] += 1
for name, c in sorted(byb.items(), key=lambda kv: -sum(kv[1].values())):
    v = sorted(c.values())
    if len(v) < 20: continue
    print(f'{name:22s} {len(v):6d} {sum(v):8d} {sum(v)/len(v):6.2f} {v[len(v)//2]:7d} '
          f'{v[min(len(v)-1,int(len(v)*0.9))]:5d} {v[-1]:5d}')
hv = collections.Counter()
for r in hu: hv[(r['repo'], r['pr'])] += 1
v = sorted(hv.values())
print(f'{"HUMANS (control)":22s} {len(v):6d} {sum(v):8d} {sum(v)/len(v):6.2f} {v[len(v)//2]:7d} '
      f'{v[min(len(v)-1,int(len(v)*0.9))]:5d} {v[-1]:5d}')

print('\n### 2. DUPLICATE RATE (mechanical overlap between DIFFERENT bots)')
prbots = collections.defaultdict(set)
for r in ai: prbots[(r['repo'], r['pr'])].add(AI[r['author']])
multi = {k for k, v in prbots.items() if len(v) >= 2}
ai_multi = [r for r in ai if (r['repo'], r['pr']) in multi]
print(f'  PRs with 2+ distinct AI bots: {len(multi)} of {len(prbots)} AI-reviewed PRs '
      f'({len(multi)/max(1,len(prbots))*100:.1f}%)')
print(f'  AI threads on those PRs: {len(ai_multi)}')
def anchor(r): return r['line'] if r['line'] is not None else r['oline']
bypr2 = collections.defaultdict(list)
for r in ai_multi: bypr2[(r['repo'], r['pr'])].append(r)
collisions = []; hit = set()
for key, rs in bypr2.items():
    for i in range(len(rs)):
        for j in range(i+1, len(rs)):
            a, b = rs[i], rs[j]
            if AI[a['author']] == AI[b['author']] or a['path'] != b['path']: continue
            la, lb = anchor(a), anchor(b)
            if la is None or lb is None or abs(la-lb) > 3: continue
            collisions.append((a, b, abs(la-lb))); hit.add(id(a)); hit.add(id(b))
p, lo, hi = wilson(len(hit), len(ai_multi))
p2, lo2, hi2 = wilson(len(hit), len(ai))
print(f'  Collision pairs (same file, anchors within 3 lines): {len(collisions)}')
print(f'  Threads in >=1 collision: {len(hit)}/{len(ai_multi)} = {p*100:.1f}% [{lo*100:.1f},{hi*100:.1f}] '
      f'(of threads on multi-bot PRs)')
print(f'  Same, over ALL AI threads: {p2*100:.2f}% [{lo2*100:.2f},{hi2*100:.2f}]')
for k, v in collections.Counter(tuple(sorted((AI[a['author']], AI[b['author']]))) for a,b,_ in collisions).most_common(12):
    print(f'    {k[0]} x {k[1]}: {v}')
json.dump([{'repo':a['repo'],'pr':a['pr'],'path':a['path'],'gap':d,
            'a_bot':AI[a['author']],'a_login':a['author'],'a_line':anchor(a),
            'b_bot':AI[b['author']],'b_login':b['author'],'b_line':anchor(b)}
           for a,b,d in collisions], open(f'{D}/collisions.json','w'), indent=1)
print(f'  -> wrote {len(collisions)} collisions to collisions.json')
