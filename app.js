/* 数学学习工作台 · 纯前端 / 无后端 / 数据全本地 */
(function(){
'use strict';

/* ---------------- 基础工具 ---------------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
const D  = window.APP_DATA;
const GUIDE = window.TOPIC_GUIDE || {};
const CALC = window.CALC_GUIDE || {};
const TASKS = D.tasks;
const TASKMAP = Object.fromEntries(TASKS.map(t=>[t.id,t]));
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const ISO = d => { const x=new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };
const TODAY = () => ISO(new Date());
const addDays = (iso,n) => { const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return ISO(d); };
const cnDate = iso => iso ? iso.slice(5).replace('-','月')+'日' : '';
const gcd = (a,b) => { a=Math.abs(a); b=Math.abs(b); while(b){ const t=a%b; a=b; b=t; } return a||1; };
const F = (n,d) => { if(!d) return '0'; const g=gcd(n,d); n/=g; d/=g; if(d<0){n=-n;d=-d;} return d===1?String(n):n+'/'+d; };
const coprimeN = d => { const a=[]; for(let i=1;i<d;i++) if(gcd(i,d)===1) a.push(i); return a.length?a[Math.floor(Math.random()*a.length)]:1; };
const NUM = n => String(Math.round(n*1e6)/1e6);
const R = (a,b) => a + Math.floor(Math.random()*(b-a+1));
const pick = a => a[R(0,a.length-1)];
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));

let toastTimer;
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.add('hidden'),2400);
}
function download(name, text, mime){
  const blob = new Blob([text], {type:mime||'application/json;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},400);
}

/* ---------------- 状态 ---------------- */
const KEY='mxwb.v1';
const DEF_SETTINGS = { oralCount:15, writtenCount:10, calcThreshold:90, wordThreshold:80,
                       requireWord:true, allowSkip:false, notify:false,
                       aiEnabled:false, aiEndpoint:'', aiModel:'', aiKey:'' };
function blank(){ return { settings:Object.assign({},DEF_SETTINGS), completed:{}, currentId:null,
                           calcSessions:[], wordItems:[], mistakes:[], library:[], progress:{} }; }
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw) return blank();
    const s=JSON.parse(raw);
    const b=blank();
    s.settings=Object.assign({},b.settings,s.settings||{});
    ['completed','progress'].forEach(k=>{ if(!s[k]||typeof s[k]!=='object') s[k]=b[k]; });
    ['calcSessions','wordItems','mistakes','library'].forEach(k=>{ if(!Array.isArray(s[k])) s[k]=[]; });
    return s;
  }catch(e){ return blank(); }
}
let S=load();
let storageFull=false;           // 网页存储配额是否已满（与磁盘剩余空间无关）
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); storageFull=false; save._alerted=false; }
  catch(e){
    storageFull=true;
    const msg='⚠ 本次改动没有保存成功！\n\n这是「浏览器分给本网页的存储空间」满了（通常 5–10MB），不是 C 盘磁盘满。\n备份功能不受影响，请现在就到「家长设置 → 导出备份文件」保存一份，再清理旧题目照片。';
    toast('⚠ 本次未保存：网页存储已满，请到家长设置导出备份');
    if(!save._alerted){ save._alerted=true; try{ alert(msg); }catch(_){} }
    updateStorageInfo();
  }
  scheduleSync();
}

/* ---------------- 跨设备同步（GitHub 文件同步，见 sync.js） ---------------- */
var SYNC_META_KEY='mxwb-sync-meta';
function syncMeta(){ try{ return JSON.parse(localStorage.getItem(SYNC_META_KEY))||{updatedAt:0}; }catch(e){ return {updatedAt:0}; } }
function setSyncMeta(m){ try{ localStorage.setItem(SYNC_META_KEY, JSON.stringify(m)); }catch(e){} }
var _syncTimer=null;
function scheduleSync(){
  if(!window.SYNC) return;
  if(_syncTimer) clearTimeout(_syncTimer);
  _syncTimer=setTimeout(doSyncPush, 800);   // 合并连续改动，避免每次保存都请求
}
function doSyncPush(){
  if(!window.SYNC) return;
  if(!SYNC.getToken()){ updateSyncChip('未配置同步'); return; }
  var payload={updatedAt:Date.now(), data: safeParse(localStorage.getItem(KEY))};
  SYNC.push(payload).then(function(r){
    if(r.ok){ setSyncMeta({updatedAt:payload.updatedAt}); SYNC.setLastSync({at:Date.now(),from:'push',updatedAt:payload.updatedAt}); updateSyncChip('已同步'); }
    else { updateSyncChip(r.reason==='no-token'?'未配置同步':'同步失败'); }
  }).catch(function(){ updateSyncChip('同步失败'); });
}
function updateSyncChip(text){
  var el=document.getElementById('syncChip'); if(!el) return;
  if(!window.SYNC){ el.textContent='同步未加载'; return; }
  var label=text||'';
  if(!label){ var ls=SYNC.lastSync();
    if(ls){ var d=new Date(ls.at), hh=('0'+d.getHours()).slice(-2), mm=('0'+d.getMinutes()).slice(-2);
      label='上次'+(ls.from==='pull'?'拉取':'同步')+' '+hh+':'+mm; }
    else label=SYNC.getToken()?'待同步':'未配置同步';
  }
  el.textContent=label;
}
function safeParse(s){ try{ return JSON.parse(s); }catch(e){ return null; } }

// 启动时：先渲染本地，再后台合并云端最新
function boot(){
  var local=localStorage.getItem(KEY);
  var localUpdatedAt=syncMeta().updatedAt||0;
  if(local){ try{ S=JSON.parse(local); }catch(e){} }
  renderAll();
  if(!window.SYNC || !SYNC.getToken()){ updateSyncChip('未配置同步'); return Promise.resolve(); }
  return SYNC.reconcile(localUpdatedAt, function(d){ S=d; try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} })
    .then(function(res){ if(res.applied){ renderAll(); toast('已从云端同步最新数据'); } updateSyncChip(res.applied?'已同步':'已是最新'); })
    .catch(function(){ updateSyncChip('同步异常'); });
}
function doSyncNow(){
  if(!window.SYNC){ toast('同步模块未加载'); return; }
  if(!SYNC.getToken()){ toast('请先在「家长设置」填入 GitHub 访问令牌'); var t=$('#setToken'); if(t) t.focus(); return; }
  var localUpdatedAt=syncMeta().updatedAt||0;
  return SYNC.reconcile(localUpdatedAt, function(d){ S=d; try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} })
    .then(function(res){
      if(res.applied){ renderAll(); }
      var payload={updatedAt:Date.now(), data:safeParse(localStorage.getItem(KEY))};
      return SYNC.push(payload).then(function(r){
        if(r.ok){ setSyncMeta({updatedAt:payload.updatedAt}); SYNC.setLastSync({at:Date.now(),from:'push',updatedAt:payload.updatedAt}); updateSyncChip('已同步'); toast(res.applied?'已从云端合并并同步成功':'已同步到云端'); }
        else { updateSyncChip('同步失败'); toast('同步失败：'+(r.detail||r.status||r.reason||'未知错误')); }
      });
    })
    .catch(function(e){ updateSyncChip('同步异常'); toast('同步异常：'+(e&&e.message||e)); });
}
function testSync(){
  if(!window.SYNC){ toast('同步模块未加载'); return; }
  if(!SYNC.getToken()){ toast('请先填入 GitHub 访问令牌'); return; }
  SYNC.pull().then(function(r){
    if(r.exists && !r.error){ toast('✅ 连接成功：已读到仓库中的 sync.json'); }
    else if(r.error){ toast('读到但出错：'+r.error); }
    else { toast('✅ 连接成功（仓库里还没有 sync.json，首次同步会创建）'); }
  }).catch(function(e){ toast('连接失败：'+(e&&e.message||e)); });
}

/* ---------------- 图片仓库：IndexedDB 优先，file:// 下自动降级到 localStorage ---------------- */
const IMG={
  _db:null, _idbOK:true, P:'mxwb:img:',
  open(){ return new Promise((res,rej)=>{
    if(this._db) return res(this._db);
    if(!this._idbOK||!window.indexedDB) return rej(new Error('no-idb'));
    let q;
    try{ q=indexedDB.open('mxwb-images',1); }catch(e){ this._idbOK=false; return rej(e); }
    q.onupgradeneeded=()=>{ if(!q.result.objectStoreNames.contains('imgs')) q.result.createObjectStore('imgs'); };
    q.onsuccess=()=>{ this._db=q.result; res(q.result); };
    q.onerror=()=>{ this._idbOK=false; rej(q.error); };
  });},
  lsKeys(){ try{ return Object.keys(localStorage).filter(k=>k.indexOf(this.P)===0); }catch(e){ return []; } },
  lsGet(k){ try{ return localStorage.getItem(this.P+k)||''; }catch(e){ return ''; } },
  async put(k,v){
    try{
      const db=await this.open();
      await new Promise((res,rej)=>{ const t=db.transaction('imgs','readwrite');
        t.objectStore('imgs').put(v,k); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error); });
    }catch(e){
      try{ localStorage.setItem(this.P+k,v); }
      catch(err){ throw new Error('网页存储空间不足：题目照片存不下。请先到「家长设置」导出备份，再用「启动工作台.bat」以 http 方式打开（照片容量大得多），或删掉几张旧题目图片'); }
    }
  },
  async get(k){
    try{ const db=await this.open(); return await new Promise((res,rej)=>{
      const q=db.transaction('imgs','readonly').objectStore('imgs').get(k);
      q.onsuccess=()=>res(q.result||''); q.onerror=()=>rej(q.error); }); }
    catch(e){ return this.lsGet(k); }
  },
  async all(){
    const out={};
    try{ const db=await this.open(); Object.assign(out, await new Promise((res,rej)=>{
      const o={}, q=db.transaction('imgs','readonly').objectStore('imgs').openCursor();
      q.onsuccess=e=>{ const c=e.target.result; if(c){ o[c.key]=c.value; c.continue(); } else res(o); };
      q.onerror=()=>rej(q.error); })); }catch(e){}
    this.lsKeys().forEach(k=>{ out[k.slice(this.P.length)]=localStorage.getItem(k)||''; });
    return out;
  },
  async del(k){
    try{ const db=await this.open(); await new Promise(res=>{
      const t=db.transaction('imgs','readwrite'); t.objectStore('imgs').delete(k);
      t.oncomplete=()=>res(); t.onerror=()=>res(); }); }catch(e){}
    try{ localStorage.removeItem(this.P+k); }catch(e){}
  },
  async clear(){
    try{ const db=await this.open(); await new Promise(res=>{
      const t=db.transaction('imgs','readwrite'); t.objectStore('imgs').clear();
      t.oncomplete=()=>res(); t.onerror=()=>res(); }); }catch(e){}
    this.lsKeys().forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
  }
};
async function compress(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
    const max=1100, sc=Math.min(1,max/Math.max(img.width,img.height));
    const c=document.createElement('canvas'); c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    return c.toDataURL('image/jpeg',0.72);
  } finally { URL.revokeObjectURL(url); }
}

/* ---------------- 计算题自动生成 ---------------- */
const GEN={
  decadd(kind){
    if(kind==='oral'){
      const A=R(11,89),B=R(11,89);
      if(Math.random()<.5) return {stem:`${NUM(A/10)} + ${NUM(B/10)} =`, ans:NUM((A+B)/10)};
      const x=Math.max(A,B),y=Math.min(A,B);
      return {stem:`${NUM(x/10)} − ${NUM(y/10)} =`, ans:NUM((x-y)/10)};
    }
    const A=R(101,989),B=R(101,989);
    if(Math.random()<.5) return {stem:`${NUM(A/100)} + ${NUM(B/100)} =`, ans:NUM((A+B)/100)};
    const x=Math.max(A,B),y=Math.min(A,B);
    return {stem:`${NUM(x/100)} − ${NUM(y/100)} =`, ans:NUM((x-y)/100)};
  },
  decmul(kind){
    if(kind==='oral'){
      if(Math.random()<.5){ const a=R(2,9),b=R(11,49); return {stem:`${a} × ${NUM(b/10)} =`, ans:NUM(a*b/10)}; }
      const a=R(11,99),k=pick([10,100,1000]); return {stem:`${NUM(a/10)} × ${k} =`, ans:NUM(a/10*k)};
    }
    const A=R(11,99),B=R(11,99);
    return {stem:`${NUM(A/10)} × ${NUM(B/10)} =`, ans:NUM(A*B/100)};
  },
  decdiv(kind){
    if(kind==='oral'){ const d=R(2,9),q=R(11,99); return {stem:`${NUM(q*d/10)} ÷ ${d} =`, ans:NUM(q/10)}; }
    const b=R(2,9),q=R(2,12),A=b*q;
    return {stem:`${NUM(A/10)} ÷ ${NUM(b/10)} =`, ans:String(q)};
  },
  decmix(kind){
    if(kind==='written'&&Math.random()<.5){
      const A=R(11,59),b=R(2,9),C=R(11,49);
      return {stem:`${NUM(A/10)} + ${b} × ${NUM(C/10)} =`, ans:NUM((A+b*C)/10)};
    }
    return pick([GEN.decadd,GEN.decmul,GEN.decdiv])(kind);
  },
  eq(kind){
    if(kind==='oral'){ const x=R(2,9),a=R(2,9),b=R(1,20); return {stem:`当 x = ${x} 时，${a}x + ${b} =`, ans:String(a*x+b)}; }
    if(Math.random()<.4){ const x=R(2,9),a=R(2,6),b=R(2,6); return {stem:`解方程 ${a}x + ${b}x = ${(a+b)*x}，x =`, ans:String(x)}; }
    const x=R(2,12),a=R(2,9),b=R(1,20);
    return {stem:`解方程 ${a}x + ${b} = ${a*x+b}，x =`, ans:String(x)};
  },
  numth(kind){
    const countDiv=n=>{let c=0;for(let i=1;i<=n;i++)if(n%i===0)c++;return c;};
    if(kind==='oral'){
      if(Math.random()<.5){ const a=R(4,60),b=R(4,60); return {stem:`${a} 和 ${b} 的最大公约数是`, ans:String(gcd(a,b))}; }
      const n=R(10,99); return {stem:`${n} 各位数字之和是`, ans:String(String(n).split('').reduce((s,c)=>s+Number(c),0))};
    }
    const a=R(4,60),b=R(4,60);
    if(Math.random()<.5) return {stem:`${a} 和 ${b} 的最小公倍数是`, ans:String(a*b/gcd(a,b))};
    const n=R(12,96); return {stem:`${n} 一共有几个因数？（填个数）`, ans:String(countDiv(n))};
  },
  fracbase(kind){
    if(kind==='oral'){
      const d=R(2,12),k=R(2,9),n=coprimeN(d);
      return {stem:`约分：${n*k}/${d*k} =（填最简分数，如 3/4）`, ans:F(n,d)};
    }
    const d1=R(2,9),d2=R(2,9),n1=coprimeN(d1),n2=coprimeN(d2),l=d1*d2/gcd(d1,d2);
    const a=n1*l/d1,b=n2*l/d2;
    return {stem:`比较大小：${n1}/${d1} ○ ${n2}/${d2}，○ 里填 > 或 < 或 =`, ans:a>b?'>':(a<b?'<':'=')};
  },
  fracadd(kind){
    const d1=R(2,9),d2=kind==='oral'?d1:R(2,9),n1=coprimeN(d1),n2=coprimeN(d2);
    const A=n1*d2,B=n2*d1,den=d1*d2;
    if(Math.random()<.5||A===B) return {stem:`${n1}/${d1} + ${n2}/${d2} =（填最简分数）`, ans:F(A+B,den)};
    const x=Math.max(A,B),y=Math.min(A,B);
    const big=x===A?`${n1}/${d1}`:`${n2}/${d2}`, small=x===A?`${n2}/${d2}`:`${n1}/${d1}`;
    return {stem:`${big} − ${small} =（填最简分数）`, ans:F(x-y,den)};
  },
  fracmul(kind){
    const d1=R(2,9),d2=R(2,9),n1=coprimeN(d1),n2=coprimeN(d2),k=R(2,9);
    const t=kind==='oral'?R(0,1):R(0,2);
    if(t===0) return {stem:`${n1}/${d1} × ${k} =（填最简分数）`, ans:F(n1*k,d1)};
    if(t===1) return {stem:`${n1}/${d1} × ${n2}/${d2} =（填最简分数）`, ans:F(n1*n2,d1*d2)};
    return {stem:`${n1}/${d1} ÷ ${n2}/${d2} =（填最简分数）`, ans:F(n1*d2,d1*n2)};
  },
  ratio(kind){
    if(kind==='oral'){ const k=R(2,9),a=R(1,9),b=R(1,9),g=gcd(a,b);
      return {stem:`化简比：${a*k} : ${b*k} =（写成 2:3 的形式）`, ans:`${a/g}:${b/g}`}; }
    const a=R(2,9),b=R(2,9),k=R(2,9);
    return {stem:`解比例：${a} : ${b} = x : ${b*k}，x =`, ans:String(a*k)};
  },
  percent(kind){
    if(kind==='oral'){ const p=pick([10,20,25,50,75]),n=pick([20,40,60,80,120]);
      return {stem:`${n} 的 ${p}% 是`, ans:NUM(n*p/100)}; }
    const price=pick([100,200,250,300,400]),off=pick([7,8,9]);
    return {stem:`原价 ${price} 元，打 ${off} 折后是（元）`, ans:NUM(price*off/10)};
  },
  junior(kind){
    if(kind==='oral'){
      if(Math.random()<.3){ const x=R(-15,15); return {stem:`|${x}| =`, ans:String(Math.abs(x))}; }
      const a=R(-12,12),b=R(-12,12);
      return {stem:`(${a}) + (${b}) =`, ans:String(a+b)};
    }
    const a=R(-9,9),b=R(2,9),c=R(-10,10);
    return {stem:`(${a}) × ${b} + (${c}) =`, ans:String(a*b+c)};
  },
  mixed(kind){
    const t=R(0,3);
    if(t===0){ const a=R(12,99),b=R(12,99); return {stem:`${a} + ${b} =`, ans:String(a+b)}; }
    if(t===1){ const a=R(12,99),b=R(2,9); return {stem:`${a} × ${b} =`, ans:String(a*b)}; }
    if(t===2) return GEN.decadd(kind);
    return GEN.fracadd(kind);
  }
};
/* 保温类任务（mixed / decmix）按阶段从已学知识点里随机抽，讲解页会把这个池子列出来 */
function poolForStage(s){
  return s<=1?['decadd','decmul','decdiv']
       : s===2?['decadd','decmul','decdiv','eq']
       : s===3?['decadd','fracbase','fracadd','numth']
       : s===4?['fracadd','fracmul','decdiv','eq']
       : s===5?['ratio','percent','fracmul']
       : s<=7?['fracmul','ratio','percent','numth']
       : ['junior','fracmul'];
}
function effectiveTag(task){
  const tag=task.calcTag;
  if(tag!=='mixed'&&tag!=='decmix') return tag;
  const s=parseInt(task.stage.slice(1),10)||1;
  return pick(poolForStage(s));
}
function makePaper(task, oralN, writtenN, fixedTag){
  const tag=fixedTag||effectiveTag(task), fn=GEN[tag]||GEN.mixed, items=[];
  for(let i=0;i<oralN;i++)  items.push(Object.assign({kind:'口算',tag:tag,key:uid()},fn('oral')));
  for(let i=0;i<writtenN;i++)items.push(Object.assign({kind:'笔算',tag:tag,key:uid()},fn('written')));
  return {tag:tag,items:items,at:new Date().toISOString()};
}
function norm(a){
  let s=String(a==null?'':a).trim()
    .replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))
    .replace(/[．｡]/g,'.').replace(/[，,\s]/g,'')
    .replace(/[−–—]/g,'-').replace(/：/g,':')
    .replace(/[＞]/g,'>').replace(/[＜]/g,'<').replace(/[＝]/g,'=')
    .replace(/。$/,'');
  if(/^-?\d+(\.\d+)?$/.test(s)) return 'N:'+String(Number(s));
  if(/^-?\d+\/\d+$/.test(s)){ const p=s.split('/').map(Number), f=F(p[0],p[1]);
    return /^-?\d+$/.test(f)?'N:'+String(Number(f)):'F:'+f; }
  if(/^-?\d+:-?\d+$/.test(s)){ const p=s.split(':').map(Number),g=gcd(p[0],p[1]); return 'R:'+(p[0]/g)+':'+(p[1]/g); }
  return 'S:'+s;
}
const isRight=(given,ans)=>norm(given)===norm(ans);

