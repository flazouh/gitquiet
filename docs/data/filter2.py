import json, subprocess, sys, time, os
D = os.path.dirname(os.path.abspath(__file__))
repos = [l.strip() for l in open(f'{D}/cands_new.txt') if l.strip()]
done = {}
if os.path.exists(f'{D}/meta.json'): done = json.load(open(f'{D}/meta.json'))
todo = [r for r in repos if r not in done]
print(f'{len(repos)} candidates, {len(todo)} to check', file=sys.stderr)
B = 60
for i in range(0, len(todo), B):
    batch = todo[i:i+B]
    parts = []
    for j, r in enumerate(batch):
        o, n = r.split('/', 1)
        parts.append(f'r{j}: repository(owner:"{o}",name:"{n}"){{ nameWithOwner stargazerCount isArchived '
                     f'pullRequests(states:[MERGED,CLOSED,OPEN]){{ totalCount }} }}')
    p = subprocess.run(['gh','api','graphql','-f','query={'+chr(10).join(parts)+'}'],
                       capture_output=True, text=True)
    try: data = (json.loads(p.stdout).get('data') or {})
    except Exception:
        print('PARSE', p.stdout[:150], file=sys.stderr); continue
    for j, r in enumerate(batch):
        v = data.get(f'r{j}')
        if not v or v['isArchived']:
            done[r] = None; continue
        done[r] = {'stars': v['stargazerCount'], 'prs': v['pullRequests']['totalCount']}
    json.dump(done, open(f'{D}/meta.json','w'))
    if i % 600 == 0: print(f'  {i+len(batch)}/{len(todo)}', file=sys.stderr)
    time.sleep(0.1)
live = {k:v for k,v in done.items() if v and v['prs'] >= 60}
print('live repos with >=60 PRs:', len(live))
with open(f'{D}/repos_pool.txt','w') as f:
    for k,v in sorted(live.items(), key=lambda kv: -kv[1]['prs']):
        f.write(f'{k}\t{v["stars"]}\t{v["prs"]}\n')
