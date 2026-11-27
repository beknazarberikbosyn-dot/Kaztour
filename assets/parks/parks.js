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
const LL=(en,zh,de,ru,kk)=>{const v={zh,de,ru,kk}[lang()];return v===undefined?en:v;};   // for text with numbers: rendered in place, not by the page translator
const tx=s=>{const i={zh:0,de:1,ru:2,kk:3}[lang()];return i!==undefined&&I18N[s]&&I18N[s][i]?I18N[s][i]:s;}; // for attributes
const loc=()=>LOC(); // same locale rules as the rest of the site
const H=3600e3;
function load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
function ago(ts){const m=Math.max(0,Math.round((Date.now()-ts)/6e4));
  if(m<1)return LL('just now','刚刚','gerade eben','только что','жаңа ғана');
  if(m<60)return LL(`${m} min ago`,`${m}分钟前`,`vor ${m} Min.`,`${m} мин назад`,`${m} мин бұрын`);
  const h=Math.round(m/60);if(h<48)return LL(`${h} h ago`,`${h}小时前`,`vor ${h} Std.`,`${h} ч назад`,`${h} сағ бұрын`);
  const d=Math.round(h/24);return LL(`${d} days ago`,`${d}天前`,`vor ${d} Tagen`,`${d} дн. назад`,`${d} күн бұрын`);}
const N=s=>`<span translate="no">${s}</span>`;
function dist(a,b,c,d){const R=6371e3,r=Math.PI/180,x=(d-b)*r*Math.cos((a+c)/2*r),y=(c-a)*r;return Math.hypot(x,y)*R;}
function bearing(a,b,c,d){const r=Math.PI/180,y=Math.sin((d-b)*r)*Math.cos(c*r),x=Math.cos(a*r)*Math.sin(c*r)-Math.sin(a*r)*Math.cos(c*r)*Math.cos((d-b)*r);return (Math.atan2(y,x)/r+360)%360;}
function dirName(deg){const en=['north','north-east','east','south-east','south','south-west','west','north-west'],zh=['北','东北','东','东南','南','西南','西','西北'],de=['Norden','Nordosten','Osten','Südosten','Süden','Südwesten','Westen','Nordwesten'],ru=['север','северо-восток','восток','юго-восток','юг','юго-запад','запад','северо-запад'],kk=['солтүстік','солтүстік-шығыс','шығыс','оңтүстік-шығыс','оңтүстік','оңтүстік-батыс','батыс','солтүстік-батыс'];const i=Math.round(deg/45)%8;return LL(en[i],zh[i],de[i],ru[i],kk[i]);}
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

/* ---------- storage and server ----------
   outbox     reports made on this phone, not sent yet (no signal)
   sample     made-up reports from "other visitors", local only, marked as sample data
   server     Supabase when assets/parks/config.js has a project (live: every phone and the office
              panel on the projector see the same data); otherwise this browser plays the server */
const OUT='sr_pk_out',SRV='sr_pk_srv',SAMPLE='sr_pk_sample',CACHE='sr_pk_cache',MINE='sr_pk_mine',PACKS='sr_packs',SIM='sr_pk_sim',
  CK='sr_ck',CKQ='sr_ck_q',CKSRV='sr_ck_srv',CKCACHE='sr_ck_cache',RELAYN='sr_relay_n';
let simOff=load(SIM,false);
const online=()=>navigator.onLine&&!simOff;
const CFG=window.SR_CONFIG||{},API=CFG.supabaseUrl&&CFG.supabaseKey?String(CFG.supabaseUrl).replace(/\/+$/,''):null;
const rid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function seed(){
  if(load('sr_pk_seed',0)===3)return;
  /* sample reports from other visitors over the last 7 days, so the office panel shows a working week */
  let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;const now=Date.now(),out=[];
  const plan={kolsai:[['k-wc2','dirty',6],['k-wc2','supplies',3],['k-bin2','full',7],['k-bin3','full',4],['k-bin3','litter',3],['k-wc1','dirty',3],['k-tap','ok',2],['k-gate','ok',2],[null,'nosig',8],[null,'litter',4],[null,'sigok',2]],
    charyn:[['c-wc1','dirty',5],['c-wc1','closed',2],['c-bin1','full',4],['c-bin2','full',5],['c-bin2','litter',3],['c-tap','nowater',2],[null,'nosig',5],[null,'litter',3]],
    bigalmaty:[['b-wc1','dirty',4],['b-bin1','full',3],['b-bin2','litter',4],[null,'nosig',3],[null,'litter',2]],
    burabay:[['u-wc2','supplies',3],['u-bin1','full',4],['u-bin3','full',3],['u-tap','ok',2],[null,'sigok',3],[null,'nosig',2]],
    altynemel:[['a-wc1','dirty',3],['a-bin1','full',4],[null,'litter',3],[null,'nosig',4]]};
  for(const pk in plan)for(const [fid,kind,n] of plan[pk])for(let i=0;i<n;i++){
    const P=PARKS[pk],f=fid&&facility(pk,fid);let lat,lng;
    if(f){lat=f.lat;lng=f.lng;}else{const base=P.trail[Math.floor(rnd()*P.trail.length)];lat=base[0]+(rnd()-.5)*.0016;lng=base[1]+(rnd()-.5)*.0022;}
    const ts=now-rnd()*7*24*H;const old=now-ts>20*H&&rnd()<.72&&K[kind].sev>0;
    out.push({id:'s'+out.length,park:pk,f:fid,kind,lat:+lat.toFixed(5),lng:+lng.toFixed(5),ts:Math.round(ts),by:'sample',status:old?'done':(rnd()<.25&&K[kind].sev>0?'work':'new'),doneAt:old?Math.round(ts+(1.5+rnd()*9)*H):null,sentAt:Math.round(ts)});
  }
  save(SAMPLE,out);save(SRV,load(SRV,[]).filter(r=>r.by!=='sample'));save('sr_pk_seed',3);
}
const mine=()=>new Set(load(MINE,[]));
/* everything the office knows: sample data plus real reports (from the server, or from this browser in demo mode) */
function srv(){const m=mine();const real=(API?load(CACHE,[]):load(SRV,[])).map(r=>Object.assign(r,{by:m.has(r.id)?'you':(API?'live':'you')}));return load(SAMPLE,[]).concat(real);}
const outbox=()=>load(OUT,[]);
function addReport(r){const o=outbox();o.push(r);if(!save(OUT,o)&&r.photo){delete r.photo;o[o.length-1]=r;save(OUT,o);}bc('change');sync();}

/* Supabase REST (PostgREST). The anon / publishable key is public by design; row-level security in supabase/schema.sql decides what it may do */
async function rest(path,opt={}){
  const h=Object.assign({apikey:CFG.supabaseKey,'Content-Type':'application/json'},/^eyJ/.test(CFG.supabaseKey)?{Authorization:'Bearer '+CFG.supabaseKey}:{},opt.headers||{});
  const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),9000);
  try{const r=await fetch(API+'/rest/v1/'+path,Object.assign({},opt,{headers:h,signal:ctl.signal}));const t=await r.text();
    if(!r.ok)throw new Error(r.status+' '+t.slice(0,160));return t?JSON.parse(t):null;}finally{clearTimeout(tm);}
}
const toRow=(r,now)=>({id:r.id,park:r.park,f:r.f||null,kind:r.kind,lat:r.lat,lng:r.lng,ts:r.ts,note:r.note||null,photo:r.photo||null,src:r.src==='relay'?'relay':'phone',sent_at:now});
const fromRow=r=>({id:r.id,park:r.park,f:r.f,kind:r.kind,lat:r.lat,lng:r.lng,ts:+r.ts,note:r.note,photo:r.photo,src:r.src,status:r.status,doneAt:r.done_at?+r.done_at:null,sentAt:r.sent_at?+r.sent_at:null});
let syncing=false,srvErr=null,lastPull=0,sig='';
async function pull(){
  if(!API||!online())return false;
  const since=Date.now()-8*24*H;
  const [rs,cs]=await Promise.all([rest(`reports?select=id,park,f,kind,lat,lng,ts,note,photo,src,status,done_at,sent_at&ts=gte.${since}&order=ts.desc&limit=1500`),
    rest('checkins_public?select=*&order=due_at.desc&limit=200')]);
  lastPull=Date.now();const next=JSON.stringify([rs,cs]);if(next===sig)return false;sig=next;
  save(CACHE,rs.map(fromRow));save(CKCACHE,cs);return true;
}
async function sync(){
  if(syncing){sync.again=true;return;}
  if(!online()){paintNet();return;}
  syncing=true;let changed=false,sent=0,relayed=0;
  try{
    const o=outbox();
    if(o.length){const now=Date.now();
      if(API)await rest('reports?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(o.map(r=>toRow(r,now)))});
      else{const s=load(SRV,[]),have=new Set(s.map(r=>r.id));o.forEach(r=>{if(!have.has(r.id))s.push(Object.assign({},r,{sentAt:now,status:'new'}));});save(SRV,s);}
      const ids=new Set(o.map(r=>r.id));save(OUT,outbox().filter(r=>!ids.has(r.id)));
      save(MINE,[...mine(),...o.filter(r=>r.src!=='relay').map(r=>r.id)].slice(-300));
      sent=o.filter(r=>r.src!=='relay').length;relayed=o.length-sent;changed=true;
    }
    if(await pushCheckins())changed=true;
    if(await pushPasses())changed=true;
    if(API&&await pull())changed=true;
    if(API&&await pullHosts())changed=true;
    srvErr=null;
  }catch(e){srvErr=String(e.message||e);}
  syncing=false;paintNet();
  if(sent||relayed)pkToast(`✓ ${N([sent?LL(`${sent} report${sent>1?'s':''} sent to the park office`,`已向公园管理处发送${sent}条反馈`,`${sent} Meldung${sent>1?'en':''} an die Parkverwaltung gesendet`,`Отправлено в администрацию парка: ${sent}`,`Парк әкімшілігіне жіберілді: ${sent}`):'',relayed?LL(`${relayed} passed on for other travelers`,`代其他游客转发${relayed}条`,`${relayed} für andere Reisende weitergegeben`,`Передано за других туристов: ${relayed}`,`Басқа саяхатшылар үшін жіберілді: ${relayed}`):''].filter(Boolean).join(' · '))}`);
  if(changed){bc('change');rerender();}
  if(sync.again){sync.again=false;sync();}
}
async function setStatus(ids,status){
  const now=Date.now(),smp=load(SAMPLE,[]),sIds=new Set(smp.map(r=>r.id));
  smp.forEach(r=>{if(ids.includes(r.id)){r.status=status;if(status==='done')r.doneAt=now;}});save(SAMPLE,smp);
  const real=ids.filter(i=>!sIds.has(i));
  if(real.length){
    if(API){const c=load(CACHE,[]);c.forEach(r=>{if(real.includes(r.id)){r.status=status;if(status==='done')r.doneAt=now;}});save(CACHE,c);
      try{await rest(`reports?id=in.(${real.join(',')})`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,done_at:status==='done'?now:null})});srvErr=null;}catch(e){srvErr=String(e.message||e);}}
    else{const s=load(SRV,[]);s.forEach(r=>{if(real.includes(r.id)){r.status=status;if(status==='done')r.doneAt=now;}});save(SRV,s);}
  }
  bc('change');rerender();
}
/* live updates: the office on the projector asks the server every few seconds; tabs of one browser hear each other at once */
let chan=null;try{chan=new BroadcastChannel('samruk-parks');chan.onmessage=()=>rerender();}catch(e){}
function bc(m){try{chan&&chan.postMessage(m);}catch(e){}}
window.addEventListener('storage',e=>{if([SRV,OUT,SAMPLE,CKSRV,CK,HST,HMINE,PSRV,PMINE].includes(e.key))rerender();});
window.addEventListener('online',()=>{paintNet();setTimeout(sync,400);});
window.addEventListener('offline',paintNet);
const tick={k:''};
setInterval(()=>{
  if(document.hidden||!online())return;
  const office=!$('#view-office').hidden,busy=!$('#view-parks').hidden||!$('#view-pack').hidden;
  const hv=!$('#view-host').hidden;
  if(outbox().length||load(CKQ,[]).length||load(PQ,[]).length)sync();
  else if(API&&(office||busy||hv)&&Date.now()-lastPull>(office||hv?2500:12000))Promise.all([pull(),pullHosts()]).then(([a,b])=>{if(a||b)rerender();srvErr=null;}).catch(e=>{srvErr=String(e.message||e);paintNet();});
  if(office&&!API){const k=JSON.stringify(checkins().map(c=>c.state));if(k!==tick.k){tick.k=k;renderOffice();}} // overdue check-ins appear without a reload
},3000);