/* ---------------- 错题与 1/3/7 复习 ---------------- */
/* 计算题的 tag 是「小数加减」这类知识点名，筛「所属专题」时要归回对应专题 */
const CALC2TOPIC = { '小数加减':'小数计算','小数乘法':'小数计算','小数除法与四则':'小数计算','小数综合':'小数计算',
  '式与方程':'方程','数论基础':'数论','分数意义与约分通分':'分数计算','分数加减':'分数计算','分数乘除与混合':'分数计算',
  '比与比例':'比与比例','百分数':'百分数与浓度','有理数与初中计算':'有理数','综合保温':'综合' };
function topicTagOf(m){
  if(!m) return '综合';
  if(m.topicTag && D.keyPoints[m.topicTag]) return m.topicTag;
  const t=m.tag||'';
  if(D.keyPoints[t]) return t;
  if(CALC2TOPIC[t]) return CALC2TOPIC[t];
  return '综合';
}
function mkReviews(d){ return [1,3,7].map(day=>({day:day,due:addDays(d,day),done:null,ok:null})); }
function addMistake(o){
  const d=TODAY();
  const m={ id:uid(), date:d, taskId:o.taskId||'', stage:o.stage||'', tag:o.tag||'综合',
    topicTag:topicTagOf({tag:o.tag,topicTag:o.topicTag}), source:o.source||'', type:o.type||'calc',
    question:o.question||'', imageKey:o.imageKey||'', fileKey:o.fileKey||'', fileName:o.fileName||'', fileType:o.fileType||'',
    childAnswer:o.childAnswer||'', correctAnswer:o.correctAnswer||'',
    reason:o.reason||'思路错误', note:o.note||'', cycleStart:d, reviews:mkReviews(d), streak:0, status:'active', history:[] };
  S.mistakes.unshift(m); save(); return m;
}
/* 当场选错因：判分 / 判错的那一刻就把下拉摆出来，选完即时写回错题本，
   不用事后再去错题本里逐条「编辑错因」。 */
function reasonBarHTML(m){
  if(!m) return '';
  const cur=D.reasons.indexOf(m.reason)>=0?m.reason:D.reasons[0];
  return `<div class="reason-bar">
    <span class="rb-label">错因</span>
    <select class="paper-reason" data-id="${esc(m.id)}" aria-label="选择错因">
      ${D.reasons.map(r=>`<option value="${esc(r)}" ${cur===r?'selected':''}>${esc(r)}</option>`).join('')}
    </select>
    <input class="paper-note" data-id="${esc(m.id)}" type="text" value="${esc(m.note||'')}" placeholder="补一句具体原因（可不填）" aria-label="补充错因">
  </div>`;
}
function setMistakeField(id,field,value){
  const m=S.mistakes.find(x=>x.id===id); if(!m) return;
  m[field]=value; save(); renderAll();
  toast(field==='reason'?'✓ 已记下错因：'+value:'✓ 已记下备注');
}
function dueOf(m){ const r=(m.reviews||[]).find(x=>!x.done); return r?r.due:null; }
function isDue(m){ const d=dueOf(m); return m.status==='active' && !!d && d<=TODAY(); }
function reviewMistake(id,ok){
  const m=S.mistakes.find(x=>x.id===id); if(!m||m.status!=='active') return;
  const r=(m.reviews||[]).find(x=>!x.done); if(!r) return;
  r.done=TODAY(); r.ok=!!ok;
  if(ok){
    m.streak=(m.streak||0)+1;
    if(m.streak>=2){ m.status='graduated'; m.graduatedAt=TODAY(); }
  }else{
    m.streak=0; m.cycleStart=TODAY();
    m.history=(m.history||[]).concat([{at:TODAY(),reviews:m.reviews}]);
    m.reviews=mkReviews(TODAY());
  }
  save();
}
const activeMistakes = () => S.mistakes.filter(m=>m.status==='active');
const dueMistakes    = () => S.mistakes.filter(isDue);

/* ---------------- 任务与达标 ---------------- */
function currentTask(){
  if(S.currentId){ const t=TASKMAP[S.currentId]; if(t&&!S.completed[t.id]) return t; }
  const t=TASKS.find(x=>!S.completed[x.id]); S.currentId=t?t.id:null; save(); return t||null;
}
function canComplete(id){
  const s=S.settings;
  const sess=S.calcSessions.filter(x=>x.taskId===id);
  const last=sess[sess.length-1];
  const calcRate=last?last.rate:null;
  const calcOK=calcRate!==null && calcRate>=s.calcThreshold;
  const ws=S.wordItems.filter(x=>x.taskId===id&&x.verdict);
  const wordRate=ws.length?Math.round(ws.filter(w=>w.verdict==='correct').length/ws.length*100):null;
  const wordOK=!s.requireWord?true:(wordRate!==null&&wordRate>=s.wordThreshold);
  const passed=!!(S.progress[id]&&S.progress[id].passed);
  return {ok:passed||(calcOK&&wordOK),passed:passed,calcOK:calcOK,wordOK:wordOK,calcRate:calcRate,wordRate:wordRate,wordCount:ws.length};
}
function completeTask(id){
  const c=canComplete(id);
  if(!c.ok){ toast('还没达标，先完成练习'); return; }
  S.completed[id]={at:TODAY(),calcRate:c.calcRate,wordRate:c.wordRate};
  const next=TASKS.find(t=>!S.completed[t.id]);
  S.currentId=next?next.id:null; save(); renderAll();
  toast(next?`✓ ${id} 完成，已进入 ${next.id}`:'✓ 全部任务完成，太棒了！');
}
function typePill(t){
  const cls=t.type==='复盘节点'?'rev':(t.type==='阶段测试'||t.type==='套卷')?'test':'';
  return `<span class="pill ${cls}">${esc(t.type)}</span>`;
}
/* ---------------- 计算知识点讲解：和专题讲解并列，先学再练 ----------------
   计算类知识点也是「新学」内容，所以任务预览里必须能直接看到怎么算、例题、易错点，
   而不只是「生成题目」让孩子直接做。 */
