import json, subprocess, sys, collections, random, time, os
D = os.path.dirname(os.path.abspath(__file__))
cols = json.load(open(f'{D}/collisions_full.json'))
prev = {(c['repo'], c['pr'], c['path'], c['a_line']) for c in json.load(open(f'{D}/collision_sample.json'))}
cols = [c for c in cols if (c['repo'], c['pr'], c['path'], c['a_line']) not in prev]
random.seed(99)
by_pair = collections.defaultdict(list)
for c in cols: by_pair[tuple(sorted((c['a_bot'], c['b_bot'])))].append(c)
pairs = sorted(by_pair, key=lambda k: -len(by_pair[k]))
sample = []
while len(sample) < 30:
    moved = False
    for p in pairs:
        if by_pair[p] and len(sample) < 30:
            sample.append(by_pair[p].pop(random.randrange(len(by_pair[p])))); moved = True
    if not moved: break
print(f'sampled {len(sample)} across {len({tuple(sorted((c["a_bot"],c["b_bot"]))) for c in sample})} pairs', file=sys.stderr)
Q = '''query($o:String!,$n:String!,$p:Int!){repository(owner:$o,name:$n){pullRequest(number:$p){
 reviewThreads(first:100){nodes{path line originalLine comments(first:1){nodes{author{login} body url}}}}}}}'''
cache = {}; out = []
for c in sample:
    key = (c['repo'], c['pr'])
    if key not in cache:
        o, n = c['repo'].split('/', 1)
        p = subprocess.run(['gh','api','graphql','-f','query='+Q,'-F','o='+o,'-F','n='+n,'-F','p=%d'%c['pr']],
                           capture_output=True, text=True)
        try: cache[key] = json.loads(p.stdout)['data']['repository']['pullRequest']['reviewThreads']['nodes']
        except Exception: cache[key] = []
        time.sleep(0.1)
    def find(login, line):
        for t in cache[key]:
            cs = t['comments']['nodes']
            if not cs or not cs[0]['author'] or t['path'] != c['path']: continue
            anc = t['line'] if t['line'] is not None else t['originalLine']
            if anc is None or abs(anc-line) > 1: continue
            if cs[0]['author']['login'] == login: return cs[0]
        return None
    a = find(c['a_login'], c['a_line']); b = find(c['b_login'], c['b_line'])
    if a and b:
        out.append({**c, 'a_body': a['body'][:700], 'a_url': a['url'],
                    'b_body': b['body'][:700], 'b_url': b['url']})
json.dump(out, open(f'{D}/collision_sample2.json','w'), indent=1)
print('usable pairs:', len(out))