/* ---------- safety check-in: if I am not back by my time, my contact gets an SMS with my last point ---------- */
function myCk(){return load(CK,null);}
function ckQueue(op){const q=load(CKQ,[]);if(op.op==='point'){const i=q.findIndex(x=>x.op==='point'&&x.id===op.id);if(i>=0){if(q[i].ts>=op.ts)return;q.splice(i,1);}}q.push(op);save(CKQ,q);}
function ckStart(o){
  const ck={id:rid('c'),name:o.name,contact:o.contact,park:o.park||null,tour:o.tour||null,due:o.due,startedAt:Date.now(),status:'out'};save(CK,ck);
  ckQueue({op:'start',id:ck.id,name:ck.name,contact:ck.contact,park:ck.park,tour:ck.tour,due:ck.due,lat:me?+me.lat.toFixed(5):null,lng:me?+me.lng.toFixed(5):null,ts:me?me.ts:null});
  if(me)save('sr_ck_last',{lat:+me.lat.toFixed(5),lng:+me.lng.toFixed(5),ts:me.ts});
  sync();return ck;
}
function ckPoint(p,src){const ck=myCk();if(!ck||ck.status!=='out')return;const last=load('sr_ck_last',null);
  if(src!=='relay'&&last&&p.ts-last.ts<60000&&dist(last.lat,last.lng,p.lat,p.lng)<40)return;
  const pt={lat:+p.lat.toFixed(5),lng:+p.lng.toFixed(5),ts:p.ts};if(src!=='relay')save('sr_ck_last',pt);
  ckQueue(Object.assign({op:'point',id:p.id||ck.id,src:src||'phone'},pt));if(online())sync();}
function ckBack(){const ck=myCk();if(!ck)return;ck.status='back';ck.backAt=Date.now();save(CK,ck);ckQueue({op:'back',id:ck.id,ts:ck.backAt});sync();}
async function pushCheckins(){
  const q=load(CKQ,[]);if(!q.length)return false;const done=[];
  for(const op of q){
    if(API){
      if(op.op==='start')await rest('rpc/checkin_start',{method:'POST',body:JSON.stringify({p_id:op.id,p_name:op.name,p_contact:op.contact,p_park:op.park,p_tour:op.tour,p_due:op.due,p_lat:op.lat,p_lng:op.lng,p_ts:op.ts})});
      else if(op.op==='point')await rest('rpc/checkin_point',{method:'POST',body:JSON.stringify({p_id:op.id,p_lat:op.lat,p_lng:op.lng,p_ts:op.ts,p_src:op.src})});
      else if(op.op==='back')await rest('rpc/checkin_back',{method:'POST',body:JSON.stringify({p_id:op.id,p_ts:op.ts})});
    }else{
      const s=load(CKSRV,[]);let c=s.find(x=>x.id===op.id);
      if(op.op==='start'){if(!c){c={id:op.id};s.push(c);}Object.assign(c,{name:String(op.name).split(' ')[0],contact_masked:maskPhone(op.contact),park:op.park,tour:op.tour,due_at:op.due,last_lat:op.lat,last_lng:op.lng,last_ts:op.ts,last_src:'phone',status:'out',back_at:null,sms_sent_at:null});}
      else if(c&&op.op==='point'&&(!c.last_ts||c.last_ts<op.ts))Object.assign(c,{last_lat:op.lat,last_lng:op.lng,last_ts:op.ts,last_src:op.src});
      else if(c&&op.op==='back')Object.assign(c,{status:'back',back_at:op.ts});
      save(CKSRV,s);
    }
    done.push(op);
  }
  save(CKQ,load(CKQ,[]).filter(x=>!done.includes(x)&&!done.some(d=>d.op===x.op&&d.id===x.id&&d.ts===x.ts)));
  const ck=myCk();if(ck&&done.some(d=>d.id===ck.id)){ck.synced=true;save(CK,ck);}
  return true;
}
function maskPhone(p){const d=String(p).replace(/[^0-9]/g,'');return `+${d.slice(0,1)} ${d.slice(1,4)} ••• •• ${d.slice(-2)}`;}
function checkins(){const now=Date.now();return (API?load(CKCACHE,[]):load(CKSRV,[])).map(c=>Object.assign({},c,{state:c.status==='out'&&+c.due_at<now?'overdue':c.status}));}

/* ---------- relay: a phone with no signal hands its reports and last point to another traveler by QR ---------- */
const RELAY_MAX=6;
function relayPayload(){
  const o=outbox().slice(-RELAY_MAX).map(r=>[r.id,r.park,r.f||0,r.kind,r.lat,r.lng,Math.round(r.ts/1000).toString(36)]);
  const ck=myCk(),last=load('sr_ck_last',null),pt=me&&ck&&ck.status==='out'&&ck.synced?{lat:+me.lat.toFixed(5),lng:+me.lng.toFixed(5),ts:me.ts}:(ck&&ck.status==='out'&&ck.synced?last:null);
  const c=pt?[ck.id,pt.lat,pt.lng,Math.round(pt.ts/1000).toString(36)]:0;
  return {text:'SRLY1:'+JSON.stringify({r:o,c}),n:o.length,c:!!c};
}
function relayTake(text){
  const m=/^SRLY1:(.+)$/s.exec(String(text||'').trim());if(!m)return null;let d;try{d=JSON.parse(m[1]);}catch(e){return null;}
  const o=outbox(),have=new Set(o.map(r=>r.id).concat(srv().map(r=>r.id)));let n=0;
  (Array.isArray(d.r)?d.r:[]).slice(0,20).forEach(a=>{const [id,park,f,kind,lat,lng,t36]=a;
    if(typeof id!=='string'||!/^[a-z0-9]{4,40}$/.test(id)||!PARKS[park]||!K[kind]||have.has(id)||typeof lat!=='number'||typeof lng!=='number')return;
    o.push({id,park,f:f&&facility(park,f)?f:null,kind,lat,lng,ts:parseInt(t36,36)*1000,note:'',photo:null,src:'relay',status:'new'});n++;});
  save(OUT,o);
  let c=false;if(Array.isArray(d.c)&&/^[a-z0-9]{4,40}$/.test(d.c[0])&&typeof d.c[1]==='number'){ckQueue({op:'point',id:d.c[0],lat:d.c[1],lng:d.c[2],ts:parseInt(d.c[3],36)*1000,src:'relay'});c=true;}
  save(RELAYN,load(RELAYN,0)+n+(c?1:0));bc('change');sync();return {n,c};
}
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
  if(st.s==='bad'||st.s==='warn')return `<span class="pk-st pk-st-${st.s}">${esc(K[st.top.kind].l)}</span> <span class="muted">· ${N(ago(st.top.ts))}${st.n>1?' · '+N(LL(`${st.n} reports`,`${st.n}条反馈`,`${st.n} Meldungen`,`отметок: ${st.n}`,`белгі: ${st.n}`)):''}</span>`;
  if(st.s==='fixed')return `<span class="pk-st pk-st-ok">Fixed by park staff</span> <span class="muted">· ${N(ago(st.at))}</span>`;
  if(st.s==='ok')return `<span class="pk-st pk-st-ok">Visitors say all good</span> <span class="muted">· ${N(ago(st.at))}</span>`;
  return `<span class="pk-st">No reports yet</span>`;
}

/* ---------- network pill ---------- */
function paintNet(){
  const n=outbox().length,on=online();
  document.querySelectorAll('.pk-net').forEach(el=>{
    el.className='pk-net '+(on?'on':'off');
    el.innerHTML=`<span class="pk-dot" aria-hidden="true"></span><span>${on?'Online':'No signal'}</span>${n?` · ${N(LL(`${n} waiting to send`,`${n}条待发送`,`${n} warten auf Versand`,`ждут отправки: ${n}`,`жіберуді күтуде: ${n}`))}`:''}`;
    el.title=tx(API?(srvErr?'Server error: '+srvErr:'Live server: every phone and the park office see the same data'):'Demo mode: no server yet, data stays in this browser');
  });
  document.querySelectorAll('.pk-sim').forEach(b=>b.setAttribute('aria-pressed',String(simOff)));
  document.querySelectorAll('.pk-mode').forEach(el=>{el.className='pk-mode '+(API?(srvErr?'err':'live'):'demo');
    el.innerHTML=API?(srvErr?'<span>Server not reachable</span>':'<span class="pk-dot" aria-hidden="true"></span><span>Live server</span>'):'<span>Demo: data in this browser</span>';});
}
function toggleSim(){simOff=!simOff;save(SIM,simOff);paintNet();
  pkToast(simOff?N(LL('Test mode: the site now acts as if there is no signal','测试模式：网站现在模拟没有信号','Testmodus: Die Seite verhält sich jetzt wie ohne Netz','Тестовый режим: сайт ведёт себя так, будто связи нет','Сынақ режимі: сайт байланыс жоқ сияқты жұмыс істейді')):N(LL('Signal is back','信号已恢复','Netz ist wieder da','Связь вернулась','Байланыс қайта пайда болды')));
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
    placed.push([x,y]);return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" class="pk-svgl">${esc(tx(f.n))}</text>`;}).join('');
  const me=o.me?`<g transform="translate(${X(o.me.lng)} ${Y(o.me.lat)})"><circle r="${Math.max(10,+R(o.me.acc||30))}" fill="var(--sky)" fill-opacity=".15"/><circle r="9" fill="var(--sky)" stroke="#fff" stroke-width="3"/></g>`:'';
  const nArrow=`<g transform="translate(${W-46} 46)"><circle r="24" fill="var(--surface)" stroke="var(--line)"/><path d="M0-15 7 6 0 2-7 6z" fill="var(--ink)"/><text y="20" text-anchor="middle" font-size="11" font-weight="700" fill="var(--muted)">N</text></g>`;
  const sc=Math.pow(10,Math.floor(Math.log10((W/sx)*111320/3)));const scPx=sc/111320*sx;
  const scale=`<g transform="translate(24 ${(Hh-26).toFixed(0)})"><path d="M0 0h${scPx.toFixed(1)}" stroke="var(--ink)" stroke-width="3"/><path d="M0-6v6M${scPx.toFixed(1)}-6v6" stroke="var(--ink)" stroke-width="2"/><text x="${(scPx/2).toFixed(1)}" y="-9" text-anchor="middle" font-size="13" fill="var(--muted)">${sc>=1000?sc/1000+' km':sc+' m'}</text></g>`;
  return {svg:`<svg class="pk-plan" viewBox="0 0 ${W} ${Hh.toFixed(0)}" role="img" aria-label="${esc(tx('Offline plan of the park'))}"><rect width="${W}" height="${Hh.toFixed(0)}" rx="18" class="pk-planbg"/>${sig}${crowd}${trail}${fac}${(o.hosts||[]).map(h=>{const x=+X(h.lng),y=+Y(h.lat);return x<10||y<10||x>W-10||y>Hh-10?'':`<g class="pk-svgh" data-hostid="${h.id}" transform="translate(${x} ${y})"><rect x="-19" y="-19" width="38" height="38" rx="9"/><g transform="translate(-12 -12)">${ICO.host}</g></g>`;}).join('')}${lbl}${me}${nArrow}${scale}</svg>`,proj:{X,Y}};
}

