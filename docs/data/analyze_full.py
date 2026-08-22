import json, collections, math, os, glob
D = os.path.dirname(os.path.abspath(__file__))
AI = {'coderabbitai':'CodeRabbit','cursor':'Cursor Bugbot','chatgpt-codex-connector':'OpenAI Codex',
      'copilot-pull-request-reviewer':'GitHub Copilot','cubic-dev-ai':'cubic','greptile-apps':'Greptile',
      'gemini-code-assist':'Gemini Code Assist','claude':'Claude','devin-ai-integration':'Devin',
      'sourcery-ai':'Sourcery','macroscopeapp':'Macroscope','fullsend-ai-review':'FullSend',
      'qodo-code-review':'Qodo','qodo-free-for-open-source-projects':'Qodo','qodo-app-for-konflux-ci':'Qodo',
      'qodo-for-redhat-appstudio':'Qodo','qodo-for-stolostron':'Qodo','rhdh-qodo-merge':'Qodo',
      'qodo-for-securesign':'Qodo','gitar-bot':'Gitar','kilo-code-bot':'Kilo','ellipsis-dev':'Ellipsis',
      'entelligence-ai-pr-reviews':'Entelligence','codiumai-pr-agent-free':'Qodo','sweep-ai':'Sweep'}
def wilson(k,n,z=1.96):
    if n==0: return (0.0,0.0,0.0)
    p=k/n; d=1+z*z/n; c=(p+z*z/(2*n))/d
    h=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
    return (p,max(0.0,c-h),min(1.0,c+h))

rows=[]
for f in ['threads2.jsonl','threads_w2.jsonl']:
    fp=f'{D}/{f}'
    if os.path.exists(fp): rows += [json.loads(l) for l in open(fp)]
seen=set(); T=[]
for r in rows:
    k=(r['repo'],r['pr'],r['path'],r['oline'],r['sline'],r['author'],r['created'])
    if k in seen: continue
    seen.add(k); T.append(r)
for r in T:
    a=r['author']
    r['kind']='ai' if a in AI else ('otherbot' if r['atype']=='Bot' else 'human')
ai=[r for r in T if r['kind']=='ai']; hu=[r for r in T if r['kind']=='human']

def human_assent(r):
    if not r['resolved']: return False
    rb,rt=r.get('resolved_by'),r.get('resolved_by_type')
    if rb is None or rt=='Bot' or rb.endswith('[bot]'): return False
    if rb==r['author'] or rb.replace('[bot]','')==r['author']: return False
    return True
def self_closed(r):
    rb=r.get('resolved_by')
    return bool(r['resolved'] and rb and (rb==r['author'] or rb.replace('[bot]','')==r['author']))

print('='*100)
print(f"COMBINED CORPUS  raw={len(rows)}  deduped={len(T)}  AI={len(ai)}  human={len(hu)}  otherbot={len(T)-len(ai)-len(hu)}")
print(f"  repos={len({r['repo'] for r in T})}  PRs={len({(r['repo'],r['pr']) for r in T})}  "
      f"PRs w/ AI={len({(r['repo'],r['pr']) for r in ai})}")
ds=sorted(r['pr_created'][:10] for r in ai); print(f"  PR date range {ds[0]} .. {ds[-1]}")
print('='*100)

print(f'\n### PER-BOT MASTER TABLE\n')
print(f'{"bot":20s} {"n":>6s} {"repos":>5s} {"stale%":>7s} {"95%CI":>13s} {"assent%":>8s} {"95%CI":>13s} '
      f'{"self%":>6s} {"stale&unres%":>12s} {"thr/PR":>7s}')
g=collections.defaultdict(list)
for r in ai: g[AI[r['author']]].append(r)
master=[]
for name,rs in sorted(g.items(), key=lambda kv:-len(kv[1])):
    n=len(rs)
    if n<80: continue
    st,slo,shi=wilson(sum(1 for r in rs if r['outdated']),n)
    ha,hlo,hhi=wilson(sum(1 for r in rs if human_assent(r)),n)
    sc=sum(1 for r in rs if self_closed(r))/n
    su=sum(1 for r in rs if r['outdated'] and not r['resolved'])/n
    prs=collections.Counter((r['repo'],r['pr']) for r in rs)
    tpp=n/len(prs)
    nrepo=len({r['repo'] for r in rs})
    master.append((name,n,nrepo,st,slo,shi,ha,hlo,hhi,sc,su,tpp,sorted(prs.values())))
    print(f'{name:20s} {n:6d} {nrepo:5d} {st*100:6.1f}% [{slo*100:4.1f},{shi*100:4.1f}] {ha*100:7.1f}% '
          f'[{hlo*100:4.1f},{hhi*100:4.1f}] {sc*100:5.1f}% {su*100:11.1f}% {tpp:7.2f}')
n=len(hu)
st=wilson(sum(1 for r in hu if r['outdated']),n); ha=wilson(sum(1 for r in hu if human_assent(r)),n)
hp=collections.Counter((r['repo'],r['pr']) for r in hu)
print(f'{"HUMANS (control)":20s} {n:6d} {len({r["repo"] for r in hu}):5d} {st[0]*100:6.1f}% '
      f'[{st[1]*100:4.1f},{st[2]*100:4.1f}] {ha[0]*100:7.1f}% [{ha[1]*100:4.1f},{ha[2]*100:4.1f}] '
      f'{"-":>5s} {sum(1 for r in hu if r["outdated"] and not r["resolved"])/n*100:11.1f}% {n/len(hp):7.2f}')

