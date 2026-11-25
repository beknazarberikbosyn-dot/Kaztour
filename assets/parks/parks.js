/* Samruk Travel · parks without stress
   1) offline trip pack: programme, ticket QR, SOS, park plan with GPS, phrasebook — works with no signal
   2) park facilities map: toilets, bins, water, first aid, signal zones, with one-tap reports
   3) reports wait in an outbox while there is no signal and are sent when the network returns
   4) park office panel: hotspots, open issues, a service round for cleaners and signal gaps
   Prototype: the "park server" is this browser's storage, so the office panel sees what tourists sent from here. */
(function(){
'use strict';

/* ---------- data: five parks on our routes. Positions are approximate, for the prototype ---------- */
const PARKS={
 kolsai:{name:'Kolsai Lakes National Park',short:'Kolsai Lakes',tour:'kolsai',c:[42.9958,78.3282],z:16,
  water:'Tap water at the car park. Nothing on the trail: carry at least 1.5 litres.',
  signal:'Signal is weak at the gate and there is none at the lake shore or on the trail. The nearest stable signal is in Saty village.',
  f:[{id:'k-gate',t:'ranger',lat:42.9992,lng:78.3301,n:'Entrance gate and ranger post'},
     {id:'k-park',t:'parking',lat:42.9987,lng:78.3287,n:'Main car park'},
     {id:'k-wc1',t:'toilet',lat:42.9982,lng:78.3276,n:'Toilets by the car park'},
     {id:'k-wc2',t:'toilet',lat:42.9952,lng:78.3246,n:'Toilets at the lake shore'},
     {id:'k-bin1',t:'bin',lat:42.9979,lng:78.3285,n:'Bins at the car park'},
     {id:'k-bin2',t:'bin',lat:42.9958,lng:78.3254,n:'Bins by the jetty'},
     {id:'k-bin3',t:'bin',lat:42.9922,lng:78.3271,n:'Bin on the east shore trail'},
     {id:'k-tap',t:'water',lat:42.9984,lng:78.3292,n:'Drinking water tap'},
     {id:'k-aid',t:'aid',lat:42.9990,lng:78.3296,n:'First aid at the ranger post'}],
  trail:[[42.9952,78.3246],[42.9938,78.3262],[42.9922,78.3271],[42.9900,78.3290],[42.9870,78.3305]],trailName:'Trail to the Middle lake',
  sig:[{lat:42.9989,lng:78.3293,r:170,q:1,n:'Weak signal at the gate'},{lat:42.9950,lng:78.3255,r:260,q:0,n:'No signal at the lake shore'},{lat:42.9895,lng:78.3292,r:330,q:0,n:'No signal on the trail'}]},
 charyn:{name:'Charyn National Park',short:'Charyn Canyon',tour:'charyn',c:[43.3545,79.0805],z:15,
  water:'Water is sold at the eco-park by the river. Take 2 litres for the walk down and back.',
  signal:'Weak signal at the top car park. No signal inside the Valley of Castles.',
  f:[{id:'c-gate',t:'ranger',lat:43.3530,lng:79.0737,n:'Ticket office and ranger post'},
     {id:'c-park',t:'parking',lat:43.3536,lng:79.0728,n:'Car park at the top'},
     {id:'c-wc1',t:'toilet',lat:43.3526,lng:79.0744,n:'Toilets at the top'},
     {id:'c-wc2',t:'toilet',lat:43.3570,lng:79.0880,n:'Toilets at the eco-park by the river'},
     {id:'c-bin1',t:'bin',lat:43.3528,lng:79.0749,n:'Bins at the top'},
     {id:'c-bin2',t:'bin',lat:43.3513,lng:79.0779,n:'Bin at the start of the valley'},
     {id:'c-bin3',t:'bin',lat:43.3566,lng:79.0871,n:'Bins at the eco-park'},
     {id:'c-tap',t:'water',lat:43.3573,lng:79.0886,n:'Water at the eco-park'},
     {id:'c-aid',t:'aid',lat:43.3532,lng:79.0734,n:'First aid at the ticket office'}],
  trail:[[43.3526,79.0750],[43.3513,79.0779],[43.3522,79.0812],[43.3540,79.0838],[43.3556,79.0860],[43.3570,79.0880]],trailName:'Path down the Valley of Castles',
  sig:[{lat:43.3530,lng:79.0738,r:200,q:1,n:'Weak signal at the top'},{lat:43.3535,lng:79.0820,r:420,q:0,n:'No signal in the valley'}]},
 bigalmaty:{name:'Ile-Alatau National Park, Big Almaty Lake',short:'Big Almaty Lake',tour:'bigalmaty',c:[43.0532,76.9848],z:16,
  water:'There is no drinking water at the lake. Bring your own.',
  signal:'Signal is usually weak at the car park and on the dam.',
  f:[{id:'b-gate',t:'ranger',lat:43.0566,lng:76.9829,n:'Ranger post on the road above the lake'},
     {id:'b-park',t:'parking',lat:43.0559,lng:76.9838,n:'Car park above the dam'},
     {id:'b-wc1',t:'toilet',lat:43.0554,lng:76.9845,n:'Toilets at the car park'},
     {id:'b-bin1',t:'bin',lat:43.0551,lng:76.9850,n:'Bins at the car park'},
     {id:'b-bin2',t:'bin',lat:43.0516,lng:76.9862,n:'Bin on the shore path'},
     {id:'b-aid',t:'aid',lat:43.0564,lng:76.9832,n:'First aid at the ranger post'}],
  trail:[[43.0551,76.9850],[43.0536,76.9856],[43.0516,76.9862],[43.0505,76.9853]],trailName:'Path down to the shore',
  sig:[{lat:43.0556,lng:76.9842,r:220,q:1,n:'Weak signal at the car park'},{lat:43.0510,lng:76.9858,r:220,q:1,n:'Weak signal on the shore'}]},
 burabay:{name:'Burabay National Park',short:'Burabay',tour:'burabay',c:[53.0815,70.2645],z:14,
  water:'Drinking water and cafes at the visitor centre.',
  signal:'Good signal near the resort. Weak at Blue Bay.',
  f:[{id:'u-gate',t:'ranger',lat:53.0790,lng:70.2790,n:'Visitor centre'},
     {id:'u-park',t:'parking',lat:53.0796,lng:70.2801,n:'Car park at the visitor centre'},
     {id:'u-wc1',t:'toilet',lat:53.0785,lng:70.2796,n:'Toilets at the visitor centre'},
     {id:'u-wc2',t:'toilet',lat:53.0868,lng:70.2532,n:'Toilets at Blue Bay'},
     {id:'u-bin1',t:'bin',lat:53.0782,lng:70.2788,n:'Bins at the beach'},
     {id:'u-bin2',t:'bin',lat:53.0825,lng:70.2640,n:'Bin on the shore path'},
     {id:'u-bin3',t:'bin',lat:53.0872,lng:70.2524,n:'Bins at Blue Bay'},
     {id:'u-tap',t:'water',lat:53.0788,lng:70.2783,n:'Drinking water at the visitor centre'},
     {id:'u-aid',t:'aid',lat:53.0792,lng:70.2793,n:'First aid at the visitor centre'}],
  trail:[[53.0790,70.2790],[53.0802,70.2712],[53.0825,70.2640],[53.0850,70.2580],[53.0870,70.2530]],trailName:'Shore path to Blue Bay',
  sig:[{lat:53.0790,lng:70.2790,r:450,q:2,n:'Good signal at the resort'},{lat:53.0870,lng:70.2530,r:300,q:1,n:'Weak signal at Blue Bay'}]},
 altynemel:{name:'Altyn-Emel National Park, Singing Dune',short:'Singing Dune',tour:'altynemel',c:[43.8700,78.5605],z:15,
  water:'There is no water at the dune. Bring at least 2 litres each, more in summer.',
  signal:'No signal around the dune. Agree on a meeting time with your group before you climb.',
  f:[{id:'a-gate',t:'ranger',lat:43.8659,lng:78.5574,n:'Ranger shelter'},
     {id:'a-park',t:'parking',lat:43.8665,lng:78.5585,n:'Car park below the dune'},
     {id:'a-wc1',t:'toilet',lat:43.8661,lng:78.5580,n:'Toilet at the car park'},
     {id:'a-bin1',t:'bin',lat:43.8668,lng:78.5591,n:'Bins at the car park'},
     {id:'a-aid',t:'aid',lat:43.8658,lng:78.5571,n:'First aid kit at the ranger shelter'}],
  trail:[[43.8668,78.5591],[43.8690,78.5600],[43.8712,78.5612],[43.8733,78.5624]],trailName:'Climb to the top of the dune',
  sig:[{lat:43.8700,lng:78.5605,r:700,q:0,n:'No signal around the dune'}]}
};
const PARK_OF={};for(const k in PARKS)PARK_OF[PARKS[k].tour]=k;
const FT={toilet:'Toilet',bin:'Bin',water:'Water',aid:'First aid',ranger:'Ranger',parking:'Car park',spot:'Spot on the map'};
/* report kinds: sev 0 = good news, 1..3 = how urgent */
const K={
 dirty:{l:'Toilet is dirty',on:['toilet'],sev:2},
 closed:{l:'Toilet is closed',on:['toilet'],sev:3},
 supplies:{l:'No paper or soap',on:['toilet'],sev:1},
 full:{l:'Bin is full',on:['bin'],sev:2},
 litter:{l:'Litter left here',on:['bin','parking','toilet','water','spot'],sev:2},
 nowater:{l:'No water',on:['water'],sev:3},
 broken:{l:'Something is broken',on:['toilet','bin','water','aid','ranger','parking'],sev:1},
 nosig:{l:'No signal here',on:['spot'],sev:1},
 sigok:{l:'Signal works here',on:['spot'],sev:0},
 ok:{l:'All good here',on:['toilet','bin','water','aid','ranger','parking'],sev:0}
};
/* jobs for park staff; "no signal" goes to the signal-gaps list for mobile operators instead */
const staffJob=r=>K[r.kind].sev>0&&r.kind!=='nosig';
const SOS=[['112','Emergency, any phone'],['103','Ambulance'],['101','Fire and rescue'],['102','Police']];
const PHRASES=[
 ['Сәлеметсіз бе!','Sälemetsiz be!','Hello!'],
 ['Рақмет!','Raqmet!','Thank you!'],
 ['Дәретхана қайда?','Däretkhana qayda?','Where is the toilet?'],
 ['Қоқыс жәшігі қайда?','Qoqys jäshigi qayda?','Where is a rubbish bin?'],
 ['Су бар ма?','Su bar ma?','Is there water?'],
 ['Байланыс қай жерде бар?','Baylanys qay jerde bar?','Where is there mobile signal?'],
 ['Мен адасып қалдым','Men adasyp qaldym','I am lost'],
 ['Дәрігер керек','Däriger kerek','I need a doctor'],
 ['Көмектесіңізші!','Kömektesiñizshi!','Please help me!'],
 ['Қанша тұрады?','Qansha turady?','How much does it cost?']
];

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=()=>st.lang||'en';
const LL=(en,zh,de)=>lang()==='zh'?zh:lang()==='de'?de:en;   // for text with numbers: rendered in place, not by the page translator
const tx=s=>{const i=lang()==='zh'?0:lang()==='de'?1:-1;return i>=0&&I18N[s]?I18N[s][i]:s;}; // for attributes
const loc=()=>lang()==='zh'?'zh-CN':lang()==='de'?'de-DE':'en-GB';
const H=3600e3;
function load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
function ago(ts){const m=Math.max(0,Math.round((Date.now()-ts)/6e4));
  if(m<1)return LL('just now','刚刚','gerade eben');
  if(m<60)return LL(`${m} min ago`,`${m}分钟前`,`vor ${m} Min.`);
  const h=Math.round(m/60);if(h<48)return LL(`${h} h ago`,`${h}小时前`,`vor ${h} Std.`);
  const d=Math.round(h/24);return LL(`${d} days ago`,`${d}天前`,`vor ${d} Tagen`);}
const N=s=>`<span translate="no">${s}</span>`;
function dist(a,b,c,d){const R=6371e3,r=Math.PI/180,x=(d-b)*r*Math.cos((a+c)/2*r),y=(c-a)*r;return Math.hypot(x,y)*R;}
function bearing(a,b,c,d){const r=Math.PI/180,y=Math.sin((d-b)*r)*Math.cos(c*r),x=Math.cos(a*r)*Math.sin(c*r)-Math.sin(a*r)*Math.cos(c*r)*Math.cos((d-b)*r);return (Math.atan2(y,x)/r+360)%360;}
function dirName(deg){const en=['north','north-east','east','south-east','south','south-west','west','north-west'],zh=['北','东北','东','东南','南','西南','西','西北'],de=['Norden','Nordosten','Osten','Südosten','Süden','Südwesten','Westen','Nordwesten'];const i=Math.round(deg/45)%8;return LL(en[i],zh[i],de[i]);}
function fmtDist(m){return m<1000?`${Math.round(m/10)*10} m`:`${(m/1000).toFixed(1)} km`;}
function tourOf(id){return TOURS.find(t=>t.id===id);}
function facility(pk,id){return PARKS[pk]&&PARKS[pk].f.find(f=>f.id===id);}
function pkToast(html){let t=$('#pkToast');if(!t){t=document.createElement('div');t.id='pkToast';t.className='pk-toast';t.setAttribute('role','status');document.body.appendChild(t);}
  t.innerHTML=html;t.classList.add('on');clearTimeout(pkToast.tm);pkToast.tm=setTimeout(()=>t.classList.remove('on'),3800);}

/* icons */
const ICO={
 toilet:'<text x="12" y="16" text-anchor="middle" font-size="10" font-weight="800" fill="currentColor" font-family="system-ui,sans-serif">WC</text>',
 bin:'<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7M10.5 10.5v6M13.5 10.5v6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
 water:'<path d="M12 3.5c3 4.2 5.5 7.4 5.5 10.3a5.5 5.5 0 0 1-11 0c0-2.9 2.5-6.1 5.5-10.3z" fill="currentColor"/>',
 aid:'<path d="M10 4.5h4v5.5h5.5v4H14v5.5h-4V14H4.5v-4H10z" fill="currentColor"/>',
 ranger:'<path d="M4 11.5 12 5l8 6.5M6.5 10v9.5h11V10M10 19.5v-5h4v5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
 parking:'<text x="12" y="17" text-anchor="middle" font-size="14" font-weight="800" fill="currentColor" font-family="system-ui,sans-serif">P</text>',
 spot:'<circle cx="12" cy="12" r="4" fill="currentColor"/>',
 signal:'<path d="M5 18v-2M9.5 18v-5M14 18v-8M18.5 18V6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
 nosig:'<path d="M5 18v-2M9.5 18v-5M14 18v-8M18.5 18V6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".35"/><path d="M4 5l16 14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
};
const ico=(t,s=18)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${ICO[t]||ICO.spot}</svg>`;

/* ---------- storage: outbox on the phone, "server" of the park office ---------- */
const OUT='sr_pk_out',SRV='sr_pk_srv',PACKS='sr_packs',SIM='sr_pk_sim';
let simOff=load(SIM,false);
const online=()=>navigator.onLine&&!simOff;
function seed(){
  if(load('sr_pk_seed',0)===2)return;
  /* sample reports from other visitors over the last 7 days, so the office panel shows a working week */
  let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;const now=Date.now(),out=[];
  const plan={kolsai:[['k-wc2','dirty',6],['k-wc2','supplies',3],['k-bin2','full',7],['k-bin3','full',4],['k-bin3','litter',3],['k-wc1','dirty',3],['k-tap','ok',2],['k-gate','ok',2],[null,'nosig',8],[null,'litter',4],[null,'sigok',2]],
    charyn:[['c-wc1','dirty',5],['c-wc1','closed',2],['c-bin1','full',4],['c-bin2','full',5],['c-bin2','litter',3],['c-tap','nowater',2],[null,'nosig',5],[null,'litter',3]],
    bigalmaty:[['b-wc1','dirty',4],['b-bin1','full',3],['b-bin2','litter',4],[null,'nosig',3],[null,'litter',2]],
    burabay:[['u-wc2','supplies',3],['u-bin1','full',4],['u-bin3','full',3],['u-tap','ok',2],[null,'sigok',3],[null,'nosig',2]],
    altynemel:[['a-wc1','dirty',3],['a-bin1','full',4],[null,'litter',3],[null,'nosig',4]]};
  for(const pk in plan)for(const [fid,kind,n] of plan[pk])for(let i=0;i<n;i++){
    const P=PARKS[pk],f=fid&&facility(pk,fid);let lat,lng;
    if(f){lat=f.lat;lng=f.lng;}else{const base=kind==='nosig'||kind==='sigok'?(P.trail[Math.floor(rnd()*P.trail.length)]):P.trail[Math.floor(rnd()*P.trail.length)];lat=base[0]+(rnd()-.5)*.0016;lng=base[1]+(rnd()-.5)*.0022;}
    const ts=now-rnd()*7*24*H;const old=now-ts>20*H&&rnd()<.72&&K[kind].sev>0;
    out.push({id:'s'+out.length,park:pk,f:fid,kind,lat:+lat.toFixed(5),lng:+lng.toFixed(5),ts:Math.round(ts),by:'sample',status:old?'done':(rnd()<.25&&K[kind].sev>0?'work':'new'),doneAt:old?Math.round(ts+(1.5+rnd()*9)*H):null,sentAt:Math.round(ts)});
  }
  const mine=load(SRV,[]).filter(r=>r.by!=='sample');
  save(SRV,out.concat(mine));save('sr_pk_seed',2);
}
const srv=()=>load(SRV,[]);const outbox=()=>load(OUT,[]);
function addReport(r){const o=outbox();o.push(r);if(!save(OUT,o)&&r.photo){delete r.photo;o[o.length-1]=r;save(OUT,o);}bc('change');sync();}
function sync(){
  const o=outbox();if(!o.length||!online()){paintNet();return 0;}
  const s=srv(),now=Date.now();o.forEach(r=>{r.sentAt=now;s.push(r);});
  save(SRV,s);save(OUT,[]);bc('change');paintNet();
  pkToast(`✓ ${N(LL(`${o.length} report${o.length>1?'s':''} sent to the park office`,`已向公园管理处发送${o.length}条反馈`,`${o.length} Meldung${o.length>1?'en':''} an die Parkverwaltung gesendet`))}`);
  rerender();return o.length;
}
function setStatus(ids,status){const s=srv(),now=Date.now();s.forEach(r=>{if(ids.includes(r.id)){r.status=status;if(status==='done')r.doneAt=now;}});save(SRV,s);bc('change');rerender();}
/* other tabs: the office panel in one window updates when a tourist reports in another */
let chan=null;try{chan=new BroadcastChannel('samruk-parks');chan.onmessage=()=>rerender();}catch(e){}
function bc(m){try{chan&&chan.postMessage(m);}catch(e){}}
window.addEventListener('storage',e=>{if(e.key===SRV||e.key===OUT)rerender();});
window.addEventListener('online',()=>{paintNet();setTimeout(sync,400);});
window.addEventListener('offline',paintNet);

/* status of one facility: open issues from the last 48 h, or fixed recently */
function fstat(pk,fid,all){
  const rs=(all||srv().concat(outbox())).filter(r=>r.park===pk&&r.f===fid);
  const open=rs.filter(r=>staffJob(r)&&r.status!=='done'&&Date.now()-r.ts<48*H).sort((a,b)=>K[b.kind].sev-K[a.kind].sev||b.ts-a.ts);
  const fixed=rs.filter(r=>r.status==='done'&&r.doneAt&&Date.now()-r.doneAt<24*H).sort((a,b)=>b.doneAt-a.doneAt)[0];
  const good=rs.filter(r=>K[r.kind].sev===0).sort((a,b)=>b.ts-a.ts)[0];
  if(open.length)return{s:K[open[0].kind].sev>=3?'bad':'warn',top:open[0],n:open.length,open};
  if(fixed)return{s:'fixed',at:fixed.doneAt};
  if(good&&Date.now()-good.ts<24*H)return{s:'ok',at:good.ts};
  return{s:'none'};
}
function fstatLine(st){
  if(st.s==='bad'||st.s==='warn')return `<span class="pk-st pk-st-${st.s}">${esc(K[st.top.kind].l)}</span> <span class="muted">· ${N(ago(st.top.ts))}${st.n>1?' · '+N(LL(`${st.n} reports`,`${st.n}条反馈`,`${st.n} Meldungen`)):''}</span>`;
  if(st.s==='fixed')return `<span class="pk-st pk-st-ok">Fixed by park staff</span> <span class="muted">· ${N(ago(st.at))}</span>`;
  if(st.s==='ok')return `<span class="pk-st pk-st-ok">Visitors say all good</span> <span class="muted">· ${N(ago(st.at))}</span>`;
  return `<span class="pk-st">No reports yet</span>`;
}

/* ---------- network pill ---------- */
function paintNet(){
  const n=outbox().length,on=online();
  document.querySelectorAll('.pk-net').forEach(el=>{
    el.className='pk-net '+(on?'on':'off');
    el.innerHTML=`<span class="pk-dot" aria-hidden="true"></span><span>${on?'Online':'No signal'}</span>${n?` · ${N(LL(`${n} waiting to send`,`${n}条待发送`,`${n} warten auf Versand`))}`:''}`;
  });
  document.querySelectorAll('.pk-sim').forEach(b=>b.setAttribute('aria-pressed',String(simOff)));
}
function toggleSim(){simOff=!simOff;save(SIM,simOff);paintNet();
  pkToast(simOff?N(LL('Test mode: the site now acts as if there is no signal','测试模式：网站现在模拟没有信号','Testmodus: Die Seite verhält sich jetzt wie ohne Netz')):N(LL('Signal is back','信号已恢复','Netz ist wieder da')));
  rerender();if(!simOff)setTimeout(sync,900);}

/* ---------- park plan: a schematic SVG that needs no internet ---------- */
function parkSvg(pk,o={}){
  const P=PARKS[pk],pts=P.f.map(f=>[f.lat,f.lng]).concat(P.trail); // signal circles may run off the edge: the frame follows facilities and the trail
  let a=Math.min(...pts.map(p=>p[0])),b=Math.max(...pts.map(p=>p[0])),c=Math.min(...pts.map(p=>p[1])),d=Math.max(...pts.map(p=>p[1]));
  const k=Math.cos((a+b)/2*Math.PI/180),W=1000;{const w0=(d-c)*k,h0=b-a,m=Math.max(w0,h0)*.14;c-=m/k;d+=m/k;a-=m;b+=m;}
  /* one scale for both axes, so circles stay round and distances are true */
  let s=W/((d-c)*k),Hh=(b-a)*s;
  if(Hh<420){const e=(420/s-(b-a))/2;a-=e;b+=e;Hh=420;}
  else if(Hh>640){s=640/(b-a);Hh=640;const e=(W/s/k-(d-c))/2;c-=e;d+=e;}
  const sx=s,sy=s;
  const X=lng=>((lng-c)*k*sx).toFixed(1),Y=lat=>((b-lat)*sy).toFixed(1),R=m=>(m/111320*sy).toFixed(1);
  const cols=['var(--pk-none)','var(--pk-weak)','var(--pk-good)'];
  const sig=P.sig.map(s=>`<circle cx="${X(s.lng)}" cy="${Y(s.lat)}" r="${R(s.r)}" fill="${cols[s.q]}" fill-opacity=".16" stroke="${cols[s.q]}" stroke-width="2" stroke-dasharray="${s.q?'0':'7 6'}"/>`).join('');
  const crowd=(o.crowd||[]).map(r=>`<circle cx="${X(r.lng)}" cy="${Y(r.lat)}" r="5" fill="${r.kind==='sigok'?'var(--pk-good)':'var(--pk-none)'}" opacity=".8"/>`).join('');
  const trail=`<polyline points="${P.trail.map(p=>X(p[1])+','+Y(p[0])).join(' ')}" fill="none" stroke="var(--pk-trail)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 10"/>`;
  const all=srv().concat(outbox());
  const fac=P.f.map(f=>{const s=fstat(pk,f.id,all).s;return `<g class="pk-svgf pk-${f.t} pk-st-${s}" transform="translate(${X(f.lng)} ${Y(f.lat)})"><circle r="22"/><g transform="translate(-14.4 -14.4) scale(1.2)">${ICO[f.t]}</g></g>`;}).join('');
  const placed=[];const lbl=P.f.filter(f=>f.t==='toilet'||f.t==='water'||f.t==='ranger').map(f=>{const x=+X(f.lng),y=+Y(f.lat)+42;
    if(placed.some(q=>Math.abs(q[0]-x)<230&&Math.abs(q[1]-y)<30))return ''; // skip a label that would sit on another one
    placed.push([x,y]);return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" class="pk-svgl">${esc(f.n)}</text>`;}).join('');
  const me=o.me?`<g transform="translate(${X(o.me.lng)} ${Y(o.me.lat)})"><circle r="${Math.max(10,+R(o.me.acc||30))}" fill="var(--sky)" fill-opacity=".15"/><circle r="9" fill="var(--sky)" stroke="#fff" stroke-width="3"/></g>`:'';
  const nArrow=`<g transform="translate(${W-46} 46)"><circle r="24" fill="var(--surface)" stroke="var(--line)"/><path d="M0-15 7 6 0 2-7 6z" fill="var(--ink)"/><text y="20" text-anchor="middle" font-size="11" font-weight="700" fill="var(--muted)">N</text></g>`;
  const sc=Math.pow(10,Math.floor(Math.log10((W/sx)*111320/3)));const scPx=sc/111320*sx;
  const scale=`<g transform="translate(24 ${(Hh-26).toFixed(0)})"><path d="M0 0h${scPx.toFixed(1)}" stroke="var(--ink)" stroke-width="3"/><path d="M0-6v6M${scPx.toFixed(1)}-6v6" stroke="var(--ink)" stroke-width="2"/><text x="${(scPx/2).toFixed(1)}" y="-9" text-anchor="middle" font-size="13" fill="var(--muted)">${sc>=1000?sc/1000+' km':sc+' m'}</text></g>`;
  return {svg:`<svg class="pk-plan" viewBox="0 0 ${W} ${Hh.toFixed(0)}" role="img" aria-label="${esc(tx('Offline plan of the park'))}"><rect width="${W}" height="${Hh.toFixed(0)}" rx="18" class="pk-planbg"/>${sig}${crowd}${trail}${fac}${lbl}${me}${nArrow}${scale}</svg>`,proj:{X,Y}};
}