function calcName(tag){ return (D.calcTagNames&&D.calcTagNames[tag])||tag||'计算'; }
function calcIsNew(t){
  if(t.calcTag==='mixed'||t.calcTag==='decmix') return false;  /* 保温节不标新学 */
  const first=TASKS.find(x=>x.calcTag===t.calcTag);
  return !!first&&first.id===t.id;
}
function calcStatus(t){
  return calcIsNew(t)?'<i class="calc-badge new">新学</i>':'<i class="calc-badge review">保温</i>';
}
function calcGuideHTML(tag,task){
  const g=CALC[tag]||{}, exs=g.examples||[];
  let related='';
  if((tag==='mixed'||tag==='decmix')&&task){
    const pool=poolForStage(parseInt(task.stage.slice(1),10)||1);
    related=`<div class="calc-related"><b>这套保温题会从下面这些已学知识点里随机抽，忘了哪个就点哪个回看：</b>
      <div class="chip-row">${pool.map(x=>`<button class="chip" data-action="calc-guide" data-id="${esc(x)}">${esc(calcName(x))} ›</button>`).join('')}</div></div>`;
  }
  return `<div class="guide calc-guide">
    ${g.intro?`<div class="guide-what"><b>计算 · ${esc(calcName(tag))}｜这次学什么</b><p>${esc(g.intro)}</p>${g.signal?`<p class="signal">什么时候用：${esc(g.signal)}</p>`:''}</div>`:''}
    ${(g.steps||[]).length?`<div class="keybox"><b>怎么算 · 分 ${g.steps.length} 步</b><ol class="calc-steps">${g.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`:''}
    ${(g.traps||[]).length?`<div class="trapbox"><b>⚠ 最容易错</b><ul>${g.traps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
    ${exs.length?`<div class="guide-ex"><b>典型例题（先自己算，再点开对思路和答案）</b>`+
      exs.map((e,i)=>`<div class="ex-card"><div class="ex-q">例 ${i+1}：${esc(e.q)}</div>
        <details><summary>查看思路与答案</summary>
          <ol>${e.sol.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
          <div class="ex-ans">答案：${esc(e.ans)}</div>
        </details></div>`).join('')+`</div>`:''}
    ${related}
  </div>`;
}
function calcLearnStrip(t){
  const g=CALC[t.calcTag]||{}, gt=GUIDE[t.topicTag]||{};
  return `<div class="learn-strip">
    <div class="learn-line"><span class="ln calc">① 计算</span><div class="lt"><b>${esc(calcName(t.calcTag))}</b>${calcStatus(t)}<small>${esc(g.intro||t.calcText)}</small></div></div>
    <div class="learn-line"><span class="ln topic">② 专题</span><div class="lt"><b>${esc(t.topicTag)}</b><small>${esc(gt.intro||t.topic)}</small></div></div>
  </div>`;
}
function openCalcGuide(tag){
  if(!CALC[tag]){ toast('这个知识点还没有讲解'); return; }
  openSheet('计算讲解 · '+calcName(tag), `<div class="card"><h3>${esc(calcName(tag))}</h3>
    <p class="hint">知识点讲解，不影响任务进度；看完点左上「‹」返回。</p></div>
    <div class="card">${calcGuideHTML(tag,null)}</div>`);
}

/* 专题讲解：是什么 + 底层逻辑 + 解题要点 + 易错点 + 典型例题（答案默认折叠） */
function guideHTML(tag){
  const g=GUIDE[tag]||{}, kp=D.keyPoints[tag]||D.keyPoints['综合']||[], exs=g.examples||[];
  return `<div class="guide">
    ${g.intro?`<div class="guide-what"><b>这是什么题</b><p>${esc(g.intro)}</p>${g.signal?`<p class="signal">怎么认出它：${esc(g.signal)}</p>`:''}</div>`:''}
    ${g.logic?`<div class="guide-logic"><b>🧩 底层逻辑 · 这个专题在考什么</b><p>${esc(g.logic)}</p></div>`:''}
    <div class="keybox"><b>${esc(tag)} · 解题要点</b><ul>${kp.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
    ${(g.traps||[]).length?`<div class="trapbox"><b>⚠ 最容易错（考前再看一遍）</b><ul>${g.traps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
    ${exs.length?`<div class="guide-ex"><b>典型例题（先自己想，再点开看解析）</b>`+
      exs.map((e,i)=>`<div class="ex-card"><div class="ex-q">例 ${i+1}：${esc(e.q)}</div>
        <details><summary>查看思路与答案</summary>
          <ol>${e.sol.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
          <div class="ex-ans">答案：${esc(e.ans)}</div>
        </details></div>`).join('')+`</div>`:''}
    ${libraryHTML(tag)}
  </div>`;
}
/* 家长随手录入、判到本专题的应用题：和内置例题并列，答案默认藏起来 */
function libraryHTML(tag){
  const list=(S.library||[]).filter(x=>x.tag===tag);
  if(!list.length) return '';
  return `<div class="guide-lib"><b>家长随手录入的应用题（${list.length} 题）</b>`+
    list.slice().reverse().map(x=>`<div class="ex-card">
      <div class="ex-q">${esc(x.text||'（题目见图片）')}</div>
      ${x.imageKey?`<div data-img-key="${esc(x.imageKey)}"></div>`:''}
      <div class="guide-brief">${esc(x.at)} · ${esc(x.source||'随手录入')} · ${x.auto?'系统判别':'家长指定专题'}</div>
      <div class="btn-row">
        <button class="btn small ghost" data-action="lib-answer" data-id="${esc(x.id)}">👁 答案</button>
        <button class="btn small ghost" data-action="go-library">去专题题库</button>
      </div>
      <div class="lib-ans hidden"><b>答案：${esc(x.correctAnswer||'（未录入）')}</b>
        ${x.childAnswer?`<div>孩子答案：${esc(x.childAnswer)}</div>`:''}
        ${x.note?`<div>备注：${esc(x.note)}</div>`:''}</div>
    </div>`).join('')+`</div>`;
}
function guideBrief(tag){ const g=GUIDE[tag]; return g&&g.intro?`<small class="guide-brief">${esc(g.intro)}</small>`:''; }

function taskCardHTML(t,isCurrent){
  const c=canComplete(t.id), done=!!S.completed[t.id];
  const w=taskWeek(t.id), p=S.progress[t.id]||{};
  let gate='';
  if(done){ gate=`<div class="gate-msg ok">✓ 已于 ${esc(S.completed[t.id].at)} 达标完成</div>`; }
  else if(c.passed){ gate='<div class="gate-msg ok">✓ 已通过达标测试，可以标记完成了</div>'; }
  else if(c.ok){ gate='<div class="gate-msg ok">✓ 已达标，可以标记完成了</div>'; }
  else{
    const miss=[];
    if(!c.calcOK) miss.push(c.calcRate===null?'还没做计算练习':`计算正确率 ${c.calcRate}% ＜ ${S.settings.calcThreshold}%`);
    if(!c.wordOK) miss.push(c.wordCount===0?'还没做应用题练习':`应用题正确率 ${c.wordRate}% ＜ ${S.settings.wordThreshold}%`);
    gate=`<div class="gate-msg">还差：${esc(miss.join('；'))}。可反复练习，达标后自动放行。<br>或做「达标测试」≥80% 直接过关。</div>`;
  }
  return `<div class="task-card">
    <div class="tid"><b>${esc(t.id)}</b>${typePill(t)}<span class="pill ${done?'done':''}">${esc(t.stage)} · ${esc(t.stageName)}</span>${isCurrent?'<span class="pill">进行中</span>':''}</div>
    ${calcLearnStrip(t)}
    <div class="info-row"><div class="k">计算练习</div><div class="v">${esc(t.calcText)}<small>知识点：${esc(calcName(t.calcTag))} · ${calcIsNew(t)?'新学':'保温'} ｜ 建议题量：${esc(t.calcCount)}</small></div></div>
    <div class="info-row"><div class="k">专题学习</div><div class="v">${esc(t.topic)}${guideBrief(t.topicTag)}</div></div>
    <div class="info-row"><div class="k">过关标准</div><div class="v">${esc(t.pass)}</div></div>
    ${t.reinforce&&t.reinforce!=='无（开篇任务）'?`<div class="info-row"><div class="k">配套巩固</div><div class="v">${esc(t.reinforce)}</div></div>`:''}
    ${t.note?`<div class="info-row"><div class="k">备注</div><div class="v"><small>${esc(t.note)}</small></div></div>`:''}
    ${w?`<div class="info-row"><div class="k">📅 建议周</div><div class="v">第 ${w.week} 周${w.hard?' · 难项(2周)':(w.light?' · 复盘周':(w.dense?' · 假期密集周':''))} ｜ ${w.start?cnDate(w.start)+'–'+cnDate(w.end):'复盘/总测'}${p.start?' ｜ 实际 '+cnDate(p.start)+(p.end?'~'+cnDate(p.end):'~进行中'):''}${p.passed?' ｜ ✅已通过达标测试':''}</div></div>`:''}
    <details class="learn-details" ${isCurrent?'open':''}><summary>📐 计算怎么学：${esc(calcName(t.calcTag))} · 步骤 / 例题 / 易错点</summary>${calcGuideHTML(t.calcTag,t)}</details>
    <details class="learn-details"><summary>📖 专题讲解：${esc(t.topicTag)} · 是什么 / 底层逻辑 / 要点 / 易错点 / 例题</summary>${guideHTML(t.topicTag)}</details>
    ${gate}
    ${!done?`<div class="btn-row">
      <button class="btn" data-action="open-calc" data-id="${t.id}">做计算练习</button>
      <button class="btn amber" data-action="open-word" data-id="${t.id}">做应用题</button>
    </div>
    <div class="btn-row"><button class="btn" data-action="open-mastery" data-id="${t.id}">📝 达标测试（≥80% 过关）</button></div>
    <div class="btn-row"><button class="btn ghost" data-action="complete-task" data-id="${t.id}" ${c.ok?'':'disabled'}>✓ 标记完成，进入下一任务</button></div>`:''}
  </div>`;
}

/* ---------------- 渲染：首页 ---------------- */
function renderHome(){
  const total=TASKS.length, done=Object.keys(S.completed).length;
  const rate=total?Math.round(done/total*100):0;
  const cur=currentTask();
  $('#stCurrent').textContent=cur?cur.id:'全部完成';
  $('#stDone').textContent=`${done} / ${total}`;
  $('#stRate').textContent=rate+'%';
  $('#stWrong').textContent=activeMistakes().length;
  $('#progressBar').style.width=rate+'%';
  $('#topStage').textContent=cur?`${cur.stage} · ${cur.stageName}`:'全部任务已完成';
  const due=dueMistakes().length;
  $('#reviewBanner').classList.toggle('hidden',due===0);
  $('#reviewCount').textContent=due+' 题';
  $('#wrongBadge').classList.toggle('hidden',due===0);
  $('#wrongBadge').textContent=due;
  $('#quickOverview').textContent=`8 个阶段 · ${total} 个任务`;
  $('#quickWrong').textContent=`${activeMistakes().length} 题 · 可浏览 / 重做`;
  $('#currentTask').innerHTML=cur ? dailyPanelHTML(cur) : '<div class="card"><h3>🎉 82 个任务全部完成</h3><p class="hint">可到「任务」页回看，或在「设置」里导出备份。</p></div>';
}
/* ---------------- 今日学习面板（首页核心） ---------------- */
function prog(id){ if(!S.progress) S.progress={}; return S.progress[id]||(S.progress[id]={start:null,end:null,daily:[],passed:false}); }
function dayDiff(a,b){ return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000); }
function logToday(id,patch){
  const p=prog(id), today=TODAY();
  let rec=p.daily.find(d=>d.date===today);
  if(!rec){ rec={date:today,calc:false,calcN:0,topicFocus:'',word:false,note:''}; p.daily.push(rec); }
  Object.assign(rec,patch);
  if(!p.start) p.start=today;
  save(); renderAll();
}
function todayRec(id){ const p=prog(id); return (p.daily||[]).find(d=>d.date===TODAY())||null; }
function dailyPanelHTML(t){
  const wp=taskWeek(t.id), rec=todayRec(t.id), p=prog(t.id);
  const passed=p.passed;
  const calcToday=rec&&rec.calc;
  const todaySess=S.calcSessions.filter(x=>x.taskId===t.id&&x.at===TODAY());
  const todayRate=todaySess.length?todaySess[todaySess.length-1].rate:null;
  const dow=(new Date()).getDay();
  const sess=weeklySession(dow);
  const dayNames=['日','一','二','三','四','五','六'];
  const rhythm=WEEK_STUDY_DAYS.map(d=>({d,type:'study'})).concat(WEEK_FLEX_DAYS.map(d=>({d,type:'flex'}))).concat(WEEK_REVIEW_DAYS.map(d=>({d,type:'review'})))
    .sort((a,b)=>a.d-b.d)
    .map(o=>`<div class="rhythm-day ${o.type} ${o.d===dow?'today':''}"><b>周${dayNames[o.d]}</b><span>${o.type==='study'?'学新':(o.type==='review'?'复习/错题':'弹性')}</span></div>`).join('');
  const weekText = wp ? `第 ${wp.week} 周${wp.dense?' · 假期密集周':(wp.light?' · 复盘周':(wp.hard&&!wp.compress?' · 难项(2周)':''))}` : '';
  const weekRange = wp&&wp.start ? `${cnDate(wp.start)}–${cnDate(wp.end)}` : '';
  const subIdx = (wp&&wp.hard&&!wp.compress&&wp.start) ? Math.min(2,Math.max(1,Math.floor(dayDiff(wp.start,TODAY())/7)+1)) : 1;
  return `<div class="stage-head">本周任务<small>每周约 ${WEEKLY_HOURS} 小时 · 达标才顺延</small></div>
  <div class="daily-card">
    <div class="dc-task">当前任务 <b>${esc(t.id)}</b> · ${esc(t.stage)} ${esc(t.stageName)} <span class="pill ${passed?'done':''}">${passed?'已通过达标测试':'进行中'}</span></div>
    ${weekText?`<div class="dc-win">📅 ${esc(weekText)}${weekRange?(' · '+esc(weekRange)):''}</div>`:''}
    ${wp&&wp.dense?`<div class="dense-note">⚠ 假期密集周：本周与同阶段其他任务并行，无课可多学——每天带一点计算和巩固题即可，不必一天啃完。</div>`:''}
    <div class="rhythm-strip">${rhythm}</div>
    <div class="dc-session ${sess.type}">今天（周${dayNames[dow]}）：${esc(sess.label)}</div>
    <div class="dc-grid">
      <div class="dc-block calc">
        <div class="dc-h">① 计算 <span class="dc-tag">每天必做</span></div>
        <p class="dc-sub">本任务：${esc(calcName(t.calcTag))} ${calcIsNew(t)?'· 新学':'· 保温'} ｜ 建议 ${esc(t.calcCount)}</p>
        <p class="dc-sub">今日：${calcToday?'✅ 已做':(todayRate!==null?'✅ 已做 · 正确率'+todayRate+'%':'⭕ 还没做')}</p>
        <div class="btn-row"><button class="btn" data-action="daily-calc" data-id="${esc(t.id)}">做今日计算</button></div>
      </div>
      <div class="dc-block topic">
        <div class="dc-h">② 专题 <span class="dc-tag">今天学哪一块</span></div>
        <p class="dc-sub">${esc(t.topicTag)}：${esc(t.topic)}</p>
        <div class="dc-focus">📌 本周学：${esc(weekFocus(t,subIdx))}</div>
        <label class="lbl">今日专题小目标（一个任务可分多天，每天选一块练）</label>
        <input type="text" id="dailyFocus" value="${esc(rec?rec.topicFocus:'')}" placeholder="例：今天只练盈亏 / 盈盈+盈亏">
        <label class="switch"><input type="checkbox" id="dailyWord" ${rec&&rec.word?'checked':''}> 今天做了应用题</label>
        <div class="btn-row"><button class="btn amber" data-action="daily-word" data-id="${esc(t.id)}">做应用题</button></div>
      </div>
    </div>
    <div class="dc-block test">
      <div class="dc-h">③ 达标测试 <span class="dc-tag">≥80% 过关</span></div>
      <p class="dc-sub">${passed?'✅ 已通过，可标记完成进入下一任务':'测试覆盖本任务计算+应用题，优先从孩子错题库举一反三出题'}</p>
      <div class="btn-row"><button class="btn" data-action="open-mastery" data-id="${esc(t.id)}">📝 做达标测试</button>
        <button class="btn ghost" data-action="open-task" data-id="${esc(t.id)}">看完整任务卡 ›</button></div>
    </div>
    ${sess.type==='review'?`<div class="dc-foot">🗓 周末复习：把本周做错的题再练一遍 → <button class="linkbtn" data-action="week-review" data-id="${esc(t.id)}">看本周错题</button></div>`
      :`<div class="dc-foot">📝 今日小结：${rec?esc((rec.calc?'已做计算':'未做计算')+' ｜ '+(rec.word?'已做应用':'未做应用')+(rec.topicFocus?' ｜ 专题：'+rec.topicFocus:'')):'今天还没记录，做完上面任意一项会自动记一笔'}</div>`}
  </div>`;
}

/* ---------------- 渲染：任务序列 ---------------- */
function renderTasks(){
  const sf=$('#taskStageFilter').value, tf=$('#taskStateFilter').value;
  const stages=[...new Set(TASKS.map(t=>t.stage))];
  if($('#taskStageFilter').options.length===1) stages.forEach(s=>$('#taskStageFilter').add(new Option(s+' · '+TASKS.find(t=>t.stage===s).stageName,s)));
  const cur=currentTask();
  let html='';
  stages.forEach(st=>{
    if(sf&&sf!==st) return;
    const list=TASKS.filter(t=>t.stage===st&&(!tf||(tf==='done'?!!S.completed[t.id]:!S.completed[t.id])));
    if(!list.length) return;
    const dn=list.filter(t=>S.completed[t.id]).length;
    html+=`<div class="stage-head">${esc(st)} · ${esc(list[0].stageName)}<small>${dn}/${TASKS.filter(t=>t.stage===st).length} 已完成</small></div>`;
    list.forEach(t=>{
      const done=!!S.completed[t.id];
      html+=`<div class="task-item ${done?'is-done':''} ${cur&&cur.id===t.id?'is-current':''}" data-action="open-task" data-id="${t.id}">
        <button class="tick" data-action="toggle-done" data-id="${t.id}" aria-label="完成">✓</button>
        <div class="body"><b>${esc(t.id)}</b>${typePill(t)}
          <p class="ti-calc">计算：${esc(calcName(t.calcTag))}${calcIsNew(t)?' · 新学':' · 保温'} ｜ ${esc(t.calcText)}</p>
          <p>专题：${esc(t.topic)}</p></div>
        <div class="meta">${done?esc(S.completed[t.id].at.slice(5)):'未完成'}</div>
      </div>`;
    });
  });
  $('#taskList').innerHTML=html||'<div class="card"><p class="hint">没有符合条件的任务。</p></div>';
}

/* ---------------- 渲染：阶段总览（每阶段多少任务、分别是什么） ---------------- */
const STAGES=[...new Set(TASKS.map(t=>t.stage))];
/* 计算知识地图：按 82 个任务里首次出现的顺序列出全部计算知识点，点开看讲解 */
function renderCalcMap(){
  const el=$('#calcMap'); if(!el) return;
  const order=[...new Set(TASKS.map(t=>t.calcTag))];
  el.innerHTML=`<div class="card"><h3>📐 计算知识点学习地图</h3>
    <p class="hint">计算和专题一样要「先学再练」。下面是计算知识点在任务序列里第一次出现的顺序，点任一个可看步骤、例题与易错点；标「新学」的是孩子第一次遇到，之后的任务是保温复习。</p>
    <div class="chip-row">${order.map((tag,i)=>{
      const first=TASKS.find(t=>t.calcTag===tag);
      const isNew=!!first&&calcIsNew(first);
      return `<button class="chip" data-action="calc-guide" data-id="${esc(tag)}">${i+1}. ${esc(calcName(tag))}<small>${esc(first?first.id:'')}${isNew?' · 新学':' · 保温'}</small> ›</button>`;
    }).join('')}</div></div>`;
}
function renderOverview(){
  const cur=currentTask(), total=TASKS.length, done=Object.keys(S.completed).length;
  $('#overviewSummary').innerHTML=`<span>阶段 <b>${STAGES.length}</b></span><span>任务 <b>${total}</b></span><span>已完成 <b>${done}</b></span><span>完成率 <b>${total?Math.round(done/total*100):0}%</b></span>`;
  renderCalcMap();
  $('#overviewList').innerHTML=STAGES.map(st=>{
    const list=TASKS.filter(t=>t.stage===st), dn=list.filter(t=>S.completed[t.id]).length;
    const pct=Math.round(dn/list.length*100), isCur=!!(cur&&cur.stage===st);
    const newCalcs=[...new Set(list.filter(t=>calcIsNew(t)).map(t=>calcName(t.calcTag)))];
    return `<div class="ov-card ${isCur?'is-current':''}" data-stage="${esc(st)}">
      <div class="ov-head" data-action="toggle-stage" data-id="${esc(st)}">
        <div class="ov-title"><b>${esc(st)}</b>${esc(list[0].stageName)}${isCur?' · 当前阶段':''}</div>
        <div class="ov-meta">共 ${list.length} 个任务 ｜ ${esc(list[0].id)} → ${esc(list[list.length-1].id)} ｜ 已完成 ${dn}/${list.length}${dn===list.length?' ✓':''}</div>
        ${newCalcs.length?`<div class="ov-newcalc">本阶段新学计算：${esc(newCalcs.join('、'))}</div>`:''}
        <div class="ov-bar"><i style="width:${pct}%"></i></div>
        <span class="ov-toggle">${isCur?'▾ 收起任务清单':'▸ 展开任务清单'}</span>
      </div>
      <div class="ov-list ${isCur?'':'hidden'}" id="ov-${esc(st)}">
        ${list.map(t=>{
          const d=!!S.completed[t.id], c=!!(cur&&cur.id===t.id);
          return `<div class="ov-item" data-action="open-task" data-id="${esc(t.id)}">
            <span class="ov-id">${esc(t.id)}</span>
            <span class="ov-body">
              <span class="ov-topic">专题：${esc(t.topic)}${t.type!=='新课'?` · ${esc(t.type)}`:''}</span>
              <span class="ov-calc">计算：${esc(calcName(t.calcTag))}${calcIsNew(t)?' · 🆕 新学':' · 保温'}</span>
            </span>
            <span class="ov-state ${d?'done':(c?'cur':'')}">${d?'✓ 已完成':(c?'进行中':'')}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

/* ---------------- 渲染：错题本 ---------------- */
function val(id){ const e=$(id); return e?e.value:''; }
function monthRange(offset){
  const d=new Date();
  return {from:ISO(new Date(d.getFullYear(),d.getMonth()+offset,1)),
          to:ISO(new Date(d.getFullYear(),d.getMonth()+offset+1,0))};
}
/* 错题册多维筛选：阶段 / 所属专题 / 知识点 / 错因 / 题型 / 状态 / 日期 / 关键字 */
function filteredMistakes(){
  const st=val('#fStage'),tp=val('#fTopic'),tg=val('#fTag'),rs=val('#fReason'),ss=val('#fStatus'),
        ty=val('#fType'),kw=val('#fKeyword').trim(),sort=val('#fSort')||'due';
  let from=val('#fDateFrom'),to=val('#fDateTo');
  const q=val('#fDateQuick');
  if(q==='7'){ from=addDays(TODAY(),-6); to=TODAY(); }
  else if(q==='30'){ from=addDays(TODAY(),-29); to=TODAY(); }
  else if(q==='month'||q==='lastmonth'){ const r=monthRange(q==='month'?0:-1); from=r.from; to=r.to; }
  const list=S.mistakes.filter(m=>{
    if(st&&m.stage!==st) return false;
    if(tp&&topicTagOf(m)!==tp) return false;
    if(tg&&m.tag!==tg) return false;
    if(rs&&m.reason!==rs) return false;
    if(ss&&m.status!==ss) return false;
    if(ty&&m.type!==ty) return false;
    if(from&&(m.date||'')<from) return false;
    if(to&&(m.date||'')>to) return false;
    if(kw&&[m.question,m.childAnswer,m.correctAnswer,m.note,m.tag,m.taskId].join(' ').indexOf(kw)<0) return false;
    return true;
  });
  list.sort((a,b)=>{
    if(sort==='new') return (b.date||'').localeCompare(a.date||'');
    if(sort==='old') return (a.date||'').localeCompare(b.date||'');
    if(sort==='topic') return topicTagOf(a).localeCompare(topicTagOf(b))||(b.date||'').localeCompare(a.date||'');
    const da=isDue(a)?0:1, db=isDue(b)?0:1;
    if(da!==db) return da-db;
    return (b.date||'').localeCompare(a.date||'');
  });
  return list;
}
function fillSel(sel,label,values){
  const el=$(sel); if(!el) return;
  const cur=el.dataset.v||el.value||'';
  el.innerHTML='<option value="">'+label+'</option>'+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  el.value=cur; el.dataset.v=el.value;
}
/* 错题册目录：跟着上面的筛选走，可按专题 / 日期 / 阶段 / 错因分组 */
function renderWrongDir(list){
  const box=$('#wrongDir'); if(!box) return;
  const g=val('#fGroup')||'topic';
  if(g==='none'){ box.innerHTML='<p class="dir-empty">已设为不分组，下面直接看筛选结果。</p>'; return; }
  const groups={};
  list.forEach(m=>{
    const k=g==='topic'?topicTagOf(m):g==='date'?(m.date||'未填日期'):g==='stage'?(m.stage||'未填阶段'):(m.reason||'未填错因');
    (groups[k]=groups[k]||[]).push(m);
  });
  const keys=Object.keys(groups).sort((a,b)=>g==='date'?b.localeCompare(a):a.localeCompare(b));
  if(!keys.length){ box.innerHTML='<p class="dir-empty">当前筛选下没有错题，换个条件试试。</p>'; return; }
  box.innerHTML=keys.map((k,i)=>`<div class="dir-group">
    <div class="dir-group-head" data-action="toggle-dir" data-id="${i}"><span>${esc(k)}</span><span class="cnt">${groups[k].length} 题 · 点标题收起/展开</span></div>
    <div class="dir-items" id="dir-${i}">${groups[k].map(m=>`<button class="dir-item" data-action="view-wrong" data-id="${esc(m.id)}">
      <span class="di-date">${esc(m.date)}</span><span class="di-tag">${esc(topicTagOf(m))}</span>${m.status==='graduated'?'<span class="di-date">已移出</span>':''}
      <span class="di-q">${esc((m.question||'（题目见图片）').replace(/\s+/g,' ').slice(0,70))}</span>
    </button>`).join('')}</div>
  </div>`).join('');
}
function wrongClearFilter(){
  const defaults={fStatus:'active',fSort:'due',fGroup:'topic'};
  ['fStage','fTopic','fTag','fReason','fStatus','fType','fDateQuick','fDateFrom','fDateTo','fKeyword','fSort','fGroup'].forEach(id=>{
    const e=document.getElementById(id); if(!e) return;
    e.value=defaults[id]||''; e.dataset.v=e.value;
  });
  renderWrong(); toast('筛选已清除');
}
function renderWrong(){
  const all=S.mistakes;
  fillSel('#fStage','全部阶段',[...new Set(all.map(m=>m.stage).filter(Boolean))].sort());
  fillSel('#fTopic','全部所属专题',Object.keys(D.keyPoints).filter(t=>all.some(m=>topicTagOf(m)===t)));
  fillSel('#fTag','全部知识点',[...new Set(all.map(m=>m.tag).filter(Boolean))].sort());
  fillSel('#fReason','全部错因',D.reasons);
  const list=filteredMistakes();
  $('#wrongSummary').innerHTML=`<span>在册 <b>${activeMistakes().length}</b></span><span>今日待复习 <b>${dueMistakes().length}</b></span><span>已移出 <b>${all.filter(m=>m.status==='graduated').length}</b></span><span>筛选结果 <b>${list.length}</b></span>`;
  renderWrongDir(list);
  if(!list.length){ $('#wrongList').innerHTML='<div class="card"><p class="hint">当前筛选下没有错题。练习中做错的题会自动进这里。</p></div>'; return; }
  $('#wrongList').innerHTML=list.map(m=>{
    const due=isDue(m), next=dueOf(m);
    const cyc=(m.reviews||[]).map(r=>{
      const cl=r.ok===true?'ok':(r.ok===false?'fail':(due&&r.due===next?'due':''));
      return `<i class="${cl}" title="第${r.day}天 ${r.due}">${r.day}</i>`;
    }).join('');
    return `<div class="wrong-card ${m.status==='graduated'?'grad':''}" data-action="view-wrong" data-id="${esc(m.id)}">
      <div class="whead">
        <span class="tag">${esc(m.date)}</span><span class="tag">${esc(m.stage)}</span>
        <span class="tag">${esc(topicTagOf(m))}</span><span class="tag">${esc(m.tag)}</span><span class="tag">${esc(m.reason)}</span>
        <span class="tag">${m.type==='calc'?'计算题':'应用题'}</span>
        ${m.status==='graduated'?'<span class="tag">已移出</span>':(due?'<span class="tag" style="color:var(--amber)">待复习</span>':'')}
      </div>
      <div class="wq">${esc(m.question||'（题目见图片）')}</div>
      ${m.imageKey?`<div data-img-key="${esc(m.imageKey)}"></div>`:''}${attachHTML(m)}
      <div class="wans">孩子答案：<b>${esc(m.childAnswer||'—')}</b> ｜ 正确答案：${esc(m.correctAnswer||'—')}</div>
      ${m.note?`<div class="wans">补充：${esc(m.note)}</div>`:''}
      ${m.status==='active'?`<div class="cycle">${cyc}<span class="next">下次复习：${next?esc(cnDate(next)):'—'} ｜ 连对 ${m.streak||0}/2</span></div>`:''}
      <div class="wa">
        <button class="btn small ghost" data-action="view-wrong" data-id="${esc(m.id)}">🔍 查看详情</button>
        <button class="btn small ghost" data-action="variants" data-id="${esc(m.id)}">🧠 举一反三</button>
        ${m.status==='active'?`<button class="btn small" data-action="redo-one" data-id="${esc(m.id)}">🔁 重做这题</button>`:''}
        ${m.status==='active'?`<button class="btn small ghost" data-action="review-ok" data-id="${esc(m.id)}">✓ 做对了</button>
        <button class="btn small ghost" data-action="review-fail" data-id="${esc(m.id)}">✕ 又错了</button>`:''}
        <button class="btn small ghost" data-action="edit-wrong" data-id="${esc(m.id)}">编辑错因</button>
      </div>
    </div>`;
  }).join('');
  hydrateImages($('#wrongList'));
}

/* ---------------- 渲染：设置 ---------------- */
/* ---------------- 存储用量：说清「空间不足」到底指什么 ---------------- */
function localUsedBytes(){
  let n=0;
  try{ for(const k of Object.keys(localStorage)){
    const v=localStorage.getItem(k); n+=(k.length+(v?v.length:0))*2;   // UTF-16 近似
  } }catch(e){}
  return n;
}
async function updateStorageInfo(){
  const box=$('#storageInfo'); if(!box) return;
  const mb=localUsedBytes()/1048576;
  let photos=0;
  try{ const all=await IMG.all(); photos=Object.keys(all).length; }catch(e){}
  const isFile=location.protocol==='file:';
  const level=(storageFull||mb>4)?'danger':(mb>2.5?'warn':'ok');
  box.className='storage-box '+level;
  box.innerHTML=`
    <div class="storage-line"><b>网页存储用量</b><span>${mb.toFixed(2)} MB / 约 5 MB</span></div>
    <div class="storage-bar"><i style="width:${Math.min(100,mb/5*100).toFixed(1)}%"></i></div>
    <div class="storage-line"><span>题目照片</span><span>${photos} 张</span></div>
    <div class="storage-line"><span>当前打开方式</span><span>${isFile?'file:// 双击打开（照片挤在网页存储里，容易满）':'http 本地服务（照片存 IndexedDB，容量大，推荐）'}</span></div>
    <p class="hint">这里的容量是<b>浏览器分给单个网页的配额</b>，不是 C 盘磁盘空间；C 盘还剩十几个 GB 也可能出现这个提示。<b>导出备份是生成下载文件，不占这个配额，随时都能导出。</b></p>
    ${level==='danger'?`<div class="storage-alert">⚠ 存储接近或已经写满，刚才的改动可能没保存。请先导出备份${isFile?'，并改用「启动工作台.bat」打开':''}。</div>
      <div class="btn-row"><button class="btn" data-action="backup">立即导出备份</button></div>`:''}
  `;
}
function renderSettings(){
  $('#setCalc').value=S.settings.calcThreshold; $('#setWord').value=S.settings.wordThreshold;
  $('#setOral').value=S.settings.oralCount; $('#setWritten').value=S.settings.writtenCount;
  $('#setRequireWord').checked=!!S.settings.requireWord;
  $('#setAllowSkip').checked=!!S.settings.allowSkip;
  $('#setNotify').checked=!!S.settings.notify;
  const aiOn=$('#setAiEnabled'), ep=$('#setAiEndpoint'), md=$('#setAiModel'), ky=$('#setAiKey');
  if(aiOn) aiOn.checked=!!S.settings.aiEnabled;
  if(ep && document.activeElement!==ep) ep.value=S.settings.aiEndpoint||'';
  if(md && document.activeElement!==md) md.value=S.settings.aiModel||'';
  if(ky && document.activeElement!==ky) ky.value=S.settings.aiKey||'';
  const rep=$('#setRepo'); if(rep && document.activeElement!==rep) rep.value=window.SYNC?SYNC.getRepo():'';
  const tok=$('#setToken'); if(tok && document.activeElement!==tok) tok.value=window.SYNC?SYNC.getToken():'';
  updateSyncChip();
  updateStorageInfo();
}
function renderAll(){ renderHome(); renderTasks(); renderOverview(); renderLibrary(); renderWrong(); renderSettings(); renderPlan(); maybeNotify(); hydrateImages(document); hydrateAttachments(document); }

/* ---------------- 导航：页面历史栈 + 弹层历史栈（全站「返回上一页」） ---------------- */
const NAV={ page:['home'], sheet:[] };
function activePage(){ const p=$('.page.active'); return p&&p.id?p.id.replace('page-',''):'home'; }
function applyPage(id){
  $$('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+id));
  $$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));
  const b=$('#backBtn'); if(b) b.classList.toggle('hidden',id==='home');
  window.scrollTo(0,0);
}
function goPage(id){
  if(!$('#page-'+id)||activePage()===id) return;
  NAV.page.push(id); applyPage(id);
}
function backPage(){
  if(NAV.page.length>1) NAV.page.pop();
  applyPage(NAV.page[NAV.page.length-1]||'home');
}
function sheetOpen(){ return !$('#sheet').classList.contains('hidden'); }
function openSheet(title,html,opts){
  const open=sheetOpen();
  if(open && !(opts&&opts.push===false)) NAV.sheet.push({title:$('#sheetTitle').textContent,html:$('#sheetBody').innerHTML});
  else if(!open) NAV.sheet=[];
  $('#sheetTitle').textContent=title;
  $('#sheetBody').innerHTML=html;
  $('#sheet').classList.remove('hidden');
  $('#sheetBody').scrollTop=0;
  hydrateImages($('#sheetBody'));
  hydrateAttachments($('#sheetBody'));
}
function refreshSheet(title,html){ openSheet(title,html,{push:false}); }
function closeSheet(){ $('#sheet').classList.add('hidden'); NAV.sheet=[]; }
function backSheet(){
  if(NAV.sheet.length){
    const p=NAV.sheet.pop();
    $('#sheetTitle').textContent=p.title;
    $('#sheetBody').innerHTML=p.html;
    $('#sheetBody').scrollTop=0;
    hydrateImages($('#sheetBody'));
    /* 回到在册错题列表时，按当前筛选状态重新渲染（勾选 / 毕业状态不会显示成旧的） */
    if($('#bfList')) renderBrowse();
  } else closeSheet();
}
function goBack(){ if(sheetOpen()) backSheet(); else backPage(); }
async function hydrateImages(root){
  const slots=(root||document).querySelectorAll('[data-img-key]');
  for(const s of slots){
    const k=s.dataset.imgKey;
    if(!k||s.dataset.imgLoaded==='1'||s.querySelector('img')) continue;
    const src=await IMG.get(k);
    if(src){ s.innerHTML=`<img class="thumb" src="${esc(src)}" alt="题目图片">`; s.dataset.imgLoaded='1'; }
  }
}

/* ---------------- 子页面 ---------------- */
let PAPER=null, PAPER_TASK=null, WORD={taskId:null,imageKey:'',text:'',childAnswer:'',correctAnswer:''};
let INBOX={imageKey:'',guess:null};
let LIBFILTER={tag:'',kw:''};
let VARSTATE={tag:'',mistakeId:'',items:[],mode:'local'};
/* 拍照 / OCR 共用一套逻辑，按当前弹层里是哪一个表单自动选目标；
   逐级返回弹层后也能正确对上，不依赖全局变量记住「现在在哪个表单」。 */
function uploadCtx(){
  const body=$('#sheetBody');
  const inbox=!!(body&&body.querySelector('#inboxText'));
  return inbox
    ? {fileSel:'#inboxFile',imgSel:'#inboxImg',textSel:'#inboxText',state:INBOX,isInbox:true}
    : {fileSel:'#wordFile',imgSel:'#wordImg',textSel:'#wordText',state:WORD,isInbox:false};
}

/* 计算练习 */
function openCalc(id,preset){
  const t=TASKMAP[id]||currentTask(); if(!t) return;
  PAPER_TASK=t; PAPER=preset||null;
  openSheet(`${t.id} · 计算练习`, `
    <div class="card">
      <h3>${esc(t.calcText)}</h3>
      <p class="hint">知识点：${esc(calcName(t.calcTag))} · ${calcIsNew(t)?'新学（建议先看下面讲解再做题）':'保温复习'} ｜ ${esc(t.calcCount)}${(t.calcTag==='mixed'||t.calcTag==='decmix')?' ｜ 保温题会从本阶段已学知识点里随机抽':''}</p>
      <details class="learn-details" open><summary>📖 先学再练：${esc(calcName(t.calcTag))} 怎么算 · 例题 · 易错点</summary>${calcGuideHTML(t.calcTag,t)}</details>
      <div class="btn-row">
        <label class="field" style="flex:1;min-width:130px"><span>口算</span><input type="number" id="paperOral" min="0" max="60" value="${S.settings.oralCount}"></label>
        <label class="field" style="flex:1;min-width:130px"><span>笔算</span><input type="number" id="paperWritten" min="0" max="60" value="${S.settings.writtenCount}"></label>
      </div>
      <div class="btn-row"><button class="btn" data-action="gen-paper">生成题目</button></div>
    </div>
    <div id="paperBox"></div>
    <div id="calcHistory"></div>`);
  renderPaper(); renderCalcHistory(t.id);
}
function renderPaper(){
  const box=$('#paperBox'); if(!box) return;
  if(!PAPER){ box.innerHTML='<div class="card"><p class="hint">点上面「生成题目」开始。系统按本任务知识点自动出口算 + 笔算，提交后自动判分。</p></div>'; return; }
  const groups=['口算','笔算'];
  box.innerHTML=`<div class="card"><h3>本套 ${PAPER.items.length} 题 · ${esc(D.calcTagNames[PAPER.tag]||PAPER.tag)}</h3>
    ${groups.map(g=>{
      const arr=PAPER.items.filter(x=>x.kind===g); if(!arr.length) return '';
      return `<div class="q-group-title">${g}（${arr.length} 题）</div>`+arr.map(q=>{
        const i=PAPER.items.indexOf(q);
        return `<div class="q-item" id="q-${i}"><span class="qn">${i+1}</span><span class="qs">${esc(q.stem)}</span>${q.review?'<span class="q-tag">↺ 保温</span>':''}<input type="text" inputmode="decimal" data-qi="${i}" value="${esc(q.given||'')}" ${PAPER.submitted?'disabled':''}><span class="mark">${PAPER.submitted?(q.ok?'✅':'❌'):''}</span></div>`
          + (PAPER.submitted&&!q.ok?paperWrongHTML(q):'');
      }).join('');
    }).join('')}
    <div id="paperResult"></div>
    ${!PAPER.submitted?'<div class="btn-row"><button class="btn" data-action="submit-paper">提交判分</button></div>'
      :`<div class="btn-row"><button class="btn" data-action="regen-paper">再练一套（同知识点）</button><button class="btn ghost" data-action="gen-paper">换一组</button></div>`}
  </div>`;
  if(PAPER.submitted){
    const rate=PAPER.rate;
    $('#paperResult').innerHTML=`<div class="result-box ${rate>=S.settings.calcThreshold?'':'bad'}">本次正确率 <b>${rate}%</b>（${PAPER.correct}/${PAPER.items.length}）｜ 过关线 ${S.settings.calcThreshold}%${PAPER.wrongN?` ｜ ${PAPER.wrongN} 道错题已自动录入错题本`:''}</div>`
      + (PAPER.wrongN?`<p class="reason-tip">✎ 趁现在还记得，给每道错题选一下错因（默认已按题型填好，改一下更准），选完自动存进错题本；之后也能在错题本里改。
        <button class="btn small ghost" data-action="jump-first-wrong">↑ 去逐题选错因</button></p>`:'');
  }
}
/* 每道错题下方：正确答案 + 当场选错因 */
function paperWrongHTML(q){
  const m=(S.mistakes||[]).find(x=>x.id===q.mistakeId);
  return `<div class="q-wrong">
    <div class="q-ans">孩子答案：<b class="bad">${esc(q.given||'（未填）')}</b> ｜ 正确答案：<b class="good">${esc(q.ans)}</b></div>
    ${reasonBarHTML(m)}
  </div>`;
}
function renderCalcHistory(taskId){
  const el=$('#calcHistory'); if(!el) return;
  const list=S.calcSessions.filter(x=>x.taskId===taskId).slice(-5).reverse();
  el.innerHTML=list.length?`<div class="card"><h3>本任务最近练习</h3>${list.map(x=>`<div class="info-row"><div class="k">${esc(x.at.slice(5,10))}</div><div class="v">${esc(D.calcTagNames[x.tag]||x.tag)} · ${x.total} 题 · 正确率 <b>${x.rate}%</b></div></div>`).join('')}</div>`:'';
}
function genPaper(fixedTag){
  const o=clamp(parseInt($('#paperOral').value,10)||0,0,60), w=clamp(parseInt($('#paperWritten').value,10)||0,0,60);
  if(o+w===0){ toast('至少生成 1 道题'); return; }
  PAPER=makePaper(PAPER_TASK,o,w,fixedTag); PAPER.submitted=false;
  renderPaper(); $('#paperBox').scrollIntoView({behavior:'smooth',block:'start'});
}
function submitPaper(){
  if(!PAPER||PAPER.submitted) return;
  let correct=0,wrongN=0;
  PAPER.items.forEach((q,i)=>{
    const el=document.querySelector(`[data-qi="${i}"]`);
    q.given=el?el.value.trim():'';
    q.ok=isRight(q.given,q.ans);
    if(q.ok) correct++; else{
      wrongN++;
      const m=addMistake({taskId:PAPER_TASK.id,stage:PAPER_TASK.stage,tag:D.calcTagNames[q.tag]||q.tag,type:'calc',
        question:q.stem+' （'+q.kind+'）',childAnswer:q.given||'（未填）',correctAnswer:q.ans,reason:'计算失误'});
      q.mistakeId=m.id;
    }
  });
  PAPER.submitted=true; PAPER.correct=correct; PAPER.rate=Math.round(correct/PAPER.items.length*100); PAPER.wrongN=wrongN;
  S.calcSessions.push({id:uid(),taskId:PAPER_TASK.id,at:TODAY(),tag:PAPER.tag,total:PAPER.items.length,correct:correct,rate:PAPER.rate});
  save(); renderPaper(); renderCalcHistory(PAPER_TASK.id); renderAll();
  toast(PAPER.rate>=S.settings.calcThreshold?'✓ 计算达标':'继续练，达标后才能标记完成');
}

/* 应用题 */
function openWord(id){
  const t=TASKMAP[id]||currentTask(); if(!t) return;
  WORD={taskId:t.id,imageKey:'',text:'',childAnswer:'',correctAnswer:''};
  openSheet(`${t.id} · 应用题`, `
    <div class="card"><h3>本任务专题：${esc(t.topicTag)}</h3>
      <div class="info-row"><div class="v">${esc(t.topic)}</div></div>
      ${guideHTML(t.topicTag)}
      <div class="btn-row"><button class="btn ghost" data-action="open-inbox">📥 随手录题（不绑定本任务，自动归专题）</button></div>
    </div>
    <div class="card">
      <h3>录入一道题</h3>
      <div class="btn-row">
        <button class="btn ghost" data-action="word-photo">📷 拍照 / 选图</button>
        <button class="btn ghost" data-action="word-ocr">文字识别（需联网）</button>
      </div>
      <input type="file" id="wordFile" accept="image/*" hidden>
      <div id="wordImg"></div>
      <label class="lbl">题目文字（可拍照识别，也可直接输入 / 粘贴）</label>
      <textarea id="wordText" placeholder="例如：每人分 5 颗多 2 颗，每人分 7 颗少 6 颗，求人数。"></textarea>
      <label class="lbl">孩子的答案</label><input type="text" id="wordChild" placeholder="填孩子写的答案">
      <label class="lbl">正确答案</label><input type="text" id="wordCorrect" placeholder="填正确答案，供错题本留存">
      <div class="btn-row">
        <button class="btn" data-action="word-verdict" data-v="correct">✓ 家长判定：正确</button>
        <button class="btn amber" data-action="word-verdict" data-v="wrong">✕ 家长判定：错误</button>
      </div>
      <p class="hint">判错的题自动进错题本，保留原图 + 文字，并自动打上阶段、题型标签、错误日期；<b>判完可在下面当场选错因</b>。</p>
    </div>
    <div id="wordReason"></div>
    <div id="wordList"></div>`);
  renderWordList(t.id);
}
function renderWordList(taskId){
  const el=$('#wordList'); if(!el) return;
  const list=S.wordItems.filter(x=>x.taskId===taskId).slice().reverse();
  el.innerHTML=list.length?`<div class="card"><h3>本任务已录 ${list.length} 题</h3>${list.map(x=>{
    const m=x.mistakeId?(S.mistakes||[]).find(y=>y.id===x.mistakeId):null;
    return `<div class="info-row"><div class="k">${x.verdict==='correct'?'✓ 对':'✕ 错'}</div><div class="v">${esc(x.text||'（见图片）')}<small>${esc(x.at)} ${x.imageKey?'· 含图片':''}</small></div></div>`
      + (m?reasonBarHTML(m):'');
  }).join('')}</div>`:'';
}
async function handlePhoto(file){
  if(!file) return;
  const c=uploadCtx();
  try{
    const data=await compress(file), key='img_'+uid();
    await IMG.put(key,data); c.state.imageKey=key;
    const box=$(c.imgSel); if(box) box.innerHTML=`<img class="thumb" src="${data}" alt="题目图片">`;
    if(c.isInbox) updateGuess();
    toast('图片已保存到本机');
  }catch(e){ toast('图片读取失败，请改用手动输入文字'); }
}
async function runOCR(){
  const c=uploadCtx(), fEl=$(c.fileSel), f=fEl&&fEl.files[0];
  if(!f){ toast('请先拍照或选择图片'); return; }
  toast('正在加载识别组件，首次约需下载 10MB…');
  try{
    if(!window.Tesseract){
      await new Promise((res,rej)=>{ const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
        s.onload=res; s.onerror=()=>rej(new Error('load-fail')); document.head.appendChild(s); });
    }
    const r=await window.Tesseract.recognize(f,'chi_sim+eng');
    const txt=(r.data&&r.data.text||'').trim();
    if(!txt){ toast('没识别出文字，请手动输入'); return; }
    const box=$(c.textSel); if(box) box.value=txt;
    if(c.isInbox) updateGuess();
    toast('识别完成，请核对后修改');
  }catch(e){ toast('当前设备离线或不支持识别，请手动输入文字（图片仍会保留）'); }
}
function saveWord(verdict){
  const t=TASKMAP[WORD.taskId]; if(!t) return;
  const text=$('#wordText').value.trim(), child=$('#wordChild').value.trim(), correct=$('#wordCorrect').value.trim();
  if(!text&&!WORD.imageKey){ toast('请先填题目文字或上传图片'); return; }
  let newM=null;
  if(verdict==='wrong') newM=addMistake({taskId:t.id,stage:t.stage,tag:t.topicTag,type:'word',
    question:text,imageKey:WORD.imageKey,childAnswer:child,correctAnswer:correct,reason:'思路错误'});
  S.wordItems.push({id:uid(),taskId:t.id,at:TODAY(),text:text,imageKey:WORD.imageKey,
    childAnswer:child,correctAnswer:correct,verdict:verdict,mistakeId:newM?newM.id:''});
  save();
  WORD={taskId:t.id,imageKey:'',text:'',childAnswer:'',correctAnswer:''};
  $('#wordText').value=''; $('#wordChild').value=''; $('#wordCorrect').value=''; $('#wordImg').innerHTML=''; $('#wordFile').value='';
  const rb=$('#wordReason');
  if(rb){
    rb.innerHTML=newM?`<div class="card reason-new"><h3>刚记下的错题 · 当场选一下错因</h3>
      <div class="wq">${esc(text||'（题目见图片）')}</div>
      <div class="q-ans">孩子答案：<b class="bad">${esc(child||'—')}</b> ｜ 正确答案：<b class="good">${esc(correct||'—')}</b></div>
      ${reasonBarHTML(newM)}
      <p class="hint">选完自动存进错题本，之后再改也可以。继续录下一题即可。</p></div>`:'';
    if(newM&&rb.scrollIntoView) rb.scrollIntoView({behavior:'smooth',block:'center'});
  }
  renderWordList(t.id); renderAll();
  toast(verdict==='wrong'?'已判错并录入错题本，顺手选一下错因':'✓ 记录完成');
}

/* ---------------- 随手录题：不绑定任务，自动判题型并归入专题 ---------------- */
const TOPIC_LIST = ()=>Object.keys(D.keyPoints);
function openInbox(){
  INBOX={imageKey:'',guess:null};
  openSheet('随手录题 · 自动归专题', `
    <div class="card">
      <h3>录一道题，不用管它是哪类</h3>
      <p class="hint">日常做过的、看到的好题都能随手录。工作台按题目里的特征词判断该归到哪个专题，判错了在下面改一下就行。<b>不绑定今天的任务，也不会影响任务达标。</b></p>
      <div class="btn-row">
        <button class="btn ghost" data-action="inbox-photo">📷 拍照 / 选图</button>
        <button class="btn ghost" data-action="word-ocr">文字识别（需联网）</button>
      </div>
      <input type="file" id="inboxFile" accept="image/*" hidden>
      <div id="inboxImg"></div>
      <label class="lbl">题目文字（拍照识别，或直接输入 / 粘贴）</label>
      <textarea id="inboxText" placeholder="例如：每人分 5 颗多 2 颗，每人分 7 颗少 6 颗，求人数。"></textarea>
      <div id="inboxGuess"></div>
      <label class="lbl">归到哪个专题（系统判断完可改）</label>
      <select id="inboxTag">${TOPIC_LIST().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
      <label class="lbl">这道题从哪来</label>
      <select id="inboxSource">${['日常练习','试卷 / 作业','看到的好题','学习机题目','其他'].map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>
      <label class="lbl">孩子的答案（可不填）</label><input type="text" id="inboxChild" placeholder="孩子写的答案">
      <label class="lbl">正确答案（可不填，给孩子核对用）</label><input type="text" id="inboxCorrect" placeholder="例如：7 人，43 颗糖">
      <label class="lbl">备注（可不填）</label><input type="text" id="inboxNote" placeholder="例如：两次分配的差算反了">
      <label class="switch"><input type="checkbox" id="inboxWrong"><span>这道题做错了，同时录入错题本</span></label>
      <div id="inboxReasonWrap" class="inbox-reason hidden">
        <label class="lbl">这道题错在哪（现在选一下，省得回头再翻）</label>
        <select id="inboxReason">${D.reasons.map(r=>`<option value="${esc(r)}" ${r==='思路错误'?'selected':''}>${esc(r)}</option>`).join('')}</select>
      </div>
      <div class="btn-row"><button class="btn" data-action="inbox-save">✓ 保存并归入专题</button></div>
    </div>
    <div class="card"><h3>存进去之后会怎样</h3>
      <p class="hint">题会进「专题题库」，学到对应专题时，出现在「专题讲解」的例题下面；答案默认藏起来，点「答案」才展开。随时能在专题题库里改判专题或删掉。</p>
    </div>`);
  updateGuess();
}
function updateGuess(){
  const box=$('#inboxGuess'); if(!box) return;
  const txt=$('#inboxText')?$('#inboxText').value:'';
  const r=window.classifyTopic?window.classifyTopic(txt)
    :{tag:'综合',confidence:'无',hits:[],alternatives:[],needConfirm:true,empty:true};
  INBOX.guess=r;
  const sel=$('#inboxTag'); if(sel) sel.value=r.tag;
  const low=r.confidence==='无'||r.confidence==='较低';
  box.innerHTML=`<div class="guess-box">
    <div class="g-line"><span>系统判断：</span><span class="g-tag">${esc(r.tag)}</span>
      <span class="g-conf ${low?'low':''}">把握${esc(r.confidence)}</span></div>
    ${r.empty?'<div class="g-note">把题目文字填进来，或点上面的「文字识别」，我就开始判断。</div>'
      :(r.hits&&r.hits.length?`<div class="g-hits">依据题目里出现的：${esc(r.hits.join('、'))}</div>`
        :'<div class="g-hits">没找到明显的题型特征词。</div>')}
    ${(r.alternatives&&r.alternatives.length)?`<div class="alt-row"><span class="g-note">也可能是：</span>${r.alternatives.map(a=>`<button class="alt-btn" data-action="pick-topic" data-id="${esc(a.tag)}">${esc(a.tag)}</button>`).join('')}</div>`:''}
    <div class="g-note">这是按题面特征词判断的，不是真能读懂题意；判得不对，在下面「归到哪个专题」里改一下，我会照你选的存。</div>
  </div>`;
}
function saveInbox(){
  const text=$('#inboxText')?$('#inboxText').value.trim():'';
  if(!text&&!INBOX.imageKey){ toast('请先填题目文字或上传图片'); return; }
  const tag=$('#inboxTag')?$('#inboxTag').value:'综合';
  const g=INBOX.guess||{};
  const item={ id:uid(), at:TODAY(), tag:tag, text:text, imageKey:INBOX.imageKey,
    childAnswer:$('#inboxChild').value.trim(), correctAnswer:$('#inboxCorrect').value.trim(),
    note:$('#inboxNote').value.trim(), source:$('#inboxSource')?$('#inboxSource').value:'随手录入',
    auto:!!(text&&g.tag===tag&&!g.empty), confidence:g.confidence||'无' };
  S.library.push(item);
  if($('#inboxWrong')&&$('#inboxWrong').checked){
    const rs=$('#inboxReason');
    addMistake({taskId:'',stage:'随手录入',tag:tag,topicTag:tag,type:'word',source:'随手录入',
      question:text,imageKey:INBOX.imageKey,childAnswer:item.childAnswer,correctAnswer:item.correctAnswer,
      reason:rs?rs.value:'思路错误',note:item.note});
  }
  save(); closeSheet(); LIBFILTER.tag=tag; renderAll(); goPage('library');
  toast('✓ 已归入「'+tag+'」专题');
}

/* ---------------- 批量附件：整份错题归档一次上传 ----------------
   附件文件本体存 IndexedDB（跟题目照片一样，只在本设备）；
   文件名 / 专题 / 上传日期 / 关联错题等文字信息存在 S.library，会随同步走。 */
let ATTACH={file:null,dataURL:''};
const ATT_MAX=8*1024*1024;             // 单份附件上限 8MB
const ATT_URL={};                        // dataURL -> blobURL 缓存，避免反复创建
function openAttachSheet(){
  ATTACH={file:null,dataURL:''};
  openSheet('上传附件 · 整份错题归档', `
    <div class="card">
      <h3>一次上传一整份错题</h3>
      <p class="hint">试卷、错题合集、PDF、Word、图片都行。选好专题后存进「专题题库」，也可以同时放进错题本，按 1 / 3 / 7 天推给孩子重做。<b>不绑定当天任务，也不影响任务达标。</b></p>
      <div class="btn-row"><button class="btn ghost" data-action="attach-pick">📎 选择附件</button></div>
      <input type="file" id="attachFile" hidden>
      <div id="attachInfo" class="attach-info">还没选文件</div>
      <label class="lbl">归到哪个专题</label>
      <select id="attachTag"><option value="">— 请选择专题 —</option>${TOPIC_LIST().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
      <label class="lbl">上传日期</label>
      <input type="date" id="attachDate" value="${TODAY()}">
      <label class="lbl">这份附件里有几道题（填 1 就整份当一题）</label>
      <input type="number" id="attachCount" min="1" max="30" value="1">
      <label class="lbl">备注（可不填）</label>
      <input type="text" id="attachNote" placeholder="例如：三下第一单元测验卷，第 3、7 题错得多">
      <label class="switch"><input type="checkbox" id="attachToWrong" checked><span>同时加入错题本（按 1/3/7 天推送重做）</span></label>
      <div id="attachReasonWrap">
        <label class="lbl">这批题主要错在哪</label>
        <select id="attachReason">${D.reasons.map(r=>`<option value="${esc(r)}" ${r==='思路错误'?'selected':''}>${esc(r)}</option>`).join('')}</select>
        <p class="hint">多道题会「一天一题」错开首次复习日，避免同一天全涌过来；每题仍走 1 / 3 / 7 天、连对 2 次移出的规则。</p>
      </div>
      <div class="btn-row"><button class="btn" data-action="attach-save">✓ 保存进专题题库</button></div>
      <p class="hint">📌 附件文件本身只存在<b>上传时用的这台设备</b>（和题目照片一样，不跨设备同步）；文件名、专题、上传日期、关联错题会同步到手机和电脑。</p>
    </div>`);
}
async function attachFilePicked(file){
  if(!file) return;
  if(file.size>ATT_MAX){ toast('文件超过 8MB，请压缩或拆成几份再传'); return; }
  let data;
  try{ data=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsDataURL(file); }); }
  catch(e){ toast('读取文件失败，请换一个文件'); return; }
  ATTACH={file:file,dataURL:data};
  const info=$('#attachInfo');
  if(info) info.innerHTML=`<b>📎 ${esc(file.name)}</b><small>${(file.size/1024).toFixed(0)} KB ｜ ${esc(file.type||'未知格式')}</small>`;
}
function attachLabel(name,type){
  const t=String(type||''), n=String(name||'');
  if(t.indexOf('image/')===0 || /\.(png|jpe?g|gif|webp)$/i.test(n)) return '🖼 图片';
  if(t.indexOf('pdf')>=0 || /\.pdf$/i.test(n)) return '📄 PDF';
  if(/word|docx?/i.test(t) || /\.docx?$/i.test(n)) return '📝 Word';
  return '📎 附件';
}
/* 附件展示槽：先放占位，稍后由 hydrateAttachments 异步填出「打开/下载」 */
function attachHTML(m){
  if(!m||!m.fileKey) return '';
  return `<div class="att-slot" data-file-key="${esc(m.fileKey)}" data-file-name="${esc(m.fileName||'附件')}" data-file-type="${esc(m.fileType||'')}" data-file-label="${esc(attachLabel(m.fileName,m.fileType))}"></div>`;
}
function attBlobURL(key,src){
  if(ATT_URL[key]) return ATT_URL[key];
  try{
    if(!/^data:/.test(src)||!window.atob||!window.Blob||!URL.createObjectURL) return src;
    const comma=src.indexOf(','), head=src.slice(0,comma), b64=src.slice(comma+1);
    const mime=(head.match(/data:([^;]+)/)||[])[1]||'application/octet-stream';
    const bin=atob(b64), arr=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    const u=URL.createObjectURL(new Blob([arr],{type:mime}));
    ATT_URL[key]=u; return u;
  }catch(e){ return src; }
}
async function hydrateAttachments(root){
  const slots=(root||document).querySelectorAll('[data-file-key]');
  for(const s of slots){
    if(s.dataset.attLoaded==='1') continue;
    const key=s.dataset.fileKey, name=s.dataset.fileName||'附件', type=s.dataset.fileType||'', label=s.dataset.fileLabel||'📎 附件';
    const src=await IMG.get(key);
    if(!src){ s.innerHTML=`<div class="att-missing">${esc(label)} ${esc(name)}<small>文件在上传的那台设备上，本设备打不开（文字记录已同步）</small></div>`; s.dataset.attLoaded='1'; continue; }
    const isImg=type.indexOf('image/')===0 || /^data:image\//.test(src);
    const url=attBlobURL(key,src);
    s.innerHTML=`<div class="att-file">
      ${isImg?`<img class="thumb" src="${esc(src)}" alt="${esc(name)}">`:''}
      <div class="att-meta"><b>${esc(label)} ${esc(name)}</b>
        <div class="btn-row">
          <a class="btn small ghost" href="${esc(url)}" target="_blank" rel="noopener">👁 打开</a>
          <a class="btn small ghost" href="${esc(url)}" download="${esc(name)}">⬇ 下载</a>
        </div></div></div>`;
    s.dataset.attLoaded='1';
  }
}
async function saveAttach(){
  if(!ATTACH.file||!ATTACH.dataURL){ toast('请先选择附件'); return; }
  const tag=$('#attachTag')?$('#attachTag').value:'';
  if(!tag){ toast('请先选择这份附件属于哪个专题'); return; }
  const at=$('#attachDate')?($('#attachDate').value||TODAY()):TODAY();
  const n=Math.max(1,Math.min(30,parseInt($('#attachCount')?$('#attachCount').value:'1',10)||1));
  const note=$('#attachNote')?$('#attachNote').value.trim():'';
  const toWrong=!!($('#attachToWrong')&&$('#attachToWrong').checked);
  const reason=$('#attachReason')?$('#attachReason').value:'思路错误';
  const f=ATTACH.file, id=uid(), key='att:'+id;
  try{ await IMG.put(key,ATTACH.dataURL); }
  catch(e){ toast((e&&e.message)||'附件保存失败'); return; }
  const fileName=f.name||'附件', fileType=f.type||'', fileSize=f.size||0;
  S.library.push({ id, at, tag, kind:'file',
    text:`📎 附件《${fileName}》（共 ${n} 题，打开文件作答）`,
    fileName, fileType, fileSize, fileKey:key, questionCount:n,
    childAnswer:'', correctAnswer:'', note, source:'批量附件', auto:false, confidence:'无' });
  if(toWrong){
    for(let i=0;i<n;i++){
      const label=n>1?`附件《${fileName}》第 ${i+1} 题（打开文件作答）`:`附件《${fileName}》（打开文件作答）`;
      const m=addMistake({taskId:'',stage:'批量附件',tag,topicTag:tag,type:'word',source:'批量附件',
        question:label, fileKey:key, fileName, fileType,
        childAnswer:'', correctAnswer:'', reason, note });
      const base=addDays(at,i);                 // 多题错开：第 i 题整体后移 i 天
      m.date=at; m.cycleStart=base; m.reviews=mkReviews(base);
    }
  }
  save(); closeSheet(); LIBFILTER.tag=tag; renderAll(); goPage('library');
  toast(toWrong?`✓ 已存进「${tag}」，并加入错题本 ${n} 题`:`✓ 已存进「${tag}」专题题库`);
}
function attachCardHTML(x){
  return `<div class="lib-card att-card">
    <div class="lib-meta">${esc(x.at)} ｜ ${esc(x.tag)} ｜ 📎 批量附件 ｜ ${esc(x.questionCount||1)} 题</div>
    <div class="lib-q">${esc(x.fileName||'附件')} <small>${((x.fileSize||0)/1024).toFixed(0)} KB</small></div>
    ${attachHTML(x)}
    ${x.note?`<div class="lib-q"><small>备注：${esc(x.note)}</small></div>`:''}
    <div class="btn-row"><button class="btn small ghost" data-action="lib-delete" data-id="${esc(x.id)}">删除</button></div>
    <div class="lib-foot"><span style="font-size:12px;color:var(--faint)">改判专题：</span>
      <select class="lib-retag" data-id="${esc(x.id)}">${TOPIC_LIST().map(t=>`<option value="${esc(t)}" ${x.tag===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
    </div>
  </div>`;
}
function renderLibrary(){
  const dir=$('#libraryDir'); if(!dir) return;
  const all=S.library||[], tags=TOPIC_LIST(), counts={};
  all.forEach(x=>{ counts[x.tag]=(counts[x.tag]||0)+1; });
  const extra=[...new Set(all.map(x=>x.tag))].filter(t=>tags.indexOf(t)<0);
  const dirTags=tags.filter(t=>counts[t]).concat(extra);
  const selTag=$('#libFilterTag');
  if(selTag){
    selTag.innerHTML='<option value="">全部专题</option>'+tags.map(t=>`<option value="${esc(t)}">${esc(t)}${counts[t]?'（'+counts[t]+'）':''}</option>`).join('');
    selTag.value=LIBFILTER.tag||'';
  }
  const kwEl=$('#libFilterKw'); if(kwEl&&kwEl.value!==LIBFILTER.kw) kwEl.value=LIBFILTER.kw;
  dir.innerHTML=dirTags.length?`<div class="lib-dir">`+
    `<button data-action="lib-filter" data-id="" class="${LIBFILTER.tag?'':'on'}">全部 ${all.length} 题</button>`+
    dirTags.map(t=>`<button data-action="lib-filter" data-id="${esc(t)}" class="${LIBFILTER.tag===t?'on':''}">${esc(t)} ${counts[t]||0}</button>`).join('')+`</div>`
    :'<p class="hint">还没有录入的题目。点上面「随手录一道题」开始，题会自动归到对应专题。</p>';
  const kw=(LIBFILTER.kw||'').trim();
  const list=all.filter(x=>(!LIBFILTER.tag||x.tag===LIBFILTER.tag)&&
    (!kw||(x.text||'').indexOf(kw)>=0||(x.note||'').indexOf(kw)>=0||(x.fileName||'').indexOf(kw)>=0)).slice().reverse();
  $('#librarySummary').innerHTML=`<span>累计录入 <b>${all.length}</b></span><span>有题的专题 <b>${dirTags.length}</b></span><span>当前显示 <b>${list.length}</b></span>`;
  const box=$('#libraryList');
  if(!list.length){ box.innerHTML='<div class="card"><p class="hint">没有符合条件的题目。</p></div>'; return; }
  box.innerHTML=list.map(x=>x.kind==='file'?attachCardHTML(x):`<div class="lib-card">
    <div class="lib-meta">${esc(x.at)} ｜ ${esc(x.tag)} ｜ ${esc(x.source||'随手录入')} ｜ ${x.auto?'系统判别 · 把握'+esc(x.confidence||'—'):'家长指定专题'}</div>
    <div class="lib-q">${esc(x.text||'（题目见图片）')}</div>
    ${x.imageKey?`<div data-img-key="${esc(x.imageKey)}"></div>`:''}
    <div class="btn-row">
      <button class="btn small ghost" data-action="lib-answer" data-id="${esc(x.id)}">👁 答案</button>
      <button class="btn small ghost" data-action="lib-delete" data-id="${esc(x.id)}">删除</button>
    </div>
    <div class="lib-ans hidden"><b>答案：${esc(x.correctAnswer||'（未录入）')}</b>
      ${x.childAnswer?`<div>孩子答案：${esc(x.childAnswer)}</div>`:''}
      ${x.note?`<div>备注：${esc(x.note)}</div>`:''}</div>
    <div class="lib-foot"><span style="font-size:12px;color:var(--faint)">改判专题：</span>
      <select class="lib-retag" data-id="${esc(x.id)}">${tags.map(t=>`<option value="${esc(t)}" ${x.tag===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
    </div>
  </div>`).join('');
  hydrateImages(box);
  hydrateAttachments(box);
}
function libAnswer(el){
  const host=el.closest('.lib-card')||el.closest('.ex-card');
  const box=host?host.querySelector('.lib-ans'):null; if(!box) return;
  box.classList.toggle('hidden');
  el.textContent=box.classList.contains('hidden')?'👁 答案':'收起答案';
}

/* ---------------- 举一反三：本机变式题库 + 可选联网 AI ---------------- */
async function aiRequest(tag,question,correctAnswer,n){
  const s=S.settings;
  if(!s.aiEndpoint||!s.aiKey) return null;
  const ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
  const timer=setTimeout(()=>{ if(ctrl) ctrl.abort(); },15000);
  try{
    const sys='你是小学数学（三到四年级、浅奥难度）出题老师。只输出严格 JSON 数组，不要解释文字、不要 Markdown 代码块。每个元素形如 {"q":"题目","ans":"最终答案","sol":["解题步骤1","解题步骤2"]}。';
    const usr='下面这道错题属于「'+tag+'」专题。请仿照它的题型与难度，出 '+n+' 道「换数字、换情境但解法相同」的新题，条件自洽、数据算得通、答案必须准确。\n错题原文：'+(question||'（无文字）')+'\n参考答案：'+(correctAnswer||'（未录入）')+'\n只输出 JSON 数组。';
    const opt={method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.aiKey},
      body:JSON.stringify({model:s.aiModel||'gpt-4o-mini',messages:[{role:'system',content:sys},{role:'user',content:usr}],temperature:0.7})};
    if(ctrl) opt.signal=ctrl.signal;
    const res=await fetch(s.aiEndpoint,opt);
    clearTimeout(timer);
    if(!res.ok) throw new Error('http-'+res.status);
    const data=await res.json();
    let txt=(data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content)||'';
    txt=String(txt).replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
    const arr=JSON.parse(txt);
    if(!Array.isArray(arr)) throw new Error('not-array');
    const out=arr.filter(x=>x&&x.q).slice(0,n).map(x=>({q:String(x.q),ans:String(x.ans==null?'':x.ans),
      sol:Array.isArray(x.sol)?x.sol.map(String):[],source:'ai',label:'AI 生成 · 请家长核对'}));
    return out.length?out:null;
  }catch(e){ clearTimeout(timer); return null; }
}
function aiVariants(tag,question,correctAnswer,n){
  const s=S.settings;
  if(!s.aiEnabled||!s.aiEndpoint||!s.aiKey) return null;
  return aiRequest(tag,question,correctAnswer,n);
}
async function testAI(){
  const s=S.settings;
  if(!s.aiEndpoint||!s.aiKey){ toast('请先填接口地址和 API Key'); return; }
  toast('正在测试联网出题…');
  const r=await aiRequest('综合','1 + 1 = ?','2',1);
  toast(r?'✓ 连接成功，可以联网出题了':'没连上（地址 / 密钥 / 浏览器跨域都可能），本机题库仍可正常用');
}
async function openVariants(id,replace){
  const m=S.mistakes.find(x=>x.id===id); if(!m) return;
  const tag=topicTagOf(m);
  if(replace) refreshSheet('举一反三 · '+tag,'<div class="card"><p class="hint">正在换一组新题…</p></div>');
  else openSheet('举一反三 · '+tag,'<div class="card"><p class="hint">正在准备同类型的新题…</p></div>');
  let items=null, mode='local';
  if(S.settings.aiEnabled&&S.settings.aiEndpoint&&S.settings.aiKey){
    items=await aiVariants(tag,m.question,m.correctAnswer,3);
    if(items&&items.length) mode='ai';
  }
  if(!items||!items.length) items=window.makeVariants?window.makeVariants(tag,3,GUIDE[tag]):[];
  VARSTATE={tag:tag,mistakeId:id,items:items,mode:mode};
  if(!sheetOpen()) return;
  refreshSheet('举一反三 · '+tag,variantsHTML(m,tag,items,mode));
}
function variantsHTML(m,tag,items,mode){
  const aiOn=S.settings.aiEnabled&&S.settings.aiEndpoint&&S.settings.aiKey;
  const brief=(m.question||'（见图片）').slice(0,90);
  return `<div class="card">
    <h3>同类型换着练 · ${esc(tag)}</h3>
    <span class="mode-pill ${mode==='ai'?'ai':''}">${mode==='ai'?'联网 AI 出题':'本机变式题库 · 离线可用'}</span>
    <p class="hint" style="margin-top:9px">原题（${esc(m.date)}）：${esc(brief)}${(m.question||'').length>90?'…':''}</p>
    <p class="hint">${mode==='ai'?'AI 生成的题目和答案请家长先核对一遍。':'题目按同一题型重新换数字生成，答案由程序现算。'}答案默认藏起来，做完再点「答案」。</p>
  </div>`+
  items.map((it,i)=>`<div class="var-card">
    <div class="var-head"><b>变式 ${i+1}</b><span class="pill">${esc(it.label||'')}</span></div>
    <div class="var-q">${esc(it.q)}</div>
    <div class="btn-row"><button class="btn small ghost" data-action="var-answer">👁 答案</button></div>
    <div class="var-ans hidden"><b>答案：${esc(it.ans)}</b>
      ${(it.sol&&it.sol.length)?`<ol>${it.sol.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}
      <div class="var-note">${it.source==='ai'?'⚠ AI 生成，请家长核对后再给孩子看。'
        :(it.source==='example'?'这道来自该专题的典型例题，答案是人工核对过的。'
        :(it.source==='none'?'这个专题暂无自动变式模板，去「专题讲解」里挑一道例题重做。':'答案由程序按题中数字算出。'))}</div>
    </div>
  </div>`).join('')+
  `<div class="card"><div class="btn-row">
    <button class="btn" data-action="var-again" data-id="${esc(m.id)}">🔄 再来一组</button>
    <button class="btn ghost" data-action="view-wrong" data-id="${esc(m.id)}">← 返回原题详情</button>
  </div>
  <p class="hint">${aiOn?'当前优先联网出题，联网失败会自动退回本机题库。':'想用 AI 联网出题：到「家长设置 → 举一反三」开启并填接口信息；不配也一直能用本机题库。'}</p></div>`;
}
function varAnswer(el){
  const card=el.closest('.var-card'); if(!card) return;
  const box=card.querySelector('.var-ans'); if(!box) return;
  box.classList.toggle('hidden');
  el.textContent=box.classList.contains('hidden')?'👁 答案':'收起答案';
}

/* 任务详情 / 错题编辑 */
function openTaskDetail(id){
  const t=TASKMAP[id]; if(!t) return;
  const cur=currentTask();
  openSheet(`${t.id} · 任务详情`, taskCardHTML(t,cur&&cur.id===t.id)+
    (S.settings.allowSkip&&!S.completed[t.id]?`<div class="btn-row"><button class="btn ghost" data-action="set-current" data-id="${t.id}">设为当前任务</button></div>`:'')+
    (!S.settings.allowSkip&&cur&&cur.id!==t.id?'<div class="card"><p class="hint">当前为严格线性推进，只有完成前置任务后才会顺延到这里。家长可在设置里开启「允许跳号」。</p></div>':''));
}
function openWrongEdit(id){
  const m=S.mistakes.find(x=>x.id===id); if(!m) return;
  openSheet('编辑错题', `<div class="card">
    <h3>${esc(m.date)} · ${esc(m.stage)} · ${esc(m.tag)}</h3>
    <div class="wq" style="white-space:pre-wrap">${esc(m.question||'（见图片）')}</div>
    <label class="lbl">错误原因</label>
    <select id="edReason">${D.reasons.map(r=>`<option value="${esc(r)}" ${m.reason===r?'selected':''}>${esc(r)}</option>`).join('')}</select>
    <label class="lbl">补充备注</label><textarea id="edNote" placeholder="例如：两次分配的差算反了">${esc(m.note)}</textarea>
    <label class="lbl">正确答案</label><input type="text" id="edCorrect" value="${esc(m.correctAnswer)}">
    <label class="lbl">孩子错误答案</label><input type="text" id="edChild" value="${esc(m.childAnswer)}">
    <div class="btn-row"><button class="btn" data-action="save-wrong-edit" data-id="${m.id}">保存</button></div>
  </div>`);
}

/* ---------------- 在册错题：筛选预览 · 详情 · 选择是否重做 ---------------- */
let REDO_QUEUE=[], REDO_IDX=0, REDO=null;
function inBook(){
  return activeMistakes().slice().sort((a,b)=>(isDue(b)?1:0)-(isDue(a)?1:0)||(b.date||'').localeCompare(a.date||''));
}
function resetSheet(title,html){ NAV.sheet=[]; openSheet(title,html,{push:false}); }
/* 弹层内的筛选状态：只存内存，重做 / 看详情回来后仍在，刷新页面恢复「全部」 */
const BF_DEFAULT={ quick:'', from:'', to:'', topic:'', stage:'', reason:'', type:'', keyword:'',
                   group:'topic', sort:'due', sel:{}, collapsed:{} };
let BROWSE=Object.assign({},BF_DEFAULT,{sel:{},collapsed:{}});
function bfReset(){
  BROWSE=Object.assign({},BF_DEFAULT,{sel:{},collapsed:{}});
}
const BF_QUICKS=[['','全部时间'],['7','最近 7 天'],['30','最近 30 天'],['month','本月'],['lastmonth','上月'],['custom','自定义区间']];
function bfRange(){
  const q=BROWSE.quick;
  if(q==='7') return {from:addDays(TODAY(),-6),to:TODAY()};
  if(q==='30') return {from:addDays(TODAY(),-29),to:TODAY()};
  if(q==='month'||q==='lastmonth') return monthRange(q==='month'?0:-1);
  return {from:BROWSE.from||'',to:BROWSE.to||''};
}
function bfMatch(m,skipTopic){
  const r=bfRange();
  if(r.from&&(m.date||'')<r.from) return false;
  if(r.to&&(m.date||'')>r.to) return false;
  if(!skipTopic&&BROWSE.topic&&topicTagOf(m)!==BROWSE.topic) return false;
  if(BROWSE.stage&&m.stage!==BROWSE.stage) return false;
  if(BROWSE.reason&&m.reason!==BROWSE.reason) return false;
  if(BROWSE.type&&m.type!==BROWSE.type) return false;
  if(BROWSE.keyword&&[m.question,m.childAnswer,m.correctAnswer,m.note,m.tag,m.taskId].join(' ').toLowerCase().indexOf(BROWSE.keyword.toLowerCase())<0) return false;
  return true;
}
function bfFiltered(){
  const list=activeMistakes().filter(m=>bfMatch(m));
  list.sort((a,b)=>{
    if(BROWSE.sort==='new') return (b.date||'').localeCompare(a.date||'');
    if(BROWSE.sort==='old') return (a.date||'').localeCompare(b.date||'');
    if(BROWSE.sort==='topic') return topicTagOf(a).localeCompare(topicTagOf(b),'zh')||(b.date||'').localeCompare(a.date||'');
    return (isDue(a)?0:1)-(isDue(b)?0:1)||(b.date||'').localeCompare(a.date||'');
  });
  return list;
}
function bfSelectedIds(list){ return list.filter(m=>BROWSE.sel[m.id]).map(m=>m.id); }
function bfConditionText(){
  const bits=[];
  const q=BF_QUICKS.find(x=>x[0]===BROWSE.quick);
  if(BROWSE.quick==='custom') bits.push([BROWSE.from||'…',BROWSE.to||'…'].join(' ~ '));
  else if(BROWSE.quick) bits.push(q?q[1]:BROWSE.quick);
  else if(BROWSE.from||BROWSE.to) bits.push([BROWSE.from||'…',BROWSE.to||'…'].join(' ~ '));
  if(BROWSE.topic) bits.push('专题：'+BROWSE.topic);
  if(BROWSE.stage) bits.push(BROWSE.stage);
  if(BROWSE.reason) bits.push(BROWSE.reason);
  if(BROWSE.type) bits.push(BROWSE.type==='calc'?'计算题':'应用题');
  if(BROWSE.keyword) bits.push('「'+BROWSE.keyword+'」');
  return bits.length?bits.join(' · '):'全部在册错题';
}
function browseCardHTML(m,no,picked){
  const due=isDue(m), next=dueOf(m);
  return `<div class="browse-card ${due?'due':''} ${picked?'picked':''}">
    <div class="bf-pickrow">
      <label class="bf-pick"><input type="checkbox" class="bf-check" data-id="${esc(m.id)}" ${picked?'checked':''}><span>选入重做</span></label>
      <span class="bf-no">第 ${no} 题</span>
      ${due?'<span class="tag" style="color:var(--amber)">今日待复习</span>':''}
    </div>
    <div class="whead">
      <span class="tag">${esc(m.date)}</span><span class="tag">${esc(m.stage)}</span>
      <span class="tag bf-topic">${esc(topicTagOf(m))}</span>
      ${topicTagOf(m)!==m.tag?`<span class="tag">${esc(m.tag)}</span>`:''}<span class="tag">${esc(m.reason)}</span>
      <span class="tag">${m.type==='calc'?'计算题':'应用题'}</span>
    </div>
    <div class="bt">${esc(m.question||'（题目见图片，点查看详情）')}</div>
    ${m.imageKey?`<div class="bf-img" data-img-key="${esc(m.imageKey)}"></div>`:''}${attachHTML(m)}
    <div class="wans">下次复习：${next?esc(cnDate(next)):'—'} ｜ 连对 ${m.streak||0}/2</div>
    <details class="bf-ans"><summary>👁 看正确答案（决定重做前先别点）</summary>
      <div>孩子当初答：<b style="color:var(--red)">${esc(m.childAnswer||'—')}</b> ｜ 正确答案：<b>${esc(m.correctAnswer||'—')}</b></div>
      ${m.note?`<div>补充：${esc(m.note)}</div>`:''}
    </details>
    <div class="wa">
      <button class="btn small ghost" data-action="view-wrong" data-id="${esc(m.id)}">🔍 查看详情</button>
      <button class="btn small" data-action="redo-one" data-id="${esc(m.id)}">🔁 重做这题</button>
      <button class="btn small ghost" data-action="variants" data-id="${esc(m.id)}">🧠 举一反三</button>
    </div>
  </div>`;
}
function bfGroupKey(m){
  return BROWSE.group==='date'?(m.date||'未填日期')
       : BROWSE.group==='stage'?(m.stage||'未填阶段')
       : BROWSE.group==='reason'?(m.reason||'未填错因')
       : topicTagOf(m);
}
function browseShellHTML(){
  const all=activeMistakes(), due=dueMistakes().length;
  const stages=[...new Set(all.map(m=>m.stage).filter(Boolean))].sort();
  return `<div class="card bf-panel">
    <h3>在册错题 ${all.length} 题</h3>
    <p class="hint">先按<b>时间段</b>或<b>专题</b>缩小范围，下面会按专题分组预览题目；勾选想重做的题，再点「重做选中」。只想看看也可以不勾，随时回来。</p>
    <p class="hint">今日待复习 <b>${due}</b> 题。连续重做会按「到期优先」带出下一题，答案在重做页是藏起来的。</p>
    <div class="bf-sec"><b>① 选时间段</b>
      <div class="chip-row" id="bfQuickChips"></div>
      <div class="filter-row bf-dates">
        <input type="date" id="bfFrom" title="起始日期" aria-label="起始日期">
        <span class="bf-to">至</span>
        <input type="date" id="bfTo" title="结束日期" aria-label="结束日期">
        <button class="btn small ghost" data-action="bf-clear-dates">清除日期</button>
      </div>
    </div>
    <div class="bf-sec"><b>② 选专题</b><p class="hint">括号里是<b>当前时间段</b>下该专题的在册错题数，点一下就只看这个专题。</p>
      <div class="chip-row" id="bfTopicChips"></div>
    </div>
    <details class="bf-more"><summary>⚙ 更多筛选与分组方式</summary>
      <div class="filter-row">
        <select id="bfStage"><option value="">全部阶段</option>${stages.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>
        <select id="bfReason"><option value="">全部错因</option>${D.reasons.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>
        <select id="bfType"><option value="">全部题型</option><option value="calc">计算题</option><option value="word">应用题</option></select>
      </div>
      <div class="filter-row">
        <input type="search" id="bfKeyword" placeholder="搜题目 / 答案关键字">
        <select id="bfGroup"><option value="topic">分组：按专题</option><option value="date">按日期</option><option value="stage">按阶段</option><option value="reason">按错因</option><option value="none">不分组（按排序平铺）</option></select>
        <select id="bfSort"><option value="due">排序：到期优先</option><option value="new">日期：新 → 旧</option><option value="old">日期：旧 → 新</option><option value="topic">按专题名称</option></select>
      </div>
    </details>
    <div class="bf-summary" id="bfSummary"></div>
    <div class="btn-row bf-main-actions">
      <button class="btn" id="bfRedoSel" data-action="bf-redo-selected">🔁 重做选中（0 题）</button>
      <button class="btn ghost" id="bfRedoAll" data-action="bf-redo-filtered">连续重做本结果</button>
    </div>
    <div class="btn-row">
      <button class="btn small ghost" data-action="bf-select-all">全选本结果</button>
      <button class="btn small ghost" data-action="bf-select-none">清空选择</button>
      <button class="btn small ghost" data-action="bf-clear">清除全部筛选</button>
    </div>
  </div>
  <div id="bfList"></div>`;
}
function renderBrowse(){
  const qbox=$('#bfQuickChips'); if(!qbox) return;   // 弹层已关
  const all=activeMistakes(), list=bfFiltered();
  /* 专题计数：只按除「专题」以外的条件过滤，这样切时间段时能立刻看到各专题有几题 */
  const base=all.filter(m=>bfMatch(m,true)), counts={};
  base.forEach(m=>{ const k=topicTagOf(m); counts[k]=(counts[k]||0)+1; });
  qbox.innerHTML=BF_QUICKS.map(([v,label])=>`<button class="chip ${BROWSE.quick===v?'on':''}" data-action="bf-quick" data-v="${v}">${label}</button>`).join('');
  const topics=Object.keys(counts).sort((a,b)=>a.localeCompare(b,'zh'));
  $('#bfTopicChips').innerHTML=`<button class="chip ${!BROWSE.topic?'on':''}" data-action="bf-topic" data-v="">全部专题 <small>${base.length} 题</small></button>`+
    (topics.length?topics.map(k=>`<button class="chip ${BROWSE.topic===k?'on':''}" data-action="bf-topic" data-v="${esc(k)}">${esc(k)} <small>${counts[k]} 题</small></button>`).join('')
      :'<span class="hint">这个时间段里还没有在册错题</span>');
  const from=$('#bfFrom'), to=$('#bfTo');
  if(from) from.value=BROWSE.from; if(to) to.value=BROWSE.to;
  const set=(id,v)=>{ const e=$(id); if(e&&e.value!==v) e.value=v; };
  set('#bfStage',BROWSE.stage); set('#bfReason',BROWSE.reason); set('#bfType',BROWSE.type);
  set('#bfGroup',BROWSE.group); set('#bfSort',BROWSE.sort);
  const kw=$('#bfKeyword'); if(kw&&document.activeElement!==kw&&kw.value!==BROWSE.keyword) kw.value=BROWSE.keyword;
  bfSyncSel(list,all.length);
  const box=$('#bfList');
  if(!list.length){
    box.innerHTML='<div class="card"><p class="hint">这个条件下没有在册错题。换个时间段或点「全部专题」试试。</p></div>';
    return;
  }
  if(BROWSE.group==='none'){
    box.innerHTML=list.map((m,i)=>browseCardHTML(m,i+1,!!BROWSE.sel[m.id])).join('');
  }else{
    const groups={};
    list.forEach(m=>{ const k=bfGroupKey(m); (groups[k]=groups[k]||[]).push(m); });
    const keys=Object.keys(groups).sort((a,b)=>BROWSE.group==='date'?b.localeCompare(a):a.localeCompare(b,'zh'));
    box.innerHTML=keys.map((k,gi)=>{
      const arr=groups[k], n=arr.filter(m=>BROWSE.sel[m.id]).length;
      const folded=BROWSE.collapsed[k]?'hidden':'';
      return `<div class="bf-group">
        <div class="bf-group-head" data-action="bf-toggle-group" data-g="${esc(k)}">
          <span>${folded?'▸':'▾'} ${esc(k)}</span><span class="cnt">${arr.length} 题 · 已选 ${n} · 点标题收起 / 展开</span>
        </div>
        <div class="bf-group-body ${folded}">
          <div class="btn-row"><button class="btn small ghost" data-action="bf-select-group" data-g="${esc(k)}">全选「${esc(k)}」</button>
          <button class="btn small" data-action="bf-redo-group" data-g="${esc(k)}">🔁 重做本组（${arr.length} 题）</button></div>
          ${arr.map((m,ix)=>browseCardHTML(m,ix+1,!!BROWSE.sel[m.id])).join('')}
        </div>
      </div>`;
    }).join('');
  }
  hydrateImages(box);
}
/* 勾选时只刷新计数，不重建题目卡片（免得收起答案、图片重载、页面跳动） */
function bfSyncSel(list,allN){
  list=list||bfFiltered(); if(allN==null) allN=activeMistakes().length;
  const n=bfSelectedIds(list).length, sum=$('#bfSummary');
  if(sum) sum.innerHTML=`当前条件：<b>${esc(bfConditionText())}</b><br>
    <span>筛出 <b>${list.length}</b> 题 ｜ 已勾选 <b>${n}</b> 题 ｜ 在册共 <b>${allN}</b> 题</span>`;
  const btn=$('#bfRedoSel');
  if(btn){ btn.textContent=`🔁 重做选中（${n} 题）`; btn.disabled=!n; }
  const allBtn=$('#bfRedoAll');
  if(allBtn){ allBtn.disabled=!list.length; allBtn.textContent=list.length?`连续重做本结果（${list.length} 题）`:'连续重做本结果'; }
  $$('.bf-group-head').forEach(h=>{
    const c=h.querySelector('.cnt'); if(!c) return;
    const k=h.dataset.g, arr=list.filter(m=>bfGroupKey(m)===k);
    c.textContent=`${arr.length} 题 · 已选 ${arr.filter(m=>BROWSE.sel[m.id]).length} · 点标题收起 / 展开`;
  });
  hydrateAttachments(document);
}
function openWrongBrowse(){
  resetSheet('在册错题 · 筛选预览与重做', browseShellHTML());
  renderBrowse();
}
function openWrongDetail(id){
  const m=S.mistakes.find(x=>x.id===id); if(!m) return;
  const next=dueOf(m), due=isDue(m);
  const cyc=(m.reviews||[]).map(r=>`<i class="${r.ok===true?'ok':(r.ok===false?'fail':(due&&r.due===next?'due':''))}" title="第${r.day}天 ${esc(r.due)}">${r.day}</i>`).join('');
  openSheet(`${esc(m.stage)} · ${esc(m.tag)} · 错题详情`, `
    <div class="detail-box">
      <h3>错题详情</h3>
      <div class="bigq">${esc(m.question||'（题目见图片）')}</div>
      ${m.imageKey?`<div data-img-key="${esc(m.imageKey)}"></div>`:''}${attachHTML(m)}
      <div class="rowline"><div class="k">错题日期</div><div class="v">${esc(m.date)}</div></div>
      <div class="rowline"><div class="k">所属任务</div><div class="v">${esc(m.taskId||'—')} ｜ ${esc(m.stage)}</div></div>
      <div class="rowline"><div class="k">类型 / 标签</div><div class="v">${m.type==='calc'?'计算题':'应用题'} ｜ ${esc(m.tag)}</div></div>
      <div class="rowline"><div class="k">孩子答案</div><div class="v"><b style="color:var(--red)">${esc(m.childAnswer||'—')}</b></div></div>
      <div class="rowline"><div class="k">正确答案</div><div class="v">${esc(m.correctAnswer||'—')}</div></div>
      <div class="rowline"><div class="k">错误原因</div><div class="v">${esc(m.reason||'—')}${m.note?'（'+esc(m.note)+'）':''}</div></div>
      <div class="rowline"><div class="k">复习进度</div><div class="v">${m.status==='graduated'?'已移出（连对 2 次）':`在册 · 连对 ${m.streak||0}/2 · 下次 ${next?esc(cnDate(next)):'—'}`}</div></div>
    </div>
    ${m.status==='active'?`<div class="card"><h3>1 / 3 / 7 天复习</h3>
      <div class="cycle">${cyc}<span class="next">${due?'今天该复习了':`下次 ${next?esc(cnDate(next)):'—'}`}</span></div>
      <p class="hint">重做后由家长判定：做对记一次，连对 2 次自动移出；做错重置周期，重新按 1 / 3 / 7 天推送。</p></div>`:''}
    <div class="btn-row">
      ${m.status==='active'?`<button class="btn" data-action="redo-one" data-id="${esc(m.id)}">🔁 重做这题</button>`:''}
      <button class="btn" data-action="variants" data-id="${esc(m.id)}">🧠 举一反三（换题再做）</button>
      <button class="btn ghost" data-action="edit-wrong" data-id="${esc(m.id)}">编辑错因</button>
    </div>
    <div class="btn-row"><button class="btn ghost" data-action="wrong-browse">← 返回在册列表</button></div>`);
}
function startRedoQueue(ids){
  REDO_QUEUE=(ids||[]).filter(id=>{ const m=S.mistakes.find(x=>x.id===id); return m&&m.status==='active'; });
  REDO_IDX=0;
  if(!REDO_QUEUE.length){ toast('没有可重做的在册错题'); return; }
  openRedo(REDO_QUEUE[0]);
}
function openRedo(id,replace){
  const m=S.mistakes.find(x=>x.id===id);
  if(!m||m.status!=='active'){ toast('这道题已移出在册，无需重做'); return; }
  REDO={id:id,submitted:false,verdict:null,answer:''};
  const html=redoHTML(m);
  if(replace) refreshSheet('重做错题',html); else openSheet('重做错题',html);
}
function redoHTML(m){
  const pos=REDO_QUEUE.length?`第 ${REDO_IDX+1} / ${REDO_QUEUE.length} 题`:'单题重做';
  return `<div class="card">
    <h3>${esc(m.stage)} · ${esc(m.tag)}（${esc(pos)}）</h3>
    <div class="redo-hide">先自己想，答案暂时藏起来了。写完再点「提交并对照答案」。</div>
    <div class="bigq">${esc(m.question||'（题目见图片）')}</div>
    ${m.imageKey?`<div data-img-key="${esc(m.imageKey)}"></div>`:''}${attachHTML(m)}
    <label class="lbl">这次的答案</label>
    <input type="text" id="redoAnswer" placeholder="把答案写在这里">
    <div id="redoResult"></div>
    <div class="btn-row"><button class="btn" data-action="redo-submit" data-id="${esc(m.id)}">提交并对照答案</button></div>
  </div>
  <div class="btn-row">
    <button class="btn ghost" data-action="next-redo">下一题 ›</button>
    <button class="btn ghost" data-action="wrong-browse">← 返回在册列表</button>
  </div>`;
}
function redoSubmit(id){
  const m=S.mistakes.find(x=>x.id===id); if(!m||!REDO||REDO.submitted) return;
  const v=$('#redoAnswer')?String($('#redoAnswer').value||'').trim():'';
  REDO.answer=v; REDO.submitted=true;
  const auto=m.correctAnswer?isRight(v,m.correctAnswer):null;
  const box=$('#redoResult');
  if(box) box.innerHTML=`<div class="detail-box" style="margin:10px 0 0">
      <div class="rowline"><div class="k">本次答案</div><div class="v"><b>${esc(v||'（未填）')}</b></div></div>
      <div class="rowline"><div class="k">正确答案</div><div class="v">${esc(m.correctAnswer||'（未录入，请家长判定）')}</div></div>
      <div class="rowline"><div class="k">当初错答</div><div class="v">${esc(m.childAnswer||'—')}</div></div>
      ${auto!==null?`<div class="rowline"><div class="k">系统参考</div><div class="v">${auto?'✓ 与正确答案一致':'✕ 与正确答案不一致'}（仅作参考，以家长判定为准）</div></div>`:''}
    </div>
    <p class="hint">请家长对照后判定这次做对没有：</p>
    <div class="btn-row">
      <button class="btn" data-action="redo-verdict" data-id="${esc(id)}" data-v="ok">✓ 这次做对了</button>
      <button class="btn amber" data-action="redo-verdict" data-id="${esc(id)}" data-v="fail">✕ 又错了</button>
    </div>`;
  const sb=document.querySelector('[data-action="redo-submit"]'); if(sb&&sb.remove) sb.remove();
}
function redoVerdict(id,ok){
  const m=S.mistakes.find(x=>x.id===id); if(!m||!REDO||REDO.verdict!==null) return;
  REDO.verdict=ok;
  reviewMistake(id,ok);
  const after=S.mistakes.find(x=>x.id===id);
  renderAll();
  const msg=after.status==='graduated'
    ? '<b>✓ 连对 2 次，已移出在册错题</b><br>这道题结案啦，可以从错题本里翻篇了。'
    : ok ? `<b>✓ 记一次做对（连对 ${after.streak||0}/2）</b><br>下次复习：${dueOf(after)?esc(cnDate(dueOf(after))):'—'}，再做对一次就结案。`
         : '<b>✕ 又错了，复习周期已重置</b><br>重新按第 1 / 3 / 7 天推送，隔天再来，不用急。';
  const box=$('#redoResult');
  if(box) box.innerHTML=`<div class="redo-result ${ok?'good':'bad'}">${msg}</div>
    <div class="btn-row"><button class="btn" data-action="next-redo">下一题 ›</button>
    <button class="btn ghost" data-action="wrong-browse">← 返回在册列表</button></div>`;
  toast(ok?'✓ 记一次做对':'已重置复习周期（1/3/7 天重新计算）');
}
function nextRedo(){
  if(!REDO_QUEUE.length){ openWrongBrowse(); return; }
  let i=REDO_IDX+1;
  while(i<REDO_QUEUE.length){
    const m=S.mistakes.find(x=>x.id===REDO_QUEUE[i]);
    if(m&&m.status==='active'){ REDO_IDX=i; openRedo(m.id,true); return; }
    i++;
  }
  toast('这一批都做完啦');
  openWrongBrowse();
}

/* ---------------- 导出 ---------------- */
function exportCSV(){
  const list=filteredMistakes();
  const head=['错题日期','所属阶段','所属专题','知识点/题型','类型','题目内容','孩子答案','正确答案','错误原因','备注','状态','下次复习','连续做对'];
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""').replace(/\r?\n/g,' ')+'"';
  const rows=list.map(m=>[m.date,m.stage,topicTagOf(m),m.tag,m.type==='calc'?'计算题':'应用题',m.question,m.childAnswer,m.correctAnswer,m.reason,m.note,
    m.status==='graduated'?'已移出':'在册',dueOf(m)||'',m.streak||0].map(q).join(','));
  download('错题本_'+TODAY()+'.csv','\uFEFF'+[head.map(q).join(','),...rows].join('\r\n'),'text/csv;charset=utf-8');
}
async function exportPrint(){
  const list=filteredMistakes(), pics={};
  for(const m of list) if(m.imageKey) pics[m.id]=await IMG.get(m.imageKey);
  $('#printArea').innerHTML=`<h2 style="font-size:17px;margin:0 0 4px">错题本 · ${TODAY()}</h2>
    <p style="font-size:12px;color:#666;margin:0 0 12px">共 ${list.length} 题 ｜ 在册 ${activeMistakes().length} ｜ 1/3/7 天复习 · 连对 2 次移出</p>`+
    list.map((m,i)=>`<div class="wrong-card">
      <div style="font-size:12px;color:#666">${i+1}. ${esc(m.date)} ｜ ${esc(m.stage)} ｜ ${esc(m.tag)} ｜ ${esc(m.reason)} ｜ ${m.type==='calc'?'计算题':'应用题'}</div>
      <div style="font-size:14px;margin:6px 0">${esc(m.question||'（题目见图片）')}</div>
      ${pics[m.id]?`<img class="thumb" src="${pics[m.id]}" alt="题目图片" style="max-height:150px">`:''}
      ${m.fileName?`<div style="font-size:12px;color:#666">📎 见附件：${esc(m.fileName)}</div>`:''}
      <div style="font-size:12px;color:#666">孩子答案：${esc(m.childAnswer||'—')} ｜ 正确答案：${esc(m.correctAnswer||'—')}</div>
      ${m.note?`<div style="font-size:12px;color:#666">备注：${esc(m.note)}</div>`:''}
      <div style="border-top:1px dashed #ccc;margin-top:10px;padding-top:6px;font-size:12px;color:#999">重做区：____________________________________________</div>
    </div>`).join('');
  setTimeout(()=>window.print(),150);
}
async function backup(){
  const images=await IMG.all();
  download('数学工作台备份_'+TODAY()+'.json',JSON.stringify({app:'mxwb',version:1,exportedAt:new Date().toISOString(),state:S,images:images}));
  toast('备份已导出，请妥善保存');
}
async function restore(file){
  try{
    const data=JSON.parse(await file.text());
    if(data.app!=='mxwb'||!data.state) throw new Error('bad');
    if(!confirm('导入将覆盖当前设备上的全部进度与错题，确定继续？')) return;
    const b=blank(); S=Object.assign(b,data.state);
    S.settings=Object.assign({},DEF_SETTINGS,data.state.settings||{});
    ['calcSessions','wordItems','mistakes','library'].forEach(k=>{ if(!Array.isArray(S[k])) S[k]=[]; });
    await IMG.clear();
    const imgs=data.images||{};
    for(const k of Object.keys(imgs)) await IMG.put(k,imgs[k]);
    save(); renderAll(); toast('导入完成');
  }catch(e){
    if(e && /空间不足|Quota|quota/i.test(String(e.message||e)))
      toast('导入失败：本机网页存储不足。请先清理旧数据，或改用「启动工作台.bat」打开后重新导入');
    else toast('备份文件格式不对，导入失败');
  }
}

/* ---------------- 通知 ---------------- */
let notified=false;
function maybeNotify(){
  const n=dueMistakes().length;
  if(!S.settings.notify||!n||notified||!('Notification' in window)) return;
  if(Notification.permission==='default'){ Notification.requestPermission(); return; }
  if(Notification.permission==='granted'){ notified=true; try{ new Notification('数学学习工作台',{body:`今天有 ${n} 道错题到期复习，来做一遍吧`}); }catch(e){} }
}

/* ---------------- 事件 ---------------- */
/* ================= 阶段时间线 / 每日节奏 / 达标测试 ================= */
const CAL = window.SCHOOL_CAL || [];
let MT=null;                                   // 当前达标测试
function calOf(stage){ return CAL.find(c=>c.stage===stage); }
function isHoliday(date,cal){ return (cal.holidays||[]).some(h=>date>=h.from && date<=h.to); }
function stageStudyDays(cal){
  if(!cal) return 0; let n=0,d=cal.start;
  while(d<=cal.end){ if(!isHoliday(d,cal)) n++; d=addDays(d,1); }
  return n;
}
/* ---- 周计划：以「周」为单位排课 ----
   每个任务按难度赋权：难项(分数乘除/数论/行程/计数/工程/综合)=2 周，普通=1 周，复盘/总测/套卷=轻量(并入相邻周)。
   学期内(term)严格 1 任务/周；假期(break)任务多于周数，按比例压缩成「密集周」(每周多项)。
   每周节奏：约 2 小时，周一/三/五学新，周六日复习+本周错题（见 weeklySession）。 */
const WEEK_STUDY_DAYS=[1,3,5];    // 周一三五：学新（计算+专题）
const WEEK_REVIEW_DAYS=[6,0];    // 周六日：复习本周 + 本周错题
const WEEK_FLEX_DAYS=[2,4];      // 周二四：弹性日（可补做/复习，非必需）
const WEEKLY_HOURS=2;            // 每周自学约 2 小时
const CALC_W={decadd:1,decmul:1,decdiv:1,decmix:1,mixed:1,numth:2,fracbase:1,fracadd:1,fracmul:2,eq:1,ratio:1,percent:1,junior:1};
const TOPIC_W={行程:2,数论:2,计数:2,工程:2,综合:2};
function isLightTask(t){ return t.type==='复盘节点'||t.type==='阶段测试'||t.type==='套卷'||/复盘|总测|套卷/.test(t.topicTag||''); }
function taskWeight(t){
  const light=isLightTask(t);
  const hard=(CALC_W[t.calcTag]||1)===2 || (TOPIC_W[t.topicTag]||1)===2;
  return {w: light?0.5:(hard?2:1), hard, light};
}
/* 阶段第 1 周的周一：取「不早于阶段起点的第一个周一」，既对齐周节奏又不早于官方日期 */
function stageMonday(stage){
  const cal=calOf(stage); if(!cal) return null;
  const d=new Date(cal.start+'T00:00:00'); const dow=d.getDay();   // 0=周日..6=周六
  const add = dow===1?0:(dow===0?1:8-dow);                        // 距「当日或之后的周一」天数
  return addDays(cal.start, add);
}
/* 第 wk 周的具体日期区间（周一~周日） */
function weekDates(wk,stage){
  const mon=stageMonday(stage); if(!mon) return {mon:null,sun:null};
  const m=addDays(mon,(Math.max(1,wk)-1)*7); return {mon:m,sun:addDays(m,6)};
}
/* 核心：返回该阶段每任务的周计划 {week, span, start, end, hard, light, dense, compress} */
function weekPlan(stage){
  const cal=calOf(stage), list=TASKS.filter(t=>t.stage===stage);
  if(!cal||!list.length) return {};
  const W=Math.max(1,Math.floor(stageStudyDays(cal)/7));   // 阶段有效周数
  const wts=list.map(taskWeight);
  const total=wts.reduce((a,x)=>a+x.w,0);
  const compress = total>W;                                // 任务多于周数→假期密集排（保证不超出 W 周）
  const mon=stageMonday(stage), out={};
  if(!compress){
    // 学期内：严格顺序，难项占 2 周并把后续任务推后；轻量任务并入相邻周
    let cursor=1, prevStudy=1;
    list.forEach((t,i)=>{
      const x=wts[i];
      if(x.light){ out[t.id]={week:prevStudy,span:0,light:true,hard:false,dense:false,compress,start:null,end:null}; return; }
      const wk=Math.max(1, Math.floor(cursor-1e-9)+1), span=x.w;
      const m=addDays(mon,(wk-1)*7), e=addDays(m, Math.max(0,Math.round(span)*7-1));
      out[t.id]={week:wk,span,light:false,hard:x.hard,dense:false,compress,start:m,end:e};
      prevStudy=wk; cursor+=span;
    });
  } else {
    // 假期密集：把非轻量任务均匀铺到 W 周内，保证不超出 W 周
    const nlIdx=[]; list.forEach((t,i)=>{ if(!wts[i].light) nlIdx.push(i); });
    const weeksUsed=Math.min(W, nlIdx.length);
    const weekOf={}; nlIdx.forEach((idx,k)=>{ weekOf[idx] = weeksUsed===0?1:Math.floor(k*weeksUsed/nlIdx.length)+1; });
    let prevStudy=1;
    list.forEach((t,i)=>{
      const x=wts[i];
      if(x.light){ out[t.id]={week:prevStudy,span:0,light:true,hard:false,dense:false,compress,start:null,end:null}; return; }
      const wk=weekOf[i];
      const m=addDays(mon,(wk-1)*7), e=addDays(m,6);
      out[t.id]={week:wk,span:1,light:false,hard:x.hard,dense:false,compress,start:m,end:e};
      prevStudy=wk;
    });
  }
  const byWeek={};
  list.forEach(t=>{ const o=out[t.id]; if(o&&!o.light){(byWeek[o.week]=byWeek[o.week]||[]).push(t.id);} });
  Object.keys(byWeek).forEach(w=>{ if(byWeek[w].length>1) byWeek[w].forEach(id=>{ out[id].dense=true; }); });
  return out;
}
function taskWeek(id){ const t=TASKMAP[id]; return t?weekPlan(t.stage)[id]||null:null; }
/* 星期几→当日节奏 */
function weeklySession(dow){
  if(WEEK_STUDY_DAYS.indexOf(dow)>=0) return {type:'study',label:'学新：计算 + 专题'};
  if(WEEK_REVIEW_DAYS.indexOf(dow)>=0) return {type:'review',label:'复习本周 + 做本周错题'};
  return {type:'flex',label:'弹性日：可补做 / 复习（非必需）'};
}
/* 该任务本周学什么（分数/分数应用类难项 2 周给出分阶段提示） */
function weekFocus(t,subIdx){
  const base=`计算·${calcName(t.calcTag)}${calcIsNew(t)?'（新学）':'（保温）'} ｜ 专题·${t.topicTag}`;
  if(t.calcTag==='fracmul'||/分数/.test(t.topicTag||'')) return subIdx===2?base+'（第2周：综合+易错专练）':base+'（第1周：打基础）';
  return base;
}

/* ---- 每日计算：本任务新学/保温 + 掺入薄弱点保温 ---- */
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=R(0,i); const x=a[i]; a[i]=a[j]; a[j]=x; } return a; }
function priorStageTags(t){
  const si=parseInt((t.stage||'S1').slice(1),10)||1;
  const set=[...new Set(TASKS.filter(x=>parseInt((x.stage||'S1').slice(1),10)<si).map(x=>x.calcTag))].filter(x=>x!=='mixed'&&x!=='decmix');
  return set.length?set:['decadd'];
}
function makeDailyCalc(t){
  const oral=clamp(S.settings.oralCount,0,60), wri=clamp(S.settings.writtenCount,0,60);
  const items=makePaper(t, Math.max(0,oral-2), Math.max(0,wri-1)).items;
  const weak=[...new Set((S.mistakes||[]).filter(m=>m.type==='calc'&&m.status==='active').map(m=>m.tag))];
  const pool=weak.length?weak:priorStageTags(t);
  shuffle(pool).slice(0,2).forEach(tg=>{ const fn=GEN[tg]||GEN.mixed;
    items.push(Object.assign({kind:'口算',tag:tg,key:uid(),review:true},fn('oral')));
    items.push(Object.assign({kind:'笔算',tag:tg,key:uid(),review:true},fn('written'))); });
  return {tag:effectiveTag(t), items:items, at:new Date().toISOString(), isDaily:true};
}

/* ---- 达标测试：计算(自动判分) + 应用题(优先错题库举一反三，家长判分) ---- */
function buildMasteryTest(t){
  const cp=makePaper(t, 4, 2);
  const calcItems=cp.items.map(q=>({kind:'calc',tag:q.tag,stem:q.stem,ans:q.ans,graded:'auto',given:'',ok:null}));
  const tag=t.topicTag, wordItems=[];
  (S.mistakes||[]).filter(m=>m.status==='active'&&topicTagOf(m)===tag).slice(0,2)
    .forEach(m=>wordItems.push({kind:'word',cat:tag,src:'错题',stem:m.question,imgKey:m.imageKey,fileKey:m.fileKey||'',fileName:m.fileName||'',fileType:m.fileType||'',ans:m.correctAnswer,childAns:m.childAnswer,graded:'manual',verdict:null,reason:m.reason||''}));
  let need=Math.max(0,4-wordItems.length);
  if(need>0){ try{ (window.makeVariants?window.makeVariants(tag,need,GUIDE[tag]):[]).forEach(v=>wordItems.push({kind:'word',cat:tag,src:'变式',stem:v.q,ans:v.ans,sol:v.sol,graded:'manual',verdict:null,reason:''})); }catch(e){} need=Math.max(0,4-wordItems.length); }
  if(need>0){ (S.library||[]).filter(x=>x.tag===tag).slice(0,need).forEach(x=>wordItems.push({kind:'word',cat:tag,src:'题库',stem:x.text,imgKey:x.imageKey,fileKey:x.fileKey||'',fileName:x.fileName||'',fileType:x.fileType||'',ans:x.correctAnswer,graded:'manual',verdict:null,reason:''})); need=Math.max(0,4-wordItems.length); }
  if(need>0){ ((GUIDE[tag]||{}).examples||[]).slice(0,need).forEach(e=>wordItems.push({kind:'word',cat:tag,src:'例题',stem:e.q,ans:e.ans,sol:e.sol,graded:'manual',verdict:null,reason:''})); }
  return {taskId:t.id, items:calcItems.concat(wordItems), submitted:false, rate:null, passed:null, wrong:[]};
}
function openMasteryTest(id){ const t=TASKMAP[id]; if(!t) return; MT=buildMasteryTest(t); openSheet(`${t.id} · 达标测试`, `<div id="mtBox"></div>`); renderMastery(); }
function renderMastery(){
  const box=$('#mtBox'); if(!box||!MT) return;
  const calcN=MT.items.filter(i=>i.kind==='calc').length, wordN=MT.items.length-calcN;
  if(!MT.submitted){
    box.innerHTML=`<div class="card"><p class="hint">共 ${MT.items.length} 题：计算 <b>${calcN}</b> 题（填答案自动判分）+ 应用题 <b>${wordN}</b> 题（写完请家长点「对/错」）。提交后看是否 ≥80% 过关。</p>
      ${MT.items.map((it,i)=>it.kind==='calc'
        ? `<div class="q-item" id="mtq-${i}"><span class="qn">${i+1}</span><span class="qs">${esc(it.stem)}</span><input type="text" inputmode="decimal" data-mi="${i}" placeholder="答案"><span class="mark"></span></div>`
        : `<div class="q-item word" id="mtq-${i}"><span class="qn">${i+1}</span><div class="qw-body">
             <div class="qs">${it.imgKey?`<img class="thumb" data-img-key="${esc(it.imgKey)}">`:''}${esc(it.stem)}</div>
             ${attachHTML(it)}
             <details><summary>👁 看正确答案</summary><div class="ex-ans">答案：${esc(it.ans||'(请家长核对)')}</div>${it.sol?`<ol>${it.sol.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}</div></details>
             <div class="verdict-row"><span>孩子做：</span><button class="vbtn ${it.verdict===true?'on':''}" data-action="mt-verdict" data-i="${i}" data-v="1">✓ 对</button><button class="vbtn ${it.verdict===false?'on':''}" data-action="mt-verdict" data-i="${i}" data-v="0">✕ 错</button><small class="vsrc">来源：${esc(it.src)}</small></div>
           </div></div>`).join('')}
      <div class="btn-row"><button class="btn" data-action="submit-mastery">提交判分（≥80% 过关）</button></div></div>`;
    hydrateImages(box);
    hydrateAttachments(box);
  } else {
    const total=MT.items.length, correct=MT.items.filter(it=>it.kind==='calc'?it.ok:it.verdict===true).length;
    box.innerHTML=`<div class="result-box ${MT.passed?'':'bad'}">本次正确率 <b>${MT.rate}%</b>（${correct}/${total}）｜ 过关线 80% ｜ ${MT.passed?'✅ 通过':'❌ 未通过'}</div>`
      + (MT.passed
        ? `<div class="card"><p class="hint">已满足「达标测试通过」，可标记本任务完成并进入下一任务。</p><div class="btn-row"><button class="btn" data-action="complete-task" data-id="${MT.taskId}">✓ 标记完成，进入下一任务</button><button class="btn ghost" data-action="open-mastery" data-id="${MT.taskId}">再测一次</button></div></div>`
        : diagnosisHTML(MT));
  }
}
function diagnosisHTML(mt){
  const wrong=mt.items.filter(it=>it.kind==='calc'? !it.ok : it.verdict===false);
  const groups={};
  wrong.forEach(it=>{ const k=it.kind==='calc'?('计算·'+calcName(it.tag)):('专题·'+it.cat); (groups[k]=groups[k]||[]).push(it); });
  const cats=Object.keys(groups);
  let html=`<div class="card diag"><h3>🧩 错在哪？诊断与建议</h3><p class="hint">共错 ${wrong.length} 题，集中在下面 ${cats.length} 类。先把对应讲解和易错点过一遍，再点「再测一次」。</p>`;
  cats.forEach(k=>{
    const items=groups[k], catKey=k.replace(/^(计算|专题)·/,''), g=GUIDE[catKey]||{}, traps=(g.traps||[]).slice(0,2);
    html+=`<div class="diag-group"><div class="dg-h">${esc(k)} · 错 ${items.length} 题</div>`
      + (traps.length?`<div class="dg-tip">⚠ 易错点：${traps.map(esc).join('；')}</div>`:'')
      + `<div class="dg-adv">👉 建议：回到「${esc(catKey)}」讲解，重点看上面的易错点；${k.indexOf('计算')===0?'把这类计算再练 5–10 道':'把这类应用题的例题自己写一遍完整步骤'}。</div></div>`;
  });
  html+=`<div class="btn-row"><button class="btn" data-action="open-mastery" data-id="${mt.taskId}">🔁 再测一次</button><button class="btn ghost" data-action="open-task" data-id="${mt.taskId}">看讲解 ›</button></div></div>`;
  return html;
}
function submitMastery(){
  if(!MT||MT.submitted) return;
  MT.items.forEach((it,i)=>{
    if(it.kind==='calc'){
      const el=document.querySelector(`[data-mi="${i}"]`);
      it.given=el?el.value.trim():''; it.ok=isRight(it.given,it.ans);
      if(!it.ok && !S.mistakes.some(m=>m.status==='active'&&m.question===it.stem&&m.type==='calc'))
        addMistake({taskId:MT.taskId,stage:TASKMAP[MT.taskId].stage,tag:D.calcTagNames[it.tag]||it.tag,type:'calc',question:it.stem,childAnswer:it.given||'(未填)',correctAnswer:it.ans,reason:'计算失误'});
    }
  });
  const total=MT.items.length, correct=MT.items.filter(it=>it.kind==='calc'?it.ok:it.verdict===true).length;
  MT.rate=Math.round(correct/total*100); MT.submitted=true; MT.passed=MT.rate>=80;
  if(MT.passed){ prog(MT.taskId).passed=true; save(); }
  renderMastery(); renderAll();
  toast(MT.passed?'✅ 通过！可标记完成进入下一任务':'未达 80%，看下面的诊断和薄弱点再测一次');
}

/* ---- 时间线页 ---- */
function renderPlan(){
  const el=$('#planList'); if(!el) return;
  let html=`<div class="card"><h3>📅 学校日历与每周节奏（南宁校历口径）</h3>
    <p class="hint">S1–S3 按家长提供日期；S4–S8 为推算的「预测」值，官方校历公布后改 calendar.js 即可。春节等假期自动不排新课。</p>
    <p class="hint">📌 每周约 <b>${WEEKLY_HOURS}</b> 小时：<b>周一/三/五</b>学新（计算+专题），<b>周六日</b>复习本周+做本周错题。学期内 1 任务/周（难项 2 周）；寒暑假密集排（无课可多学）。</p>
    <div class="cal-grid">${CAL.map(c=>{ const sd=stageStudyDays(c), tn=TASKS.filter(t=>t.stage===c.stage).length, W=Math.floor(sd/7);
      return `<div class="cal-card ${c.predicted?'pred':''}"><div class="cc-h">${esc(c.stage)} · ${esc(c.name)}${c.predicted?' <small>预测</small>':''}</div>
        <div class="cc-range">${cnDate(c.start)} – ${cnDate(c.end)}</div>
        <div class="cc-meta">共 ${dayDiff(c.start,c.end)+1} 天 ｜ 有效 ${sd} 天≈${W} 周 ｜ ${tn} 任务 ｜ <b>${c.mode==='break'?'假期·密集排':'学期·1项/周'}</b></div>
        ${c.holidays&&c.holidays.length?`<div class="cc-holi">🏮 ${c.holidays.map(h=>h.label+'（'+cnDate(h.from)+'–'+cnDate(h.to)+'）').join('；')}</div>`:''}
      </div>`; }).join('')}</div></div>`;
  html+=STAGES.map(st=>{
    const list=TASKS.filter(t=>t.stage===st), wins=weekPlan(st), cur=currentTask();
    const wkList=list.map(t=>wins[t.id]).filter(Boolean);
    const maxWeek=wkList.length?Math.max.apply(null,wkList.map(w=>w.week)):0;
    const surplus = Math.floor(stageStudyDays(calOf(st))/7) - maxWeek;
    const rows=list.map(t=>{ const w=wins[t.id], p=prog(t.id), done=!!S.completed[t.id];
      let status='', cls='';
      if(done){ status='✓ '+S.completed[t.id].at.slice(5); cls='done'; }
      else if(w&&w.start){ const diff=dayDiff(TODAY(),w.end); status=diff<0?('⏰ 滞后 '+Math.abs(diff)+' 天'):('剩 '+diff+' 天'); cls=diff<0?'late':(diff<=3?'soon':''); }
      const wr = w&&w.start ? `${cnDate(w.start)}–${cnDate(w.end)}` : '复盘周';
      const diffTag = w?(w.dense?'<span class="week-badge dense">密集</span>':(w.light?'<span class="week-badge light">复盘</span>':(w.hard&&!w.compress?'<span class="week-badge hard">难·2周</span>':'<span class="week-badge">1周</span>'))):'';
      return `<tr class="${cls} ${cur&&cur.id===t.id?'cur':''}">
        <td class="t-id"><b>${esc(t.id)}</b></td>
        <td class="wk">第 ${w?w.week:'—'} 周${diffTag}</td>
        <td>${esc(wr)}</td>
        <td>${p.start?cnDate(p.start):'<span class="muted">未开始</span>'}${p.end?' ~ '+cnDate(p.end):''}</td>
        <td class="${cls}">${esc(status)}</td>
        <td class="t-act"><input type="date" class="pa" data-pa="start" data-id="${esc(t.id)}" value="${p.start||''}" title="实际开始"><input type="date" class="pa" data-pa="end" data-id="${esc(t.id)}" value="${p.end||''}" title="实际结束"></td>
      </tr>`;
    }).join('');
    return `<div class="plan-stage"><div class="ps-h">${esc(st)} · ${esc(list[0].stageName)} ｜ 共 ${maxWeek} 教学周${surplus>0?(' ｜ 富余 '+surplus+' 周(弹性复习)')

  :''}</div>
      <table class="plan-table"><thead><tr><th>任务</th><th>第几周</th><th>建议周(月/日)</th><th>实际用时</th><th>状态</th><th>记录实际日期</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
  el.innerHTML=html;
}

document.addEventListener('click',e=>{
  const tab=e.target.closest('.tab[data-tab]');
  if(tab){ goPage(tab.dataset.tab); return; }
  const el=e.target.closest('[data-action]'); if(!el) return;
  const a=el.dataset.action, id=el.dataset.id;
  switch(a){
    case 'go-home': goPage('home'); break;
    case 'go-overview': goPage('overview'); break;
    case 'go-settings': goPage('settings'); break;
    case 'go-wrong': goPage('wrong'); break;
    case 'go-back': goBack(); break;
    case 'go-library': closeSheet(); goPage('library'); break;
    case 'open-inbox': openInbox(); break;
    case 'inbox-photo': { const f=$('#inboxFile'); if(f) f.click(); break; }
    case 'inbox-save': saveInbox(); break;
    case 'open-attach': openAttachSheet(); break;
    case 'attach-pick': { const f=$('#attachFile'); if(f) f.click(); break; }
    case 'attach-save': saveAttach(); break;
    case 'pick-topic': { const s=$('#inboxTag'); if(s){ s.value=id; toast('已改判为「'+id+'」'); } break; }
    case 'lib-filter': LIBFILTER.tag=id||''; renderLibrary(); break;
    case 'lib-answer': libAnswer(el); break;
    case 'lib-delete': {
      const it=(S.library||[]).find(x=>x.id===id);
      if(!confirm(it&&it.kind==='file'
        ? '删掉这份附件？（文件会从本机删除；关联的错题会保留文字，但附件链接会失效）'
        : '删掉这道随手录入的题？不影响任务进度和错题本。')) break;
      if(it&&it.fileKey){
        IMG.del(it.fileKey);
        (S.mistakes||[]).forEach(m=>{ if(m.fileKey===it.fileKey){ delete m.fileKey; delete m.fileName; delete m.fileType; } });
      }
      S.library=S.library.filter(x=>x.id!==id); save(); renderAll(); toast('已删除'); break; }
    case 'variants': openVariants(id); break;
    case 'var-answer': varAnswer(el); break;
    case 'var-again': openVariants(id,true); break;
    case 'toggle-dir': { const d=$('#dir-'+id); if(d) d.classList.toggle('hidden'); break; }
    case 'wrong-clear-filter': wrongClearFilter(); break;
    case 'test-ai': testAI(); break;
    case 'sync-now': doSyncNow(); break;
    case 'sync-test': testSync(); break;
    case 'close-sheet': closeSheet(); break;
    case 'toggle-stage': {
      const box=$('#ov-'+id); if(!box) break;
      box.classList.toggle('hidden');
      const tg=el.querySelector('.ov-toggle');
      if(tg) tg.textContent=box.classList.contains('hidden')?'▸ 展开任务清单':'▾ 收起任务清单';
      break; }
    case 'ov-expand': $$('.ov-list').forEach(x=>x.classList.remove('hidden'));
      $$('.ov-toggle').forEach(x=>x.textContent='▾ 收起任务清单'); break;
    case 'ov-collapse': $$('.ov-list').forEach(x=>x.classList.add('hidden'));
      $$('.ov-toggle').forEach(x=>x.textContent='▸ 展开任务清单'); break;
    case 'open-wrong-browse': openWrongBrowse(); break;
    case 'wrong-browse': openWrongBrowse(); break;
    case 'bf-quick': {
      BROWSE.quick=el.dataset.v||'';
      if(BROWSE.quick!=='custom'){ BROWSE.from=''; BROWSE.to=''; }
      BROWSE.collapsed={}; renderBrowse(); break; }
    case 'bf-topic': BROWSE.topic=el.dataset.v||''; BROWSE.collapsed={}; renderBrowse(); break;
    case 'bf-clear-dates': BROWSE.quick=''; BROWSE.from=''; BROWSE.to=''; renderBrowse(); break;
    case 'bf-clear': bfReset(); openWrongBrowse(); toast('筛选已清除'); break;
    case 'bf-select-all': { const l=bfFiltered(); l.forEach(m=>{BROWSE.sel[m.id]=true;});
      $$('.bf-check').forEach(c=>{ c.checked=true; });
      $$('.browse-card').forEach(c=>c.classList.add('picked'));
      bfSyncSel(l); break; }
    case 'bf-select-none': BROWSE.sel={};
      $$('.bf-check').forEach(c=>{ c.checked=false; });
      $$('.browse-card').forEach(c=>c.classList.remove('picked'));
      bfSyncSel(); break;
    case 'bf-select-group': {
      const k=el.dataset.g, l=bfFiltered();
      l.filter(m=>bfGroupKey(m)===k).forEach(m=>{BROWSE.sel[m.id]=true;});
      renderBrowse(); break; }
    case 'bf-redo-selected': startRedoQueue(bfSelectedIds(bfFiltered())); break;
    case 'bf-redo-filtered': startRedoQueue(bfFiltered().map(m=>m.id)); break;
    case 'bf-redo-group': startRedoQueue(bfFiltered().filter(m=>bfGroupKey(m)===el.dataset.g).map(m=>m.id)); break;
    case 'bf-toggle-group': {
      const k=el.dataset.g||''; BROWSE.collapsed[k]=!BROWSE.collapsed[k];
      const body=el.nextElementSibling; if(body) body.classList.toggle('hidden',!!BROWSE.collapsed[k]);
      const ar=el.querySelector('span'); if(ar) ar.textContent=(BROWSE.collapsed[k]?'▸ ':'▾ ')+k;
      break; }
    case 'view-wrong': openWrongDetail(id); break;
    case 'redo-one': startRedoQueue([id]); break;
    case 'redo-all': startRedoQueue(bfFiltered().map(m=>m.id)); break;
    case 'redo-submit': redoSubmit(id); break;
    case 'redo-verdict': redoVerdict(id,el.dataset.v==='ok'); break;
    case 'next-redo': nextRedo(); break;
    case 'calc-guide': openCalcGuide(id); break;
    case 'jump-first-wrong': {
      const w=document.querySelector('.q-wrong');
      if(w&&w.scrollIntoView) w.scrollIntoView({behavior:'smooth',block:'center'});
      break; }
    case 'open-calc': openCalc(id); break;
    case 'open-word': openWord(id); break;
    case 'open-task': openTaskDetail(id); break;
    case 'complete-task': completeTask(id); closeSheet(); break;
    case 'set-current': S.currentId=id; save(); closeSheet(); renderAll(); toast('已设为当前任务'); break;
    case 'toggle-done': {
      e.stopPropagation();
      if(S.completed[id]){ if(confirm('取消该任务的完成标记？')){ delete S.completed[id]; S.currentId=id; save(); renderAll(); } }
      else completeTask(id);
      break; }
    case 'gen-paper': genPaper(null); break;
    case 'regen-paper': genPaper(PAPER?PAPER.tag:null); break;
    case 'submit-paper': submitPaper(); break;
    case 'word-photo': $('#wordFile').click(); break;
    case 'word-ocr': runOCR(); break;
    case 'word-verdict': saveWord(el.dataset.v); break;
    case 'review-ok': reviewMistake(id,true); renderAll(); toast('✓ 记一次做对'); break;
    case 'review-fail': reviewMistake(id,false); renderAll(); toast('已重置复习周期（1/3/7 天重新计算）'); break;
    case 'edit-wrong': openWrongEdit(id); break;
    case 'save-wrong-edit': {
      const m=S.mistakes.find(x=>x.id===id); if(!m) break;
      m.reason=$('#edReason').value; m.note=$('#edNote').value.trim();
      m.correctAnswer=$('#edCorrect').value.trim(); m.childAnswer=$('#edChild').value.trim();
      save(); goBack(); renderAll(); toast('已保存'); break; }
    case 'export-print': exportPrint(); break;
    case 'export-wrong-csv': exportCSV(); break;
    case 'backup': backup(); break;
    case 'restore': $('#restoreFile').click(); break;
    case 'reset': if(confirm('⚠ 将清空全部任务进度、练习记录和错题（含图片），且不可恢复。建议先导出备份。确定清空？'))
      { S=blank(); save(); IMG.clear(); renderAll(); toast('已清空'); } break;
    case 'go-plan': goPage('plan'); break;
    case 'daily-calc': { const t=TASKMAP[id]; if(t){ openCalc(t.id, makeDailyCalc(t)); logToday(t.id,{calc:true}); } break; }
    case 'daily-word': { const t=TASKMAP[id]; if(t){ openWord(t.id); logToday(t.id,{word:true}); } break; }
    case 'open-mastery': openMasteryTest(id); break;
    case 'week-review': { const cur=currentTask(); if(cur){ const wp=taskWeek(cur.id); const ds=wp&&wp.week?weekDates(wp.week,cur.stage):null; BROWSE.quick='custom'; BROWSE.from=ds?ds.mon:''; BROWSE.to=ds?ds.sun:''; openWrongBrowse(); } break; }
    case 'submit-mastery': submitMastery(); break;
    case 'mt-verdict': { const i=+el.dataset.i; if(MT&&MT.items[i]){ MT.items[i].verdict = el.dataset.v==='1'; renderMastery(); } break; }
  }
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='restoreFile'&&t.files[0]){ restore(t.files[0]); t.value=''; return; }
  if((t.id==='wordFile'||t.id==='inboxFile')&&t.files[0]){ handlePhoto(t.files[0]); return; }
  if(t.id==='attachFile'&&t.files[0]){ attachFilePicked(t.files[0]); return; }
  if(t.id==='taskStageFilter'||t.id==='taskStateFilter'){ renderTasks(); return; }
  if(t.id==='inboxWrong'){ const w=$('#inboxReasonWrap'); if(w) w.classList.toggle('hidden',!t.checked); return; }
  if(t.id==='attachToWrong'){ const w=$('#attachReasonWrap'); if(w) w.classList.toggle('hidden',!t.checked); return; }
  if(t.id==='bfFrom'||t.id==='bfTo'){
    BROWSE.from=$('#bfFrom')?$('#bfFrom').value:''; BROWSE.to=$('#bfTo')?$('#bfTo').value:'';
    BROWSE.quick='custom'; BROWSE.collapsed={}; renderBrowse(); return; }
  if(t.classList&&t.classList.contains('bf-check')){
    if(t.checked) BROWSE.sel[t.dataset.id]=true; else delete BROWSE.sel[t.dataset.id];
    const card=t.closest?t.closest('.browse-card'):null;
    if(card&&card.classList) card.classList.toggle('picked',!!t.checked);
    bfSyncSel(); return; }
  const bfMap={bfStage:'stage',bfReason:'reason',bfType:'type',bfGroup:'group',bfSort:'sort'};
  if(bfMap[t.id]){ BROWSE[bfMap[t.id]]=t.value; BROWSE.collapsed={}; renderBrowse(); return; }
  if(t.classList&&t.classList.contains('paper-reason')){ setMistakeField(t.dataset.id,'reason',t.value); return; }
  if(t.classList&&t.classList.contains('paper-note')){ setMistakeField(t.dataset.id,'note',t.value.trim()); return; }
  if(t.classList&&t.classList.contains('lib-retag')){
    const it=(S.library||[]).find(x=>x.id===t.dataset.id);
    if(it){ it.tag=t.value; it.auto=false; save(); renderAll(); toast('已改判到「'+t.value+'」'); }
    return;
  }
  if(t.id==='libFilterTag'){ LIBFILTER.tag=t.value; renderLibrary(); return; }
  const FILTERS=['fStage','fTopic','fTag','fReason','fStatus','fType','fDateQuick','fDateFrom','fDateTo','fSort','fGroup','fKeyword'];
  if(FILTERS.indexOf(t.id)>=0){
    t.dataset.v=t.value;
    if((t.id==='fDateFrom'||t.id==='fDateTo')&&t.value){ const q=$('#fDateQuick'); if(q){ q.value='custom'; q.dataset.v='custom'; } }
    renderWrong(); return;
  }
  const map={setCalc:'calcThreshold',setWord:'wordThreshold',setOral:'oralCount',setWritten:'writtenCount'};
  if(map[t.id]){ S.settings[map[t.id]]=clamp(parseInt(t.value,10)||0,0,t.id==='setOral'||t.id==='setWritten'?60:100); save(); renderHome(); return; }
  const sw={setRequireWord:'requireWord',setAllowSkip:'allowSkip',setNotify:'notify',setAiEnabled:'aiEnabled'};
  if(sw[t.id]){ S.settings[sw[t.id]]=t.checked; save(); if(sw[t.id]==='notify'&&t.checked) maybeNotify(); renderHome(); return; }
  const aiMap={setAiEndpoint:'aiEndpoint',setAiModel:'aiModel',setAiKey:'aiKey'};
  if(aiMap[t.id]){ S.settings[aiMap[t.id]]=String(t.value||'').trim(); save(); return; }
  if(t.id==='setRepo'){ SYNC.setRepo(t.value); return; }
  if(t.id==='setToken'){ SYNC.setToken(t.value.trim()); updateSyncChip('令牌已保存'); return; }
  if(t.classList&&t.classList.contains('pa')){
    const p=prog(t.dataset.id), f=t.dataset.pa;
    p[f]=t.value||null; save(); renderPlan(); return;
  }
  if(t.id==='dailyFocus'){ const cur=currentTask(); if(cur) logToday(cur.id,{topicFocus:t.value}); return; }
  if(t.id==='dailyWord'){ const cur=currentTask(); if(cur) logToday(cur.id,{word:t.checked}); return; }
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='inboxText'){ updateGuess(); return; }
  if(t.id==='fKeyword'){ renderWrong(); return; }
  if(t.id==='bfKeyword'){ BROWSE.keyword=t.value; BROWSE.collapsed={}; renderBrowse(); return; }
  if(t.id==='libFilterKw'){ LIBFILTER.kw=t.value; renderLibrary(); return; }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') goBack(); });

/* ---------------- 启动 ---------------- */
if('serviceWorker' in navigator && /^https?:/.test(location.protocol)){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
boot();
})();
