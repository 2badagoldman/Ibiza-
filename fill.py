import json,sys
meta=json.load(open('meta.json')); clips=[]
for mf in sys.argv[1:]:
    for c in json.load(open(mf))['clips']:
        if c.get('error') or c['id'] not in meta: continue
        m=meta[c['id']]; clips.append({'id':c['id'],'url':c['url'],'poster':c['poster'],'title':m['title'],'desc':m['desc'],'tags':m['tags'],'soon':m.get('soon',False),'cta':m.get('cta',''),'song':c.get('song',''),'p':m['p']})
order=list(meta); clips.sort(key=lambda c:order.index(c['id']))
s=open('demo.html').read(); a=s.index('/*CLIPS*/'); b=s.index('/*END*/')
open('public-demo.html','w').write(s[:a+9]+json.dumps(clips,ensure_ascii=False)+s[b:])
print(len(clips),'clips')