/* ---------- where am I: GPS works without mobile data ---------- */
let me=null,watch=null;
function locate(cb){
  if(!navigator.geolocation){cb&&cb(null);return;}
  if(watch===null)watch=navigator.geolocation.watchPosition(p=>{me={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy,ts:Date.now()};cb&&cb(me);cb=null;paintMe();},()=>{cb&&cb(null);cb=null;},{enableHighAccuracy:true,maximumAge:20000,timeout:15000});
  else cb&&cb(me);
}
const nearPark=pk=>me&&dist(me.lat,me.lng,PARKS[pk].c[0],PARKS[pk].c[1])<4000;
function paintMe(){if(!$('#view-pack').hidden&&cur.pack)renderPack(cur.pack,true);if(!$('#view-parks').hidden&&pmap.me&&me&&window.L){pmap.me.setLatLng([me.lat,me.lng]).addTo(pmap.m);}}
/* nearest facility of a type, from me or from the gate */
function nearest(pk,type,from){const P=PARKS[pk];const o=from||{lat:P.f[0].lat,lng:P.f[0].lng};
  let best=null;const list=type==='signal'?P.sig.filter(s=>s.q>0).map(s=>({lat:s.lat,lng:s.lng,n:s.n,r:s.r})):P.f.filter(f=>f.t===type);
  for(const f of list){const m=dist(o.lat,o.lng,f.lat,f.lng);if(!best||m<best.m)best={f,m,b:bearing(o.lat,o.lng,f.lat,f.lng)};}return best;}