print('\n### RANKED BY HUMAN ASSENT (auto-resolve removed)')
for name,n,nr,st,sl,sh,ha,hl,hh,sc,su,tpp,v in sorted(master,key=lambda x:-x[6]):
    tag=' [never self-closes]' if sc<0.005 else f' [self-closes {sc*100:.0f}%]'
    print(f'  {ha*100:5.1f}%  [{hl*100:4.1f},{hh*100:4.1f}]  n={n:6d}  repos={nr:3d}  {name}{tag}')

print('\n### THREADS PER PR')
print(f'{"bot":20s} {"PRs":>6s} {"mean":>6s} {"median":>7s} {"p90":>5s} {"max":>5s}')
for name,n,nr,st,sl,sh,ha,hl,hh,sc,su,tpp,v in sorted(master,key=lambda x:-x[11]):
    print(f'{name:20s} {len(v):6d} {tpp:6.2f} {v[len(v)//2]:7d} {v[min(len(v)-1,int(len(v)*.9))]:5d} {v[-1]:5d}')
hv=sorted(hp.values())
print(f'{"HUMANS (control)":20s} {len(hv):6d} {sum(hv)/len(hv):6.2f} {hv[len(hv)//2]:7d} '
      f'{hv[min(len(hv)-1,int(len(hv)*.9))]:5d} {hv[-1]:5d}')

print('\n### CONTROL: bots vs humans (pooled)')
for lab,rs in (('ALL AI BOTS',ai),('HUMANS',hu)):
    n=len(rs); st=wilson(sum(1 for r in rs if r['outdated']),n)
    su=wilson(sum(1 for r in rs if r['outdated'] and not r['resolved']),n)
    print(f'  {lab:12s} n={n:6d} stale={st[0]*100:5.1f}% [{st[1]*100:.1f},{st[2]*100:.1f}]  '
          f'stale&unresolved={su[0]*100:5.1f}% [{su[1]*100:.1f},{su[2]*100:.1f}]')

print('\n### WITHIN-PR PAIRED')
bp=collections.defaultdict(lambda:{'ai':[],'human':[]})
for r in T:
    if r['kind'] in ('ai','human'): bp[(r['repo'],r['pr'])][r['kind']].append(r)
both={k:v for k,v in bp.items() if v['ai'] and v['human']}
for lab,key in (('AI bots','ai'),('Humans','human')):
    rs=[r for v in both.values() for r in v[key]]
    p,lo,hi=wilson(sum(1 for r in rs if r['outdated']),len(rs))
    print(f'  {lab:9s} n={len(rs):6d}  stale={p*100:5.1f}% [{lo*100:.1f},{hi*100:.1f}]   (PRs={len(both)})')

print('\n### DUPLICATE RATE')
prb=collections.defaultdict(set)
for r in ai: prb[(r['repo'],r['pr'])].add(AI[r['author']])
multi={k for k,v in prb.items() if len(v)>=2}
am=[r for r in ai if (r['repo'],r['pr']) in multi]
def anch(r): return r['line'] if r['line'] is not None else r['oline']
bp2=collections.defaultdict(list)
for r in am: bp2[(r['repo'],r['pr'])].append(r)
cols=[]; hit=set()
for k,rs in bp2.items():
    for i in range(len(rs)):
        for j in range(i+1,len(rs)):
            a,b=rs[i],rs[j]
            if AI[a['author']]==AI[b['author']] or a['path']!=b['path']: continue
            la,lb=anch(a),anch(b)
            if la is None or lb is None or abs(la-lb)>3: continue
            cols.append((a,b,abs(la-lb))); hit.add(id(a)); hit.add(id(b))
p,lo,hi=wilson(len(hit),len(am)); p2,lo2,hi2=wilson(len(hit),len(ai))
print(f'  multi-bot PRs: {len(multi)}/{len(prb)} ({len(multi)/len(prb)*100:.1f}%)  threads on them: {len(am)}')
print(f'  mechanical overlap: {len(hit)}/{len(am)} = {p*100:.1f}% [{lo*100:.1f},{hi*100:.1f}] of multi-bot threads')
print(f'                      = {p2*100:.2f}% [{lo2*100:.2f},{hi2*100:.2f}] of ALL AI threads')
J=json.load(open(f'{D}/judgments.json'))
dq=sum(1 for j in J if j['verdict']=='duplicate'); jn=len(J)
q,ql,qh=wilson(dq,jn)
print(f'  hand-judged true-dup share: {q*100:.0f}% [{ql*100:.1f},{qh*100:.1f}] (n={jn})')
print(f'  CORRECTED, multi-bot threads: {p*q*100:.1f}% [{p*ql*100:.1f},{p*qh*100:.1f}]')
print(f'  CORRECTED, all AI threads:    {p2*q*100:.1f}% [{p2*ql*100:.1f},{p2*qh*100:.1f}]')
json.dump([{'repo':a['repo'],'pr':a['pr'],'path':a['path'],'gap':d,
            'a_bot':AI[a['author']],'a_login':a['author'],'a_line':anch(a),
            'b_bot':AI[b['author']],'b_login':b['author'],'b_line':anch(b)} for a,b,d in cols],
          open(f'{D}/collisions_full.json','w'), indent=1)
print(f'  wrote {len(cols)} collisions -> collisions_full.json')
