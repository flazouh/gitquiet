import json, subprocess, sys, time, os

Q = '''
query($o:String!,$n:String!,$c:String){
 rateLimit{ remaining cost }
 repository(owner:$o,name:$n){
  pullRequests(first:50, orderBy:{field:CREATED_AT,direction:DESC}, states:[MERGED,CLOSED,OPEN], after:$c){
   pageInfo{ hasNextPage endCursor }
   nodes{ number state createdAt closedAt mergedAt updatedAt changedFiles additions
    reviewThreads(first:60){ pageInfo{ hasNextPage } totalCount
     nodes{ isOutdated isResolved resolvedBy{ login __typename } path line originalLine startLine diffSide
      comments(first:1){ totalCount nodes{ author{ login __typename } createdAt } } } } } } } }
'''
D = os.path.dirname(os.path.abspath(__file__))
repos = [l.strip() for l in open(f'{D}/repos.txt') if l.strip()]
done = set()
if os.path.exists(f'{D}/harvest2_done.txt'):
    done = set(l.strip() for l in open(f'{D}/harvest2_done.txt'))
out = open(f'{D}/threads2.jsonl', 'a')
donef = open(f'{D}/harvest2_done.txt', 'a')
PAGES = int(sys.argv[1]) if len(sys.argv) > 1 else 2
n = 0; rl = {}
for r in repos:
    if r in done: continue
    o, nm = r.split('/', 1)
    cur = None
    for pg in range(PAGES):
        args = ['gh','api','graphql','-f','query='+Q,'-F','o='+o,'-F','n='+nm]
        if cur: args += ['-F','c='+cur]
        p = subprocess.run(args, capture_output=True, text=True)
        try: j = json.loads(p.stdout)
        except Exception:
            print('PARSE', r, p.stdout[:150], file=sys.stderr); break
        rl = (j.get('data') or {}).get('rateLimit') or {}
        repo = (j.get('data') or {}).get('repository')
        if not repo:
            print('NOREPO', r, str(j.get('errors'))[:120], file=sys.stderr); break
        prs = repo['pullRequests']
        for pr in prs['nodes']:
            trunc = pr['reviewThreads']['pageInfo']['hasNextPage']
            for t in pr['reviewThreads']['nodes']:
                cs = t['comments']['nodes']
                if not cs or not cs[0]['author']: continue
                a = cs[0]['author']
                out.write(json.dumps({
                    'repo': r, 'pr': pr['number'], 'pr_state': pr['state'],
                    'pr_created': pr['createdAt'], 'pr_closed': pr['closedAt'],
                    'pr_merged': pr['mergedAt'], 'pr_updated': pr['updatedAt'],
                    'pr_files': pr['changedFiles'], 'pr_adds': pr['additions'],
                    'author': a['login'], 'atype': a['__typename'], 'created': cs[0]['createdAt'],
                    'ncomments': t['comments']['totalCount'],
                    'outdated': t['isOutdated'], 'resolved': t['isResolved'],
                    'resolved_by': (t['resolvedBy'] or {}).get('login'),
                    'resolved_by_type': (t['resolvedBy'] or {}).get('__typename'),
                    'path': t['path'], 'line': t['line'], 'oline': t['originalLine'],
                    'sline': t['startLine'], 'side': t['diffSide'],
                    'thread_trunc': trunc, 'pr_threads': pr['reviewThreads']['totalCount'],
                })+'\n')
                n += 1
        if not prs['pageInfo']['hasNextPage']: break
        cur = prs['pageInfo']['endCursor']
        if rl.get('remaining', 9999) < 250:
            out.flush(); print('RATE LOW', rl, file=sys.stderr); sys.exit(2)
    donef.write(r+'\n'); donef.flush(); out.flush()
    print(f'{r} rows={n} rl={rl.get("remaining")}', file=sys.stderr)
out.close()
print('WROTE', n)
