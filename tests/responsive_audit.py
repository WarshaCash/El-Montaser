"""فحص التجاوب: يقيس التمدد الأفقي لكل الشاشات الأساسية بسبعة عروض (320 إلى 1920):  python3 tests/responsive_audit.py"""
import pathlib, json
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
SIZES={'phoneS':(320,640),'phone':(375,740),'phoneL':(430,900),'tablet':(768,1024),'tabletL':(1024,768),'laptop':(1280,720),'pc':(1920,1080)}
ROUTES=['/','/invoices','/invoices/new','/customers','/accounts','/collect','/treasury','/expenses','/settings']
JS="""() => { const w=document.documentElement.clientWidth; const bad=[];
 document.querySelectorAll('#view *, .topbar *, #bottomnav *').forEach(e=>{const r=e.getBoundingClientRect(); if(r.width>0 && (r.right>w+1 || r.left<-1) && getComputedStyle(e).position!=='fixed'){ let p=e.parentElement, scroller=false; while(p&&p!==document.body){const o=getComputedStyle(p).overflowX; if((o==='auto'||o==='scroll'||o==='hidden')&&p.getBoundingClientRect().right<=w+1){scroller=true;break} p=p.parentElement} if(!scroller) bad.push((e.id?'#'+e.id:'')+'.'+(e.className&&e.className.baseVal===undefined?String(e.className).split(' ')[0]:'')+'<'+e.tagName.toLowerCase()+'>'+Math.round(r.right))}});
 return {doc:document.documentElement.scrollWidth, w, bad:[...new Set(bad)].slice(0,6)} }"""
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,(W,H) in SIZES.items():
        ctx=b.new_context(viewport={'width':W,'height':H}, has_touch=name in('phone','phoneS','tablet'), is_mobile=name.startswith('phone'))
        pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto((ROOT/'index.html').as_uri()+'#/'); pg.wait_for_timeout(600)
        for r in ROUTES:
            pg.evaluate("h=>{location.hash=h}",r); pg.wait_for_timeout(350)
            res=pg.evaluate(JS)
            flag='OVERFLOW' if res['doc']>res['w']+1 or res['bad'] else 'ok'
            print(f"{name:7}{r:14}{flag:9}doc={res['doc']}/{res['w']} {res['bad']}")
        if name in('phone','tablet'):
            for r,fn in (('/','home'),('/invoices/new','new')):
                pg.evaluate("h=>{location.hash=h}",r); pg.wait_for_timeout(500); pg.screenshot(path=f'/home/claude/r_{name}_{fn}.png')
        print(name,'errors',errs)
        ctx.close()
    b.close()