/* ---------- PARKS view: the facilities map ---------- */
const cur={park:'kolsai',sel:null,layers:{toilet:1,bin:1,water:1,aid:1,ranger:1,parking:1,signal:1},mode:null,photo:null,pack:null,office:'kolsai'};
const pmap={m:null,g:null,me:null,park:null};
function openParks(pk,fromHistory){
  if(pk&&PARKS[pk])cur.park=pk;cur.sel=null;cur.mode=null;
  show('parks');markNav('parks');renderParks();
  if(!fromHistory)push({view:'parks',park:cur.park});
}
function markNav(v){document.querySelectorAll('.nav [data-view]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.view===v)));}
function renderParks(){
  const P=PARKS[cur.park],t=tourOf(P.tour),packed=!!load(PACKS,{})[P.tour];
  $('#pkTabs').innerHTML=Object.keys(PARKS).map(k=>`<button class="chip" role="tab" data-pk="${k}" aria-selected="${k===cur.park}" aria-pressed="${k===cur.park}">${esc(PARKS[k].short)}</button>`).join('');
  $('#pkName').textContent=P.name;
  $('#pkFacts').innerHTML=`<div class="pk-fact">${ico('water',20)}<p>${esc(P.water)}</p></div><div class="pk-fact">${ico('signal',20)}<p>${esc(P.signal)}</p></div>`;
  $('#pkLegend').innerHTML=['toilet','bin','water','aid','ranger','parking','signal'].map(k=>`<button class="pk-lg pk-${k}" data-layer="${k}" aria-pressed="${!!cur.layers[k]}"><span class="pk-lgi">${ico(k,16)}</span><span>${k==='signal'?'Signal zones':FT[k]}</span></button>`).join('');
  $('#pkPack').innerHTML=packed?`<a class="btn btn-line sm" href="#pack-${P.tour}" data-pack="${P.tour}">✓ <span>Saved for offline · open</span></a>`:`<button class="btn btn-gold sm" data-savepack="${P.tour}">${ico('signal',16)} <span>Save this park for offline</span></button>`;
  $('#pkTour').innerHTML=t?`<button class="btn btn-line sm" data-tour="${t.id}"><span>Trip:</span> <span>${esc(t.name)}</span></button>`:'';
  paintNet();renderPanel();renderOutbox();
  const useMap=window.L&&online();
  $('#pkMapWrap').classList.toggle('pk-offline',!useMap);
  $('#pkOffNote').hidden=useMap;
  if(useMap){$('#pkPlan').hidden=true;$('#pkMap').hidden=false;drawMap();}
  else{$('#pkMap').hidden=true;$('#pkPlan').hidden=false;drawPlan();}
}
function drawPlan(){const {svg}=parkSvg(cur.park,{me:nearPark(cur.park)?me:null,crowd:srv().filter(r=>r.park===cur.park&&(r.kind==='nosig'||r.kind==='sigok'))});$('#pkPlan').innerHTML=svg;
  $('#pkPlan').querySelectorAll('.pk-svgf').forEach((g,i)=>{const f=PARKS[cur.park].f[i];g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',tx(f.n));g.onclick=()=>select(f.id);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(f.id);}};});}
function mkIcon(f,s){return L.divIcon({className:'',html:`<span class="pk-mk pk-${f.t} pk-st-${s}${cur.sel===f.id?' sel':''}">${ico(f.t,18)}</span>`,iconSize:[34,34],iconAnchor:[17,17]});}
function drawMap(){
  const P=PARKS[cur.park];
  if(!pmap.m){pmap.m=L.map('pkMap',{zoomControl:true,scrollWheelZoom:false,attributionControl:true});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(pmap.m);
    pmap.me=L.circleMarker([0,0],{radius:8,color:'#fff',weight:3,fillColor:'#0A84A6',fillOpacity:1});
    pmap.m.on('click',e=>{if(cur.mode==='spot'){cur.spot={lat:e.latlng.lat,lng:e.latlng.lng};renderPanel();drawMap();}});}
  if(pmap.park!==cur.park){pmap.m.setView(P.c,P.z);pmap.park=cur.park;}
  if(pmap.g)pmap.g.remove();pmap.g=L.layerGroup().addTo(pmap.m);
  const cols=['#C2453A','#D99A1E','#2E9D5B'];
  if(cur.layers.signal){P.sig.forEach(s=>L.circle([s.lat,s.lng],{radius:s.r,color:cols[s.q],weight:2,dashArray:s.q?null:'6 6',fillOpacity:.12,interactive:false}).addTo(pmap.g));
    srv().filter(r=>r.park===cur.park&&(r.kind==='nosig'||r.kind==='sigok')).forEach(r=>L.circleMarker([r.lat,r.lng],{radius:4,stroke:false,fillColor:r.kind==='sigok'?cols[2]:cols[0],fillOpacity:.75,interactive:false}).addTo(pmap.g));}
  L.polyline(P.trail,{color:'#8a5a2b',weight:4,dashArray:'2 9',lineCap:'round'}).addTo(pmap.g).bindTooltip(tx(P.trailName));
  const all=srv().concat(outbox());
  P.f.forEach(f=>{if(!cur.layers[f.t])return;const s=fstat(cur.park,f.id,all).s;
    L.marker([f.lat,f.lng],{icon:mkIcon(f,s),title:tx(f.n),keyboard:true,riseOnHover:true}).addTo(pmap.g).on('click',()=>select(f.id));});
  if(cur.mode==='spot'&&cur.spot)L.marker([cur.spot.lat,cur.spot.lng],{icon:L.divIcon({className:'',html:'<span class="pk-pin" aria-hidden="true"></span>',iconSize:[26,34],iconAnchor:[13,32]}),draggable:true}).addTo(pmap.g).on('dragend',e=>{const p=e.target.getLatLng();cur.spot={lat:p.lat,lng:p.lng};});
  if(me&&nearPark(cur.park))pmap.me.setLatLng([me.lat,me.lng]).addTo(pmap.m);
  setTimeout(()=>pmap.m.invalidateSize(),60);
}
function select(fid){cur.sel=fid;cur.mode=null;cur.photo=null;renderPanel();if(!$('#pkMap').hidden)drawMap();else drawPlan();
  const p=$('#pkPanel');if(window.innerWidth<860)p.scrollIntoView({behavior:'smooth',block:'nearest'});}
function renderPanel(){
  const P=PARKS[cur.park],box=$('#pkPanel');
  if(cur.mode==='spot'){
    const kinds=Object.keys(K).filter(k=>K[k].on.includes('spot'));
    box.innerHTML=`<div class="pk-ph"><span class="pk-mk pk-spot">${ico('spot',18)}</span><div><b>Report a spot</b><small class="muted">${cur.spot?(cur.spot.gps?'Your GPS position':'The pin on the map. Drag it or tap the map to move it.'):'Tap the map where the problem is.'}</small></div></div>
     <div class="pk-kinds">${kinds.map(k=>`<button class="pk-kind${K[k].sev?'':' good'}" data-kind="${k}" ${cur.spot?'':'disabled'}>${ico(k==='nosig'?'nosig':k==='sigok'?'signal':'bin',18)}<span>${esc(K[k].l)}</span></button>`).join('')}</div>
     ${extras()}<button class="btn btn-line sm" data-cancel>Cancel</button>`;
    return;
  }
  if(!cur.sel){
    const all=srv().concat(outbox());const issues=P.f.map(f=>({f,s:fstat(cur.park,f.id,all)})).filter(x=>x.s.s==='bad'||x.s.s==='warn');
    const near=['toilet','water','signal'].map(tp=>{const n=nearest(cur.park,tp,nearPark(cur.park)?me:null);return n?`<li>${ico(tp,16)} <span>${tp==='signal'?'Nearest signal':tp==='toilet'?'Nearest toilet':'Nearest water'}</span>: <b translate="no">${fmtDist(n.m)}</b> ${N(dirName(n.b))} <small class="muted">${esc(n.f.n)}</small></li>`:`<li>${ico(tp,16)} <span>${tp==='water'?'No drinking water in this park':'No signal zone in this park'}</span></li>`;}).join('');
    box.innerHTML=`<div class="pk-ph"><span class="pk-mk pk-ranger">${ico('ranger',18)}</span><div><b>Tap an icon on the map</b><small class="muted">See if it works now and report a problem in one tap.</small></div></div>
     <ul class="pk-near">${near}</ul><p class="src pk-from">${nearPark(cur.park)?'Distances from your GPS position.':'Distances from the entrance. Turn on location in the park to measure from where you are.'}</p>
     <div class="pk-acts"><button class="btn btn-gold sm" data-spot>${ico('spot',14)} <span>Report a spot: litter, no signal</span></button><button class="btn btn-line sm" data-gps>Use my location</button></div>
     ${issues.length?`<h4 class="pk-h4">Problems visitors reported</h4><ul class="pk-issues">${issues.map(x=>`<li><button data-sel="${x.f.id}"><span class="pk-mk sm pk-${x.f.t} pk-st-${x.s.s}">${ico(x.f.t,14)}</span><span><b>${esc(x.f.n)}</b><br>${fstatLine(x.s)}</span></button></li>`).join('')}</ul>`:'<p class="muted">No open problems right now.</p>'}`;
    return;
  }
  const f=facility(cur.park,cur.sel),s=fstat(cur.park,f.id);const kinds=Object.keys(K).filter(k=>K[k].on.includes(f.t));
  box.innerHTML=`<div class="pk-ph"><span class="pk-mk pk-${f.t} pk-st-${s.s}">${ico(f.t,18)}</span><div><b>${esc(f.n)}</b><small class="muted">${esc(FT[f.t])}</small></div><button class="pk-x" data-close aria-label="${esc(tx('Close'))}">×</button></div>
   <p class="pk-now">${fstatLine(s)}</p>
   <h4 class="pk-h4">What is it like now?</h4>
   <div class="pk-kinds">${kinds.map(k=>`<button class="pk-kind${K[k].sev?'':' good'}" data-kind="${k}">${K[k].sev?'<span class="pk-k-dot" aria-hidden="true"></span>':'✓ '}<span>${esc(K[k].l)}</span></button>`).join('')}</div>
   ${extras()}
   ${s.open&&s.open.length?`<h4 class="pk-h4">Recent reports</h4><ul class="pk-rec">${s.open.slice(0,4).map(r=>`<li><span>${esc(K[r.kind].l)}</span> <span class="muted">· ${N(ago(r.ts))}</span>${r.status==='work'?' <span class="pk-st pk-st-ok">Staff on the way</span>':''}${r.note?`<br><small>${esc(r.note)}</small>`:''}</li>`).join('')}</ul>`:''}`;
}
function extras(){return `<details class="pk-more"><summary>Add a note or photo (optional)</summary><div class="field"><label for="pkNote">Note</label><input id="pkNote" maxlength="140" placeholder="For example: the door does not lock"></div>
  <label class="btn btn-line sm pk-photo">${ico('spot',14)} <span>${cur.photo?'Photo added':'Add a photo'}</span><input type="file" accept="image/*" capture="environment" id="pkPhoto" class="vh"></label>${cur.photo?`<img class="pk-thumb" src="${cur.photo}" alt="">`:''}</details>`;}
function submit(kind){
  const P=PARKS[cur.park],f=cur.mode==='spot'?null:facility(cur.park,cur.sel);const pos=f||cur.spot;if(!pos)return;
  const note=($('#pkNote')&&$('#pkNote').value.trim())||'';
  addReport({id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),park:cur.park,f:f?f.id:null,kind,lat:+pos.lat.toFixed(5),lng:+pos.lng.toFixed(5),ts:Date.now(),note,photo:cur.photo,by:'you',status:'new'});
  if(!online())pkToast(`⏳ ${N(LL('Saved on your phone. It will be sent when there is signal.','已保存在手机上，有信号时会自动发送。','Auf dem Handy gespeichert. Wird gesendet, sobald es Netz gibt.'))}`);
  cur.photo=null;if(cur.mode==='spot'){cur.mode=null;cur.spot=null;}
  renderParks();
}
function renderOutbox(){
  const o=outbox(),box=$('#pkOutbox');if(!box)return;
  const mine=srv().filter(r=>r.by==='you').sort((a,b)=>b.ts-a.ts);
  if(!o.length&&!mine.length){box.hidden=true;return;}box.hidden=false;
  box.innerHTML=`<h4 class="pk-h4">Your reports</h4><ul class="pk-rec">${o.map(r=>`<li><span class="pk-q">⏳</span> <span>${esc(K[r.kind].l)}</span> <span class="muted">· <span>${esc(PARKS[r.park].short)}</span> · ${N(ago(r.ts))}</span> <span class="pk-st pk-st-warn">Waiting for signal</span></li>`).join('')}${mine.slice(0,6).map(r=>`<li><span class="pk-q">✓</span> <span>${esc(K[r.kind].l)}</span> <span class="muted">· <span>${esc(PARKS[r.park].short)}</span> · ${N(ago(r.ts))}</span> ${r.status==='done'?'<span class="pk-st pk-st-ok">Fixed by park staff</span>':r.status==='work'?'<span class="pk-st pk-st-ok">Staff on the way</span>':'<span class="pk-st">Sent to the park office</span>'}</li>`).join('')}</ul>
   ${o.length?`<button class="btn btn-line sm" data-sync>Send now</button>`:''}`;
}
async function readPhoto(file){
  const img=new Image(),url=URL.createObjectURL(file);await new Promise((r,j)=>{img.onload=r;img.onerror=j;img.src=url;});
  const s=Math.min(1,360/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);return c.toDataURL('image/jpeg',.6);
}

/* ---------- OFFLINE PACK ---------- */
function packUrls(tid){
  const t=tourOf(tid),u=['./','index.html','manifest.webmanifest','assets/parks/parks.js','assets/parks/parks.css','assets/parks/qrcode.js','assets/parks/icon-192.png',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
  if(t&&t.photo)u.push(commonsImg(t.photo.file,640),commonsImg(t.photo.file,960));
  (GALLERY[tid]||[]).forEach(f=>u.push(commonsImg(f,320)));
  try{const lc=vtLangCode();(POINTS[tid]||[]).forEach(p=>{const n=VT_CLIPS.indexOf(p.n);if(n>=0)u.push(`assets/vt/${lc}/${String(n).padStart(2,'0')}.mp3`);});}catch(e){}
  return u;
}
function savePack(tid,code){
  const p=load(PACKS,{});p[tid]=Object.assign(p[tid]||{},{savedAt:Date.now()},code?{code}:{});save(PACKS,p);
  const urls=packUrls(tid);
  if(navigator.serviceWorker&&navigator.serviceWorker.controller){
    const ch=new MessageChannel();ch.port1.onmessage=e=>{const d=e.data||{};pkToast(`✓ ${N(LL(`Saved for offline: ${d.ok} of ${d.total} files on your phone`,`已离线保存：${d.ok}/${d.total}个文件在您的手机上`,`Offline gespeichert: ${d.ok} von ${d.total} Dateien auf Ihrem Handy`))}`);};
    navigator.serviceWorker.controller.postMessage({type:'pack',urls},[ch.port2]);
  }else pkToast(`✓ ${N(LL('Saved. Keep this page open, or add the site to your home screen for full offline use.','已保存。请保持此页面打开，或将网站添加到主屏幕以完全离线使用。','Gespeichert. Lassen Sie die Seite offen oder legen Sie sie auf den Startbildschirm, um sie ganz offline zu nutzen.'))}`);
  rerender();
}
function removePack(tid){const p=load(PACKS,{});delete p[tid];save(PACKS,p);}
function openPack(tid,fromHistory){if(!tourOf(tid))return;cur.pack=tid;show('pack');markNav('');renderPack(tid);if(!fromHistory)push({view:'pack',tour:tid});
  if(PARK_OF[tid])locate(()=>renderPack(tid,true));}
function qrSvg(text){try{const q=qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag({cellSize:4,margin:2,scalable:true});}catch(e){return '';}}
function renderPack(tid,soft){
  const t=tourOf(tid),pk=PARK_OF[tid],P=pk&&PARKS[pk],pack=load(PACKS,{})[tid],code=(pack&&pack.code)||null;
  const g=GUIDES.find(x=>x.tours.includes(tid));
  const plan=P?parkSvg(pk,{me:nearPark(pk)?me:null}):null;
  const near=P?['toilet','water','signal','ranger'].map(tp=>{const n=nearest(pk,tp,nearPark(pk)?me:null);return n?`<li>${ico(tp,16)} <span>${tp==='signal'?'Nearest signal':tp==='toilet'?'Nearest toilet':tp==='water'?'Nearest water':'Nearest ranger'}</span>: <b translate="no">${fmtDist(n.m)}</b> ${N(dirName(n.b))}</li>`:'';}).join(''):'';
  const smsBody=me?`SOS. Samruk Travel group. My location: ${me.lat.toFixed(5)}, ${me.lng.toFixed(5)} https://maps.google.com/?q=${me.lat.toFixed(5)},${me.lng.toFixed(5)}`:'';
  const html=`
  <div class="pk-packhead">
    <div><div class="eyebrow">Offline trip pack</div><h1>${esc(t.name)}</h1>
    <p class="muted">${pack?`<span>Saved on this phone</span> ${N(new Date(pack.savedAt).toLocaleString(loc(),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}. <span>Everything on this page works without internet.</span>`:'<span>Not saved yet. Save it before you lose signal.</span>'}</p></div>
    <div class="pk-packbtns"><span class="pk-net"></span>${pack?`<button class="btn btn-line sm" data-savepack="${tid}">Update</button><button class="btn btn-line sm" data-unpack="${tid}">Remove</button>`:`<button class="btn btn-gold" data-savepack="${tid}">Save for offline</button>`}</div>
  </div>
  <div class="pk-packgrid">
    <section class="pk-card pk-ticket"><h3>Your ticket</h3>
      <div class="pk-qr" translate="no">${qrSvg(`SAMRUK:${code||'SAMPLE'}:${tid}`)}</div>
      <p><b translate="no">${esc(code||'SR-SAMPLE')}</b>${code?'':' <span class="demo-tag">Sample</span>'}</p>
      <p class="muted">Show this code to your guide and at the park gate. It opens with no signal.</p></section>
    <section class="pk-card pk-sos"><h3>Emergency</h3>
      <div class="pk-sosgrid">${SOS.map(([n,l])=>`<a class="pk-call${n==='112'?' main':''}" href="tel:${n}"><b translate="no">${n}</b><span>${esc(l)}</span></a>`).join('')}</div>
      ${me?`<a class="btn btn-gold sm pk-sms" href="sms:112?body=${encodeURIComponent(smsBody)}">Send my location by SMS</a><p class="src" translate="no">${me.lat.toFixed(5)}, ${me.lng.toFixed(5)} · ±${Math.round(me.acc)} m</p>`:`<button class="btn btn-line sm" data-locate>Find my GPS position</button>`}
      <p class="muted pk-small">A text message often gets through when calls and mobile data do not. GPS works without signal.</p>
      ${g?`<div class="pk-contact"><span class="ava" style="background:${g.c}">${esc(g.n[0])}</span><div><b>${esc(g.n)}</b><small>Your guide · WhatsApp +7 700 000 00 00 (sample)</small></div></div>`:''}
      ${P?`<div class="pk-contact"><span class="ava pk-rng">${ico('ranger',16)}</span><div><b>${esc(P.f.find(f=>f.t==='ranger').n)}</b><small>Park rangers · +7 700 000 00 01 (sample)</small></div></div>`:''}</section>
    ${P?`<section class="pk-card pk-wide"><div class="pk-planhead"><h3><span>Park plan:</span> <span>${esc(P.short)}</span></h3><a class="btn btn-line sm" href="#parks-${pk}" data-openpark="${pk}">Report a problem</a></div>
      ${plan.svg}
      <div class="pk-legend-s">${['toilet','bin','water','aid','ranger'].map(k=>`<span>${ico(k,14)} ${esc(FT[k])}</span>`).join('')}<span><i class="pk-sw g"></i>Good signal</span><span><i class="pk-sw w"></i>Weak signal</span><span><i class="pk-sw n"></i>No signal</span></div>
      <ul class="pk-near">${near}</ul><p class="src">${nearPark(pk)?'Distances from your GPS position.':'Distances from the entrance. Your position appears on the plan when you are in the park.'} Schematic plan: positions of facilities are approximate.</p>
      <div class="pk-facts2"><div class="pk-fact">${ico('water',20)}<p>${esc(P.water)}</p></div><div class="pk-fact">${ico('signal',20)}<p>${esc(P.signal)}</p></div></div></section>`:''}
    <section class="pk-card"><h3>Day by day</h3><div class="days">${t.plan.map(([d,x])=>`<div class="day"><b>${esc(d)}</b><p>${esc(x)}</p></div>`).join('')}</div></section>
    <section class="pk-card"><h3>Leave no trace</h3><ul class="checklist pk-lnt">
      ${['Take a bag for your rubbish and carry it out if the bins are full','Use the toilets at the car park before the trail','Fill your water bottle before you start','Download this page and tell someone your plan','Stay on the marked trail'].map((x,i)=>`<li><label><input type="checkbox" data-lnt="${i}" ${(load('sr_lnt_'+tid,[]))[i]?'checked':''}><span>${esc(x)}</span></label></li>`).join('')}</ul></section>
    <section class="pk-card pk-wide"><h3>Kazakh phrases</h3><div class="pk-phr">${PHRASES.map(([kz,lat,en])=>`<div><b lang="kk" translate="no">${kz}</b><i translate="no">${lat}</i><span>${esc(en)}</span></div>`).join('')}</div></section>
  </div>`;
  const box=$('#packBox');if(soft&&box.querySelector('.pk-packgrid')&&document.activeElement&&box.contains(document.activeElement)&&document.activeElement.type==='checkbox')return;
  box.innerHTML=html;paintNet();
}

/* ---------- OFFICE view: the park administration panel ---------- */
const omap={m:null,g:null,park:null};
function openOffice(pk,fromHistory){if(pk&&PARKS[pk])cur.office=pk;show('office');markNav('office');renderOffice();if(!fromHistory)push({view:'office',park:cur.office});}
function renderOffice(){
  const pk=cur.office,P=PARKS[pk],all=srv().filter(r=>r.park===pk),now=Date.now();
  $('#ofTabs').innerHTML=Object.keys(PARKS).map(k=>{const n=srv().filter(r=>r.park===k&&staffJob(r)&&r.status!=='done').length;return `<button class="chip" data-of="${k}" aria-pressed="${k===pk}">${esc(PARKS[k].short)} ${n?`<span class="pk-badge" translate="no">${n}</span>`:''}</button>`;}).join('');
  $('#ofName').textContent=P.name;
  const open=all.filter(r=>staffJob(r)&&r.status!=='done');
  const wc=new Set(open.filter(r=>r.f&&facility(pk,r.f).t==='toilet').map(r=>r.f)).size,bins=new Set(open.filter(r=>r.kind==='full'||(r.f&&facility(pk,r.f).t==='bin'&&r.kind==='litter')).map(r=>r.f)).size;
  const ns=all.filter(r=>r.kind==='nosig'&&now-r.ts<7*24*H).length;
  const done=all.filter(r=>r.status==='done'&&r.doneAt);const fix=done.length?done.reduce((s,r)=>s+(r.doneAt-r.ts),0)/done.length/H:0;
  const week=all.filter(r=>now-r.ts<7*24*H).length;
  $('#ofKpi').innerHTML=[[open.length,'Open problems'],[wc,'Toilets to clean'],[bins,'Bins to empty or tidy'],[ns,'No-signal reports, 7 days'],[fix?fix.toFixed(1):'–','Average hours to fix'],[week,'Reports this week']].map(([n,l],i)=>`<div class="pk-kpi${i<3&&n>0?' hot':''}"><b class="num" translate="no">${n}</b><span>${esc(l)}</span></div>`).join('');
  /* group open issues by facility (or 80 m cells for spots) and rank: urgency × reports × age */
  const groups={};open.forEach(r=>{const key=r.f||('spot:'+(Math.round(r.lat/.0007))+':'+(Math.round(r.lng/.0009))+':'+r.kind);(groups[key]=groups[key]||{key,f:r.f&&facility(pk,r.f),rs:[]}).rs.push(r);});
  const G=Object.values(groups).map(g=>{const sev=Math.max(...g.rs.map(r=>K[r.kind].sev)),old=Math.min(...g.rs.map(r=>r.ts));const lat=g.rs.reduce((s,r)=>s+r.lat,0)/g.rs.length,lng=g.rs.reduce((s,r)=>s+r.lng,0)/g.rs.length;
    return Object.assign(g,{sev,old,lat,lng,score:sev*2+g.rs.length+Math.min(6,(now-old)/(8*H)),work:g.rs.every(r=>r.status==='work')});}).sort((a,b)=>b.score-a.score);
  $('#ofList').innerHTML=G.length?G.map(g=>{const kinds={};g.rs.forEach(r=>kinds[r.kind]=(kinds[r.kind]||0)+1);
    return `<li class="pk-of${g.work?' work':''}"><span class="pk-mk sm pk-${g.f?g.f.t:'spot'} pk-st-${g.sev>=3?'bad':'warn'}">${ico(g.f?g.f.t:'spot',14)}</span>
     <div class="pk-ofm"><b>${g.f?esc(g.f.n):'<span>Spot on the trail</span>'}</b><div class="pk-ofk">${Object.entries(kinds).map(([k,n])=>`<span class="pk-tag">${esc(K[k].l)}${n>1?` <b translate="no">×${n}</b>`:''}</span>`).join('')}</div>
     <small class="muted"><span>First report</span> ${N(ago(g.old))}${g.rs.some(r=>r.by==='you')?' · <span>includes reports sent from this phone</span>':''}${g.rs.some(r=>r.photo)?' · 📷':''}</small>
     ${g.rs.filter(r=>r.note||r.photo).slice(0,2).map(r=>`<div class="pk-ofnote">${r.photo?`<img src="${r.photo}" alt="">`:''}${r.note?`<span>“${esc(r.note)}”</span>`:''}</div>`).join('')}</div>
     <div class="pk-ofb">${g.work?'<span class="pk-st pk-st-ok">In progress</span>':`<button class="btn btn-line sm" data-work="${g.rs.map(r=>r.id).join(',')}">Send staff</button>`}<button class="btn btn-gold sm" data-done="${g.rs.map(r=>r.id).join(',')}">Mark fixed</button></div></li>`;}).join(''):'<li class="muted">No open problems. Good work.</li>';
  /* service round: nearest-neighbour route from the ranger post through toilets and bins that need work */
  const stops=G.filter(g=>g.f&&(g.f.t==='toilet'||g.f.t==='bin'||g.f.t==='water')),gate=P.f.find(f=>f.t==='ranger');let pos=gate,route=[],len=0;const left=stops.slice();
  while(left.length){let bi=0,bm=1e12;left.forEach((s,i)=>{const m=dist(pos.lat,pos.lng,s.lat,s.lng);if(m<bm){bm=m;bi=i;}});len+=bm;pos=left[bi];route.push(left.splice(bi,1)[0]);}
  if(route.length)len+=dist(pos.lat,pos.lng,gate.lat,gate.lng);
  $('#ofRound').innerHTML=route.length?`<ol class="pk-round"><li><b>${esc(gate.n)}</b></li>${route.map(s=>`<li><b>${esc(s.f.n)}</b> <small class="muted">${[...new Set(s.rs.map(r=>K[r.kind].l))].map(x=>`<span>${esc(x)}</span>`).join(', ')}</small></li>`).join('')}<li><span>Back to</span> <b>${esc(gate.n)}</b></li></ol><p class="muted"><span>About</span> ${N(fmtDist(len))} <span>on foot</span>, ${N(LL(`${route.length} stops`,`${route.length}个站点`,`${route.length} Stationen`))}.</p>`:'<p class="muted">Nothing to service right now.</p>';
  /* chart: reports by kind, 7 days */
  const by={};all.filter(r=>now-r.ts<7*24*H).forEach(r=>by[r.kind]=(by[r.kind]||0)+1);const mx=Math.max(1,...Object.values(by));
  $('#ofChart').innerHTML=Object.keys(K).filter(k=>by[k]).sort((a,b)=>by[b]-by[a]).map(k=>`<div class="pk-bar"><span>${esc(K[k].l)}</span><i style="--w:${(by[k]/mx*100).toFixed(1)}%" class="${K[k].sev?'':'good'}"></i><b class="num" translate="no">${by[k]}</b></div>`).join('')||'<p class="muted">No reports this week.</p>';
  /* by day */
  const days=[...Array(7)].map((_,i)=>{const d0=new Date(now-(6-i)*24*H);d0.setHours(0,0,0,0);const d1=d0.getTime()+24*H;return {d:d0,n:all.filter(r=>r.ts>=d0.getTime()&&r.ts<d1).length};});const dm=Math.max(1,...days.map(d=>d.n));
  $('#ofDays').innerHTML=days.map(d=>`<div class="pk-day"><i style="--h:${(d.n/dm*100).toFixed(0)}%"></i><b class="num" translate="no">${d.n}</b><span translate="no">${d.d.toLocaleDateString(loc(),{weekday:'short'})}</span></div>`).join('');
  /* signal gaps for the mobile operator: where visitors had no signal */
  const gaps={};all.filter(r=>r.kind==='nosig').forEach(r=>{const k=Math.round(r.lat/.0018)+':'+Math.round(r.lng/.0024);(gaps[k]=gaps[k]||{n:0,lat:0,lng:0});gaps[k].n++;gaps[k].lat+=r.lat;gaps[k].lng+=r.lng;});
  const GP=Object.values(gaps).map(g=>({n:g.n,lat:g.lat/g.n,lng:g.lng/g.n})).sort((a,b)=>b.n-a.n);
  $('#ofGaps').innerHTML=GP.length?`<ul class="pk-gaps">${GP.slice(0,5).map(g=>`<li>${ico('nosig',16)} <b translate="no">${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}</b> <span class="muted">·</span> ${N(LL(`${g.n} report${g.n>1?'s':''}`,`${g.n}条反馈`,`${g.n} Meldung${g.n>1?'en':''}`))}</li>`).join('')}</ul><button class="btn btn-line sm" data-csv>Download for the mobile operator (CSV)</button>`:'<p class="muted">No signal gaps reported.</p>';
  /* map */
  if(window.L&&online()){$('#ofMap').hidden=false;$('#ofPlan').hidden=true;
    if(!omap.m){omap.m=L.map('ofMap',{scrollWheelZoom:false});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(omap.m);}
    if(omap.park!==pk){omap.m.setView(P.c,P.z);omap.park=pk;}
    if(omap.g)omap.g.remove();omap.g=L.layerGroup().addTo(omap.m);
    P.f.forEach(f=>L.circleMarker([f.lat,f.lng],{radius:4,color:'#5A6B7B',weight:1,fillOpacity:.6}).addTo(omap.g).bindTooltip(tx(f.n)));
    GP.forEach(g=>L.circle([g.lat,g.lng],{radius:60+g.n*20,color:'#7a7f87',weight:1,dashArray:'4 4',fillOpacity:.12,interactive:false}).addTo(omap.g));
    G.forEach(g=>L.circleMarker([g.lat,g.lng],{radius:8+Math.min(18,g.rs.length*3),color:g.sev>=3?'#C2453A':'#D99A1E',weight:2,fillOpacity:.35}).addTo(omap.g).bindTooltip(`${g.f?tx(g.f.n):tx('Spot on the trail')} · ${g.rs.length}`));
    setTimeout(()=>omap.m.invalidateSize(),60);
  }else{$('#ofMap').hidden=true;$('#ofPlan').hidden=false;$('#ofPlan').innerHTML=parkSvg(pk,{crowd:all.filter(r=>r.kind==='nosig')}).svg;}
  paintNet();
}
function csv(){const pk=cur.office,rows=[['park','lat','lng','kind','time']].concat(srv().filter(r=>r.park===pk&&(r.kind==='nosig'||r.kind==='sigok')).map(r=>[pk,r.lat,r.lng,r.kind,new Date(r.ts).toISOString()]));
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}));a.download=`signal-gaps-${pk}.csv`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}

function rerender(){
  if($('#view-parks')&&!$('#view-parks').hidden)renderParks();
  if($('#view-office')&&!$('#view-office').hidden)renderOffice();
  if($('#view-pack')&&!$('#view-pack').hidden&&cur.pack)renderPack(cur.pack);
  if($('#view-tour')&&!$('#view-tour').hidden&&st.tour)onTour(st.tour);
  paintHome();paintNet();
}

/* ---------- hooks into the rest of the site ---------- */
function onTour(t){
  const b=$('#dOffline'),pb=$('#dPark');if(!b)return;const pack=load(PACKS,{})[t.id];
  b.innerHTML=pack?'✓ <span>Saved for offline · open</span>':`${ico('signal',16)} <span>Save for offline</span>`;b.dataset.tid=t.id;b.dataset.saved=pack?'1':'';
  const pk=PARK_OF[t.id];pb.hidden=!pk;if(pk){pb.dataset.openpark=pk;}
}
function onBooked(tid,code){const p=load(PACKS,{});p[tid]=Object.assign(p[tid]||{savedAt:Date.now()},{code});save(PACKS,p);
  const b=$('#cOffline');if(b){b.dataset.tid=tid;b.hidden=false;}}
function paintHome(){
  const el=$('#hpPacks');if(!el)return;const p=load(PACKS,{}),ids=Object.keys(p).filter(tourOf);
  el.innerHTML=ids.length?`<span class="muted">Saved on this phone:</span> ${ids.map(id=>`<a class="chip" href="#pack-${id}" data-pack="${id}">✓ ${esc(tourOf(id).name)}</a>`).join(' ')}`:'';
  const all=srv(),open=all.filter(r=>staffJob(r)&&r.status!=='done').length,fixed=all.filter(r=>r.status==='done'&&Date.now()-r.doneAt<7*24*H).length;
  const s=$('#hpStats');if(s)s.innerHTML=`<div class="pk-kpi"><b class="num" translate="no">${Object.keys(PARKS).length}</b><span>Parks on the map</span></div><div class="pk-kpi"><b class="num" translate="no">${Object.values(PARKS).reduce((n,p)=>n+p.f.length,0)}</b><span>Toilets, bins, taps and posts</span></div><div class="pk-kpi"><b class="num" translate="no">${fixed}</b><span>Problems fixed this week</span></div><div class="pk-kpi hot"><b class="num" translate="no">${open}</b><span>Open right now</span></div>`;
}
function apply(x){
  if(x.view==='parks')openParks(x.park,true);
  else if(x.view==='office')openOffice(x.park,true);
  else if(x.view==='pack'){if(tourOf(x.tour))openPack(x.tour,true);else{show('home');}}
}

document.addEventListener('click',async e=>{
  const q=s=>e.target.closest(s);let b;
  if(b=q('[data-pk]')){cur.park=b.dataset.pk;cur.sel=null;cur.mode=null;renderParks();replace({view:'parks',park:cur.park});return;}
  if(b=q('[data-of]')){cur.office=b.dataset.of;renderOffice();replace({view:'office',park:cur.office});return;}
  if(b=q('[data-layer]')){const k=b.dataset.layer;cur.layers[k]=!cur.layers[k];renderParks();return;}
  if(b=q('[data-kind]')){submit(b.dataset.kind);return;}
  if(b=q('[data-sel]')){select(b.dataset.sel);return;}
  if(q('[data-close]')||q('[data-cancel]')){cur.sel=null;cur.mode=null;cur.spot=null;renderParks();return;}
  if(q('[data-spot]')){cur.sel=null;cur.mode='spot';cur.spot=nearPark(cur.park)?{lat:me.lat,lng:me.lng,gps:1}:(pmap.m&&!$('#pkMap').hidden?(c=>({lat:c.lat,lng:c.lng}))(pmap.m.getCenter()):null);
    if(!cur.spot){const P=PARKS[cur.park];cur.spot={lat:P.c[0],lng:P.c[1]};}renderParks();return;}
  if(q('[data-gps]')||q('[data-locate]')){locate(p=>{if(!p)pkToast(N(LL('Location is off or not allowed. Turn it on to see where you are.','定位未开启或未授权，请开启以查看您的位置。','Standort ist aus oder nicht erlaubt. Schalten Sie ihn ein, um zu sehen, wo Sie sind.')));else if(!nearPark(cur.park)&&!$('#view-parks').hidden)pkToast(N(LL('You are not in this park now, so distances are counted from the entrance.','您现在不在这个公园里，所以距离从入口算起。','Sie sind gerade nicht in diesem Park, daher zählen die Entfernungen ab dem Eingang.')));rerender();});return;}
  if(q('[data-sync]')){if(!online())pkToast(N(LL('Still no signal. Reports stay on your phone and go out automatically.','仍然没有信号。反馈保存在手机上，会自动发送。','Noch kein Netz. Die Meldungen bleiben auf dem Handy und gehen automatisch raus.')));else sync();return;}
  if(b=q('[data-savepack]')){savePack(b.dataset.savepack);return;}
  if(b=q('[data-unpack]')){removePack(b.dataset.unpack);renderPack(b.dataset.unpack);paintHome();return;}
  if(b=q('#dOffline')){const tid=b.dataset.tid;if(b.dataset.saved)openPack(tid);else{savePack(tid);}return;}
  if(b=q('#cOffline')){const tid=b.dataset.tid;savePack(tid);openPack(tid);return;}
  if(b=q('[data-pack]')){e.preventDefault();openPack(b.dataset.pack);return;}
  if(b=q('[data-openpark]')){e.preventDefault();openParks(b.dataset.openpark);return;}
  if((b=q('[data-tour]'))&&b.closest('#view-parks')){openTour(b.dataset.tour);return;}
  if(b=q('[data-work]')){setStatus(b.dataset.work.split(','),'work');return;}
  if(b=q('[data-done]')){setStatus(b.dataset.done.split(','),'done');pkToast(`✓ ${N(LL('Marked fixed. Visitors see it on the map.','已标记为已修复，游客会在地图上看到。','Als behoben markiert. Besucher sehen es auf der Karte.'))}`);return;}
  if(q('[data-csv]')){csv();return;}
  if(q('.pk-sim')){toggleSim();return;}
  if(b=q('[data-goview]')){const v=b.dataset.goview;if(v==='parks')openParks();else if(v==='office')openOffice();return;}
});
document.addEventListener('change',async e=>{
  if(e.target.id==='pkPhoto'&&e.target.files[0]){try{cur.photo=await readPhoto(e.target.files[0]);}catch(x){cur.photo=null;}const n=$('#pkNote')&&$('#pkNote').value;renderPanel();const d=$('#pkPanel details');if(d)d.open=true;if(n&&$('#pkNote'))$('#pkNote').value=n;}
  if(e.target.dataset&&e.target.dataset.lnt!==undefined&&cur.pack){const k='sr_lnt_'+cur.pack,v=load(k,[]);v[+e.target.dataset.lnt]=e.target.checked;save(k,v);}
});
$('#lang')&&$('#lang').addEventListener('change',()=>setTimeout(rerender,0));

/* translations of everything above that the page translator sees */
Object.assign(I18N,PK_I18N);

/* service worker: makes the site and saved trips open with no signal */
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

seed();
window.PK={apply,onTour,onBooked,openParks,openOffice,openPack,PARKS,sync,_k:K};
paintHome();paintNet();sync();
if(window.__pkInit){apply(window.__pkInit);window.__pkInit=null;}
else if(st.tour&&!$('#view-tour').hidden)onTour(st.tour);
})();
