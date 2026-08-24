import json, collections, math, os
D = os.path.dirname(os.path.abspath(__file__))
AI = {'coderabbitai':'CodeRabbit','cursor':'Cursor Bugbot','chatgpt-codex-connector':'OpenAI Codex',
      'copilot-pull-request-reviewer':'GitHub Copilot','cubic-dev-ai':'cubic','greptile-apps':'Greptile',
      'gemini-code-assist':'Gemini Code Assist','claude':'Claude','devin-ai-integration':'Devin',
      'sourcery-ai':'Sourcery','macroscopeapp':'Macroscope','fullsend-ai-review':'FullSend',
      'qodo-code-review':'Qodo','qodo-free-for-open-source-projects':'Qodo','qodo-app-for-konflux-ci':'Qodo',
      'qodo-for-redhat-appstudio':'Qodo','qodo-for-stolostron':'Qodo','rhdh-qodo-merge':'Qodo',
      'qodo-for-securesign':'Qodo','gitar-bot':'Gitar','kilo-code-bot':'Kilo'}
def wilson(k,n,z=1.96):
    if n==0: return (0.0,0.0,0.0)
    p=k/n; d=1+z*z/n; c=(p+z*z/(2*n))/d
    h=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
    return (p,max(0.0,c-h),min(1.0,c+h))

rows=[json.loads(l) for l in open(f'{D}/threads2.jsonl')]
seen=set(); T=[]
for r in rows:
    k=(r['repo'],r['pr'],r['path'],r['oline'],r['sline'],r['author'],r['created'])
    if k in seen: continue
    seen.add(k); T.append(r)
ai=[r for r in T if r['author'] in AI]
hu=[r for r in T if r['author'] not in AI and r['atype']!='Bot']

def human_resolved(r):
    if not r['resolved']: return False
    rb, rt = r.get('resolved_by'), r.get('resolved_by_type')
    if rb is None: return False
    if rt == 'Bot' or rb.endswith('[bot]'): return False
    if rb == r['author'] or rb.replace('[bot]','') == r['author']: return False
    return True

print('='*94)
print(f"RESOLUTION, DECOMPOSED BY WHO CLOSED THE THREAD   (AI threads n={len(ai)})")
print('='*94)
print(f'{"bot":22s} {"n":>6s} {"resolved%":>10s} {"HUMAN-assent%":>14s} {"95% CI":>15s} {"self-closed%":>13s} {"other-bot%":>11s}')
g=collections.defaultdict(list)
for r in ai: g[AI[r['author']]].append(r)
out=[]
for name,rs in sorted(g.items(), key=lambda kv:-len(kv[1])):
    n=len(rs)
    if n<100: continue
    res=sum(1 for r in rs if r['resolved'])
    ha=sum(1 for r in rs if human_resolved(r))
    self_=sum(1 for r in rs if r['resolved'] and r.get('resolved_by') and
              (r['resolved_by']==r['author'] or r['resolved_by'].replace('[bot]','')==r['author']))
    ob=res-ha-self_
    p,lo,hi=wilson(ha,n)
    out.append((name,n,res/n,p,lo,hi,self_/n,ob/n))
    print(f'{name:22s} {n:6d} {res/n*100:9.1f}% {p*100:13.1f}% [{lo*100:5.1f},{hi*100:5.1f}] '
          f'{self_/n*100:12.1f}% {ob/n*100:10.1f}%')
n=len(hu); res=sum(1 for r in hu if r['resolved']); ha=sum(1 for r in hu if human_resolved(r))
p,lo,hi=wilson(ha,n)
print(f'{"HUMANS (control)":22s} {n:6d} {res/n*100:9.1f}% {p*100:13.1f}% [{lo*100:5.1f},{hi*100:5.1f}]')

print('\n--- ranked by human assent (the metric nobody publishes) ---')
for name,n,r_,p,lo,hi,s,o in sorted(out,key=lambda x:-x[3]):
    print(f'  {p*100:5.1f}%  [{lo*100:4.1f},{hi*100:4.1f}]  n={n:5d}  {name}'
          + (f'   <- published resolution was {r_*100:.1f}%' if abs(r_-p)>0.10 else ''))
