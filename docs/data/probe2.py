import json, subprocess, sys, time, collections, os
D = os.path.dirname(os.path.abspath(__file__))
AI = {'coderabbitai','cursor','chatgpt-codex-connector','copilot-pull-request-reviewer','cubic-dev-ai',
      'greptile-apps','gemini-code-assist','claude','devin-ai-integration','sourcery-ai','macroscopeapp',
      'fullsend-ai-review','qodo-code-review','qodo-free-for-open-source-projects','qodo-app-for-konflux-ci',
      'qodo-for-redhat-appstudio','qodo-for-stolostron','rhdh-qodo-merge','qodo-for-securesign','gitar-bot',
      'kilo-code-bot','ellipsis-dev','entelligence-ai-pr-reviews','codiumai-pr-agent-free','sweep-ai'}
repos = [l.split('\t')[0] for l in open(f'{D}/repos_pool.txt')]
old = set(l.strip() for l in open(f'{D}/repos.txt'))
repos = [r for r in repos if r not in old]
res = {}
if os.path.exists(f'{D}/probe2.json'): res = json.load(open(f'{D}/probe2.json'))
todo = [r for r in repos if r not in res]
print(f'{len(todo)} to probe', file=sys.stderr)
def build(batch):
    parts=[]
    for j,r in enumerate(batch):
        o,n=r.split('/',1)
        parts.append(f'''r{j}: repository(owner:"{o}",name:"{n}"){{ pullRequests(last:20,states:[MERGED,CLOSED,OPEN]){{ nodes{{ reviewThreads(first:20){{ nodes{{ comments(first:1){{ nodes{{ author{{ login __typename }} }} }} }} }} }} }} }}''')
    return '{ rateLimit{remaining} ' + chr(10).join(parts) + '}'
B=6
for i in range(0,len(todo),B):
    batch=todo[i:i+B]
    p=subprocess.run(['gh','api','graphql','-f','query='+build(batch)],capture_output=True,text=True)
    try: d=json.loads(p.stdout); data=d.get('data') or {}
    except Exception:
        print('PARSE',p.stdout[:120],file=sys.stderr); continue
    rl=(data.get('rateLimit') or {}).get('remaining',9999)
    for j,r in enumerate(batch):
        v=data.get(f'r{j}')
        if not v: res[r]={}; continue
        bots=collections.Counter()
        for pr in v['pullRequests']['nodes']:
            for t in pr['reviewThreads']['nodes']:
                c=t['comments']['nodes']
                if not c or not c[0]['author']: continue
                a=c[0]['author']['login']
                if a in AI: bots[a]+=1
        res[r]=dict(bots)
    json.dump(res,open(f'{D}/probe2.json','w'))
    if i % 300 == 0: print(f'  {i+len(batch)}/{len(todo)} rl={rl}',file=sys.stderr)
    if rl < 400:
        print('RATE LOW',rl,file=sys.stderr); sys.exit(2)
    time.sleep(0.1)
print('probed',len(res),'with bots',sum(1 for v in res.values() if v))