/* ---------- where am I: GPS works without mobile data ---------- */
let me=null,watch=null;
function locate(cb){
  if(!navigator.geolocation){cb&&cb(null);return;}
  if(watch===null)watch=navigator.geolocation.watchPosition(p=>{me={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy,ts:Date.now()};cb&&cb(me);cb=null;ckPoint(me);paintMe();},()=>{cb&&cb(null);cb=null;},{enableHighAccuracy:true,maximumAge:20000,timeout:15000});
  else cb&&cb(me);
}
const nearPark=pk=>me&&dist(me.lat,me.lng,PARKS[pk].c[0],PARKS[pk].c[1])<4000;
function paintMe(){if(!$('#view-pack').hidden&&cur.pack&&!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#packBox input')))renderPack(cur.pack,true);if(!$('#view-parks').hidden&&pmap.me&&me&&window.L){pmap.me.setLatLng([me.lat,me.lng]).addTo(pmap.m);}}
/* nearest facility of a type, from me or from the gate */
function nearest(pk,type,from){const P=PARKS[pk];const o=from||{lat:P.f[0].lat,lng:P.f[0].lng};
  let best=null;const list=type==='signal'?P.sig.filter(s=>s.q>0).map(s=>({lat:s.lat,lng:s.lng,n:s.n,r:s.r})).concat(hostsOf(pk).filter(h=>h.svc.wifi&&h.svc.wifi.open).map(h=>({lat:h.lat,lng:h.lng,n:h.name}))):P.f.filter(f=>f.t===type);
  for(const f of list){const m=dist(o.lat,o.lng,f.lat,f.lng);if(!best||m<best.m)best={f,m,b:bearing(o.lat,o.lng,f.lat,f.lng)};}return best;}

/* ---------- PARKS view: the facilities map ---------- */
const cur={park:'kolsai',sel:null,layers:{toilet:1,bin:1,water:1,aid:1,ranger:1,parking:1,signal:1,host:1},mode:null,photo:null,pack:null,office:'kolsai'};
const pmap={m:null,g:null,me:null,park:null};
function openParks(pk,fromHistory){
  if(pk&&PARKS[pk])cur.park=pk;cur.sel=null;cur.mode=null;
  show('parks');markNav('parks');renderParks();loadJsQR().catch(()=>{}); // the scanner must be ready before the signal is gone
  if(!fromHistory)push({view:'parks',park:cur.park});
}
function markNav(v){document.querySelectorAll('.nav [data-view]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.view===v)));}
function renderParks(){
  const P=PARKS[cur.park],t=tourOf(P.tour),packed=!!load(PACKS,{})[P.tour];
  $('#pkTabs').innerHTML=Object.keys(PARKS).map(k=>`<button class="chip" role="tab" data-pk="${k}" aria-selected="${k===cur.park}" aria-pressed="${k===cur.park}">${esc(PARKS[k].short)}</button>`).join('');
  $('#pkName').textContent=P.name;
  $('#pkFacts').innerHTML=`<div class="pk-fact">${ico('water',20)}<p>${esc(P.water)}</p></div><div class="pk-fact">${ico('signal',20)}<p>${esc(P.signal)}</p></div>`;
  $('#pkLegend').innerHTML=['host','toilet','bin','water','aid','ranger','parking','signal'].map(k=>`<button class="pk-lg pk-${k}" data-layer="${k}" aria-pressed="${!!cur.layers[k]}"><span class="pk-lgi">${ico(k,16)}</span><span>${k==='signal'?'Signal zones':k==='host'?'Local hosts':FT[k]}</span></button>`).join('');
  $('#pkPack').innerHTML=packed?`<a class="btn btn-line sm" href="#pack-${P.tour}" data-pack="${P.tour}">✓ <span>Saved for offline · open</span></a>`:`<button class="btn btn-gold sm" data-savepack="${P.tour}">${ico('signal',16)} <span>Save this park for offline</span></button>`;
  $('#pkTour').innerHTML=t?`<button class="btn btn-line sm" data-tour="${t.id}"><span>Trip:</span> <span>${esc(t.name)}</span></button>`:'';
  paintNet();renderPanel();renderOutbox();
  const rb=$('#pkRelay');if(rb)rb.innerHTML=passesCard(cur.park,true)+relayCard(true)+`<a class="btn btn-line sm pk-cklink" href="#pack-${P.tour}" data-pack="${P.tour}">${ico('ranger',14)} <span>Safety check-in for this park</span></a><a class="btn btn-line sm pk-cklink" href="#host-new" data-hostnew>${ico('host',14)} <span>Are you a host near this park? Add your place</span></a>`;
  const useMap=window.L&&online();
  $('#pkMapWrap').classList.toggle('pk-offline',!useMap);
  $('#pkOffNote').hidden=useMap;
  if(useMap){$('#pkPlan').hidden=true;$('#pkMap').hidden=false;drawMap();}
  else{$('#pkMap').hidden=true;$('#pkPlan').hidden=false;drawPlan();}
}
function drawPlan(){const {svg}=parkSvg(cur.park,{hosts:cur.layers.host?hostsOf(cur.park):[],me:nearPark(cur.park)?me:null,crowd:srv().filter(r=>r.park===cur.park&&(r.kind==='nosig'||r.kind==='sigok'))});$('#pkPlan').innerHTML=svg;
  $('#pkPlan').querySelectorAll('.pk-svgh').forEach(g=>{g.setAttribute('tabindex','0');g.setAttribute('role','button');g.onclick=()=>selectHost(g.dataset.hostid);});
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
  if(cur.layers.host)hostsOf(cur.park).forEach(h=>L.marker([h.lat,h.lng],{icon:L.divIcon({className:'',html:`<span class="pk-mk pk-host${cur.selHost===h.id?' sel':''}${h.verified?'':' new'}">${ico('host',18)}</span>`,iconSize:[34,34],iconAnchor:[17,17]}),title:tx(h.name),keyboard:true,riseOnHover:true}).addTo(pmap.g).on('click',()=>selectHost(h.id)));
  if(cur.mode==='spot'&&cur.spot)L.marker([cur.spot.lat,cur.spot.lng],{icon:L.divIcon({className:'',html:'<span class="pk-pin" aria-hidden="true"></span>',iconSize:[26,34],iconAnchor:[13,32]}),draggable:true}).addTo(pmap.g).on('dragend',e=>{const p=e.target.getLatLng();cur.spot={lat:p.lat,lng:p.lng};});
  if(me&&nearPark(cur.park))pmap.me.setLatLng([me.lat,me.lng]).addTo(pmap.m);
  setTimeout(()=>pmap.m.invalidateSize(),60);
}
function selectHost(id){cur.selHost=id;cur.sel=null;cur.mode=null;renderPanel();if(!$('#pkMap').hidden)drawMap();else drawPlan();if(window.innerWidth<860)$('#pkPanel').scrollIntoView({behavior:'smooth',block:'nearest'});}
function select(fid){cur.sel=fid;cur.selHost=null;cur.mode=null;cur.photo=null;renderPanel();if(!$('#pkMap').hidden)drawMap();else drawPlan();
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
  if(cur.selHost&&hostById(cur.selHost)){box.innerHTML=hostCard(hostById(cur.selHost),nearPark(cur.park)?me:null);return;}
  if(!cur.sel){
    const all=srv().concat(outbox());const issues=P.f.map(f=>({f,s:fstat(cur.park,f.id,all)})).filter(x=>x.s.s==='bad'||x.s.s==='warn');
    const near=['toilet','water','signal'].map(tp=>{const n=nearest(cur.park,tp,nearPark(cur.park)?me:null);return n?`<li>${ico(tp,16)} <span>${tp==='signal'?'Nearest signal':tp==='toilet'?'Nearest toilet':'Nearest water'}</span>: <b translate="no">${fmtDist(n.m)}</b> ${N(dirName(n.b))} <small class="muted">${esc(n.f.n)}</small></li>`:`<li>${ico(tp,16)} <span>${tp==='water'?'No drinking water in this park':'No signal zone in this park'}</span></li>`;}).join('');
    box.innerHTML=`<div class="pk-ph"><span class="pk-mk pk-ranger">${ico('ranger',18)}</span><div><b>Tap an icon on the map</b><small class="muted">See if it works now and report a problem in one tap.</small></div></div>
     <ul class="pk-near">${near}${hostNearLines(cur.park,nearPark(cur.park)?me:null)}</ul><p class="src pk-from">${nearPark(cur.park)?'Distances from your GPS position.':'Distances from the entrance. Turn on location in the park to measure from where you are.'}</p>
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
  if(!online())pkToast(`⏳ ${N(LL('Saved on your phone. It will be sent when there is signal.','已保存在手机上，有信号时会自动发送。','Auf dem Handy gespeichert. Wird gesendet, sobald es Netz gibt.','Сохранено в телефоне. Отправится, когда появится связь.','Телефонда сақталды. Байланыс болғанда жіберіледі.'))}`);
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
  const t=tourOf(tid),u=['./','index.html','manifest.webmanifest','assets/parks/parks.js','assets/parks/parks.css','assets/parks/qrcode.js','assets/parks/jsQR.js','assets/parks/config.js','assets/parks/i18n.js','assets/i18n/ru-kk.js','assets/theme.css','assets/parks/icon-192.png',
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
    const ch=new MessageChannel();ch.port1.onmessage=e=>{const d=e.data||{};pkToast(`✓ ${N(LL(`Saved for offline: ${d.ok} of ${d.total} files on your phone`,`已离线保存：${d.ok}/${d.total}个文件在您的手机上`,`Offline gespeichert: ${d.ok} von ${d.total} Dateien auf Ihrem Handy`,`Сохранено для офлайна: ${d.ok} из ${d.total} файлов в телефоне`,`Офлайнға сақталды: телефонда ${d.total} файлдың ${d.ok}`))}`);};
    navigator.serviceWorker.controller.postMessage({type:'pack',urls},[ch.port2]);
  }else pkToast(`✓ ${N(LL('Saved. Keep this page open, or add the site to your home screen for full offline use.','已保存。请保持此页面打开，或将网站添加到主屏幕以完全离线使用。','Gespeichert. Lassen Sie die Seite offen oder legen Sie sie auf den Startbildschirm, um sie ganz offline zu nutzen.','Сохранено. Не закрывайте страницу или добавьте сайт на главный экран, чтобы он работал полностью офлайн.','Сақталды. Бетті жаппаңыз немесе толық офлайн жұмыс үшін сайтты басты экранға қосыңыз.'))}`);
  rerender();
}
function removePack(tid){const p=load(PACKS,{});delete p[tid];save(PACKS,p);}
function openPack(tid,fromHistory){if(!tourOf(tid))return;cur.pack=tid;show('pack');markNav('');renderPack(tid);loadJsQR().catch(()=>{});if(!fromHistory)push({view:'pack',tour:tid});
  if(PARK_OF[tid])locate(()=>renderPack(tid,true));}
function qrSvg(text){try{const q=qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag({cellSize:4,margin:2,scalable:true});}catch(e){return '';}}
function renderPack(tid,soft){
  const t=tourOf(tid),pk=PARK_OF[tid],P=pk&&PARKS[pk],pack=load(PACKS,{})[tid],code=(pack&&pack.code)||null;
  const g=GUIDES.find(x=>x.tours.includes(tid));
  const plan=P?parkSvg(pk,{hosts:hostsOf(pk),me:nearPark(pk)?me:null}):null;
  const near=P?['toilet','water','signal','ranger'].map(tp=>{const n=nearest(pk,tp,nearPark(pk)?me:null);return n?`<li>${ico(tp,16)} <span>${tp==='signal'?'Nearest signal':tp==='toilet'?'Nearest toilet':tp==='water'?'Nearest water':'Nearest ranger'}</span>: <b translate="no">${fmtDist(n.m)}</b> ${N(dirName(n.b))}</li>`:'';}).join(''):'';
  const smsBody=me?`SOS. Samruk Travel group. My location: ${me.lat.toFixed(5)}, ${me.lng.toFixed(5)} https://maps.google.com/?q=${me.lat.toFixed(5)},${me.lng.toFixed(5)}`:'';
  const html=`
  <div class="pk-packhead">
    <div><div class="eyebrow">Offline trip pack</div><h1>${esc(t.name)}</h1>
    <p class="muted">${pack?`<span>Saved on this phone</span> ${N(new Date(pack.savedAt).toLocaleString(loc(),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}. <span>Everything on this page works without internet.</span>`:'<span>Not saved yet. Save it before you lose signal.</span>'}</p></div>
    <div class="pk-packbtns"><span class="pk-net"></span>${pack?`<button class="btn btn-line sm" data-savepack="${tid}">Update</button><button class="btn btn-line sm" data-unpack="${tid}">Remove</button>`:`<button class="btn btn-gold" data-savepack="${tid}">Save for offline</button>`}</div>
  </div>
  <div class="pk-packgrid">
    ${ckCard(tid)}
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
    ${relayCard()}
    ${P?passesCard(pk):''}
    ${P?`<section class="pk-card pk-wide"><div class="pk-planhead"><h3><span>Park plan:</span> <span>${esc(P.short)}</span></h3><a class="btn btn-line sm" href="#parks-${pk}" data-openpark="${pk}">Report a problem</a></div>
      ${plan.svg}
      <div class="pk-legend-s">${['toilet','bin','water','aid','ranger'].map(k=>`<span>${ico(k,14)} ${esc(FT[k])}</span>`).join('')}<span><i class="pk-sw g"></i>Good signal</span><span><i class="pk-sw w"></i>Weak signal</span><span><i class="pk-sw n"></i>No signal</span></div>
      <ul class="pk-near">${near}${hostNearLines(pk,nearPark(pk)?me:null)}</ul><p class="src">${nearPark(pk)?'Distances from your GPS position.':'Distances from the entrance. Your position appears on the plan when you are in the park.'} Schematic plan: positions of facilities are approximate.</p>
      <div class="pk-facts2"><div class="pk-fact">${ico('water',20)}<p>${esc(P.water)}</p></div><div class="pk-fact">${ico('signal',20)}<p>${esc(P.signal)}</p></div></div></section>`:''}
    <section class="pk-card"><h3>Day by day</h3><div class="days">${t.plan.map(([d,x])=>`<div class="day"><b>${esc(d)}</b><p>${esc(x)}</p></div>`).join('')}</div></section>
    <section class="pk-card"><h3>Leave no trace</h3><ul class="checklist pk-lnt">
      ${['Take a bag for your rubbish and carry it out if the bins are full','Use the toilets at the car park before the trail','Fill your water bottle before you start','Download this page and tell someone your plan','Stay on the marked trail'].map((x,i)=>`<li><label><input type="checkbox" data-lnt="${i}" ${(load('sr_lnt_'+tid,[]))[i]?'checked':''}><span>${esc(x)}</span></label></li>`).join('')}</ul></section>
    <section class="pk-card pk-wide"><h3>Kazakh phrases</h3><div class="pk-phr">${PHRASES.map(([kz,lat,en])=>`<div><b lang="kk" translate="no">${kz}</b><i translate="no">${lat}</i><span>${esc(en)}</span></div>`).join('')}</div></section>
  </div>`;
  const box=$('#packBox');if(soft&&box.querySelector('.pk-packgrid')&&document.activeElement&&box.contains(document.activeElement)&&document.activeElement.type==='checkbox')return;
  box.innerHTML=html;paintNet();
}

/* ---------- check-in and relay cards ---------- */
function hhmm(ts){return new Date(+ts).toLocaleTimeString(loc(),{hour:'2-digit',minute:'2-digit'});}
function dur(ms){const m=Math.max(0,Math.round(Math.abs(ms)/6e4)),h=Math.floor(m/60),mm=m%60;
  return h?LL(`${h} h ${mm} min`,`${h}小时${mm}分钟`,`${h} Std. ${mm} Min.`,`${h} ч ${mm} мин`,`${h} сағ ${mm} мин`):LL(`${mm} min`,`${mm}分钟`,`${mm} Min.`,`${mm} мин`,`${mm} мин`);}
function ckCard(tid){
  const ck=myCk(),now=Date.now(),last=load('sr_ck_last',null),pend=load(CKQ,[]).length;
  const note=`<p class="src pk-gpsnote">Phones do not let a website record GPS in the background, and iPhone is the strictest. Your last point is from the last time this page was open with location on, or from a traveler who relayed it.</p>`;
  if(ck&&ck.status==='out'){
    const over=now>ck.due;
    return `<section class="pk-card pk-ck${over?' over':''}"><h3>Safety check-in</h3>
      <p class="pk-ckstate">${over?`<span class="pk-st pk-st-bad">Overdue</span> ${N(LL(`by ${dur(now-ck.due)}: the alarm goes to your contact`,`已超时${dur(now-ck.due)}：警报会发给您的联系人`,`seit ${dur(now-ck.due)}: Der Alarm geht an Ihren Kontakt`,`на ${dur(now-ck.due)}: тревога уходит вашему контакту`,`${dur(now-ck.due)} кешікті: дабыл байланысыңызға жіберіледі`))}`
        :`<span class="pk-st pk-st-ok">In the park</span> ${N(LL(`back by ${hhmm(ck.due)}, in ${dur(ck.due-now)}`,`${hhmm(ck.due)}前返回，还剩${dur(ck.due-now)}`,`zurück bis ${hhmm(ck.due)}, in ${dur(ck.due-now)}`,`вернуться к ${hhmm(ck.due)}, через ${dur(ck.due-now)}`,`${hhmm(ck.due)} дейін оралу, ${dur(ck.due-now)} қалды`))}`}</p>
      <ul class="pk-near">
        <li>${ico('ranger',16)} ${ck.synced?'<span>The server has your plan and will text your contact if you are late.</span>':'<span>Waiting for signal to register your plan on the server.</span>'}</li>
        <li>${ico('spot',16)} ${last?`<span>Last point</span> ${N(`${last.lat.toFixed(4)}, ${last.lng.toFixed(4)} · ${ago(last.ts)}`)}${pend?' · <span>waiting for signal</span>':''}`:'<span>No GPS point yet. Turn on location.</span>'}</li>
        <li>${ico('signal',16)} <span>Contact:</span> ${N(esc(maskPhone(ck.contact)))}</li></ul>
      <div class="pk-acts"><button class="btn btn-gold sm" data-ck="back">I am back safe</button><button class="btn btn-line sm" data-ck="later">+1 hour</button>${me?'':'<button class="btn btn-line sm" data-locate>Turn on location</button>'}</div>${note}</section>`;
  }
  const t=new Date(now+4*H);t.setMinutes(Math.ceil(t.getMinutes()/15)*15,0,0);const def=new Date(t.getTime()-t.getTimezoneOffset()*6e4).toISOString().slice(0,16);
  const back=ck&&ck.status==='back'&&now-ck.backAt<12*H?`<p><span class="pk-st pk-st-ok">Back safe</span> ${N(hhmm(ck.backAt))}</p>`:'';
  return `<section class="pk-card pk-ck"><h3>Safety check-in</h3>${back}
    <p class="muted pk-small">Start it while you still have signal. If you are not back by your time, the server texts your contact your last GPS point. Nobody else sees the phone number.</p>
    <form class="pk-ckform" data-ckform="${tid}">
      <div class="field"><label for="ckName">Your name</label><input id="ckName" required maxlength="60" autocomplete="given-name" value="${esc(load('sr_ck_name',''))}"></div>
      <div class="field"><label for="ckPhone">Who gets the SMS</label><input id="ckPhone" required type="tel" maxlength="20" placeholder="+7 701 000 00 00" value="${esc(load('sr_ck_phone',''))}"></div>
      <div class="field"><label for="ckDue">Back by</label><input id="ckDue" required type="datetime-local" value="${def}"></div>
      <button class="btn btn-gold sm" type="submit">Start check-in</button>
    </form>${note}</section>`;
}
function relayCard(compact){
  const o=outbox().length,carried=outbox().filter(r=>r.src==='relay').length+load(CKQ,[]).filter(x=>x.src==='relay').length;
  return `<section class="${compact?'pk-panel':'pk-card'} pk-relay"><h3 class="${compact?'pk-h4':''}">Relay: no signal?</h3>
    <p class="muted pk-small">Pass your reports and last point to a traveler you meet. Their phone sends them as soon as it finds signal.</p>
    <div class="pk-acts"><button class="btn btn-gold sm" data-relay="show">${ico('signal',14)} <span>Show my QR</span></button><button class="btn btn-line sm" data-relay="scan">Scan a traveler's QR</button></div>
    ${carried?`<p class="src">${N(LL(`You carry ${carried} item${carried>1?'s':''} for other travelers.`,`您正在为其他游客携带${carried}条数据。`,`Sie tragen ${carried} Einträge für andere Reisende.`,`Вы везёте данные других туристов: ${carried}.`,`Басқа саяхатшылардың деректерін алып жүрсіз: ${carried}.`))}</p>`:''}</section>`;
}
/* modal: show my relay QR, or scan someone else's */
let scanStop=null,scanHandler=null;
function modal(html){let m=$('#pkModal');if(!m){m=document.createElement('div');m.id='pkModal';m.className='modal pk-modal';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-mclose]'))closeModal();});}
  m.innerHTML=`<div class="modal-box pk-mbox">${html}<button class="btn btn-line sm" data-mclose>Close</button></div>`;m.hidden=false;}
function closeModal(){if(scanStop){scanStop();scanStop=null;}const m=$('#pkModal');if(m)m.hidden=true;}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#pkModal')&&!$('#pkModal').hidden)closeModal();});
function showRelay(){
  const p=relayPayload();
  if(!p.n&&!p.c){modal(`<h3>Nothing to pass on</h3><p class="muted">No reports are waiting on this phone, and there is no check-in point to send.</p>`);return;}
  let svg='';try{const q=qrcode(0,'L');q.addData(p.text);q.make();svg=q.createSvgTag({cellSize:4,margin:3,scalable:true});}catch(e){}
  modal(`<h3>Show this to another traveler</h3><div class="pk-qr pk-qrbig" translate="no">${svg}</div>
    <p>${N(LL(`${p.n} report${p.n===1?'':'s'}${p.c?' and your last point':''}`,`${p.n}条反馈${p.c?'和您的最后位置':''}`,`${p.n} Meldung${p.n===1?'':'en'}${p.c?' und Ihr letzter Standort':''}`,`Отметок: ${p.n}${p.c?', и ваша последняя точка':''}`,`Белгілер: ${p.n}${p.c?', және соңғы нүктеңіз':''}`))}</p>
    <p class="muted pk-small">They open Samruk Travel, tap "Scan a traveler's QR" and point the camera here. Notes and photos stay on your phone.</p>`);
}
let jsqrP=null;function loadJsQR(){if(window.jsQR)return Promise.resolve();if(!jsqrP)jsqrP=new Promise((res,rej)=>{const sc=document.createElement('script');sc.src='assets/parks/jsQR.js';sc.onload=res;sc.onerror=()=>{jsqrP=null;sc.remove();rej();};document.head.appendChild(sc);});return jsqrP;}
function relayGot(text){const r=relayTake(text);if(!r){pkToast(N(LL('This QR is not a Samruk Travel relay code.','这不是 Samruk Travel 接力二维码。','Das ist kein Samruk-Travel-Staffelcode.','Это не QR-код эстафеты Samruk Travel.','Бұл Samruk Travel эстафета QR-коды емес.')));return false;}
  closeModal();pkToast(`✓ ${N(LL(`Received ${r.n} report${r.n===1?'':'s'}${r.c?' and a location':''}. They go out when you have signal.`,`已接收${r.n}条反馈${r.c?'和一个位置':''}，有信号时会发送。`,`${r.n} Meldung${r.n===1?'':'en'}${r.c?' und ein Standort':''} empfangen. Sie gehen raus, sobald Sie Netz haben.`,`Получено отметок: ${r.n}${r.c?' и точка':''}. Отправятся, когда появится связь.`,`Алынды: ${r.n} белгі${r.c?' және нүкте':''}. Байланыс пайда болғанда жіберіледі.`))}`);rerender();return true;}
async function scanRelay(handler,title){
  scanHandler=handler||relayGot;
  modal(`<h3>${esc(tx(title||"Scan a traveler's QR"))}</h3><div class="pk-scan"><video id="pkVideo" playsinline muted></video><div class="pk-scanframe" aria-hidden="true"></div></div>
    <p class="muted pk-small" id="pkScanMsg">Point the camera at the QR on the other phone.</p>
    <label class="btn btn-line sm">${ico('spot',14)} <span>Or take a photo of the QR</span><input type="file" accept="image/*" capture="environment" id="pkQrFile" class="vh"></label>`);
  try{await loadJsQR();}catch(e){$('#pkScanMsg').textContent=tx('The scanner did not load. Save the trip for offline first.');return;}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){$('#pkScanMsg').textContent=tx('No camera access here. Take a photo of the QR instead.');return;}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});}catch(e){$('#pkScanMsg').textContent=tx('No camera access here. Take a photo of the QR instead.');return;}
  const v=$('#pkVideo');if(!v){stream.getTracks().forEach(t=>t.stop());return;}v.srcObject=stream;await v.play().catch(()=>{});
  const c=document.createElement('canvas'),g=c.getContext('2d',{willReadFrequently:true});let live=true,raf=0;
  scanStop=()=>{live=false;cancelAnimationFrame(raf);stream.getTracks().forEach(t=>t.stop());};
  const tick=()=>{if(!live)return;if(v.readyState>=2&&v.videoWidth){const k=Math.min(1,720/Math.max(v.videoWidth,v.videoHeight));c.width=Math.round(v.videoWidth*k);c.height=Math.round(v.videoHeight*k);g.drawImage(v,0,0,c.width,c.height);
      const d=g.getImageData(0,0,c.width,c.height),r=jsQR(d.data,c.width,c.height,{inversionAttempts:'dontInvert'});if(r&&r.data&&scanHandler(r.data))return;}
    raf=requestAnimationFrame(tick);};tick();
}
async function scanFile(file){
  try{await loadJsQR();}catch(e){return;}
  const img=new Image(),url=URL.createObjectURL(file);await new Promise((r,j)=>{img.onload=r;img.onerror=j;img.src=url;}).catch(()=>{});
  const k=Math.min(1,1400/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
  const g=c.getContext('2d');g.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);const r=jsQR(g.getImageData(0,0,c.width,c.height).data,c.width,c.height);
  if(!r||!(scanHandler||relayGot)(r.data)){const m=$('#pkScanMsg');if(m)m.textContent=tx('No QR found in the photo. Try again closer.');}
}

/* ---------- OFFICE view: the park administration panel ---------- */
const omap={m:null,g:null,park:null};
function openOffice(pk,fromHistory){if(pk&&PARKS[pk])cur.office=pk;show('office');markNav('office');renderOffice();if(!fromHistory)push({view:'office',park:cur.office});}
function renderOffice(){
  const pk=cur.office,P=PARKS[pk],all=srv().filter(r=>r.park===pk),now=Date.now();
  $('#ofTabs').innerHTML=Object.keys(PARKS).map(k=>{const n=srv().filter(r=>r.park===k&&staffJob(r)&&r.status!=='done').length;return `<button class="chip" data-of="${k}" aria-pressed="${k===pk}">${esc(PARKS[k].short)} ${n?`<span class="pk-badge" translate="no">${n}</span>`:''}</button>`;}).join('');
  $('#ofName').textContent=P.name;$('#ofSample').hidden=false;
  const oh=$('#ofHosts');if(oh)oh.innerHTML=hostsOfficeCard(pk);
  const open=all.filter(r=>staffJob(r)&&r.status!=='done');
  const wc=new Set(open.filter(r=>r.f&&facility(pk,r.f).t==='toilet').map(r=>r.f)).size,bins=new Set(open.filter(r=>r.kind==='full'||(r.f&&facility(pk,r.f).t==='bin'&&r.kind==='litter')).map(r=>r.f)).size;
  const ns=all.filter(r=>r.kind==='nosig'&&now-r.ts<7*24*H).length;
  const done=all.filter(r=>r.status==='done'&&r.doneAt);const fix=done.length?done.reduce((s,r)=>s+(r.doneAt-r.ts),0)/done.length/H:0;
  const cks=checkins().filter(c=>c.park===pk||!c.park),over=cks.filter(c=>c.state==='overdue'),outN=cks.filter(c=>c.state==='out').length;
  $('#ofKpi').innerHTML=[[over.length,'Overdue visitors'],[open.length,'Open problems'],[wc,'Toilets to clean'],[bins,'Bins to empty or tidy'],[ns,'No-signal reports, 7 days'],[fix?fix.toFixed(1):'–','Average hours to fix']].map(([n,l],i)=>`<div class="pk-kpi${i<4&&n>0?' hot':''}${i===0&&n>0?' alarm':''}"><b class="num" translate="no">${n}</b><span>${esc(l)}</span></div>`).join('');
  /* safety check-ins: who is out, who is late; the server texts the contact (Twilio), the office sees the last point */
  $('#ofCk').innerHTML=cks.length?`<ul class="pk-cklist">${cks.sort((a,b)=>(a.state==='overdue'?0:a.state==='out'?1:2)-(b.state==='overdue'?0:b.state==='out'?1:2)||a.due_at-b.due_at).slice(0,8).map(c=>`<li class="pk-ckrow ${c.state}">
      <span class="pk-st ${c.state==='overdue'?'pk-st-bad':c.state==='out'?'pk-st-warn':'pk-st-ok'}">${c.state==='overdue'?'Overdue':c.state==='out'?'In the park':'Back safe'}</span>
      <div><b translate="no">${esc(c.name||'')}</b> <small class="muted" translate="no">${esc(c.contact_masked||'')}</small><br>
      <small class="muted">${c.state==='overdue'?N(LL(`due ${hhmm(c.due_at)}, late by ${dur(now-c.due_at)}`,`应于${hhmm(c.due_at)}返回，已超时${dur(now-c.due_at)}`,`fällig ${hhmm(c.due_at)}, ${dur(now-c.due_at)} zu spät`,`срок ${hhmm(c.due_at)}, опоздание ${dur(now-c.due_at)}`,`мерзімі ${hhmm(c.due_at)}, кешігу ${dur(now-c.due_at)}`)):c.state==='out'?N(LL(`back by ${hhmm(c.due_at)}`,`${hhmm(c.due_at)}前返回`,`zurück bis ${hhmm(c.due_at)}`,`вернуться к ${hhmm(c.due_at)}`,`${hhmm(c.due_at)} дейін оралу`)):N(hhmm(c.back_at||c.due_at))}
      ${c.last_ts?` · <span>last point</span> ${N(ago(+c.last_ts))}${c.last_src==='relay'?' <span class="pk-tag">via another traveler</span>':''}`:' · <span>no point yet</span>'}</small>
      ${c.state==='overdue'?`<br><small>${c.sms_sent_at?`<span>SMS sent to the contact</span> ${N(hhmm(c.sms_sent_at))}`:(API?'<span>SMS goes out when the Twilio key is added on the server</span>':'<span>Demo mode: the SMS is sent only with a server</span>')}</small>`:''}</div></li>`).join('')}</ul>`
    :'<p class="muted">Nobody has started a check-in for this park.</p>';
  /* group open issues by facility (or 80 m cells for spots) and rank: urgency × reports × age */
  const groups={};open.forEach(r=>{const key=r.f||('spot:'+(Math.round(r.lat/.0007))+':'+(Math.round(r.lng/.0009))+':'+r.kind);(groups[key]=groups[key]||{key,f:r.f&&facility(pk,r.f),rs:[]}).rs.push(r);});
  const G=Object.values(groups).map(g=>{const sev=Math.max(...g.rs.map(r=>K[r.kind].sev)),old=Math.min(...g.rs.map(r=>r.ts));const lat=g.rs.reduce((s,r)=>s+r.lat,0)/g.rs.length,lng=g.rs.reduce((s,r)=>s+r.lng,0)/g.rs.length;
    return Object.assign(g,{sev,old,lat,lng,score:sev*2+g.rs.length+Math.min(6,(now-old)/(8*H)),work:g.rs.every(r=>r.status==='work')});}).sort((a,b)=>b.score-a.score);
  $('#ofList').innerHTML=G.length?G.map(g=>{const kinds={};g.rs.forEach(r=>kinds[r.kind]=(kinds[r.kind]||0)+1);
    return `<li class="pk-of${g.work?' work':''}"><span class="pk-mk sm pk-${g.f?g.f.t:'spot'} pk-st-${g.sev>=3?'bad':'warn'}">${ico(g.f?g.f.t:'spot',14)}</span>
     <div class="pk-ofm"><b>${g.f?esc(g.f.n):'<span>Spot on the trail</span>'}</b><div class="pk-ofk">${Object.entries(kinds).map(([k,n])=>`<span class="pk-tag">${esc(K[k].l)}${n>1?` <b translate="no">×${n}</b>`:''}</span>`).join('')}</div>
     <small class="muted"><span>First report</span> ${N(ago(g.old))}${g.rs.some(r=>r.by==='you')?' · <span>includes reports sent from this phone</span>':''}${g.rs.some(r=>r.photo)?' · 📷':''}</small>
     <div class="pk-ofk">${g.rs.every(r=>r.by==='sample')?'<span class="pk-tag demo">Sample data</span>':`<span class="pk-tag live">${API?'Live':'This browser'}</span>`}${g.rs.some(r=>r.src==='relay')?'<span class="pk-tag">Carried by another traveler</span>':''}</div>
     ${g.rs.filter(r=>r.note||r.photo).slice(0,2).map(r=>`<div class="pk-ofnote">${r.photo?`<img src="${r.photo}" alt="">`:''}${r.note?`<span>“${esc(r.note)}”</span>`:''}</div>`).join('')}</div>
     <div class="pk-ofb">${g.work?'<span class="pk-st pk-st-ok">In progress</span>':`<button class="btn btn-line sm" data-work="${g.rs.map(r=>r.id).join(',')}">Send staff</button>`}<button class="btn btn-gold sm" data-done="${g.rs.map(r=>r.id).join(',')}">Mark fixed</button></div></li>`;}).join(''):'<li class="muted">No open problems. Good work.</li>';
  /* service round: nearest-neighbour route from the ranger post through toilets and bins that need work */
  const stops=G.filter(g=>g.f&&(g.f.t==='toilet'||g.f.t==='bin'||g.f.t==='water')),gate=P.f.find(f=>f.t==='ranger');let pos=gate,route=[],len=0;const left=stops.slice();
  while(left.length){let bi=0,bm=1e12;left.forEach((s,i)=>{const m=dist(pos.lat,pos.lng,s.lat,s.lng);if(m<bm){bm=m;bi=i;}});len+=bm;pos=left[bi];route.push(left.splice(bi,1)[0]);}
  if(route.length)len+=dist(pos.lat,pos.lng,gate.lat,gate.lng);
  $('#ofRound').innerHTML=route.length?`<ol class="pk-round"><li><b>${esc(gate.n)}</b></li>${route.map(s=>`<li><b>${esc(s.f.n)}</b> <small class="muted">${[...new Set(s.rs.map(r=>K[r.kind].l))].map(x=>`<span>${esc(x)}</span>`).join(', ')}</small></li>`).join('')}<li><span>Back to</span> <b>${esc(gate.n)}</b></li></ol><p class="muted"><span>About</span> ${N(fmtDist(len))} <span>on foot</span>, ${N(LL(`${route.length} stops`,`${route.length}个站点`,`${route.length} Stationen`,`${route.length} ${['точка','точки','точек'][route.length%10===1&&route.length%100!==11?0:route.length%10>1&&route.length%10<5&&(route.length%100<10||route.length%100>20)?1:2]}`,`${route.length} нүкте`))}.</p>`:'<p class="muted">Nothing to service right now.</p>';
  /* chart: reports by kind, 7 days */
  const by={};all.filter(r=>now-r.ts<7*24*H).forEach(r=>by[r.kind]=(by[r.kind]||0)+1);const mx=Math.max(1,...Object.values(by));
  $('#ofChart').innerHTML=Object.keys(K).filter(k=>by[k]).sort((a,b)=>by[b]-by[a]).map(k=>`<div class="pk-bar"><span>${esc(K[k].l)}</span><i style="--w:${(by[k]/mx*100).toFixed(1)}%" class="${K[k].sev?'':'good'}"></i><b class="num" translate="no">${by[k]}</b></div>`).join('')||'<p class="muted">No reports this week.</p>';
  /* by day */
  const days=[...Array(7)].map((_,i)=>{const d0=new Date(now-(6-i)*24*H);d0.setHours(0,0,0,0);const d1=d0.getTime()+24*H;return {d:d0,n:all.filter(r=>r.ts>=d0.getTime()&&r.ts<d1).length};});const dm=Math.max(1,...days.map(d=>d.n));
  $('#ofDays').innerHTML=days.map(d=>`<div class="pk-day"><i style="--h:${(d.n/dm*100).toFixed(0)}%"></i><b class="num" translate="no">${d.n}</b><span translate="no">${d.d.toLocaleDateString(loc(),{weekday:'short'})}</span></div>`).join('');
  /* signal gaps for the mobile operator: where visitors had no signal */
  const gaps={};all.filter(r=>r.kind==='nosig').forEach(r=>{const k=Math.round(r.lat/.0018)+':'+Math.round(r.lng/.0024);(gaps[k]=gaps[k]||{n:0,lat:0,lng:0});gaps[k].n++;gaps[k].lat+=r.lat;gaps[k].lng+=r.lng;});
  const GP=Object.values(gaps).map(g=>({n:g.n,lat:g.lat/g.n,lng:g.lng/g.n})).sort((a,b)=>b.n-a.n);
  $('#ofGaps').innerHTML=GP.length?`<ul class="pk-gaps">${GP.slice(0,5).map(g=>`<li>${ico('nosig',16)} <b translate="no">${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}</b> <span class="muted">·</span> ${N(LL(`${g.n} report${g.n>1?'s':''}`,`${g.n}条反馈`,`${g.n} Meldung${g.n>1?'en':''}`,`отметок: ${g.n}`,`белгі: ${g.n}`))}</li>`).join('')}</ul><button class="btn btn-line sm" data-csv>Download for the mobile operator (CSV)</button>`:'<p class="muted">No signal gaps reported.</p>';
  /* map */
  if(window.L&&online()){$('#ofMap').hidden=false;$('#ofPlan').hidden=true;
    if(!omap.m){omap.m=L.map('ofMap',{scrollWheelZoom:false});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(omap.m);}
    if(omap.park!==pk){omap.m.setView(P.c,P.z);omap.park=pk;}
    if(omap.g)omap.g.remove();omap.g=L.layerGroup().addTo(omap.m);
    P.f.forEach(f=>L.circleMarker([f.lat,f.lng],{radius:4,color:'#5A6B7B',weight:1,fillOpacity:.6}).addTo(omap.g).bindTooltip(tx(f.n)));
    GP.forEach(g=>L.circle([g.lat,g.lng],{radius:60+g.n*20,color:'#7a7f87',weight:1,dashArray:'4 4',fillOpacity:.12,interactive:false}).addTo(omap.g));
    G.forEach(g=>L.circleMarker([g.lat,g.lng],{radius:8+Math.min(18,g.rs.length*3),color:g.sev>=3?'#C2453A':'#D99A1E',weight:2,fillOpacity:.35}).addTo(omap.g).bindTooltip(`${g.f?tx(g.f.n):tx('Spot on the trail')} · ${g.rs.length}`));
    hostsOf(pk).forEach(h=>L.marker([h.lat,h.lng],{icon:L.divIcon({className:'',html:`<span class="pk-mk sm pk-host">${ico('host',14)}</span>`,iconSize:[26,26],iconAnchor:[13,13]})}).addTo(omap.g).bindTooltip(tx(h.name)));
    cks.filter(c=>c.last_lat!=null&&c.state!=='back').forEach(c=>L.marker([c.last_lat,c.last_lng],{icon:L.divIcon({className:'',html:`<span class="pk-person ${c.state}" aria-hidden="true">${esc((c.name||'?')[0])}</span>`,iconSize:[30,30],iconAnchor:[15,15]})}).addTo(omap.g).bindTooltip(`${c.name} · ${tx(c.state==='overdue'?'Overdue':'In the park')}`));
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
  if($('#view-host')&&!$('#view-host').hidden&&!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#hostBox input,#hostBox select')))renderHost();
  if($('#view-tour')&&!$('#view-tour').hidden&&st.tour)onTour(st.tour);
  paintHome();paintNet();
}

/* ---------- FACILITIES FROM LOCAL HOSTS ----------
   Guesthouses and cafés next to a park open their toilet, shower, water, charging and Wi-Fi to day visitors
   for a small fee. The park gets more facilities without new building, the hosts earn, and a host's Wi-Fi
   is a place with signal. A visitor buys a pass while online; the pass is a QR that works with no signal,
   and the host checks it on their own phone, also with no signal. Hosts and prices here are sample data. */
const SVC={toilet:{l:'Toilet',p:200},shower:{l:'Shower',p:1000},water:{l:'Water refill, 1.5 L',p:300},charge:{l:'Phone charging, 1 h',p:500},wifi:{l:'Wi-Fi, 1 h',p:500},parking:{l:'Parking',p:1000},meal:{l:'Hot meal',p:2500}};
Object.assign(ICO,{
 host:'<path d="M3.5 11 12 4l8.5 7v9h-6v-5.5h-5V20h-6z" fill="currentColor"/>',
 shower:'<path d="M5 20V8a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4M11 8h8M13 11v2M16 11v2M19 11v2M14 15v2M17 15v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 charge:'<path d="M13 2 5 13.5h6L10 22l8-11.5h-6z" fill="currentColor"/>',
 wifi:'<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="19.3" r="1.7" fill="currentColor"/>',
 meal:'<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1.5-3 4-3 7h3v11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
});
const SVC_ICO={toilet:'toilet',shower:'shower',water:'water',charge:'charge',wifi:'wifi',parking:'parking',meal:'meal'};
const HOSTS0=[
 {id:'h-kgate',park:'kolsai',name:'Yurt café at the lake gate',village:'Kolsai, lower lake',lat:42.99985,lng:78.33155,hours:'08:00–21:00',rating:4.6,s:{toilet:200,water:300,charge:500,meal:2500}},
 {id:'h-saty1',park:'kolsai',name:'Saty Ui guesthouse',village:'Saty village',lat:43.0560,lng:78.4110,hours:'07:00–23:00',rating:4.8,s:{toilet:200,shower:1000,water:300,charge:500,wifi:500,parking:1000,meal:3000}},
 {id:'h-saty2',park:'kolsai',name:'Aigul homestay',village:'Saty village',lat:43.0545,lng:78.4135,hours:'08:00–22:00',rating:4.7,s:{toilet:150,shower:800,wifi:400}},
 {id:'h-ctop',park:'charyn',name:'Guesthouse by the top car park',village:'Charyn, top car park',lat:43.3542,lng:79.0716,hours:'08:00–20:00',rating:4.5,s:{toilet:200,water:300,charge:500,wifi:500}},
 {id:'h-criv',park:'charyn',name:'Canyon yurt camp by the river',village:'Charyn, river',lat:43.3583,lng:79.0899,hours:'09:00–21:00',rating:4.4,s:{toilet:200,shower:1200,meal:2800}},
 {id:'h-bal',park:'bigalmaty',name:'Tea house on the lake road',village:'Big Almaty gorge',lat:43.0598,lng:76.9816,hours:'09:00–19:00',rating:4.6,s:{toilet:200,water:300,meal:2200}},
 {id:'h-bur1',park:'burabay',name:'Okzhetpes guesthouse',village:'Burabay village',lat:53.0823,lng:70.2928,hours:'07:00–23:00',rating:4.7,s:{toilet:150,shower:800,charge:400,wifi:400,parking:800}},
 {id:'h-bur2',park:'burabay',name:'Blue Bay lakeside café',village:'Blue Bay',lat:53.0880,lng:70.2556,hours:'10:00–20:00',rating:4.3,s:{toilet:200,water:300,meal:2600}},
 {id:'h-alt1',park:'altynemel',name:'Yurt camp at the dune car park',village:'Singing Dune',lat:43.8651,lng:78.5566,hours:'08:00–20:00',rating:4.5,s:{toilet:200,water:400,charge:500}},
 {id:'h-alt2',park:'altynemel',name:'Basshi village guesthouse',village:'Basshi village',lat:44.1705,lng:78.7635,hours:'07:00–23:00',rating:4.8,s:{toilet:150,shower:900,wifi:400,meal:2800}}
];
const HST='sr_hosts_state',HMINE='sr_hosts_mine',HCACHE='sr_hosts_cache',PMINE='sr_passes_mine',PQ='sr_passes_q',PSRV='sr_passes_srv',PCACHE='sr_passes_cache',HME='sr_host_me';
/* every host with its current services: {svc:{p:price, open:bool}} */
function hosts(){
  const st=load(HST,{}),srvRows=API?load(HCACHE,[]):[],byId={};
  HOSTS0.forEach(h=>{byId[h.id]=Object.assign({sample:1,verified:1},h,{svc:Object.fromEntries(Object.entries(h.s).map(([k,p])=>[k,{p,open:true}]))});});
  load(HMINE,[]).concat(srvRows).forEach(r=>{const b=byId[r.id]||{},clean=Object.fromEntries(Object.entries(r).filter(([k,v])=>v!==null&&v!==undefined));
    byId[r.id]=Object.assign({},b,clean,{svc:Object.assign({},b.svc||{},r.svc||{}),verified:!!(b.verified||r.verified)});});
  for(const id in st)if(byId[id])byId[id].svc=Object.assign({},byId[id].svc,st[id]);
  return Object.values(byId);
}
const hostsOf=pk=>hosts().filter(h=>h.park===pk);
const hostById=id=>hosts().find(h=>h.id===id);
const kzt=n=>`${Math.round(n).toLocaleString('ru-RU')} ₸`;
/* pass check: a short code from the pass fields. Demo only: a real version signs passes on the server with a secret key */
function passSig(id,host,svc,price){let h=5381;for(const ch of `${id}|${host}|${svc}|${price}|samruk-demo`)h=((h*33)^ch.charCodeAt(0))>>>0;return h.toString(36).toUpperCase().padStart(6,'0').slice(0,6);}
const passText=p=>`SRPASS1:${p.id}:${p.host}:${p.svc}:${p.price}:${p.sig}`;
const passCode=p=>`${p.id.slice(-5).toUpperCase()}-${p.sig}`;
function seedPasses(){
  if(load('sr_pass_seed',0)===1)return;let s=11;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;const now=Date.now(),out=[];
  HOSTS0.forEach(h=>{const ks=Object.keys(h.s);for(let i=0;i<14+Math.floor(rnd()*22);i++){const svc=ks[Math.floor(rnd()*ks.length)],ts=Math.round(now-rnd()*7*24*H),id='q'+out.length+'x'+h.id.slice(2);
    out.push({id,host:h.id,svc,price:h.s[svc],ts,sig:passSig(id,h.id,svc,h.s[svc]),status:rnd()<.85?'used':'paid',usedAt:ts+Math.round(rnd()*5*H),sample:1});}});
  save(PSRV,out);save('sr_pass_seed',1);
}
/* all passes the office and the hosts know about */
function passes(){const by={};(API?load(PCACHE,[]):[]).concat(load(PSRV,[]),load(PMINE,[])).forEach(p=>{const o=by[p.id];if(!o||(p.status==='used'&&o.status!=='used'))by[p.id]=Object.assign({},o||{},p);});return Object.values(by);}
function pq(op){const q=load(PQ,[]);q.push(op);save(PQ,q);if(online())sync();}
async function pushPasses(){
  const q=load(PQ,[]);if(!q.length)return false;const done=[];
  for(const op of q){
    if(API){
      if(op.op==='pass')await rest('passes?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify([{id:op.p.id,host:op.p.host,svc:op.p.svc,price:op.p.price,ts:op.p.ts,sig:op.p.sig}])});
      else if(op.op==='use')await rest(`passes?id=eq.${op.id}&status=eq.paid`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'used',used_at:op.at})});
      else if(op.op==='host')await rest('hosts?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([op.h])});
    }else{
      const s=load(PSRV,[]);
      if(op.op==='pass'&&!s.some(x=>x.id===op.p.id))s.push(Object.assign({},op.p));
      if(op.op==='use'){const x=s.find(x=>x.id===op.id);if(x&&x.status!=='used')Object.assign(x,{status:'used',usedAt:op.at});else if(!x&&op.p)s.push(Object.assign({},op.p,{status:'used',usedAt:op.at}));}
      save(PSRV,s);
    }
    done.push(op);
  }
  save(PQ,load(PQ,[]).filter(x=>!done.includes(x)&&!done.some(d=>JSON.stringify(d)===JSON.stringify(x))));return true;
}
async function pullHosts(){if(!API||!online())return false;
  const [hs,ps]=await Promise.all([rest('hosts?select=*'),rest(`passes?select=*&ts=gte.${Date.now()-8*24*H}&order=ts.desc&limit=2000`)]);
  const next=JSON.stringify([hs,ps]);if(next===pullHosts.sig)return false;pullHosts.sig=next;
  save(HCACHE,hs.map(r=>({id:r.id,park:r.park,name:r.name,village:r.village,lat:r.lat,lng:r.lng,hours:r.hours,phone:r.phone,svc:r.svc||{},verified:!!r.verified,rating:r.rating||null})));
  save(PCACHE,ps.map(r=>({id:r.id,host:r.host,svc:r.svc,price:+r.price,ts:+r.ts,sig:r.sig,status:r.status,usedAt:r.used_at?+r.used_at:null})));return true;}
function buyPass(hid,svc){
  const h=hostById(hid);if(!h||!h.svc[svc]||!h.svc[svc].open)return;
  if(!online()){pkToast(N(LL('Buying needs signal. Buy passes before you go, or pay the host in cash.','购买需要信号。请出发前购买，或现场向接待方付现金。','Kaufen braucht Netz. Kaufen Sie Pässe vorher oder zahlen Sie bar beim Gastgeber.','Для покупки нужна связь. Купите пропуск заранее или заплатите хозяину наличными.','Сатып алу үшін байланыс керек. Рұқсатты алдын ала алыңыз немесе қожайынға қолма-қол төлеңіз.')));return;}
  const id=rid('p'),price=h.svc[svc].p,p={id,host:hid,svc,price,ts:Date.now(),sig:passSig(id,hid,svc,price),status:'paid',park:h.park};
  const m=load(PMINE,[]);m.unshift(p);save(PMINE,m.slice(0,40));pq({op:'pass',p});showPass(id);rerender();
}
function myPasses(pk){return load(PMINE,[]).filter(p=>!pk||((hostById(p.host)||{}).park===pk));}
function passState(p){const k=passes().find(x=>x.id===p.id);return k&&k.status==='used'?'used':p.status;}
function showPass(id){
  const p=load(PMINE,[]).find(x=>x.id===id);if(!p)return;const h=hostById(p.host)||{name:p.host};const used=passState(p)==='used';
  modal(`<h3>${esc(SVC[p.svc].l)}</h3><p><b>${esc(h.name)}</b> · ${N(kzt(p.price))}</p>
    <div class="pk-qr pk-qrbig${used?' used':''}" translate="no">${qrSvg(passText(p))}</div>
    <p translate="no"><b>${passCode(p)}</b></p>
    <p>${used?'<span class="pk-st">Used</span>':'<span class="pk-st pk-st-ok">Paid · not used yet</span>'}</p>
    <p class="muted pk-small">Show this QR to the host. It opens with no signal, and the host checks it with no signal too.</p>`);
}
function hostCard(h,from){
  const P=PARKS[h.park],o=from||{lat:P.f[0].lat,lng:P.f[0].lng},m=dist(o.lat,o.lng,h.lat,h.lng),mineP=myPasses().filter(p=>p.host===h.id&&passState(p)!=='used');
  return `<div class="pk-ph"><span class="pk-mk pk-host">${ico('host',18)}</span><div><b>${esc(h.name)}</b><small class="muted"><span>${esc(h.village||'')}</span> · ${N(fmtDist(m)+' '+dirName(bearing(o.lat,o.lng,h.lat,h.lng)))}</small></div><button class="pk-x" data-close aria-label="${esc(tx('Close'))}">×</button></div>
   <p class="pk-now">${h.verified?'<span class="pk-st pk-st-ok">Checked by the park</span>':'<span class="pk-st pk-st-warn">New, not checked yet</span>'} ${h.rating?`<span class="stars" translate="no">★ ${h.rating}</span>`:''} <span class="muted">· ${N(esc(h.hours||''))}</span></p>
   <h4 class="pk-h4">Facilities for visitors</h4>
   <ul class="pk-svcs">${Object.entries(h.svc).map(([k,v])=>`<li class="${v.open?'':'off'}"><span class="pk-svci">${ico(SVC_ICO[k],16)}</span><span class="pk-svcn">${esc(SVC[k].l)}</span><b translate="no">${kzt(v.p)}</b>${v.open?`<button class="btn btn-gold sm" data-buy="${h.id}|${k}">Buy pass</button>`:'<span class="pk-st">Closed now</span>'}</li>`).join('')}</ul>
   ${mineP.length?`<div class="pk-acts">${mineP.map(p=>`<button class="btn btn-line sm" data-showpass="${p.id}">${ico(SVC_ICO[p.svc],14)} <span>Show my pass</span></button>`).join('')}</div>`:''}
   <p class="src">Pay by card or Kaspi while you have signal (demo: nothing is charged), or pay the host in cash. Sample host for the prototype.</p>`;
}
function passesCard(pk,compact){
  const ps=myPasses(pk);if(!ps.length)return '';
  return `<section class="${compact?'pk-panel':'pk-card'} pk-mypass"><h3 class="${compact?'pk-h4':''}">Your passes</h3><ul class="pk-rec">${ps.slice(0,6).map(p=>{const h=hostById(p.host)||{name:p.host};const used=passState(p)==='used';
    return `<li><button class="pk-passrow" data-showpass="${p.id}"><span class="pk-svci">${ico(SVC_ICO[p.svc],16)}</span><span><b>${esc(SVC[p.svc].l)}</b><br><small class="muted">${esc(h.name)}</small></span>${used?'<span class="pk-st">Used</span>':'<span class="pk-st pk-st-ok">Ready</span>'}</button></li>`;}).join('')}</ul>
    <p class="src">Passes open with no signal.</p></section>`;
}

/* nearest paid facilities at hosts, for the "nearest" lists */
function hostNearLines(pk,from){const P=PARKS[pk],o=from||{lat:P.f[0].lat,lng:P.f[0].lng};
  return ['toilet','shower','wifi'].map(k=>{let best=null;hostsOf(pk).forEach(h=>{const v=h.svc[k];if(!v||!v.open)return;const m=dist(o.lat,o.lng,h.lat,h.lng);if(!best||m<best.m)best={h,m,v};});
    return best?`<li class="pk-hostline">${ico(SVC_ICO[k],16)} <span>${k==='toilet'?'Toilet at a local host':k==='shower'?'Shower at a local host':'Wi-Fi at a local host'}</span>: <b translate="no">${fmtDist(best.m)}</b> ${N('· '+kzt(best.v.p))} <button class="pk-linkbtn" data-hostsel="${best.h.id}">${esc(best.h.name)}</button></li>`:'';}).join('');}
/* office: how much hosts add to the park */
function hostsOfficeCard(pk){
  const hs=hostsOf(pk),ps=passes().filter(p=>hs.some(h=>h.id===p.host)&&Date.now()-p.ts<7*24*H);
  const cnt=k=>hs.filter(h=>h.svc[k]&&h.svc[k].open).length;
  return `<div class="pk-kpis pk-kpis4">${[[cnt('toilet'),'Extra toilets from hosts'],[cnt('shower'),'Showers'],[cnt('wifi'),'Wi-Fi points with signal'],[ps.filter(p=>p.status==='used').length,'Visitors served, 7 days']].map(([n,l])=>`<div class="pk-kpi"><b class="num" translate="no">${n}</b><span>${esc(l)}</span></div>`).join('')}</div>
   <ul class="pk-cklist">${hs.map(h=>`<li class="pk-ckrow"><span class="pk-mk sm pk-host">${ico('host',14)}</span><div><b>${esc(h.name)}</b> <small class="muted">${esc(h.village||'')}</small><br><small>${Object.entries(h.svc).filter(([k,v])=>v.open).map(([k])=>`<span>${esc(SVC[k].l)}</span>`).join(', ')}</small></div>
     ${h.verified?'<span class="pk-st pk-st-ok">Checked by the park</span>':`<button class="btn btn-gold sm" data-hverify="${h.id}">Mark as checked</button>`}</li>`).join('')}</ul>
   <p class="muted pk-small"><span>Income for hosts, 7 days:</span> ${N(kzt(ps.reduce((s,p)=>s+p.price,0)))}</p>`;
}
/* ---------- HOST CABINET: what a guesthouse owner sees on their phone ---------- */
const hcur={id:null,adding:false,pin:null};const hmap={m:null,g:null};
function openHost(id,fromHistory){const hs=hosts();hcur.id=(id&&hs.some(h=>h.id===id))?id:(load(HME,null)||HOSTS0[1].id);hcur.adding=id==='new';
  show('host');markNav('');renderHost();if(!fromHistory)push({view:'host',host:hcur.adding?'new':hcur.id});loadJsQR().catch(()=>{});}
function renderHost(){
  const box=$('#hostBox');if(!box)return;
  if(hcur.adding){renderHostAdd(box);return;}
  const h=hostById(hcur.id);if(!h){hcur.adding=true;renderHostAdd(box);return;}
  save(HME,h.id);
  const now=Date.now(),ps=passes().filter(p=>p.host===h.id),d0=new Date();d0.setHours(0,0,0,0);
  const today=ps.filter(p=>p.ts>=d0.getTime()),week=ps.filter(p=>now-p.ts<7*24*H),used=ps.filter(p=>p.status==='used'&&p.usedAt>=d0.getTime());
  const days=[...Array(7)].map((_,i)=>{const a=new Date(now-(6-i)*24*H);a.setHours(0,0,0,0);const b=a.getTime()+24*H;return {d:a,v:ps.filter(p=>p.ts>=a.getTime()&&p.ts<b).reduce((s,p)=>s+p.price,0)};});const mx=Math.max(1,...days.map(x=>x.v));
  const bySvc={};week.forEach(p=>bySvc[p.svc]=(bySvc[p.svc]||0)+1);
  box.innerHTML=`
  <div class="pk-top"><div><div class="eyebrow">Host cabinet <span class="demo-tag">Demo</span></div><h1>${esc(h.name)}</h1><p class="muted"><span>${esc(h.village||'')}</span> · <span>${esc(PARKS[h.park].short)}</span> ${h.verified?'· <span class="pk-st pk-st-ok">Checked by the park</span>':'· <span class="pk-st pk-st-warn">New, not checked yet</span>'}</p></div>
    <div class="pk-topr"><span class="pk-mode"></span><span class="pk-net"></span><label class="vh" for="hostPick">Your place</label><select id="hostPick" class="pk-select">${hosts().map(x=>`<option value="${x.id}" ${x.id===h.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select><button class="btn btn-line sm" data-hostnew>+ <span>Add your place</span></button></div></div>
  <div class="pk-kpis">${[[today.length,'Passes sold today'],[kzt(today.reduce((s,p)=>s+p.price,0)),'Income today'],[kzt(week.reduce((s,p)=>s+p.price,0)),'Income, 7 days'],[used.length,'Checked in today'],[Object.values(h.svc).filter(v=>v.open).length+' / '+Object.keys(h.svc).length,'Facilities open now'],[h.rating||'–','Rating']].map(([n,l])=>`<div class="pk-kpi"><b class="num" translate="no">${n}</b><span>${esc(l)}</span></div>`).join('')}</div>
  <div class="pk-ofgrid pk-hgrid">
    <section class="pk-card pk-wide"><h3>Facilities and prices</h3><p class="muted pk-small">Visitors see these on the park map. Close a facility when it is busy or being cleaned.</p>
      <ul class="pk-svcs pk-svcedit">${Object.keys(SVC).map(k=>{const v=h.svc[k];return `<li class="${v&&v.open?'':'off'}"><span class="pk-svci">${ico(SVC_ICO[k],16)}</span><span class="pk-svcn">${esc(SVC[k].l)}</span>
        ${v?`<label class="pk-price"><input type="number" min="0" step="50" value="${v.p}" data-hprice="${k}" aria-label="${esc(tx('Price'))}"> ₸</label><button class="btn ${v.open?'btn-gold':'btn-line'} sm" data-hopen="${k}" aria-pressed="${v.open}">${v.open?'Open':'Closed'}</button>`
          :`<button class="btn btn-line sm" data-hadd="${k}">+ <span>Offer this</span></button>`}</li>`;}).join('')}</ul></section>
    <section class="pk-card"><h3>Check a pass</h3><p class="muted pk-small">Scan the visitor's QR or type the code under it. Works with no signal.</p>
      <div class="pk-acts"><button class="btn btn-gold sm" data-hscan>Scan QR</button></div>
      <form class="pk-codeform" data-hcode><input id="hostCode" placeholder="ABCDE-123456" autocomplete="off" aria-label="${esc(tx('Pass code'))}"><button class="btn btn-line sm" type="submit">Check</button></form>
      <div id="hostCheck" aria-live="polite"></div></section>
    <section class="pk-card"><h3>Income, last 7 days</h3><div class="pk-days">${days.map(x=>`<div class="pk-day"><i style="--h:${(x.v/mx*100).toFixed(0)}%"></i><b class="num" translate="no">${x.v?Math.round(x.v/1000)+'k':'0'}</b><span translate="no">${x.d.toLocaleDateString(loc(),{weekday:'short'})}</span></div>`).join('')}</div>
      <div class="pk-bars">${Object.entries(bySvc).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<div class="pk-bar"><span>${esc(SVC[k].l)}</span><i style="--w:${(n/Math.max(...Object.values(bySvc))*100).toFixed(0)}%" class="good"></i><b class="num" translate="no">${n}</b></div>`).join('')}</div></section>
    <section class="pk-card"><h3>Recent passes</h3><ul class="pk-rec">${ps.sort((a,b)=>b.ts-a.ts).slice(0,7).map(p=>`<li><span>${esc(SVC[p.svc].l)}</span> <span class="muted">· ${N(kzt(p.price))} · ${N(ago(p.ts))}</span> ${p.status==='used'?'<span class="pk-st pk-st-ok">Checked in</span>':'<span class="pk-st">Paid</span>'}${p.sample?' <span class="pk-tag demo">Sample data</span>':''}</li>`).join('')||'<li class="muted">No passes yet.</li>'}</ul></section>
  </div>
  <p class="src pk-note">Prototype: hosts, prices and passes are sample data, and nothing is charged. The pass check here is a demo; a real version signs passes on the server, pays the host through Kaspi or a card, and the park checks every new place before it is marked "Checked by the park".</p>`;
  paintNet();
}
function renderHostAdd(box){
  const pk=hcur.pk||'kolsai';
  box.innerHTML=`<div class="pk-top"><div><div class="eyebrow">Host cabinet <span class="demo-tag">Demo</span></div><h1>Add your place</h1><p class="muted">Guesthouse, café or shop near a park: open your toilet, shower, water or Wi-Fi to day visitors and earn from it.</p></div>
    <div class="pk-topr">${hosts().length?'<button class="btn btn-line sm" data-hostback>← <span>Back to my cabinet</span></button>':''}</div></div>
  <form class="pk-card pk-hostform" data-hostform>
    <div class="grid2"><div class="field"><label for="hfName">Name of the place</label><input id="hfName" required maxlength="60" placeholder="For example: Altyn Saty guesthouse"></div>
    <div class="field"><label for="hfPark">Park nearby</label><select id="hfPark">${Object.keys(PARKS).map(k=>`<option value="${k}" ${k===pk?'selected':''}>${esc(PARKS[k].short)}</option>`).join('')}</select></div>
    <div class="field"><label for="hfVillage">Village or place</label><input id="hfVillage" maxlength="60"></div>
    <div class="field"><label for="hfHours">Opening hours</label><input id="hfHours" maxlength="20" value="08:00–21:00"></div></div>
    <fieldset class="pk-svcpick"><legend>What can visitors use?</legend>${Object.keys(SVC).map(k=>`<label><input type="checkbox" data-hfs="${k}" ${k==='toilet'?'checked':''}> ${ico(SVC_ICO[k],16)} <span>${esc(SVC[k].l)}</span> <input type="number" min="0" step="50" value="${SVC[k].p}" data-hfp="${k}" aria-label="${esc(tx('Price'))}"> ₸</label>`).join('')}</fieldset>
    <div><b>Where is it?</b> <span class="muted pk-small">Tap the map, or use your GPS.</span> <button class="btn btn-line sm" type="button" data-hgps>Use my location</button></div>
    <div class="map pk-map pk-hmap" id="hostMap" role="region" aria-label="${esc(tx('Map'))}"></div>
    <p class="src" id="hfPin">${hcur.pin?`${hcur.pin.lat.toFixed(5)}, ${hcur.pin.lng.toFixed(5)}`:''}</p>
    <button class="btn btn-gold" type="submit">Publish on the park map</button>
    <p class="src">New places show "New, not checked yet" until the park office checks them.</p>
  </form>`;
  if(window.L){const P=PARKS[pk];if(hmap.m){hmap.m.remove();hmap.m=null;}
    hmap.m=L.map('hostMap',{scrollWheelZoom:false}).setView(hcur.pin?[hcur.pin.lat,hcur.pin.lng]:P.c,13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(hmap.m);
    hmap.g=L.layerGroup().addTo(hmap.m);const pin=()=>{hmap.g.clearLayers();if(hcur.pin)L.marker([hcur.pin.lat,hcur.pin.lng],{icon:L.divIcon({className:'',html:`<span class="pk-mk pk-host">${ico('host',18)}</span>`,iconSize:[34,34],iconAnchor:[17,17]})}).addTo(hmap.g);const t=$('#hfPin');if(t)t.textContent=hcur.pin?`${hcur.pin.lat.toFixed(5)}, ${hcur.pin.lng.toFixed(5)}`:'';};
    hmap.m.on('click',e=>{hcur.pin={lat:e.latlng.lat,lng:e.latlng.lng};pin();});pin();hmap.pinFn=pin;setTimeout(()=>hmap.m.invalidateSize(),80);}
}
function hostSave(h){
  const st=load(HST,{});st[h.id]=h.svc;save(HST,st);
  const row={id:h.id,park:h.park,name:h.name,village:h.village||null,lat:h.lat,lng:h.lng,hours:h.hours||null,svc:h.svc};
  if(!h.sample){const m=load(HMINE,[]).filter(x=>x.id!==h.id);m.push(Object.assign({},row,{verified:!!h.verified}));save(HMINE,m);}
  pq({op:'host',h:row});bc('change');
}
function checkPassText(text,quiet){
  const h=hostById(hcur.id),out=$('#hostCheck');let m=/^SRPASS1:([a-z0-9]+):([a-z0-9-]+):(\w+):(\d+):([A-Z0-9]{6})$/.exec(String(text).trim()),p=null;
  if(m)p={id:m[1],host:m[2],svc:m[3],price:+m[4],sig:m[5]};
  else{const c=/^([A-Z0-9]{5})-([A-Z0-9]{6})$/i.exec(String(text).trim());if(c){const tail=c[1].toLowerCase(),sig=c[2].toUpperCase();
    const known=passes().find(x=>x.id.slice(-5)===tail&&x.sig===sig&&x.host===h.id);if(known)p=Object.assign({},known);}}
  const say=(ok,html)=>{if(out)out.innerHTML=`<div class="pk-check ${ok?'ok':'bad'}">${html}</div>`;pkToast(html);};
  if(!p){say(false,`✕ <span>Not a valid pass</span>`);return false;}
  if(p.host!==h.id){say(false,`✕ <span>This pass is for another place</span>`);return false;}
  if(!SVC[p.svc]||passSig(p.id,p.host,p.svc,p.price)!==p.sig){say(false,`✕ <span>Not a valid pass</span>`);return false;}
  const k=passes().find(x=>x.id===p.id);
  if(k&&k.status==='used'){say(false,`✕ <span>Already used</span> ${N(hhmm(k.usedAt||k.ts))}`);return false;}
  const at=Date.now(),s=load(PSRV,[]),x=s.find(y=>y.id===p.id);if(x)Object.assign(x,{status:'used',usedAt:at});else s.push(Object.assign({},p,{ts:at,status:'used',usedAt:at}));save(PSRV,s);
  const mp=load(PMINE,[]),y=mp.find(z=>z.id===p.id);if(y){y.status='used';save(PMINE,mp);}
  pq({op:'use',id:p.id,at,p});
  say(true,`✓ <span>Valid pass</span>: <b>${esc(SVC[p.svc].l)}</b> · ${N(kzt(p.price))}`);
  setTimeout(()=>{if(!$('#view-host').hidden)renderHost();},quiet?0:1600);return true;
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
  else if(x.view==='host')openHost(x.host,true);
  else if(x.view==='pack'){if(tourOf(x.tour))openPack(x.tour,true);else{show('home');}}
}

document.addEventListener('click',async e=>{
  const q=s=>e.target.closest(s);let b;
  if(b=q('[data-pk]')){cur.park=b.dataset.pk;cur.sel=null;cur.mode=null;renderParks();replace({view:'parks',park:cur.park});return;}
  if(b=q('[data-of]')){cur.office=b.dataset.of;renderOffice();replace({view:'office',park:cur.office});return;}
  if(b=q('[data-layer]')){const k=b.dataset.layer;cur.layers[k]=!cur.layers[k];renderParks();return;}
  if(b=q('[data-kind]')){submit(b.dataset.kind);return;}
  if(b=q('[data-sel]')){select(b.dataset.sel);return;}
  if(q('[data-close]')||q('[data-cancel]')){cur.sel=null;cur.selHost=null;cur.mode=null;cur.spot=null;renderParks();return;}
  if(q('[data-spot]')){cur.sel=null;cur.mode='spot';cur.spot=nearPark(cur.park)?{lat:me.lat,lng:me.lng,gps:1}:(pmap.m&&!$('#pkMap').hidden?(c=>({lat:c.lat,lng:c.lng}))(pmap.m.getCenter()):null);
    if(!cur.spot){const P=PARKS[cur.park];cur.spot={lat:P.c[0],lng:P.c[1]};}renderParks();return;}
  if(q('[data-gps]')||q('[data-locate]')){locate(p=>{if(!p)pkToast(N(LL('Location is off or not allowed. Turn it on to see where you are.','定位未开启或未授权，请开启以查看您的位置。','Standort ist aus oder nicht erlaubt. Schalten Sie ihn ein, um zu sehen, wo Sie sind.','Геолокация выключена или запрещена. Включите её, чтобы видеть, где вы.','Геолокация өшірулі немесе рұқсат жоқ. Қай жерде екеніңізді көру үшін қосыңыз.')));else if(!nearPark(cur.park)&&!$('#view-parks').hidden)pkToast(N(LL('You are not in this park now, so distances are counted from the entrance.','您现在不在这个公园里，所以距离从入口算起。','Sie sind gerade nicht in diesem Park, daher zählen die Entfernungen ab dem Eingang.','Вы сейчас не в этом парке, поэтому расстояния считаются от входа.','Сіз қазір бұл саябақта емессіз, сондықтан қашықтық кіреберістен есептеледі.')));rerender();});return;}
  if(q('[data-sync]')){if(!online())pkToast(N(LL('Still no signal. Reports stay on your phone and go out automatically.','仍然没有信号。反馈保存在手机上，会自动发送。','Noch kein Netz. Die Meldungen bleiben auf dem Handy und gehen automatisch raus.','Связи всё ещё нет. Отметки сохранены в телефоне и уйдут автоматически.','Байланыс әлі жоқ. Белгілер телефонда сақталған және автоматты түрде жіберіледі.')));else sync();return;}
  if(b=q('[data-savepack]')){savePack(b.dataset.savepack);return;}
  if(b=q('[data-unpack]')){removePack(b.dataset.unpack);renderPack(b.dataset.unpack);paintHome();return;}
  if(b=q('#dOffline')){const tid=b.dataset.tid;if(b.dataset.saved)openPack(tid);else{savePack(tid);}return;}
  if(b=q('#cOffline')){const tid=b.dataset.tid;savePack(tid);openPack(tid);return;}
  if(b=q('[data-pack]')){e.preventDefault();openPack(b.dataset.pack);return;}
  if(b=q('[data-openpark]')){e.preventDefault();openParks(b.dataset.openpark);return;}
  if((b=q('[data-tour]'))&&b.closest('#view-parks')){openTour(b.dataset.tour);return;}
  if(b=q('[data-work]')){setStatus(b.dataset.work.split(','),'work');return;}
  if(b=q('[data-done]')){setStatus(b.dataset.done.split(','),'done');pkToast(`✓ ${N(LL('Marked fixed. Visitors see it on the map.','已标记为已修复，游客会在地图上看到。','Als behoben markiert. Besucher sehen es auf der Karte.','Отмечено как исправленное. Посетители увидят это на карте.','Түзетілді деп белгіленді. Келушілер мұны картадан көреді.'))}`);return;}
  if(q('[data-csv]')){csv();return;}
  if(b=q('[data-relay]')){b.dataset.relay==='show'?showRelay():scanRelay();return;}
  if(b=q('[data-buy]')){const [h,k]=b.dataset.buy.split('|');buyPass(h,k);return;}
  if(b=q('[data-showpass]')){showPass(b.dataset.showpass);return;}
  if(b=q('[data-hostsel]')){selectHost(b.dataset.hostsel);return;}
  if(b=q('[data-hostnew]')){e.preventDefault();hcur.pk=cur.park;hcur.pin=null;openHost('new');return;}
  if(q('[data-hostback]')){hcur.adding=false;openHost(load(HME,null));return;}
  if(b=q('[data-hopen]')){const h=hostById(hcur.id);const k=b.dataset.hopen;h.svc[k].open=!h.svc[k].open;hostSave(h);renderHost();return;}
  if(b=q('[data-hadd]')){const h=hostById(hcur.id);const k=b.dataset.hadd;h.svc[k]={p:SVC[k].p,open:true};hostSave(h);renderHost();return;}
  if(q('[data-hscan]')){scanRelay(t=>{const ok=checkPassText(t);if(ok)closeModal();return ok;},'Scan the visitor\'s pass');return;}
  if(q('[data-hgps]')){locate(p2=>{if(p2&&hmap.pinFn){hcur.pin={lat:p2.lat,lng:p2.lng};hmap.m.setView([p2.lat,p2.lng],15);hmap.pinFn();}});return;}
  if(b=q('[data-hverify]')){const h=hostById(b.dataset.hverify);if(h){h.verified=true;if(h.sample){}else{const m=load(HMINE,[]);const x=m.find(y=>y.id===h.id);if(x)x.verified=true;save(HMINE,m);}pq({op:'host',h:{id:h.id,park:h.park,name:h.name,village:h.village||null,lat:h.lat,lng:h.lng,hours:h.hours||null,svc:h.svc,verified:true}});rerender();}return;}
  if(b=q('[data-ck]')){if(b.dataset.ck==='back'){ckBack();pkToast(`✓ ${N(LL('Welcome back! The alarm is off.','欢迎回来！警报已取消。','Willkommen zurück! Der Alarm ist aus.','С возвращением! Тревога отключена.','Қош келдіңіз! Дабыл өшірілді.'))}`);}
    else{const ck=myCk();if(ck){ck.due+=H;save(CK,ck);ckQueue({op:'start',id:ck.id,name:ck.name,contact:ck.contact,park:ck.park,tour:ck.tour,due:ck.due,lat:null,lng:null,ts:null});sync();}}rerender();return;}
  if(q('.pk-sim')){toggleSim();return;}
  if(b=q('[data-goview]')){const v=b.dataset.goview;if(v==='parks')openParks();else if(v==='office')openOffice();else if(v==='host')openHost();return;}
});
document.addEventListener('submit',e=>{
  if(e.target.closest('[data-hcode]')){e.preventDefault();checkPassText($('#hostCode').value,false);return;}
  const hf=e.target.closest('[data-hostform]');if(hf){e.preventDefault();
    const name=$('#hfName').value.trim(),svc={};hf.querySelectorAll('[data-hfs]').forEach(c=>{if(c.checked){const k=c.dataset.hfs;svc[k]={p:Math.max(0,+hf.querySelector(`[data-hfp="${k}"]`).value||0),open:true};}});
    if(!name||!Object.keys(svc).length||!hcur.pin){pkToast(N(LL('Add a name, at least one facility and the place on the map.','请填写名称、至少一项设施，并在地图上标出位置。','Geben Sie einen Namen, mindestens eine Einrichtung und den Ort auf der Karte an.','Укажите название, хотя бы одно удобство и место на карте.','Атауын, кемінде бір ыңғайлылықты және картадағы орнын көрсетіңіз.')));return;}
    const h={id:rid('h'),park:$('#hfPark').value,name,village:$('#hfVillage').value.trim(),hours:$('#hfHours').value.trim(),lat:+hcur.pin.lat.toFixed(5),lng:+hcur.pin.lng.toFixed(5),svc,verified:false};
    hostSave(h);save(HME,h.id);hcur.adding=false;hcur.id=h.id;replace({view:'host',host:h.id});renderHost();
    pkToast(`✓ ${N(LL('Published. Visitors see your place on the park map.','已发布，游客可以在公园地图上看到您的地点。','Veröffentlicht. Besucher sehen Ihren Ort auf der Parkkarte.','Опубликовано. Посетители видят ваше место на карте парка.','Жарияланды. Келушілер сіздің орныңызды саябақ картасынан көреді.'))}`);return;}
  const f=e.target.closest('[data-ckform]');if(!f)return;e.preventDefault();
  const name=$('#ckName').value.trim(),phone=$('#ckPhone').value.trim(),due=new Date($('#ckDue').value).getTime();
  if(!name||!/^\+?[0-9 ()-]{6,20}$/.test(phone)){pkToast(N(LL('Enter your name and a phone number for the SMS.','请填写姓名和接收短信的电话号码。','Geben Sie Ihren Namen und eine Telefonnummer für die SMS ein.','Введите имя и номер телефона для SMS.','Атыңызды және SMS үшін телефон нөмірін енгізіңіз.')));return;}
  if(!(due>Date.now()+5*6e4)){pkToast(N(LL('Pick a time later than now.','请选择晚于现在的时间。','Wählen Sie eine spätere Zeit.','Выберите время позже текущего.','Қазіргіден кейінгі уақытты таңдаңыз.')));return;}
  save('sr_ck_name',name);save('sr_ck_phone',phone);const tid=f.dataset.ckform;
  ckStart({name,contact:phone,due,park:PARK_OF[tid]||null,tour:tid});locate();
  pkToast(online()?`✓ ${N(LL('Check-in started. Have a good walk!','已开始报平安计时，祝您徒步愉快！','Check-in gestartet. Gute Wanderung!','Отметка начата. Хорошей прогулки!','Белгі басталды. Серуеніңіз сәтті болсын!'))}`:`⏳ ${N(LL('Saved. It reaches the server when there is signal.','已保存，有信号时会发送到服务器。','Gespeichert. Erreicht den Server, sobald es Netz gibt.','Сохранено. Уйдёт на сервер, когда появится связь.','Сақталды. Байланыс болғанда серверге жіберіледі.'))}`);
  rerender();});
document.addEventListener('change',async e=>{
  if(e.target.id==='pkQrFile'&&e.target.files[0]){scanFile(e.target.files[0]);return;}
  if(e.target.id==='hostPick'){hcur.id=e.target.value;replace({view:'host',host:hcur.id});renderHost();return;}
  if(e.target.id==='hfPark'){hcur.pk=e.target.value;if(hmap.m)hmap.m.setView(PARKS[hcur.pk].c,13);return;}
  if(e.target.dataset&&e.target.dataset.hprice){const h=hostById(hcur.id),k=e.target.dataset.hprice;h.svc[k].p=Math.max(0,Math.round(+e.target.value||0));hostSave(h);pkToast(`✓ ${N(LL('Price saved','价格已保存','Preis gespeichert','Цена сохранена','Баға сақталды'))}`);return;}
  if(e.target.id==='pkPhoto'&&e.target.files[0]){try{cur.photo=await readPhoto(e.target.files[0]);}catch(x){cur.photo=null;}const n=$('#pkNote')&&$('#pkNote').value;renderPanel();const d=$('#pkPanel details');if(d)d.open=true;if(n&&$('#pkNote'))$('#pkNote').value=n;}
  if(e.target.dataset&&e.target.dataset.lnt!==undefined&&cur.pack){const k='sr_lnt_'+cur.pack,v=load(k,[]);v[+e.target.dataset.lnt]=e.target.checked;save(k,v);}
});
$('#lang')&&$('#lang').addEventListener('change',()=>setTimeout(rerender,0));


/* service worker: makes the site and saved trips open with no signal */
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

seed();seedPasses();
window.PK={apply,onTour,onBooked,openParks,openOffice,openPack,openHost,PARKS,sync,_k:K};
paintHome();paintNet();sync();
if(window.__pkInit){apply(window.__pkInit);window.__pkInit=null;}
else if(st.tour&&!$('#view-tour').hidden)onTour(st.tour);
})();
