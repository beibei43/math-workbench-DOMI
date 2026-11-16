/* 数学学习工作台 · 纯前端 / 无后端 / 数据全本地 */
(function(){
'use strict';

/* ---------------- 基础工具 ---------------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
const D  = window.APP_DATA;
const APP_VER = 'v24';   /* 界面上可见的版本号：更新后数字变了，说明新文件已生效 */
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
                           calcSessions:[], wordItems:[], mistakes:[], library:[], progress:{}, masteryLog:[],
                           pathDone:{}, week:null }; }
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw) return blank();
    const s=JSON.parse(raw);
    const b=blank();
    s.settings=Object.assign({},b.settings,s.settings||{});
    ['completed','progress','pathDone'].forEach(k=>{ if(!s[k]||typeof s[k]!=='object') s[k]=b[k]; });
    ['calcSessions','wordItems','mistakes','library','masteryLog'].forEach(k=>{ if(!Array.isArray(s[k])) s[k]=[]; });
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
  if(local){ try{ S=load(); }catch(e){} }   /* 走 load() 补齐老版本数据里没有的字段 */
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
  },
  /* —— 以下为补齐小学五年级/六年级与初中所需的计算类型 —— */
  fracdiv(kind){            /* 分数除法：除以一个数=乘它的倒数 */
    const d1=R(2,9),d2=R(2,9),n1=coprimeN(d1),n2=coprimeN(d2);
    if(kind==='oral'){
      const t=R(0,2);
      if(t===0){ const k=R(2,9); return {stem:`${n1}/${d1} ÷ ${k} =（填最简分数）`, ans:F(n1,d1*k)}; }
      if(t===1){ const k=R(2,9); return {stem:`${k} ÷ ${n1}/${d1} =（填整数或最简分数）`, ans:F(k*d1,n1)}; }
      return {stem:`${n1}/${d1} ÷ ${n2}/${d2} =（填最简分数）`, ans:F(n1*d2,d1*n2)};
    }
    return {stem:`${n1}/${d1} ÷ ${n2}/${d2} =（填最简分数）`, ans:F(n1*d2,d1*n2)};
  },
  circle(kind){            /* 圆与扇形：周长/面积/扇形 */
    const r=R(2,15), pi=3.14;
    if(kind==='oral'){
      if(Math.random()<.5) return {stem:`一个圆半径为 ${r} cm，周长是（cm，π 取 3.14）`, ans:NUM(2*pi*r)};
      return {stem:`一个圆半径为 ${r} cm，面积是（cm²，π 取 3.14）`, ans:NUM(pi*r*r)};
    }
    if(Math.random()<.5){ const deg=R(2,6)*30; return {stem:`一个圆半径 ${r} cm，其中 ${deg}° 的扇形面积是（cm²，π 取 3.14）`, ans:NUM(pi*r*r*deg/360)}; }
    return {stem:`一个圆直径 ${2*r} cm，周长是（cm，π 取 3.14）`, ans:NUM(2*pi*r)};
  },
  cyl(kind){              /* 圆柱与圆锥：体积/侧面积/圆锥体积 */
    const r=R(2,10), h=R(2,15), pi=3.14, t=R(0,2);
    if(t===0) return {stem:`圆柱底面半径 ${r} cm、高 ${h} cm，体积是（cm³，π 取 3.14）`, ans:NUM(pi*r*r*h)};
    if(t===1) return {stem:`圆柱底面半径 ${r} cm、高 ${h} cm，侧面积是（cm²，π 取 3.14）`, ans:NUM(2*pi*r*h)};
    return {stem:`圆锥底面半径 ${r} cm、高 ${h} cm，体积是（cm³，π 取 3.14）`, ans:NUM(pi*r*r*h/3)};
  },
  trap(kind){             /* 梯形/平行四边形/三角形面积 */
    if(kind==='oral'){ const a=R(3,20),b=R(3,20),h=R(2,12); return {stem:`梯形上底 ${a} cm、下底 ${b} cm、高 ${h} cm，面积是（cm²）`, ans:String((a+b)*h/2)}; }
    if(Math.random()<.5){ const a=R(3,20),b=R(3,20); return {stem:`平行四边形底 ${a} cm、高 ${b} cm，面积是（cm²）`, ans:String(a*b)}; }
    const base=R(3,20),h=R(2,12); return {stem:`三角形底 ${base} cm、高 ${h} cm，面积是（cm²）`, ans:String(base*h/2)};
  },
  solid(kind){            /* 长方体/正方体：体积/表面积 */
    const a=R(2,12),b=R(2,12),c=R(2,12);
    if(kind==='oral') return {stem:`长方体长 ${a} cm、宽 ${b} cm、高 ${c} cm，体积是（cm³）`, ans:String(a*b*c)};
    if(Math.random()<.5) return {stem:`正方体棱长 ${a} cm，表面积是（cm²）`, ans:String(6*a*a)};
    return {stem:`长方体长 ${a} cm、宽 ${b} cm、高 ${c} cm，表面积是（cm²）`, ans:String(2*(a*b+b*c+a*c))};
  },
  real(kind){             /* 初中：实数与二次根式 */
    if(kind==='oral'){ const a=R(2,12); return {stem:`√${a*a} =`, ans:String(a)}; }
    const k=R(2,9),a=R(2,9),b=R(2,9); return {stem:`计算 ${a}√${k} + ${b}√${k}（精确到整数）`, ans:String(Math.round((a+b)*Math.sqrt(k)))};
  },
  func(kind){             /* 初中：一次函数 / 正比例函数 */
    if(kind==='oral'){ const k=R(2,6); return {stem:`正比例函数 y = ${k}x，当 x = 3 时 y =`, ans:String(3*k)}; }
    const k=R(2,5), b=R(1,8), x=R(2,9); return {stem:`一次函数 y = ${k}x + ${b}，当 x = ${x} 时 y =`, ans:String(k*x+b)};
  },
  tri(kind){              /* 初中：三角形 / 全等 / 勾股定理 */
    if(kind==='oral'){ const a=R(3,12),b=R(3,12); return {stem:`直角三角形两直角边 ${a} 和 ${b}，斜边平方是`, ans:String(a*a+b*b)}; }
    const a=R(3,12),b=R(3,12); return {stem:`直角三角形两直角边 ${a} 和 ${b}，斜边 ≈（保留整数）`, ans:String(Math.round(Math.sqrt(a*a+b*b)))};
  },
  quad(kind){             /* 初中：四边形角度性质 */
    if(kind==='oral'){ const a=R(20,80); return {stem:`平行四边形一个角是 ${a}°，相邻另一个角是（度）`, ans:String(180-a)}; }
    const a=R(30,80); return {stem:`等腰梯形一个底角是 ${a}°，另一个底角是（度）`, ans:String(a)};
  },
  eq2(kind){              /* 初中：二元一次方程组代入求值 */
    const x=R(1,6), y=R(1,6), a=R(1,4), b=R(1,4);
    if(kind==='oral') return {stem:`已知 x=${x}, y=${y}，则 ${a}x + ${b}y =`, ans:String(a*x+b*y)};
    const c=R(1,5); return {stem:`已知 x=${x}, y=${y}，则 ${a}x − ${c}y =`, ans:String(a*x-c*y)};
  },
  ineq(kind){             /* 初中：一元一次不等式 */
    if(kind==='oral'){ const x=R(1,10); return {stem:`不等式 2x > ${2*x-1}，x 可取的最小整数是`, ans:String(x)}; }
    const a=R(2,6), x=R(1,10), b=R(0,10), rhs=a*x+b; return {stem:`不等式 ${a}x + ${b} > ${rhs-1}（${a}>0），解集起点是 x >（填整数）`, ans:String(x-1)};
  }
};
/* 保温类任务（mixed / decmix）按阶段从已学知识点里随机抽，讲解页会把这个池子列出来 */
function poolForStage(s){
  if(s<=1) return ['decadd','decmul','decdiv'];
  if(s===2) return ['decadd','decmul','decdiv','eq'];
  if(s===3) return ['decadd','fracbase','fracadd','fracdiv','numth'];
  if(s===4) return ['fracadd','fracmul','decdiv','eq','circle'];
  if(s===5) return ['ratio','percent','fracmul','fracdiv','trap','solid'];
  if(s===6) return ['fracmul','ratio','percent','numth','circle','trap','solid','cyl'];
  if(s===7) return ['fracmul','ratio','percent','numth','circle','trap','solid','cyl','real'];
  if(s===8) return ['decadd','fracbase','fracadd','fracdiv','ratio','percent','circle','trap','solid','cyl']; /* 四年级暑假·小学总复习 */
  return ['junior','real','func','tri','quad','eq2','ineq','fracmul']; /* 初中 S9/S10 */
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
  return {tag:tag,fixedTag:fixedTag||'',items:items,at:new Date().toISOString()};
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
  const d=o.date||TODAY();   /* 补录：按家长选的那天记错题，1/3/7 天也从那天算 */
  const m={ id:uid(), date:d, taskId:o.taskId||'', stage:o.stage||'', tag:o.tag||'综合',
    topicTag:topicTagOf({tag:o.tag,topicTag:o.topicTag}), source:o.source||'', type:o.type||'calc',
    question:o.question||'', imageKey:o.imageKey||'', fileKey:o.fileKey||'', fileName:o.fileName||'', fileType:o.fileType||'',
    /* v22：整份文件合集 —— 一条记录代表某个专题的一整份文件，fileSeq 是该专题下按上传顺序的编号 */
    fileBatch:!!o.fileBatch, fileSeq:o.fileSeq||0,
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
/* v17：怎么学提示条（看视频 / 家长教 / 直接练 + 看哪一节 + 培优对应 + 先测后跳） */
function learnModeStrip(t){
  if(!t || !t.mode) return '';
  const NAME={video:'看视频',teach:'家长教',drill:'直接练'};
  const label=NAME[t.mode]||'直接练';
  const preTag = t.pre===2 ? '<span class="lm-pre done">培优已学 · 先测后跳</span>'
               : t.pre===1 ? '<span class="lm-pre maybe">培优有对应讲 · 先测再定</span>' : '';
  const drillNote = t.mode==='drill' ? '<small>（保温 / 熟练度，不新增视频）</small>' : '';
  return `<div class="lm-strip lm-${t.mode}">
    <div class="lm-head"><span class="lm-badge">${label}</span><b>怎么学</b>${drillNote}${preTag}</div>
    <div class="lm-how">${esc(t.how||'')}</div>
    <details class="lm-more" ${t.mode==='video'?'open':''}><summary>看哪一节视频 / 培优对应讲 / 放行标准</summary>
      <div class="lm-row"><span>校内同步</span><div>${esc(t.videoRef||'—')}</div></div>
      <div class="lm-row"><span>培优 A</span><div>${esc(t.pyRef||'—')}</div></div>
      <div class="lm-row"><span>放行</span><div>${esc(t.gate||'达标测试 ≥80%')}</div></div>
    </details>
  </div>`;
}
/* v17：任务列表里的小徽章，一眼看出哪些是概念日 / 可先测后跳 */
function modeMini(t){
  if(!t || !t.mode) return '';
  const N={video:'看视频',teach:'家长教',drill:'直接练'};
  const cls={video:'v',teach:'t',drill:'d'}[t.mode]||'d';
  const pre=t.pre===2?'<span class="lm-mini-pre">先测后跳</span>':'';
  return `<span class="lm-mini lm-mini-${cls}">${N[t.mode]||'直接练'}</span>${pre}`;
}
function openCalcGuide(tag){
  if(!CALC[tag]){ toast('这个知识点还没有讲解'); return; }
  const canPractice=!!calcTagKey(tag);
  openSheet('计算讲解 · '+calcName(tag), `<div class="card"><h3>${esc(calcName(tag))}</h3>
    <p class="hint">知识点讲解，不影响任务进度；看完点左上「‹」返回。</p>
    ${canPractice?`<div class="btn-row"><button class="btn small" data-action="calc-practice" data-id="${esc(tag)}">✏️ 练一套这个知识点</button></div>`:''}</div>
    <div class="card">${calcGuideHTML(tag,null)}</div>`);
}
/* 家长想给某个旧知识点加练：单独出一套该知识点的题，仍记到当前选中日期 */
function practiceCalcTag(tag){
  const k=calcTagKey(tag), t=currentTask()||TASKS[0];
  if(!k||!GEN[k]||!t){ toast('这个知识点暂时不能单独出题'); return; }
  const o=Math.max(2,Math.round(clamp(S.settings.oralCount,0,60)*0.6));
  const w=Math.max(1,Math.round(clamp(S.settings.writtenCount,0,60)*0.6));
  const paper=makePaper(t,o,w,k); paper.isDaily=false;
  openCalc(t.id,paper);
  const box=$('#paperBox'); if(box&&box.scrollIntoView) box.scrollIntoView({behavior:'smooth',block:'start'});
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
    ${learnModeStrip(t)}
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
/* ============ 学习路径（v18 默认页）：规划展示 + 打钩 + 达标门 ============
   学习主阵地在学习机（看视频 / 做题），这里只负责：排顺序、标学法、记录达标、锁住下一块。 */
const LP = window.LEARN_PATH || {ver:'',stages:[]};
const PATH_BLOCKS = [];
LP.stages.forEach(s=>s.blocks.forEach(b=>PATH_BLOCKS.push(Object.assign({},b,{
  _stage:s.id,_stageName:s.name,_stageSpan:s.span,_stageGoal:s.goal,_stageGate:s.gate
}))));
const PATH_MODE={video:'看视频',teach:'家长讲',drill:'直接练',test:'达标测试'};
let PATH_OPEN=null;

/* v19：周末拔高映射（补拍培优A 六上/六下后排定），只作展示、不占主线打钩 */
const PATH_CATALOG = LP.catalog||[];
const PATH_BOOST = LP.boost||[];
const PATH_BOOST_RULE = LP.boostRule||'';
function pathBoostFor(id){
  const out=[];
  PATH_BOOST.forEach(g=>(g.items||[]).forEach(it=>{
    if((it.blocks||[]).indexOf(id)>=0) out.push(Object.assign({},it,{when:g.when}));
  }));
  return out;
}

function pathCurrentIndex(){
  const i=PATH_BLOCKS.findIndex(b=>!S.pathDone[b.id]);
  return i<0?PATH_BLOCKS.length:i;
}
function pathToggle(id){
  if(!PATH_OPEN) PATH_OPEN=new Set();
  if(PATH_OPEN.has(id)) PATH_OPEN.delete(id); else PATH_OPEN.add(id);
  renderPath();
}
function openPathGate(id){
  const b=PATH_BLOCKS.find(x=>x.id===id); if(!b) return;
  const idx=PATH_BLOCKS.findIndex(x=>x.id===id), cur=pathCurrentIndex();
  if(!S.settings.allowSkip && idx>cur){ toast('请先完成 '+PATH_BLOCKS[cur].id+' 并通过达标测试'); return; }
  const isDone=!!S.pathDone[id];
  const boosts=pathBoostFor(id);
  const rows=[
    ['学什么',b.know],['怎么学',PATH_MODE[b.mode]+' ｜ '+b.ref],
    b.teach?['家长讲',b.teach]:null,['练什么',b.practice],
    ['明确不做',b.drop],['达标标准',b.gate],
    boosts.length?['周末拔高（达标后·选做）',boosts.map(x=>x.ref).join(' ｜ ')+' ｜ 时机：'+boosts[0].when]:null
  ].filter(Boolean);
  openSheet(`${b.id} · ${isDone?'达标记录':'达标确认'}`,`
    <div class="card"><h3>${esc(b.title)}</h3>
      <p class="hint">${esc(b.from)} ｜ 建议 ${b.sessions} 次自学 ｜ ${esc(b._stageName)}</p></div>
    <div class="card"><h3>达标闸门</h3><p><b>${esc(b.gate)}</b></p>
      <p class="hint" style="margin-top:8px">按你家现有节奏确认三件事：① 当天练习完成 ② 晚上错题已讲解并订正 ③ 周末二刷全对，或达标测试 ≥80%。<br>题目来自学习机 / 纸笔，工作台只记录结果、不重复出题。</p></div>
    <div class="card"><h3>这一块怎么学</h3>
      ${rows.map(r=>`<div class="info-row"><div class="k">${esc(r[0])}</div><div class="v">${esc(r[1])}</div></div>`).join('')}
    </div>
    <div class="btn-row">
      ${isDone?`<button class="btn ghost" data-action="path-unpass" data-id="${esc(id)}">↩ 取消打钩</button>`
              :`<button class="btn" data-action="path-pass" data-id="${esc(id)}">✓ 已通过达标，打钩并开启下一块</button>`}
      <a class="btn ghost as-link" href="study-plan.html" target="_blank" rel="noopener">打开完整执行表</a>
    </div>`);
}
function renderPath(){
  const root=$('#pathRoot'); if(!root) return;
  if(!S.pathDone) S.pathDone={};
  const cur=pathCurrentIndex();
  if(!PATH_OPEN){ PATH_OPEN=new Set(); if(cur<PATH_BLOCKS.length) PATH_OPEN.add(PATH_BLOCKS[cur].id); }
  const doneN=PATH_BLOCKS.filter(b=>S.pathDone[b.id]).length;
  const pct=PATH_BLOCKS.length?Math.round(doneN/PATH_BLOCKS.length*100):0;
  const curB=PATH_BLOCKS[cur];
  let html=`<div class="page-head"><h2>学习路径 · 五年级开学前学完小学</h2>
    <p>按课标主线重排，不按年级册次。周一/三/五照当前块自学 → 晚上订正错题 → 周末二刷 + 达标测试 → 通过才打钩、才开下一块。</p></div>
    <div class="path-summary">
      <div class="ps-line"><b>${doneN} / ${PATH_BLOCKS.length} 块已达标</b><span>${pct}%</span></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <p class="ps-cur">当前块：<b>${curB?esc(curB.id)+' · '+esc(curB.title):'全部完成 ✓'}</b>${curB?`<span class="pill">${PATH_MODE[curB.mode]}</span>`:''}</p>
      <div class="btn-row">
        <a class="btn small as-link" href="study-plan.html" target="_blank" rel="noopener">📋 完整执行表</a>
        <button class="btn small ghost" data-action="go-overview">阶段总览</button>
        <button class="btn small ghost" data-action="open-inbox">随手录题</button>
      </div>
    </div>`;
  let lastStage='';
  PATH_BLOCKS.forEach((b,i)=>{
    if(b._stage!==lastStage){
      lastStage=b._stage;
      const st=LP.stages.find(s=>s.id===b._stage);
      html+=`<div class="path-stage"><h3>${esc(st.name)} <span>${esc(st.span)}</span></h3>
        <p>${esc(st.goal)}</p><div class="ps-gate">段末闸门：${esc(st.gate)}</div></div>`;
    }
    const isDone=!!S.pathDone[b.id], locked=!S.settings.allowSkip&&i>cur, isCur=i===cur, open=PATH_OPEN.has(b.id);
    const boosts=pathBoostFor(b.id);
    html+=`<div class="path-block ${isDone?'is-done':''} ${locked?'is-locked':''} ${isCur?'is-current':''}">
      <div class="pb-head">
        <button class="pb-check ${isDone?'on':''}" data-action="path-check" data-id="${esc(b.id)}" aria-label="达标确认">${isDone?'✓':(locked?'·':'○')}</button>
        <div class="pb-main" data-action="path-toggle" data-id="${esc(b.id)}">
          <div class="pb-title"><span class="pb-no">${esc(b.id)}</span><b>${esc(b.title)}</b>
            <span class="pb-mode pm-${b.mode}">${PATH_MODE[b.mode]}</span><span class="pb-src">${esc(b.src)} · ${b.sessions}次</span></div>
          <div class="pb-from">${esc(b.from)}</div>
          <div class="pb-gate">达标：${esc(b.gate)}</div>
        </div>
      </div>
      ${open?`<div class="pb-detail">
        <div class="info-row"><div class="k">学什么</div><div class="v">${esc(b.know)}</div></div>
        <div class="info-row"><div class="k">${b.mode==='teach'?'家长讲':'看什么'}</div><div class="v">${esc(b.ref)}${b.teach?'<br><b>'+esc(b.teach)+'</b>':''}</div></div>
        <div class="info-row"><div class="k">练什么</div><div class="v">${esc(b.practice)}</div></div>
        <div class="info-row"><div class="k">明确不做</div><div class="v">${esc(b.drop)}</div></div>
        ${boosts.length?`<div class="info-row"><div class="k">周末拔高<br><span class="pb-when">选做</span></div><div class="v">${boosts.map(x=>`<div class="pb-boost"><b>${esc(x.ref)}</b><span>${esc(x.note)}</span><i>时机：${esc(x.when)}（达标后）</i></div>`).join('')}</div></div>`:''}
        <div class="btn-row"><button class="btn small" data-action="path-check" data-id="${esc(b.id)}">${isDone?'查看达标记录':'✓ 达标确认 / 打钩'}</button></div>
      </div>`:''}
    </div>`;
  });
  html+=`<div class="card" style="margin-top:16px"><h3>每周节奏（沿用你家现在的安排）</h3>
    <p class="hint">周一 / 三 / 五：孩子按当前块自学 30–40 分钟（概念日看视频 ≤15 分钟，其余家长讲 2–3 分钟 + 动笔）。<br>
    每天晚上：看错题 → 讲解 → 订正。<br>
    周末：本周错题二刷 → 全对后做达标测试 → 通过打钩 → 开启下一块。<br>
    拔高（可选）：某块达标后，培优 A 有对应讲的，周末挑 1 讲做思维加餐，先准后巧、不追进度。</p></div>
    <div class="card"><p class="hint">顺序和学法的完整依据、被省略的拔高清单、家长讲解话术，都在<a href="study-plan.html" target="_blank" rel="noopener">完整执行表</a>里。设置里的「允许跳号」开启后，可不按顺序打钩。</p></div>`;
  html+=`<details class="cat-fold"><summary>📚 培优 A 已确认目录 · v19 补拍六上 / 六下（${(LP.confirmed||[]).length} 册）</summary>
    <div class="cat-body">
      <p class="hint">${esc(PATH_BOOST_RULE)}</p>
      ${(LP.confirmed||[]).map(x=>`<div class="cat-line">✓ ${esc(x)}</div>`).join('')}
      ${PATH_CATALOG.map(c=>`<div class="cat-book"><b>${esc(c.book)}</b><span>${esc(c.meta)}</span>
        <div class="cat-units">${(c.units||[]).map(u=>`<span>${esc(u)}</span>`).join('')}</div>
        <p class="hint">学与练：${esc(c.lessons)}</p>
        <p class="hint">${esc(c.note)}</p></div>`).join('')}
      <p class="hint" style="margin-top:10px">六上第 1–15 讲、培优 A 四下 / 五上 / 五下、校内同步五上 / 五下尚未拍到；按本方案整体后置，不影响主线。完整讲次与拔高映射见<a href="study-plan.html" target="_blank" rel="noopener">完整执行表</a>。</p>
    </div></details>`;
  root.innerHTML=html;
}

function renderHome(){
  const ws=weekState(), total=WPTASKS.length, done=WPTASKS.filter(t=>wpTaskDone(t,ws)).length;
  const rate=total?Math.round(done/total*100):0;
  const cur=currentTask(), ct=wpCurTask();
  $('#stCurrent').textContent=ct?wpSeq(ct.no):'全部完成';
  $('#stDone').textContent=`${done} / ${total}`;
  $('#stRate').textContent=rate+'%';
  $('#stWrong').textContent=activeMistakes().length;
  $('#progressBar').style.width=rate+'%';
  if(!$('#page-week')||!$('#page-week').classList.contains('active'))
    $('#topStage').textContent=ct?`第 ${ct.w}/94 周 · 当前第 ${wpSeq(ct.no)} 项`:'全部任务已完成';
  const due=dueMistakes().length;
  $('#reviewBanner').classList.toggle('hidden',due===0);
  $('#reviewCount').textContent=due+' 题';
  $('#wrongBadge').classList.toggle('hidden',due===0);
  $('#wrongBadge').textContent=due;
  $('#quickOverview').textContent=`${WPSTAGES.length} 个阶段 · ${WPW.length} 周 · ${total} 项主任务`;
  $('#quickWrong').textContent=`${activeMistakes().length} 题 · 可浏览 / 重做`;
  /* 统计栏始终显示「当前任务」；下面这张卡按家长选中的日期显示那天安排的任务 */
  const view=taskForDate(activeDate())||cur;
  $('#currentTask').innerHTML=view ? dailyPanelHTML(view) : `<div class="card"><h3>🎉 ${total} 项主任务全部完成</h3><p class="hint">可到「任务」页回看，或在「设置」里导出备份。</p></div>`;
}
/* ---------------- 今日学习面板（首页核心） ---------------- */
function prog(id){ if(!S.progress) S.progress={}; return S.progress[id]||(S.progress[id]={start:null,end:null,daily:[],passed:false}); }
function dayDiff(a,b){ return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000); }
function logToday(id,patch,date){
  const p=prog(id), d=date||TODAY();
  let rec=p.daily.find(x=>x.date===d);
  if(!rec){ rec={date:d,calc:false,calcN:0,topicFocus:'',word:false,note:''}; p.daily.push(rec); }
  Object.assign(rec,patch);
  if(!p.start||d<p.start) p.start=d;
  save(); renderAll();
}
function dayRec(id,d){ const p=prog(id); return (p.daily||[]).find(x=>x.date===d)||null; }
function todayRec(id){ return dayRec(id,TODAY()); }

/* ---------------- 按日期回看 / 补录 ----------------
   家长可以点周节奏条上的任意一天、翻上一周下一周、或直接选日期：
   面板显示那天的任务与完成情况；当天做的计算 / 应用题 / 随手录题都记到那一天。
   ACTIVE_DATE 只是界面状态，不写进存储，也不参与跨设备同步。 */
let ACTIVE_DATE=TODAY();
function activeDate(){ return ACTIVE_DATE||TODAY(); }
function isActiveToday(){ return activeDate()===TODAY(); }
function setActiveDate(d){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d||'')) return;
  ACTIVE_DATE=d; renderHome();
}
function dowOf(d){ return new Date(d+'T00:00:00').getDay(); }
function dateLabel(d){ return `${cnDate(d)} · 周${['日','一','二','三','四','五','六'][dowOf(d)]}`; }
/* 周日为一周的第一天，和节奏条顺序一致 */
function weekDaysOf(d){ const sun=addDays(d,-dowOf(d)); return Array.from({length:7},(_,i)=>addDays(sun,i)); }
/* 这一天按周计划排了哪些任务（轻量/复盘任务没有具体周，自动跟随相邻周） */
function tasksForDate(d){
  const out=[];
  STAGES.forEach(st=>{
    const wp=weekPlan(st);
    TASKS.filter(t=>t.stage===st).forEach(t=>{
      const w=wp[t.id];
      if(w&&w.start&&w.end&&d>=w.start&&d<=w.end) out.push(t);
    });
  });
  return out;
}
function taskForDate(d){
  const cur=currentTask(), list=tasksForDate(d);
  if(!list.length) return cur;                       /* 开学前 / 假期空档：跟着当前任务补录 */
  if(cur&&list.some(t=>t.id===cur.id)) return cur;
  return list.find(t=>!S.completed[t.id])||list[0]||cur;
}
/* 这一天有没有留下过记录：节奏条上打一个小圆点 */
function dayHasLog(d){
  if((S.calcSessions||[]).some(x=>x.at===d)||(S.wordItems||[]).some(x=>x.at===d)||
     (S.mistakes||[]).some(x=>x.date===d)||(S.library||[]).some(x=>x.at===d)||
     (S.masteryLog||[]).some(x=>x.at===d)) return true;
  return Object.keys(S.progress||{}).some(id=>
    (((S.progress[id]||{}).daily)||[]).some(r=>r.date===d&&(r.calc||r.word||r.topicFocus||r.note)));
}
const clip = (s,n) => { const x=String(s||''); return x.length>n?x.slice(0,n)+'…':x; };
/* 某天完成情况明细：计算、应用题、随手录、附件、错题、达标测试 */
function dayDetailHTML(d,t){
  const sess=(S.calcSessions||[]).filter(x=>x.at===d);
  const words=(S.wordItems||[]).filter(x=>x.at===d);
  const wrongs=(S.mistakes||[]).filter(x=>x.date===d);
  const libs=(S.library||[]).filter(x=>x.at===d);
  const tests=(S.masteryLog||[]).filter(x=>x.at===d);
  const rec=dayRec(t.id,d);
  const rows=[];
  if(rec&&(rec.calc||rec.word||rec.topicFocus||rec.note)) rows.push(
    `<div class="dd-row"><span>📌 当日记录</span><div>${rec.calc?'✅ 已做计算':'⭕ 未记计算'} ｜ ${rec.word?'✅ 已做应用题':'⭕ 未记应用题'}${rec.topicFocus?'<br>小目标：'+esc(rec.topicFocus):''}${rec.note?'<br>备注：'+esc(rec.note):''}</div></div>`);
  if(sess.length) rows.push(`<div class="dd-row"><span>🧮 计算</span><div>${sess.map(x=>`${esc(D.calcTagNames[x.tag]||x.tag)} · ${x.total} 题 · 正确率 <b>${x.rate}%</b>`).join('<br>')}</div></div>`);
  if(words.length) rows.push(`<div class="dd-row"><span>📖 应用题</span><div>共 ${words.length} 题（对 ${words.filter(x=>x.verdict==='correct').length} / 错 ${words.filter(x=>x.verdict==='wrong').length}）<br>${words.slice(0,4).map(x=>esc(clip(x.text||'（见图片）',34))).join('<br>')}${words.length>4?'<br>…':''}</div></div>`);
  if(tests.length) rows.push(`<div class="dd-row"><span>📝 达标测试</span><div>${tests.map(x=>`${esc(x.taskId)} · ${x.rate}% · ${x.passed?'✅ 通过':'❌ 未通过'}`).join('<br>')}</div></div>`);
  if(libs.length) rows.push(`<div class="dd-row"><span>📥 录入题目</span><div>${libs.length} 题 / 附件<br>${libs.slice(0,4).map(x=>esc(clip(x.kind==='file'?x.fileName:x.text||'',34))).join('<br>')}${libs.length>4?'<br>…':''}</div></div>`);
  if(wrongs.length) rows.push(`<div class="dd-row"><span>✎ 当天错题</span><div>${wrongs.length} 道${wrongs.slice(0,3).map(m=>`<br>${esc(clip(m.question||'（见图片）',28))} <button class="linkbtn" data-action="view-wrong" data-id="${esc(m.id)}">查看 ›</button>`).join('')}${wrongs.length>3?'<br>…':''}</div></div>`);
  return `<div class="day-detail"><div class="dd-h">📋 ${esc(dateLabel(d))} 的完成情况<small>${rows.length?'点错题右侧「查看」可看原题与错因':'这天还没有记录，可用上面的按钮补录'}</small></div>
    ${rows.length?rows.join(''):'<p class="hint">这天还没有记录。选中日期后点「补录…」，题目和完成情况都会记到这一天。</p>'}</div>`;
}
function dailyPanelHTML(t){
  const d0=activeDate(), isT=isActiveToday(), wp=taskWeek(t.id), rec=dayRec(t.id,d0), p=prog(t.id);
  const passed=p.passed;
  const calcDone=rec&&rec.calc;
  const daySess=S.calcSessions.filter(x=>x.taskId===t.id&&x.at===d0);
  const dayRate=daySess.length?daySess[daySess.length-1].rate:null;
  const dow=dowOf(d0), sess=weeklySession(dow);
  const dayNames=['日','一','二','三','四','五','六'];
  const week=weekDaysOf(d0);
  const rhythm=week.map(ds=>{
    const dd=dowOf(ds), ty=weeklySession(dd).type;
    const cls=[ty,ds===TODAY()?'today':'',ds===d0?'sel':'',dayHasLog(ds)?'has-log':''].filter(Boolean).join(' ');
    return `<button type="button" class="rhythm-day ${cls}" data-action="pick-day" data-v="${ds}" title="查看 ${ds} 的任务"><b>周${dayNames[dd]}</b><small>${ds.slice(5).replace('-','/')}</small><span>${ty==='study'?'学新':(ty==='review'?'复习/错题':'弹性')}</span></button>`;
  }).join('');
  const weekText = wp ? `第 ${wp.week} 周${wp.dense?' · 假期密集周':(wp.light?' · 复盘周':(wp.hard&&!wp.compress?' · 难项(2周)':''))}` : '';
  const weekRange = wp&&wp.start ? `${cnDate(wp.start)}–${cnDate(wp.end)}` : '';
  const subIdx = (wp&&wp.hard&&!wp.compress&&wp.start) ? Math.min(2,Math.max(1,Math.floor(dayDiff(wp.start,d0)/7)+1)) : 1;
  const thisDay = isT?'今天':'这天';
  return `<div class="stage-head">任务 · 按日期查看 <span class="ver-tag">${APP_VER}</span><small>每周约 ${WEEKLY_HOURS} 小时 · 点任意一天回看 / 补录</small></div>
  <div class="day-nav">
    <button type="button" class="dn-arrow" data-action="day-shift" data-v="-1" aria-label="前一天">‹</button>
    <label class="dn-pick"><span>${isT?'今天':(d0<TODAY()?'回看':'预览')}</span><input type="date" id="dayPick" value="${d0}"></label>
    <button type="button" class="dn-arrow" data-action="day-shift" data-v="1" aria-label="后一天">›</button>
    ${isT?'':`<button type="button" class="dn-today" data-action="day-today">回到今天</button>`}
  </div>
  <div class="day-week"><button type="button" class="wk-btn" data-action="day-shift" data-v="-7">‹ 上一周</button>
    <span>${week[0].slice(5).replace('-','/')} – ${week[6].slice(5).replace('-','/')}</span>
    <button type="button" class="wk-btn" data-action="day-shift" data-v="7">下一周 ›</button></div>
  ${isT?'':`<div class="day-back-note">⏪ 正在${d0<TODAY()?'回看 / 补录':'预览'} <b>${esc(dateLabel(d0))}</b>：这天录入的计算、应用题、随手录题、附件都会记到这一天。${d0>TODAY()?'未来日期建议只用来看安排。':''}
    <div class="btn-row"><button class="btn small ghost" data-action="open-inbox">📥 补录这天的随手录题</button><button class="btn small ghost" data-action="open-attach">📎 补录整份附件</button></div></div>`}
  <div class="daily-card">
    <div class="dc-task">${isT?'当前任务':'这天安排的任务'} <b>${esc(t.id)}</b> · ${esc(t.stage)} ${esc(t.stageName)} <span class="pill ${passed?'done':''}">${passed?'已通过达标测试':'进行中'}</span></div>
    ${weekText?`<div class="dc-win">📅 ${esc(weekText)}${weekRange?(' · '+esc(weekRange)):''}</div>`:''}
    ${wp&&wp.dense?`<div class="dense-note">⚠ 假期密集周：本周与同阶段其他任务并行，无课可多学——每天带一点计算和巩固题即可，不必一天啃完。</div>`:''}
    <div class="rhythm-legend">点日期回看 / 补录 ｜ 深绿 = 正在看 · 绿框 = 今天 · • = 有记录</div>
    <div class="rhythm-strip">${rhythm}</div>
    <div class="dc-session ${sess.type}">${isT?'今天':esc(cnDate(d0))}（周${dayNames[dow]}）：${esc(sess.label)}</div>
    <div class="dc-grid">
      <div class="dc-block calc">
        <div class="dc-h">① 计算 <span class="dc-tag">每天必做</span></div>
        <p class="dc-sub">本任务：${esc(calcName(t.calcTag))} ${calcIsNew(t)?'· 新学':'· 保温'} ｜ 建议 ${esc(t.calcCount)}</p>
        <p class="dc-sub">${thisDay}：${calcDone?'✅ 已做':(dayRate!==null?'✅ 已做 · 正确率'+dayRate+'%':'⭕ 还没做')}</p>
        <p class="dc-sub">🔁 今日旧知识保温：${esc(reviewPool(t).slice(0,2).map(k=>calcName(k)).join(' · ')||'暂无')}</p>
        <div class="btn-row"><button class="btn" data-action="daily-calc" data-id="${esc(t.id)}">${isT?'做今日计算':'✚ 补录这天的计算'}</button></div>
      </div>
      <div class="dc-block topic">
        <div class="dc-h">② 专题 <span class="dc-tag">${thisDay}学哪一块</span></div>
        <p class="dc-sub">${esc(t.topicTag)}：${esc(t.topic)}</p>
        <div class="dc-focus">📌 本周学：${esc(weekFocus(t,subIdx))}</div>
        <label class="lbl">${thisDay}专题小目标（一个任务可分多天，每天选一块练）</label>
        <input type="text" id="dailyFocus" data-task="${esc(t.id)}" data-date="${d0}" value="${esc(rec?rec.topicFocus:'')}" placeholder="例：今天只练盈亏 / 盈盈+盈亏">
        <label class="switch"><input type="checkbox" id="dailyWord" data-task="${esc(t.id)}" data-date="${d0}" ${rec&&rec.word?'checked':''}> ${thisDay}做了应用题</label>
        <div class="btn-row"><button class="btn amber" data-action="daily-word" data-id="${esc(t.id)}">${isT?'做应用题':'✚ 补录这天的题'}</button></div>
      </div>
    </div>
    <div class="dc-block test">
      <div class="dc-h">③ 达标测试 <span class="dc-tag">≥80% 过关</span></div>
      <p class="dc-sub">${passed?'✅ 已通过，可标记完成进入下一任务':'测试覆盖本任务计算+应用题，优先从孩子错题库举一反三出题'}</p>
      <div class="btn-row"><button class="btn" data-action="open-mastery" data-id="${esc(t.id)}">📝 做达标测试</button>
        <button class="btn ghost" data-action="open-task" data-id="${esc(t.id)}">看完整任务卡 ›</button></div>
    </div>
    ${sess.type==='review'?`<div class="dc-foot">🗓 周末复习：把本周做错的题再练一遍 → <button class="linkbtn" data-action="week-review" data-id="${esc(t.id)}">看本周错题</button></div>`
      :`<div class="dc-foot">📝 ${isT?'今日小结':esc(cnDate(d0))+' 小结'}：${rec?esc((rec.calc?'已做计算':'未做计算')+' ｜ '+(rec.word?'已做应用':'未做应用')+(rec.topicFocus?' ｜ 专题：'+rec.topicFocus:'')):'这天还没记录，做完上面任意一项会自动记一笔'}</div>`}
  </div>
  ${dayDetailHTML(d0,t)}`;
}

/* ---------------- 渲染：任务序列（v21 · 94 周执行表全局序号） ---------------- */
function renderTasks(){
  const sf=$('#taskStageFilter').value, tf=$('#taskStateFilter').value;
  const sel=$('#taskStageFilter');
  if(sel.options.length===1) WPSTAGES.forEach(s=>{
    const a=WPW.filter(w=>w.stage===s);
    sel.add(new Option(s+'（第 '+a[0].w+'–'+a[a.length-1].w+' 周）',s));
  });
  const ws=weekState(), cursor=wpCursor(ws);
  const nV=WPTASKS.filter(t=>t.kind==='video').length, nG=WPTASKS.length-nV;
  let html=`<div class="card wptip"><p class="hint">执行表主任务共 <b>${WPTASKS.length}</b> 项（${nV} 个视频 + ${nG} 次阶段测），按序号 <b>01 → ${wpSeq(WPTASKS.length)}</b> 推进：<b>前一项没打钩，后面全部锁住</b>。落下就停在原地继续那一项，不会随日历跳过去。当天的计算 / 错题随时做，不排先后。</p></div>`;
  WPSTAGES.forEach(st=>{
    if(sf&&sf!==st) return;
    const all=WPTASKS.filter(t=>t.stage===st);
    const list=all.filter(t=>!tf||(tf==='done'?wpTaskDone(t,ws):!wpTaskDone(t,ws)));
    if(!list.length) return;
    const dn=all.filter(t=>wpTaskDone(t,ws)).length;
    const wks=WPW.filter(w=>w.stage===st);
    html+=`<div class="stage-head">${esc(st)}<small>第 ${wks[0].w}–${wks[wks.length-1].w} 周 ｜ ${dn}/${all.length} 已完成</small></div>`;
    list.forEach(t=>{
      const d=wpTaskDone(t,ws), isCur=(t.no-1===cursor), lock=(t.no-1>cursor&&!d);
      const raw=t.kind==='video'?ws.done[t.key]:((ws.gate&&ws.gate[`W${pad2(t.w)}`]&&ws.gate[`W${pad2(t.w)}`].at)||ws.done[t.key]);
      html+=`<div class="task-item ${d?'is-done':''} ${isCur?'is-current':''} ${lock?'is-locked':''}" data-action="wp-task" data-no="${t.no}">
        <button class="tick" data-action="wp-toggle" data-no="${t.no}" ${lock?'disabled':''}>${d?'✓':(isCur?'▶':(lock?'🔒':'○'))}</button>
        <div class="body"><b>${wpSeq(t.no)}</b><span class="wk-pill ${t.kind==='gate'?'alt':''}">${t.kind==='gate'?'阶段测':'视频'}</span>
          <p>${esc(t.title)}</p>
          <p class="ti-calc">第 ${t.w} 周 · ${esc(t.main||'').slice(0,52)}</p></div>
        <div class="meta">${d?esc(String(raw||'').slice(5)):(isCur?'当前':(lock?'未解锁':''))}</div>
      </div>`;
    });
  });
  $('#taskList').innerHTML=html||'<div class="card"><p class="hint">没有符合条件的任务。</p></div>';
}
/* 任务页交互：已完成项＝预览（不直接改）；当前项＝确认后才打钩推进 */
function wpToggleTask(no){
  const ws=weekState(), t=WPTASKS.find(x=>x.no===no); if(!t) return;
  if(wpTaskDone(t,ws)){ wpOpenTask(no); return; }   /* 已完成：只预览，撤销要在详情里单独确认 */
  const cursor=wpCursor(ws);
  if((no-1)!==cursor){ toast('请先完成第 '+wpSeq(cursor+1)+' 项：'+((WPTASKS[cursor]||{}).title||'')); return; }
  if(t.kind==='video'){ wpConfirmDone(no); return; }
  WK_VIEW=t.w; weekOpenGate();   /* 阶段测：去填达标率 */
}
/* 打钩前先给家长看清楚是哪一项，避免「只想测试」就推进 */
function wpConfirmDone(no){
  const ws=weekState(), t=WPTASKS.find(x=>x.no===no); if(!t) return;
  if(wpTaskDone(t,ws)){ wpOpenTask(no); return; }
  const cursor=wpCursor(ws);
  if((no-1)!==cursor){ toast('请先完成第 '+wpSeq(cursor+1)+' 项：'+((WPTASKS[cursor]||{}).title||'')); return; }
  const wk=wkAt(t.w)||{};
  openSheet('确认完成第 '+wpSeq(no)+' 项？', `<div class="card">
    <p class="hint"><b>点确认才会打钩并推进到下一项</b>；只是想看看的话点「取消」，进度不会变。</p>
    <h3>${esc(t.title)}</h3>
    <p class="hint">${esc(t.stage)} · 第 ${t.w} 周 · ${t.kind==='gate'?'阶段达标测试':'培优A视频'}</p>
    ${wk.main?`<p class="hint">本周主线：${esc(wk.main)}</p>`:''}
    <div class="btn-row"><button class="btn" data-action="wp-done-yes" data-no="${no}">✓ 确认完成，进入下一项</button>
      <button class="btn ghost" data-action="close-sheet">取消，不改进度</button></div>
  </div>`);
}
/* 真正确认打钩：只有这里写 ws.done */
function wpDoneYes(no){
  const ws=weekState(), t=WPTASKS.find(x=>x.no===no); if(!t) return;
  if(wpTaskDone(t,ws)){ closeSheet(); return; }
  const cursor=wpCursor(ws);
  if((no-1)!==cursor){ closeSheet(); toast('这一项还不是当前任务，未改动'); return; }
  if(t.kind==='video') ws.done[t.key]=activeDate();
  else { if(!ws.gate) ws.gate={}; ws.gate[`W${pad2(t.w)}`]={rate:100,passed:true,at:TODAY(),byParent:true}; ws.done[t.key]=activeDate(); }
  WK_VIEW=null; save(); closeSheet(); renderAll();
  const nt=wpCurTask();
  toast('✓ 第 '+wpSeq(no)+' 项完成'+(nt?('，下一项：第 '+wpSeq(nt.no)+' 项'):''));
}
function wpDoneRaw(t,ws){
  if(t.kind==='video') return ws.done[t.key];
  const g=ws.gate&&ws.gate[`W${pad2(t.w)}`];
  return (g&&g.at)||ws.done[t.key];
}
/* 任务详情：这里是「预览」，点开不会改任何进度；撤销要单独确认 */
function wpOpenTask(no){
  const t=WPTASKS.find(x=>x.no===no); if(!t) return;
  const ws=weekState(), wk=wkAt(t.w)||{}, d=wpTaskDone(t,ws), isCur=((no-1)===wpCursor(ws));
  const raw=wpDoneRaw(t,ws);
  openSheet('第 '+wpSeq(no)+' 项 · '+(t.kind==='gate'?'阶段测试':'视频'), `<div class="card">
    <p class="hint">${esc(t.stage)} · 第 ${t.w} 周 · 计划 ${esc(wk.start||'')} ~ ${esc(wk.end||'')}</p>
    <h3>${esc(t.title)}</h3>
    <p class="hint">本周主线：${esc(t.main||'')}</p>
    <p class="hint">本周计算：${(wk.calc||[]).map(c=>esc(calcName(c.tag))+' '+c.n+' 题').join('、')||'按每日保温'}</p>
    ${wk.backup?`<p class="hint">校内兜底：${esc(wk.backup)}</p>`:''}
    <p class="hint">状态：${d?('✓ 已于 '+esc(String(raw||'').slice(0,16))+' 完成'):(isCur?'▶ 当前这项':'未完成（前面的项还没打钩）')}</p>
    <div class="btn-row">
      ${d?`<button class="btn ghost danger" data-action="wp-undo" data-no="${no}">撤销这一项的打钩</button>`
        :(isCur?`<button class="btn" data-action="wp-toggle" data-no="${no}">打钩完成</button>`:'')}
      <button class="btn ghost" data-action="wp-view-week" data-v="${t.w}">看这一周执行表</button>
      <button class="btn ghost" data-action="done-list">← 已完成清单</button></div>
  </div>`);
}
/* 已完成清单：家长预览 / 撤销已打钩的主任务 */
function openDoneList(){
  const ws=weekState();
  const done=WPTASKS.filter(t=>wpTaskDone(t,ws));
  if(!done.length){ toast('还没有已完成的主任务'); return; }
  openSheet('已完成的任务 · '+done.length+' 项', `<div class="card">
    <p class="hint">下面都是已打钩的主任务。<b>预览</b>只是看详情，不会改动进度；<b>撤销</b>会取消打钩，当前任务回到这一项、后面的重新锁住。撤销只改完成记录，错题和计算记录都保留。</p>
    <div class="done-list">${done.slice().reverse().map(t=>{
      const raw=wpDoneRaw(t,ws);
      return `<div class="done-item">
        <div class="done-main"><b>${wpSeq(t.no)}</b><span class="wk-pill ${t.kind==='gate'?'alt':''}">${t.kind==='gate'?'阶段测':'视频'}</span> ${esc(t.title)}
          <small>第 ${t.w} 周 · ${esc(String(raw||'').slice(0,16))} 完成</small></div>
        <div class="done-btns"><button class="btn tiny ghost" data-action="wp-preview" data-no="${t.no}">预览</button>
          <button class="btn tiny ghost danger" data-action="wp-undo" data-no="${t.no}">撤销</button></div>
      </div>`;
    }).join('')}</div>
    <div class="btn-row"><button class="btn ghost" data-action="close-sheet">关闭</button></div>
  </div>`);
}
function wpUndoTask(no){
  const t=WPTASKS.find(x=>x.no===no); if(!t) return;
  const ws=weekState(), raw=wpDoneRaw(t,ws);
  openSheet('撤销第 '+wpSeq(no)+' 项的完成？', `<div class="card">
    <h3>${esc(t.title)}</h3>
    <p class="hint">第 ${t.w} 周 · ${esc(t.stage)} · ${esc(String(raw||'').slice(0,16))} 完成</p>
    <p class="hint">撤销后当前任务回到第 ${wpSeq(no)} 项，后面各项重新锁住。<b>错题、每日计算、达标率记录都不受影响</b>——只是家长在改完成标记，孩子学过的内容不会消失。</p>
    <div class="btn-row"><button class="btn ghost danger" data-action="wp-undo-yes" data-no="${no}">✓ 确认撤销</button>
      <button class="btn ghost" data-action="done-list">返回，不改</button></div>
  </div>`);
}
function wpUndoYes(no){
  const ws=weekState(), t=WPTASKS.find(x=>x.no===no); if(!t) return;
  if(t.kind==='video') delete ws.done[t.key];
  else { delete ws.done[t.key]; if(ws.gate) delete ws.gate[`W${pad2(t.w)}`]; }
  WK_VIEW=null; save(); renderAll();
  toast('已撤销第 '+wpSeq(no)+' 项，当前任务回到这一项');
  openDoneList();
}
function wpViewWeek(v){
  v=parseInt(v,10); if(!(v>=1&&v<=WPW.length)) return;
  WK_VIEW=(v===wpCurWeek())?null:v; closeSheet();
  if(activePage()!=='week'){ NAV.page=['week']; applyPage('week'); }
  renderAll();
}

/* ---------------- 渲染：阶段总览（每阶段多少任务、分别是什么） ---------------- */
const STAGES=[...new Set(TASKS.map(t=>t.stage))];
/* 计算知识地图：按 94 周执行表第一次出现的顺序列出，点开看讲解 */
function renderCalcMap(){
  const el=$('#calcMap'); if(!el) return;
  const order=[];
  WPW.forEach(w=>(w.calc||[]).forEach(c=>{ if(order.indexOf(c.tag)<0) order.push(c.tag); }));
  el.innerHTML=`<div class="card"><h3>📐 计算知识点学习地图（94 周执行表顺序）</h3>
    <p class="hint">计算和专题一样要「先学再练」。下面是执行表里计算知识点第一次出现的周次，点任一个可看步骤、例题与易错点。</p>
    <div class="btn-row"><a class="btn small ghost as-link" href="study-plan.html" target="_blank" rel="noopener">打开完整执行表：顺序 / 看哪节视频 / 怎么学</a></div>
    <div class="chip-row">${order.map((tag,i)=>{
      const w=WPW.find(w=>(w.calc||[]).some(c=>c.tag===tag));
      return `<button class="chip" data-action="calc-guide" data-id="${esc(tag)}">${i+1}. ${esc(calcName(tag))}<small>第 ${w?w.w:'—'} 周</small> ›</button>`;
    }).join('')}</div></div>`;
}
function renderOverview(){
  const ws=weekState(), cursor=wpCursor(ws), cw=wpCurWeek();
  const total=WPTASKS.length, done=WPTASKS.filter(t=>wpTaskDone(t,ws)).length;
  $('#overviewSummary').innerHTML=`<span>阶段 <b>${WPSTAGES.length}</b></span><span>周 <b>${WPW.length}</b></span><span>主任务 <b>${total}</b></span><span>已完成 <b>${done}</b></span><span>完成率 <b>${total?Math.round(done/total*100):0}%</b></span>`;
  renderCalcMap();
  $('#overviewList').innerHTML=WPSTAGES.map(st=>{
    const weeks=WPW.filter(w=>w.stage===st), tasks=WPTASKS.filter(t=>t.stage===st);
    const dn=tasks.filter(t=>wpTaskDone(t,ws)).length;
    const pct=tasks.length?Math.round(dn/tasks.length*100):0;
    const isCur=weeks.some(w=>w.w===cw);
    return `<div class="ov-card ${isCur?'is-current':''}" data-stage="${esc(st)}">
      <div class="ov-head" data-action="toggle-stage" data-id="${esc(st)}">
        <div class="ov-title"><b>${esc(st)}</b>${isCur?' · 当前阶段':''}</div>
        <div class="ov-meta">第 ${weeks[0].w}–${weeks[weeks.length-1].w} 周 ｜ ${weeks.length} 周 ｜ 主任务 ${dn}/${tasks.length}${tasks.length&&dn===tasks.length?' ✓':''}</div>
        <div class="ov-newcalc">本阶段主线：${esc((weeks[0].main||'').slice(0,58))}${weeks.length>1?' …':''}</div>
        <div class="ov-bar"><i style="width:${pct}%"></i></div>
        <span class="ov-toggle">${isCur?'▾ 收起每周任务':'▸ 展开每周任务'}</span>
      </div>
      <div class="ov-list ${isCur?'':'hidden'}" id="ov-${esc(st)}">
        ${weeks.map(w=>{
          const wt=WPTASKS.filter(t=>t.w===w.w), wd=wt.filter(t=>wpTaskDone(t,ws)).length;
          return `<div class="ov-witem">
            <div class="ov-whead"><b>第 ${w.w} 周</b><span>${esc(w.start||'')} ~ ${esc(w.end||'')}</span><span>${wd}/${wt.length} 项</span>${w.test?'<span class="wk-pill alt">阶段测</span>':''}</div>
            <div class="ov-wmain">${esc(w.main||'')}</div>
            <div class="ov-wtasks">${wt.length?wt.map(t=>`<button class="ov-wtask ${wpTaskDone(t,ws)?'done':''} ${((t.no-1)===cursor?'cur':'')}" data-action="wp-task" data-no="${t.no}"><em>${wpSeq(t.no)}</em>${esc((t.title||'').slice(0,36))}${((t.no-1)===cursor?' ← 当前':'')}</button>`).join(''):'<span class="hint">本周无新视频：计算 / 错题 / 阶段测</span>'}</div>
            <div class="ov-wcalc">计算：${(w.calc||[]).map(c=>esc(calcName(c.tag))+' '+c.n+'题').join('、')||'—'} ｜ 回炉：${esc((w.review||[]).join('、')||'—')}</div>
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
function renderAll(){ renderWeek(); renderPath(); renderHome(); renderTasks(); renderOverview(); renderLibrary(); renderWrong(); renderSettings(); renderPlan(); maybeNotify(); hydrateImages(document); hydrateAttachments(document);
  const av=$('#appVer'); if(av) av.textContent=APP_VER;
}

/* ---------------- 导航：页面历史栈 + 弹层历史栈（全站「返回上一页」） ---------------- */
const NAV={ page:['week'], sheet:[] };
function activePage(){ const p=$('.page.active'); return p&&p.id?p.id.replace('page-',''):'home'; }
function applyPage(id){
  $$('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+id));
  $$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));
  const b=$('#backBtn'); if(b) b.classList.toggle('hidden',id==='week'||id==='path');
  window.scrollTo(0,0);
}
function goPage(id){
  if(!$('#page-'+id)||activePage()===id) return;
  NAV.page.push(id); applyPage(id);
}
function backPage(){
  if(NAV.page.length>1) NAV.page.pop();
  let p=NAV.page[NAV.page.length-1]||'week';
  if(p==='home') p='week';   /* 旧版首页已下线，返回时不再落回去 */
  NAV.page[NAV.page.length-1]=p;
  applyPage(p);
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
let PAPER=null, PAPER_TASK=null, PAPER_DATE=null, WORD={taskId:null,date:null,imageKey:'',text:'',childAnswer:'',correctAnswer:''};
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
  PAPER_TASK=t; PAPER_DATE=activeDate(); PAPER=preset||null;
  if(PAPER) PAPER.date=PAPER_DATE;
  openSheet(`${t.id} · 计算练习${PAPER_DATE!==TODAY()?'（补录 '+cnDate(PAPER_DATE)+'）':''}`, `
    <div class="card">
      <h3>${esc(t.calcText)}</h3>
      <p class="hint">知识点：${esc(calcName(t.calcTag))} · ${calcIsNew(t)?'新学（建议先看下面讲解再做题）':'保温复习'} ｜ ${esc(t.calcCount)}${(t.calcTag==='mixed'||t.calcTag==='decmix')?' ｜ 保温题会从本阶段已学知识点里随机抽':''}</p>
      ${PAPER&&PAPER.fixedTag?`<p class="hint">✏️ 专项练习：<b>${esc(calcName(PAPER.fixedTag))}</b>。本套及后面「换一组」都只出这个知识点，适合给忘了的旧知识加练。</p>`:''}
      ${PAPER_DATE!==TODAY()?`<p class="hint">⏪ 补录模式：这套练习和产生的错题都会记到 <b>${esc(cnDate(PAPER_DATE))}</b>。</p>`:''}
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
  PAPER=makePaper(PAPER_TASK,o,w,fixedTag); PAPER.submitted=false; PAPER.date=PAPER_DATE||activeDate();
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
        date:PAPER.date||activeDate(),
        question:q.stem+' （'+q.kind+'）',childAnswer:q.given||'（未填）',correctAnswer:q.ans,reason:'计算失误'});
      q.mistakeId=m.id;
    }
  });
  PAPER.submitted=true; PAPER.correct=correct; PAPER.rate=Math.round(correct/PAPER.items.length*100); PAPER.wrongN=wrongN;
  /* 逐知识点留痕：保温题也要记，下次才能算「这个知识点多久没练、上次正确率多少」 */
  const byTag={};
  PAPER.items.forEach(q=>{
    const k=calcTagKey(q.tag)||'mixed';
    if(!byTag[k]) byTag[k]={tag:k,total:0,correct:0,review:!!q.review};
    byTag[k].total++; if(q.ok) byTag[k].correct++;
  });
  const tags=Object.keys(byTag).map(k=>Object.assign(byTag[k],
    {rate:Math.round(byTag[k].correct/Math.max(1,byTag[k].total)*100)}));
  S.calcSessions.push({id:uid(),taskId:PAPER_TASK.id,at:PAPER.date||activeDate(),tag:PAPER.tag,tags:tags,total:PAPER.items.length,correct:correct,rate:PAPER.rate});
  save(); renderPaper(); renderCalcHistory(PAPER_TASK.id); renderAll();
  toast(PAPER.rate>=S.settings.calcThreshold?'✓ 计算达标':'继续练，达标后才能标记完成');
}

/* 应用题 */
function openWord(id){
  const t=TASKMAP[id]||currentTask(); if(!t) return;
  WORD={taskId:t.id,date:activeDate(),imageKey:'',text:'',childAnswer:'',correctAnswer:''};
  openSheet(`${t.id} · 应用题${WORD.date!==TODAY()?'（补录 '+cnDate(WORD.date)+'）':''}`, `
    <div class="card"><h3>本任务专题：${esc(t.topicTag)}</h3>
      ${WORD.date!==TODAY()?`<p class="hint">⏪ 补录模式：下面录入的题和错题都会记到 <b>${esc(cnDate(WORD.date))}</b>。</p>`:''}
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
  const at=WORD.date||activeDate();
  let newM=null;
  if(verdict==='wrong') newM=addMistake({taskId:t.id,stage:t.stage,tag:t.topicTag,type:'word',date:at,
    question:text,imageKey:WORD.imageKey,childAnswer:child,correctAnswer:correct,reason:'思路错误'});
  S.wordItems.push({id:uid(),taskId:t.id,at:at,text:text,imageKey:WORD.imageKey,
    childAnswer:child,correctAnswer:correct,verdict:verdict,mistakeId:newM?newM.id:''});
  save();
  WORD={taskId:t.id,date:at,imageKey:'',text:'',childAnswer:'',correctAnswer:''};
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
      <p class="hint">日常做过的、看到的好题都能随手录。工作台按题目里的特征词判断该归到哪个专题，判错了在下面改一下就行。<b>不绑定今天的任务，也不会影响任务达标。</b>补录昨天做过的题，把下面日期改成昨天即可。</p>
      <label class="lbl">做题 / 录入日期（补录旧题时改这里）</label>
      <input type="date" id="inboxDate" value="${activeDate()}">
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
  const at=$('#inboxDate')?($('#inboxDate').value||activeDate()):activeDate();
  const g=INBOX.guess||{};
  const item={ id:uid(), at:at, tag:tag, text:text, imageKey:INBOX.imageKey,
    childAnswer:$('#inboxChild').value.trim(), correctAnswer:$('#inboxCorrect').value.trim(),
    note:$('#inboxNote').value.trim(), source:$('#inboxSource')?$('#inboxSource').value:'随手录入',
    auto:!!(text&&g.tag===tag&&!g.empty), confidence:g.confidence||'无' };
  S.library.push(item);
  if($('#inboxWrong')&&$('#inboxWrong').checked){
    const rs=$('#inboxReason');
    addMistake({taskId:'',stage:'随手录入',tag:tag,topicTag:tag,type:'word',source:'随手录入',date:at,
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
      <label class="lbl">上传 / 做题日期（补录旧卷子时改这里）</label>
      <input type="date" id="attachDate" value="${activeDate()}">
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

/* ---- 每日计算：本任务新学/保温 + 按遗忘风险掺入旧知识点 ----
   旧数据里错题的 tag 记的是中文名（如「小数加减」），出题器用的是内部键（decadd）；
   calcTagKey 做双向归一，避免「错题优先」实际退化成综合题。 */
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=R(0,i); const x=a[i]; a[i]=a[j]; a[j]=x; } return a; }
function calcTagKey(v){
  if(!v) return '';
  if(Object.prototype.hasOwnProperty.call(GEN,v)) return v;
  const names=D.calcTagNames||{};
  return Object.keys(names).find(k=>names[k]===v)||'';
}
function priorStageTags(t){
  const si=parseInt((t.stage||'S1').slice(1),10)||1;
  const set=[...new Set(TASKS.filter(x=>parseInt((x.stage||'S1').slice(1),10)<si).map(x=>x.calcTag))].filter(x=>x!=='mixed'&&x!=='decmix');
  return set.length?set:['decadd'];
}
/* 遗忘风险：距上次练的天数 + 当时正确率 + 在册错题数；越久没练、错得越多越先出现 */
function calcForgetRisk(k){
  const name=D.calcTagNames[k]||k;
  const sess=(S.calcSessions||[]).slice().sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  let last=null, lastRate=null;
  for(const s of sess){
    const hit=(s.tags||[]).find(x=>x.tag===k)||(s.tag===k?{rate:s.rate}:null);
    if(hit){ last=s.at; lastRate=hit.rate; break; }
  }
  const wrongs=(S.mistakes||[]).filter(m=>m.type==='calc'&&m.status==='active'&&(m.tag===k||m.tag===name)).length;
  const days=last?Math.max(0,dayDiff(last,activeDate())):45;
  const rate=(typeof lastRate==='number')?lastRate:70;
  return days + (100-rate)*0.4 + wrongs*15 + (last?0:10);
}
function reviewPool(t){
  const weak=(S.mistakes||[]).filter(m=>m.type==='calc'&&m.status==='active')
    .map(m=>calcTagKey(m.tag)).filter(Boolean);
  const all=[...new Set(priorStageTags(t).concat(weak))]
    .filter(k=>k!=='mixed'&&k!=='decmix'&&GEN[k]);
  const seed=parseInt(String(activeDate()).replace(/-/g,''),10)||0;
  return all.map((k,i)=>({k:k,s:calcForgetRisk(k)+((seed+i*3)%5)*0.6}))
    .sort((a,b)=>b.s-a.s||a.k.localeCompare(b.k)).map(x=>x.k);
}
function makeDailyCalc(t){
  const oral=clamp(S.settings.oralCount,0,60), wri=clamp(S.settings.writtenCount,0,60);
  const items=makePaper(t, Math.max(0,oral-2), Math.max(0,wri-1)).items;
  const picks=reviewPool(t).slice(0,2);
  picks.forEach(tg=>{ const fn=GEN[tg]||GEN.mixed;
    items.push(Object.assign({kind:'口算',tag:tg,key:uid(),review:true},fn('oral')));
    items.push(Object.assign({kind:'笔算',tag:tg,key:uid(),review:true},fn('written'))); });
  return {tag:effectiveTag(t), items:items, at:new Date().toISOString(), isDaily:true, reviewTags:picks};
}

/* ---- 达标测试：计算(自动判分) + 应用题(优先错题库举一反三，家长判分) ---- */
function buildMasteryTest(t){
  /* 6 道计算 = 4 道本任务 + 2 道跨阶段旧知识回测；总题量不变，≥80% 放行线不变 */
  const cp=makePaper(t, 3, 1);
  const calcItems=cp.items.map(q=>({kind:'calc',tag:q.tag,stem:q.stem,ans:q.ans,graded:'auto',given:'',ok:null}));
  const extras=reviewPool(t).slice(0,2).map(k=>({k:k,old:true}));
  /* S1 还没学过别的知识点时池子不足 2 个，用本任务知识点补足，保证 6 道计算 / 10 题不变 */
  const mainTag=effectiveTag(t);
  while(extras.length<2) extras.push({k:mainTag,old:false});
  extras.forEach(x=>{
    const fn=GEN[x.k]||GEN.mixed, q=fn('written');
    calcItems.push({kind:'calc',tag:x.k,stem:q.stem,ans:q.ans,graded:'auto',given:'',ok:null,review:x.old});
  });
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
  const oldN=MT.items.filter(i=>i.kind==='calc'&&i.review).length;
  if(!MT.submitted){
    box.innerHTML=`<div class="card"><p class="hint">共 ${MT.items.length} 题：计算 <b>${calcN}</b> 题${oldN?`（含 ${oldN} 道旧知识回测，填答案自动判分）`:'（填答案自动判分）'}+ 应用题 <b>${wordN}</b> 题（写完请家长点「对/错」）。提交后看是否 ≥80% 过关。</p>
      ${MT.items.map((it,i)=>it.kind==='calc'
        ? `<div class="q-item" id="mtq-${i}"><span class="qn">${i+1}</span><span class="qs">${esc(it.stem)}</span>${it.review?'<span class="q-tag">↺ 旧知识</span>':''}<input type="text" inputmode="decimal" data-mi="${i}" placeholder="答案"><span class="mark"></span></div>`
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
        addMistake({taskId:MT.taskId,stage:TASKMAP[MT.taskId].stage,tag:D.calcTagNames[it.tag]||it.tag,type:'calc',date:activeDate(),question:it.stem,childAnswer:it.given||'(未填)',correctAnswer:it.ans,reason:'计算失误'});
    }
  });
  const total=MT.items.length, correct=MT.items.filter(it=>it.kind==='calc'?it.ok:it.verdict===true).length;
  MT.rate=Math.round(correct/total*100); MT.submitted=true; MT.passed=MT.rate>=80;
  if(!Array.isArray(S.masteryLog)) S.masteryLog=[];
  S.masteryLog.push({id:uid(),at:activeDate(),taskId:MT.taskId,rate:MT.rate,passed:MT.passed});
  if(MT.passed) prog(MT.taskId).passed=true;
  save();
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
    /* 日期回看 / 补录：切换只重画首页这张卡，不动数据 */
    case 'pick-day': setActiveDate(el.dataset.v); break;
    case 'day-shift': setActiveDate(addDays(activeDate(),parseInt(el.dataset.v,10)||0)); break;
    case 'day-today': setActiveDate(TODAY()); break;
    /* 任务页 / 规划页的快捷入口：直接跳到首页并切到那一天 */
    /* 学习路径：展开 / 达标确认 / 打钩 / 取消 */
    case 'path-toggle': pathToggle(id); break;
    case 'path-check': openPathGate(id); break;
    case 'path-pass': {
      S.pathDone[id]={at:activeDate()}; save();
      const ni=PATH_BLOCKS.findIndex(b=>!S.pathDone[b.id]);
      if(ni>=0&&PATH_OPEN) PATH_OPEN.add(PATH_BLOCKS[ni].id);
      closeSheet(); renderAll(); toast('✓ '+id+' 已达标，下一块已解锁');
      break; }
    case 'path-unpass': {
      delete S.pathDone[id]; save(); closeSheet(); renderAll(); toast('已取消 '+id+' 的打钩');
      break; }
    case 'go-day':                       /* 旧版按日回看入口已下线，统一回到新版本周打卡 */
    case 'go-week-cur': {
      WK_VIEW=null; setActiveDate(TODAY());
      NAV.page=['week']; applyPage('week'); renderAll();
      break;
    }
    case 'go-home': goPage('week'); break;
    /* ---- v20 本周打卡 ---- */
    case 'week-video': weekVideoToggle(parseInt(id,10)); break;
    case 'week-video-ok': weekVideoNone(); break;
    case 'week-calc': weekOpenCalc(id); break;
    case 'week-calc-done': weekCalcDone(id); break;
    case 'week-review-done': weekReviewDone(); break;
    case 'week-calc-edit': openWeekCalcEdit(); break;
    case 'week-calcedit-save': weekCalcEditSave(); break;
    case 'week-upload': weekOpenUpload(); break;
    case 'week-up-mode': {
      const seg=el.parentNode; if(seg) Array.from(seg.children).forEach(b=>b.classList.toggle('on',b===el));
      WK_UP.mode=el.dataset.v;
      renderWeekUploadBody();   /* 渲染对应模式的内容（首次切到文件模式时下拉还没生成） */
      $('#wuSingle').classList.toggle('hidden',WK_UP.mode!=='single');
      $('#wuFileBody').classList.toggle('hidden',WK_UP.mode!=='file');
      break; }
    case 'week-up-photo': { const f=$('#wuFile'); if(f) f.click(); break; }
    case 'week-up-file-pick': { const f=$('#wuFFile'); if(f) f.click(); break; }
    case 'week-up-file-save': weekFileSave(); break;
    case 'week-up-kind': { WK_UP.kind=el.dataset.v;
      $$('#wuSeg .seg-b').forEach(x=>x.classList.toggle('on',x.dataset.v===WK_UP.kind)); renderWeekUploadCats(); break; }
    case 'week-up-save': weekUploadSave(); break;
    case 'week-gate': weekOpenGate(); break;
    case 'week-gate-copy': weekGateCopy(); break;
    case 'week-gate-save': weekGateSave(); break;
    case 'week-redo': { const ids=dueMistakes().map(m=>m.id); if(ids.length) startRedoQueue(ids); break; }
    case 'week-prev': weekViewShift(-1); break;
    case 'week-next': weekViewShift(1); break;
    case 'week-cur': weekViewCur(); break;
    case 'week-jump': weekJump(); break;
    case 'week-jump-go': weekJumpGo(); break;
    case 'week-unlock': weekUnlock(); break;
    case 'week-calcedit-add': WK_EDIT.push({tag:Object.keys(D.calcTagNames||{})[0]||'mixed',n:10}); renderCalcEditRows(Object.keys(D.calcTagNames||{})); break;
    case 'week-calcedit-del': if(WK_EDIT.length>1){ WK_EDIT.splice(parseInt(id,10),1); renderCalcEditRows(Object.keys(D.calcTagNames||{})); } break;
    case 'go-path': goPage('path'); break;
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
      const box=document.getElementById('ov-'+id); if(!box) break;
      box.classList.toggle('hidden');
      const tg=el.querySelector('.ov-toggle');
      if(tg) tg.textContent=box.classList.contains('hidden')?'▸ 展开每周任务':'▾ 收起每周任务';
      break; }
    case 'ov-expand': $$('.ov-list').forEach(x=>x.classList.remove('hidden'));
      $$('.ov-toggle').forEach(x=>x.textContent='▾ 收起每周任务'); break;
    case 'ov-collapse': $$('.ov-list').forEach(x=>x.classList.add('hidden'));
      $$('.ov-toggle').forEach(x=>x.textContent='▸ 展开每周任务'); break;
    /* v21 任务页 / 阶段总览：全局序号任务 */
    case 'wp-toggle': wpToggleTask(parseInt(el.dataset.no,10)); break;
    case 'wp-task': wpOpenTask(parseInt(el.dataset.no,10)); break;
    case 'wp-view-week': wpViewWeek(el.dataset.v); break;
    /* v23 打钩确认 / 已完成预览与撤销 */
    case 'wp-done-yes': wpDoneYes(parseInt(el.dataset.no,10)); break;
    case 'wp-preview': wpOpenTask(parseInt(el.dataset.no,10)); break;
    case 'wp-undo': wpUndoTask(parseInt(el.dataset.no,10)); break;
    case 'wp-undo-yes': wpUndoYes(parseInt(el.dataset.no,10)); break;
    case 'done-list': openDoneList(); break;
    case 'clear-cache': clearCacheAndReload(); break;
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
    case 'calc-practice': practiceCalcTag(id); break;
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
    case 'gen-paper': genPaper((PAPER&&PAPER.fixedTag)||null); break;
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
    case 'daily-calc': { const t=TASKMAP[id]; if(t){ openCalc(t.id, makeDailyCalc(t)); logToday(t.id,{calc:true},activeDate()); } break; }
    case 'daily-word': { const t=TASKMAP[id]; if(t){ openWord(t.id); logToday(t.id,{word:true},activeDate()); } break; }
    case 'open-mastery': openMasteryTest(id); break;
    case 'week-review': { const w=weekDaysOf(activeDate()); BROWSE.quick='custom'; BROWSE.from=w[0]; BROWSE.to=w[6]; openWrongBrowse(); break; }
    case 'submit-mastery': submitMastery(); break;
    case 'mt-verdict': { const i=+el.dataset.i; if(MT&&MT.items[i]){ MT.items[i].verdict = el.dataset.v==='1'; renderMastery(); } break; }
  }
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='dayPick'){ setActiveDate(t.value); return; }
  if(t.id==='restoreFile'&&t.files[0]){ restore(t.files[0]); t.value=''; return; }
  if((t.id==='wordFile'||t.id==='inboxFile')&&t.files[0]){ handlePhoto(t.files[0]); return; }
  if(t.id==='attachFile'&&t.files[0]){ attachFilePicked(t.files[0]); return; }
  if(t.id==='wuFile'&&t.files[0]){ weekUploadPicked(t.files[0]); t.value=''; return; }
  if(t.id==='wuFFile'&&t.files[0]){ weekFilePicked(t.files[0]); t.value=''; return; }
  if(t.id==='wuFTopic'){ updateFileSeqHint(); return; }
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
  if(t.id==='dailyFocus'||t.id==='dailyWord'){
    const id=t.dataset.task||(currentTask()||{}).id; if(!id) return;
    const d=t.dataset.date||activeDate();
    logToday(id, t.id==='dailyFocus'?{topicFocus:t.value}:{word:t.checked}, d); return; }
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='inboxText'){ updateGuess(); return; }
  if(t.id==='fKeyword'){ renderWrong(); return; }
  if(t.id==='bfKeyword'){ BROWSE.keyword=t.value; BROWSE.collapsed={}; renderBrowse(); return; }
  if(t.id==='libFilterKw'){ LIBFILTER.kw=t.value; renderLibrary(); return; }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') goBack(); });

/* ==================== v20 · 94 周打卡主线 ====================
   数据见 weekplan.js（window.WEEK_PLAN）。旧 114 任务 / 32 块路径全部保留，只是不再是打卡主线。
   状态：S.week = { cur, done:{key:实际打钩日期}, calc:{key:[{tag,n}]}, gate:{} }
   key 形如 W01/v0（视频）、W01/c/2026-11-16（某日计算）、W01/upload、W17/gate。
*/
const WP = window.WEEK_PLAN || { weeks:[], gateWeeks:{} };
const WPW = WP.weeks || [];
const WP_END = WPW.length ? WPW[WPW.length-1].end : addDays(TODAY(), 600);
const WP_START = WP.start || (WPW.length ? WPW[0].start : TODAY());
const pad2 = n => String(n).padStart(2,'0');

/* ==================== v21 · 全局任务序号（按执行表顺序，前一项没完成就锁住后一项） ====================
   视频主条目按周→周内顺序编号 01..N；阶段测试周作为关卡插入同一序列。
   日期/周次只是基准：落下就停在原地继续当前项，绝不随日历自动跳过。
   当天「视频 / 计算 / 错题」三类互不锁，先做哪个都行；只有视频之间按序号串行。 */
function buildWPTasks(){
  const list=[];
  WPW.forEach(w=>{
    (w.videos||[]).filter(v=>!v.opt).forEach((v,vi)=>{
      list.push({ no:list.length+1, w:w.w, kind:'video', vi, key:`W${pad2(w.w)}/v${vi}`,
                  title:v.t, stage:w.stage, main:w.main||'' });
    });
    if(Object.prototype.hasOwnProperty.call(WP.gateWeeks||{},String(w.w))){
      list.push({ no:list.length+1, w:w.w, kind:'gate', key:`W${pad2(w.w)}/gate`,
                  title:(WP.gateWeeks||{})[String(w.w)]||'阶段达标测试', stage:w.stage, main:w.main||'' });
    }
  });
  return list;
}
const WPTASKS=buildWPTasks();
const WPSTAGES=[...new Set(WPW.map(w=>w.stage))];
function wpTaskDone(t,ws){
  if(!t) return false;
  if(t.kind==='video') return !!ws.done[t.key];
  const g=ws.gate&&ws.gate[`W${pad2(t.w)}`];
  return !!(g&&g.passed) || !!ws.done[t.key];
}
/* 当前卡在第几项（0-based 下标）；返回 length 表示全部完成 */
function wpCursor(ws){
  for(let i=0;i<WPTASKS.length;i++) if(!wpTaskDone(WPTASKS[i],ws)) return i;
  return WPTASKS.length;
}
function wpCurTask(){ const ws=weekState(),i=wpCursor(ws); return i<WPTASKS.length?WPTASKS[i]:null; }
function wpCurWeek(){ const t=wpCurTask(); return t?t.w:(WPW.length||94); }
function wpSeq(n){ return String(n).padStart(2,'0'); }
/* 只看视图周：手动翻周不影响任务进度，刷新/打钩后自动回到当前任务 */
let WK_VIEW=null;
function wkViewWeek(){ const w=WK_VIEW; return (w>=1&&w<=WPW.length)?w:wpCurWeek(); }

function weekState(){
  if(!S.week || typeof S.week!=='object') S.week={ cur:1, done:{}, calc:{}, gate:{} };
  const w=S.week;
  if(!w.done) w.done={}; if(!w.calc) w.calc={}; if(!w.gate) w.gate={};
  if(!(w.cur>=1&&w.cur<=94)) w.cur=1;
  return w;
}
function wkAt(w){ return WPW[w-1]||null; }
function weekCalcDefault(w){
  const wk=wkAt(w); if(!wk) return [{tag:'mixed',n:10}];
  return (wk.calc&&wk.calc.length?wk.calc:[{tag:'mixed',n:10}]).map(c=>({tag:c.tag,n:c.n}));
}
function weekCalcCfg(w,ds){
  const ws=weekState(), k=`W${pad2(w)}/c/${ds}`;
  return ws.calc[k] || weekCalcDefault(w);
}
/* 本周四项打卡（当天四类互不锁，先做哪个都行）：
   ① 本周视频 ② 每日计算（线下买题，只记录内容+打钩，不出题判分）③ 回炉专题（每周一个）④ 周末错题上传
   阶段达标测试是序列关卡，关卡周额外多一项。 */
function weekSteps(w){
  const wk=wkAt(w); if(!wk) return [];
  const steps=[];
  const vids=(wk.videos||[]).filter(v=>!v.opt);
  if(vids.length) steps.push({kind:'video',key:`W${pad2(w)}/video`,label:'本周视频',n:vids.length});
  steps.push({kind:'calc',key:`W${pad2(w)}/calc`,label:'每日计算',n:3});
  steps.push({kind:'review',key:`W${pad2(w)}/review`,label:'回炉专题',n:1});
  steps.push({kind:'upload',key:`W${pad2(w)}/upload`,label:'周末错题上传',n:1});
  if(wk.test) steps.push({kind:'gate',key:`W${pad2(w)}/gate`,label:'阶段达标测试',n:1});
  return steps;
}
function stepDone(ws,w,st){
  if(st.kind==='video'){
    const wk=wkAt(w)||{}, vids=(wk.videos||[]).filter(v=>!v.opt);
    return vids.length>0 && vids.every((v,i)=>!!ws.done[`W${pad2(w)}/v${i}`]);
  }
  if(st.kind==='calc'){
    const wk=wkAt(w)||{};
    let doneD=0;
    for(let i=0;i<7;i++){ const ds=addDays(wk.start,i); if(ws.done[`W${pad2(w)}/c/${ds}`]) doneD++; }
    return doneD>=3;
  }
  return !!ws.done[st.key];
}
/* 本周回炉专题名（去掉「（一轮）/（二轮）」后缀），用于到错题库找对应错题 */
function reviewTopics(w){
  const wk=wkAt(w)||{};
  return (wk.review||[]).map(x=>String(x).replace(/（[^）]*）$/,'').trim()).filter(Boolean);
}
/* 执行表回炉专题名（如「和差问题」）与错题库专题名（keyPoints 里的「和差倍」）不同名，做一层别名对应 */
const REVIEW_ALIAS={ '和差问题':'和差倍','和倍问题':'和差倍','差倍问题':'和差倍','和差倍综合':'和差倍',
  '年龄问题':'年龄','还原问题':'还原与间隔','还原问题（倒推）':'还原与间隔','盈亏问题':'盈亏',
  '平均数问题':'平均与容斥','归一归总问题':'平均与容斥','周期问题':'周期与日期','双周期与最小公倍数':'周期与日期',
  '日期推算':'周期与日期','等差数列':'等差数列','直线植树':'还原与间隔','封闭图形植树':'还原与间隔',
  '爬楼梯问题':'还原与间隔','敲钟问题':'还原与间隔','蜗牛爬井':'还原与间隔','环形插旗与嵌套间隔':'还原与间隔',
  '路标与费用':'还原与间隔','鸡兔同笼':'鸡兔同笼','鸡兔同笼变式':'鸡兔同笼','容斥原理':'平均与容斥',
  '容斥与倍数结合':'平均与容斥','有序枚举':'计数','标数法与递推计数':'计数','图形计数':'计数',
  '逻辑推理':'综合','数阵图与幻方':'综合','算式谜与数字谜':'综合','巧求周长':'几何平面','统筹与优化':'综合',
  '集合与韦恩图':'平均与容斥','编码与数字问题':'综合','操作类智巧趣题':'综合' };
function topicMatch(a,b){
  if(!a||!b) return false;
  if(a===b||a.indexOf(b)>=0||b.indexOf(a)>=0) return true;
  const na=REVIEW_ALIAS[a]||a, nb=REVIEW_ALIAS[b]||b;
  return na===nb||na.indexOf(nb)>=0||nb.indexOf(na)>=0;
}
function reviewMistakes(w){
  const names=reviewTopics(w); if(!names.length) return [];
  return (S.mistakes||[]).filter(m=>m.status==='active'&&names.some(n=>
    topicMatch(topicTagOf(m),n)||topicMatch(m.tag||'',n)));
}
/* 错题的「线下定位」：整份文件显示《专题-NN》，单题显示专题+题干片段。
   家长据此在线下把对应纸质件找出来重做。 */
function mistakeRef(m){
  if(m.fileBatch) return `《${fileBatchName(topicTagOf(m),m.fileSeq)}》文件`+(m.fileName?`（${m.fileName}）`:'');
  return esc(clip(m.question||m.fileName||'（见附件）',46));
}
/* 周末复盘：按 1/3/7 到期的题，按专题分组，提醒家长线下找出重做。
   包含之前累积到期的题（不只本周新传的）。 */
function weekendReviewHTML(w){
  const due=dueMistakes();
  const wk=wkAt(w)||{}, wStart=wk.start||'', wEnd=wk.end||addDays(wStart,6);
  const thisWeekNew=(S.mistakes||[]).filter(m=>m.date>=wStart&&m.date<=wEnd).length;
  if(!due.length){
    return `<div class="wk-memo"><div class="wm-h">🔁 周末复习提醒<span>${thisWeekNew} 道本周新错题</span></div>
      <p class="hint">目前没有到期的旧错题。新传的错题会在第 1 / 3 / 7 天自动出现在这里提醒你线下重做。</p></div>`;
  }
  const groups={};
  due.forEach(m=>{ const t=topicTagOf(m); (groups[t]=groups[t]||[]).push(m); });
  const gkeys=Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length);
  return `<div class="wk-memo"><div class="wm-h">🔁 周末复习提醒<span>到期 ${due.length} 道 · 本周新传 ${thisWeekNew} 道</span></div>
    <p class="hint">除了本周新错题，这些是之前错了、按 <b>1 / 3 / 7 天</b>记忆曲线今天该再复习的。按下面的「专题 + 序号/题」线下找出来给孩子重做，回来点结果：连对 2 次移出，又错则重新排期。</p>
    ${gkeys.map(t=>`<div class="wm-grp"><div class="wm-grp-h">${esc(t)} <small>${groups[t].length} 道</small></div>
      ${groups[t].map(m=>`<div class="wm-item"><span>${mistakeRef(m)}</span>
        <span class="wm-btns"><button class="btn tiny ghost" data-action="review-ok" data-id="${esc(m.id)}">做对了</button><button class="btn tiny ghost" data-action="review-fail" data-id="${esc(m.id)}">又错了</button></span></div>`).join('')}</div>`).join('')}
    <div class="btn-row"><button class="btn tiny ghost" data-action="go-wrong">去错题本查看全部</button></div></div>`;
}
function weekDone(ws,w){ const ss=weekSteps(w); return ss.length>0 && ss.every(st=>stepDone(ws,w,st)); }
/* v21：当天三类任务互不锁。视频之间的先后顺序由 WPTASKS 全局序号控制，不在这里锁。 */
function stepUnlocked(ws,w,idx){ return true; }

/* ---------- 进度偏离与实际完成日预测 ----------
   用「当前周实际打钩日 - 该周计划起始日」求偏移，再按已观测的实际周速外推 94 周结束日。 */
function weekForecast(){
  const ws=weekState(), curW=wpCurWeek(), wk0=wkAt(curW)||{start:WP_START};
  const planStart=wk0.start, planEndOfCur=wk0.end||addDays(planStart,6);
  // 本周实际开始日：本周最早一个实际打钩时间
  const weekKeys=Object.keys(ws.done).filter(k=>k.indexOf('W'+pad2(curW)+'/')===0);
  const dates=weekKeys.map(k=>ws.done[k]).filter(Boolean).sort();
  const thisWeekActual=dates[0]||TODAY();
  const driftDays=dayDiff(planStart,thisWeekActual);           // 正=比计划晚
  // 实际周速：用已完成周（cur 之前的周）里，每周首个打钩日之间的平均间隔
  const starts=[];
  for(let w=1;w<curW;w++){
    const ks=Object.keys(ws.done).filter(k=>k.indexOf('W'+pad2(w)+'/')===0);
    const ds=ks.map(k=>ws.done[k]).filter(Boolean).sort();
    if(ds.length) starts.push(ds[0]);
  }
  let pace=7;
  if(starts.length>=2){
    let sum=0; for(let i=1;i<starts.length;i++) sum+=dayDiff(starts[i-1],starts[i]);
    pace=clamp(sum/(starts.length-1),2,21);
  } else if(starts.length===1){
    pace=clamp(dayDiff(starts[0],thisWeekActual),2,21);
  }
  const remainW=Math.max(0,94-curW+1);
  const eta=addDays(thisWeekActual, Math.round(remainW*pace));
  const planTotal=dayDiff(WP_START,WP_END);
  const etaDrift=dayDiff(WP_END,eta);                          // 正=整体延后
  return { driftDays, pace, eta, etaDrift, planTotal, thisWeekActual, remainW,
           driftText: driftDays>0?`晚 ${driftDays} 天`:(driftDays<0?`提前 ${-driftDays} 天`:'与计划同步') };
}

/* ---------- 二轮重现：把已毕业错题在学到对应专题时重新激活 ---------- */
function weekRecycle(w){
  const wk=wkAt(w); if(!wk) return 0;
  const is2=/二轮|复习|模拟|查漏|销号|收口/.test(wk.attr||'') || w>=68;
  const want=new Set((wk.review||[]).map(x=>String(x).split('（')[0]));
  if(wk.main){ const m=String(wk.main).match(/^([\u4e00-\u9fa5A-Za-z][^：:·]{0,8})/); if(m) want.add(m[1]); }
  let n=0;
  (S.mistakes||[]).forEach(m=>{
    if(m.status!=='graduated') return;
    const tag=topicTagOf(m);
    const hit = is2 || [...want].some(t=>t&&(tag===t||tag.indexOf(t)>=0||t.indexOf(tag)>=0));
    if(hit && m.recycleWeek!==w && n<6){
      m.status='active'; m.streak=0; m.cycleStart=TODAY(); m.reviews=mkReviews(TODAY());
      m.recycleWeek=w; m.recycledAt=TODAY(); n++;
    }
  });
  if(n) save();
  return n;
}

/* ---------- 渲染：本周打卡主页 ---------- */
function renderWeek(){
  const root=$('#weekRoot'); if(!root) return;
  const ws=weekState(), w=wkViewWeek(), wk=wkAt(w), ct=wpCurTask(), cursor=wpCursor(ws);
  const ts=$('#topStage'); if(ts) ts.textContent = wk ? `第 ${w}/94 周 · ${wk.stage}` : '94 周打卡';
  if(!wk){ root.innerHTML='<div class="card">94 周数据未加载，请确认 weekplan.js 已上传。</div>'; return; }
  weekRecycle(w);   /* 复活二轮错题（副作用），渲染在周末提醒/错题本里体现 */
  const fc=weekForecast();
  const strong=fc.etaDrift>14?'落后':(fc.etaDrift<-14?'领先':'正常');

  /* 当前任务（全局序号）。落后就停在这项，不会跳到日历上「今天该做」的那项 */
  const doneN=WPTASKS.filter(t=>wpTaskDone(t,ws)).length;
  let html=`<div class="wk-cur">
    <div class="wkc-main"><span class="wkc-tag">当前任务 · 第 ${ct?wpSeq(ct.no)+' / '+WPTASKS.length:'✓'} 项</span>
      <b>${ct?esc(ct.title):'执行表主任务已全部完成，可进入初中衔接'}</b>
      <small>${ct?`第 ${ct.w} 周 · ${esc(ct.stage)} · ${ct.kind==='gate'?'阶段达标测试':'培优A视频'}`:''}</small></div>
    <div class="wkc-acts">
      ${doneN?`<button class="btn tiny ghost" data-action="done-list">已完成 ${doneN} 项 · 查看/撤销</button>`:''}
      ${ct?`<button class="btn tiny ghost" data-action="week-unlock">家长确认已完成</button>`:''}
    </div>
  </div>`;
  if(WK_VIEW && w!==wpCurWeek()) html+=`<div class="wk-viewnote">正在查看第 ${w} 周（不影响任务进度）<button class="btn tiny ghost" data-action="week-cur">回到当前任务 ${ct?wpSeq(ct.no):''} ›</button></div>`;

  html+=`<div class="wk-hero">
    <div class="wk-hero-l"><span class="wk-label">当前 · 第 ${w} / 94 周</span>
      <h3>${esc(wk.main)}</h3>
      <div class="wk-meta"><span class="wk-pill">${esc(wk.stage)}</span><span class="wk-pill alt">${esc(wk.attr)}</span>
        <span>计划 ${esc(wk.start)} ~ ${esc(wk.end)}</span></div>
    </div>
    <div class="wk-hero-r">
      <div class="wk-kpi ${strong==='落后'?'bad':(strong==='领先'?'good':'')}">
        <span>预计全部完成（按实际打钩速度）</span><b>${esc(fc.eta)}</b>
        <small>94 周计划表到 ${esc(WP_END)}，当前${fc.driftText}</small>
      </div>
      <div class="wk-kpi"><span>实际周速</span><b>${fc.pace.toFixed(1)} 天/周</b><small>计划 7 天/周</small></div>
    </div>
  </div>`;

  const wd=doneN;
  html+=`<div class="wk-bar"><div class="wk-bar-in" style="width:${Math.round(wd/WPTASKS.length*100)}%"></div></div>
    <div class="wk-bar-note">主任务 ${wd}/${WPTASKS.length} 项完成 · 当前第 ${ct?wpSeq(ct.no):'—'} 项 · ${strong==='落后'?'⚠ 落后较多，建议压缩选做奥数周、利用假期补回':(strong==='领先'?'✅ 领先计划，可按节奏放缓或提前启动初中预热':'节奏正常，按序号推进即可')}</div>`;

  // 当天三类任务互不锁：视频按全局序号，计算/错题随时可做
  const ss=weekSteps(w);
  html+=`<div class="wk-steps">`;
  ss.forEach((st,idx)=>{
    const done=stepDone(ws,w,st);
    const tip=st.kind==='video'?'按序号':(done?'已完成':'随时可做');
    html+=`<div class="wk-step ${done?'done':'now'}" id="wks-${st.kind}">
      <div class="wk-step-h"><span class="wk-step-i">${done?'✓':''}</span>
        <b>${esc(st.label)}</b><em class="${done?'':'hot'}">${tip}</em></div>
      <div class="wk-step-b">${weekStepBody(w,st,true,done)}</div></div>`;
  });
  html+=`</div>`;

  // 周切换
  html+=`<div class="wk-nav">
    <button class="btn ghost" data-action="week-prev" ${w<=1?'disabled':''}>‹ 看上一周</button>
    ${WK_VIEW?`<button class="btn" data-action="week-cur">🎯 回到当前任务</button>`:''}
    <button class="btn ghost" data-action="week-next" ${w>=94?'disabled':''}>看下一周 ›</button>
    <button class="btn ghost" data-action="week-jump">跳到指定周</button>
  </div>`;
  html+=`<div class="wk-foot">主视频按执行表序号推进：第 ${ct?wpSeq(ct.no):'—'} 项没完成，后面各项都锁着，落下也不会跳过。当天先看视频、先做计算、还是先清错题，随你。计划的日期只是基准；打钩的实际时间单独记录，用来算偏离和预计完成日。</div>`;

  root.innerHTML=html;
}

/* 各步骤内部的按钮/清单 */
function weekStepBody(w,st,unlocked,done){
  const ws=weekState(), wk=wkAt(w)||{};
  if(!unlocked) return `<p class="hint">先完成上一步，这里才会解锁。</p>`;
  if(st.kind==='video'){
    const vids=(wk.videos||[]).filter(v=>!v.opt);
    if(!vids.length) return `<p class="hint">本周无新视频：规则型计算家长讲 3 分钟 + 直接练；阶段测试周做出口测；二轮 / 查漏周直接做错题。<br>校内同步备选：${esc(wk.backup||'无')}</p>`;
    const cursor=wpCursor(ws);
    return `<div class="wk-vlist">${vids.map((v,i)=>{
        const key=`W${pad2(w)}/v${i}`, d=ws.done[key];
        const task=WPTASKS.find(t=>t.key===key), no=task?task.no:null;
        const locked=!!no&&!d&&(no-1)!==cursor, isCur=!!no&&(no-1)===cursor;
        return `<div class="wk-vitem ${d?'ok':''} ${locked?'locked':''} ${isCur?'iscur':''}">
          <button class="wk-check" data-action="week-video" data-id="${no||i}" ${locked?'disabled':''}>${d?'✓':(locked?'🔒':'○')}</button>
          <span>${no?`<em class="wk-no">${wpSeq(no)}</em>`:''}${esc(v.t)}</span>
          ${d?`<small>${esc(cnDate(d))} 完成</small>`:(locked?'<small>先完成前一项</small>':(isCur?'<small class="hot">← 当前这项</small>':''))}</div>`;
      }).join('')}</div>
      ${wk.backup?`<p class="hint">卡住时才看的校内同步备选：${esc(wk.backup)}</p>`:''}
      <p class="hint">按序号看：前一项没打钩，后面都锁着；落下就继续当前这项，不会跳过去。看完让孩子用 1 句话复述讲了什么。已学过又做错的回炉专题直接做错题，不用重看整讲。</p>`;
  }
  if(st.kind==='calc'){
    const days=[];
    for(let i=0;i<7;i++){ const ds=addDays(wk.start,i); const d=ws.done[`W${pad2(w)}/c/${ds}`];
      const dow=['日','一','二','三','四','五','六'][new Date(ds+'T00:00:00').getDay()];
      const cfg=weekCalcCfg(w,ds), txt=weekCalcText(w,ds);
      days.push(`<div class="wk-cday ${d?'ok':''}"><div class="wcd-top"><b>周${dow}</b><small>${ds.slice(5)}</small></div>
        <div class="wcd-tags">${txt?`<span>${esc(txt)}</span>`:cfg.map(c=>`<span>${esc(calcName(c.tag))} ${c.n}题</span>`).join('')}</div>
        <button class="btn tiny ${d?'ghost':''}" data-action="week-calc" data-id="${ds}">${d?'✓ '+cnDate(d):'记录并打钩'}</button></div>`);
    }
    return `<p class="hint">线下买的计算题，每天做完在这里<b>填今天做了什么 + 打钩</b>即可，不用在线做题、也不用再录答案。本周至少完成 3 天（周一三五）即算达标，多做的都记下来。</p>
      <div class="wk-cgrid">${days.join('')}</div>
      <div class="btn-row"><button class="btn ghost" data-action="week-calc-edit">调整本周计算内容</button></div>`;
  }
  if(st.kind==='review'){
    const names=reviewTopics(w), list=reviewMistakes(w), d=ws.done[`W${pad2(w)}/review`];
    const how=(wk.reviewHow||'原题重做（不看书）→ 同类变式 2–3 题 → 全对才打钩；★ 不看视频。');
    if(!names.length) return `<p class="hint">本周执行表没有安排回炉专题，这一项可跳过。</p>
      <div class="btn-row"><button class="btn ghost" data-action="week-review-done">${d?'✓ 已完成':'标记无需回炉'}</button></div>`;
    return `<p class="hint">本周回炉 <b>${names.map(esc).join('、')}</b>：把当时做这个专题时错过的题再做一遍，看会了没有。<b>直接做错题，不看视频。</b></p>
      <div class="rv-box"><div class="rv-how">${esc(how)}</div>
        ${list.length?`<div class="rv-list">${list.slice(0,12).map(m=>`<div class="rv-item">${mistakeRef(m)}<small>${esc(topicTagOf(m))}${m.fileBatch?' · 该文件':''}</small>
          <button class="linkbtn" data-action="view-wrong" data-id="${esc(m.id)}">查看 ›</button></div>`).join('')}${list.length>12?`<div class="rv-more">…另有 ${list.length-12} 道，到错题本查看</div>`:''}</div>`
          :`<div class="rv-none">这个专题目前没有在册错题。到周末上传时，把孩子这周做错的该专题题传进来；或直接在错题本里加一道。</div>`}
      </div>
      <div class="btn-row"><button class="btn ${d?'ghost':''}" data-action="week-review-done">${d?'✓ '+cnDate(d)+' 已完成 · 点此取消':'✓ 本周回炉做完了，打钩'}</button>
        <button class="btn ghost" data-action="go-wrong">去错题本</button></div>`;
  }
  if(st.kind==='upload'){
    const d=ws.done[`W${pad2(w)}/upload`];
    return `<p class="hint">周末把本周孩子做错的题传进来：<b>视频后练习题、线下计算题、回炉专题又错的题</b>都可以。单题拍照/打字，或整份文件一次传（自动按专题编号）。</p>
      <div class="btn-row"><button class="btn ${d?'ghost':''}" data-action="week-upload">${d?'✓ 本周已上传 · 再传':'📤 上传本周错题'}</button></div>
      ${d?`<p class="hint">已于 ${esc(d)} 上传。</p>`:''}
      ${weekendReviewHTML(w)}`;
  }
  if(st.kind==='gate'){
    const g=ws.gate[`W${pad2(w)}`];
    return `<p class="hint">${esc(wk.gate||'到下一专题前的达标测试')}。工作台给出一段 AI 关键词（本阶段全部所学内容），你复制去让 AI 出题、孩子线下做，回来填达标率；≥80% 才放行。</p>
      <div class="btn-row"><button class="btn ${g&&g.passed?'ghost':''}" data-action="week-gate">${g&&g.passed?`✓ 已通过 ${g.rate}% · 可再测`:'📝 打开 AI 出题关键词 / 填达标率'}</button></div>
      ${g?`<p class="hint">最近一次：${g.rate}% · ${g.passed?'通过':'未过'} · ${esc(g.at)}</p>`:''}`;
  }
  return '';
}

/* ---------- 本周打卡交互 ---------- */
function weekVideoToggle(no){
  const t=WPTASKS.find(x=>x.no===no&&x.kind==='video');
  if(!t) return;
  if(wpTaskDone(t,weekState())){ wpOpenTask(no); return; }   /* 已完成：预览，不直接改 */
  wpConfirmDone(no);   /* 当前项：先确认，避免误触推进 */
}
function weekVideoNone(){
  const ws=weekState(), w=wkViewWeek(), wk=wkAt(w)||{}, vids=(wk.videos||[]).filter(v=>!v.opt);
  if(vids.length) return;
  ws.done[`W${pad2(w)}/video`]=activeDate(); save(); renderAll(); toast('✓ 已确认');
}
/* 每日计算：线下买题做，工作台只记录「今天做了什么」+打钩，不出题、不判分、不录答案。
   内容存在 ws.calc[W##/c/日期]（数组 [{tag,n,text}]），text 是家长填的实际题单说明。 */
function weekCalcText(w,ds){
  const cfg=weekCalcCfg(w,ds);
  return cfg.filter(c=>c.text).map(c=>c.text).join('、')||'';
}
function weekOpenCalc(ds){
  const w=wkViewWeek(), ws=weekState(), cfg=weekCalcCfg(w,ds);
  const d=ws.done[`W${pad2(w)}/c/${ds}`];
  const suggest=cfg.map(c=>calcName(c.tag)+' '+c.n+'题').join('、');
  const cur=weekCalcText(w,ds);
  openSheet(`第 ${w} 周 · ${cnDate(ds)} · 每日计算`, `
    <div class="card"><p class="hint">线下买的计算题，做完在这里记一句「今天做了什么」再打钩即可。<b>不用在线做题，也不用录每题答案。</b>本周至少 3 天打钩算达标。</p>
      <label class="lbl">今天做的计算内容</label>
      <input type="text" id="wccText" value="${esc(cur||suggest)}" placeholder="例如：口算本 P12 小数乘法 20 题 + 竖式 10 题">
      <p class="hint">建议（按本周执行表题型）：${esc(suggest||'按本周计算安排')}</p>
      <div class="btn-row">
        <button class="btn" data-action="week-calc-done" data-id="${ds}">${d?'✓ 已打钩 · 保存并取消打钩':'✓ 做完了，打钩'}</button>
        <button class="btn ghost" data-action="close-sheet">关闭</button></div>
    </div>`);
}
function weekCalcDone(ds){
  const w=wkViewWeek(), ws=weekState(), key=`W${pad2(w)}/c/${ds}`;
  const txt=($('#wccText')&&$('#wccText').value.trim())||'';
  if(txt){
    const cfg=weekCalcCfg(w,ds).map(c=>Object.assign({},c));
    if(cfg.length) cfg[0].text=txt; else cfg.push({tag:'mixed',n:0,text:txt});
    ws.calc[key]=cfg;
  }
  if(ws.done[key]){ delete ws.done[key]; toast('已取消这一天的打钩'); }
  else ws.done[key]=activeDate();
  save(); closeSheet(); renderAll();
  if(ws.done[key]) toast('✓ 这一天计算已记录并打钩');
}
function weekReviewDone(){
  const ws=weekState(), w=wkViewWeek(), key=`W${pad2(w)}/review`;
  if(ws.done[key]){ delete ws.done[key]; toast('已取消回炉打钩'); }
  else ws.done[key]=activeDate();
  save(); renderAll();
  if(ws.done[key]) toast('✓ 本周回炉已打钩');
}
/* 错题上传：单题拍照/输入 + 整份文件合集（按专题上传顺序自动编号）
   这份工作台是给家长记录用的；孩子不在这里做题。 */
let WK_UP={imageKey:'',mode:'single',file:null,dataURL:''};
const WK_FILE_MAX=12*1024*1024;
/* 某专题下已归档的文件份数 +1（按上传顺序编号） */
function nextFileSeq(topic){
  let n=0; (S.mistakes||[]).forEach(m=>{ if(m.fileBatch && (topicMatch(topicTagOf(m),topic)||topicMatch(m.tag||'',topic))) n++; });
  return n+1;
}
function fileBatchName(topic,seq){ return topic+'-'+String(seq).padStart(2,'0'); }
function weekOpenUpload(){
  WK_UP={imageKey:'',mode:'single',file:null,dataURL:''};
  const cats=TOPIC_LIST().slice();
  const calcNames=Object.keys(D.calcTagNames||{}).map(k=>D.calcTagNames[k]);
  openSheet('上传本周错题', `
    <div class="card"><h3>把本周孩子做错的题录进来</h3>
      <p class="hint">这是<b>给家长记录用</b>的工作台。两种方式：单题拍照/打字，或整份文件一次传（某个专题的错题合集，不用一题一题录）。录进来后按 1 / 3 / 7 天提醒你线下找出来重做；连对 2 次移出，二轮学到对应专题再出现。</p>
      <div class="seg" id="wuMode"><button class="seg-b on" data-action="week-up-mode" data-v="single">📷 单题拍照 / 输入</button><button class="seg-b" data-action="week-up-mode" data-v="file">📄 整份文件合集</button></div>
      <div id="wuSingle"></div><div id="wuFileBody" class="hidden"></div>
    </div>`);
  WK_UP.kind='word'; WK_UP.cats=cats; WK_UP.calcNames=calcNames;
  renderWeekUploadBody();
}
function renderWeekUploadBody(){
  if(WK_UP.mode==='file'){
    const box=$('#wuFileBody'); if(!box) return;
    box.innerHTML=`
      <label class="lbl">这份文件属于哪个专题</label>
      <select id="wuFTopic">${WK_UP.cats.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
      <p class="hint" id="wuFSeqHint"></p>
      <div class="btn-row"><button class="btn ghost" data-action="week-up-file-pick">📎 选择文件（PDF / Word / 多图合集）</button></div>
      <input type="file" id="wuFFile" hidden>
      <div id="wuFInfo" class="attach-info">还没选文件</div>
      <label class="lbl">错题日期（补录旧题就改这里）</label>
      <input type="date" id="wuDate" value="${activeDate()}">
      <label class="lbl">备注（可不填）</label>
      <input type="text" id="wuFNote" placeholder="例如：鸡兔同笼错题 8 道，重点第 3、7 题">
      <div class="btn-row"><button class="btn" data-action="week-up-file-save">✓ 保存这份文件并编号</button></div>
      <p class="hint">📌 文件本体只存在这台设备；专题、编号、复习日期会同步。到复习日工作台会提醒你「复习《专题-NN》这份文件」，你线下找出来给孩子重做，再回来判对错。</p>`;
    updateFileSeqHint();
    return;
  }
  const box=$('#wuSingle'); if(!box) return;
  box.innerHTML=`
    <label class="lbl">错题日期（补录旧题就改这里）</label>
    <input type="date" id="wuDate" value="${activeDate()}">
    <div class="btn-row"><button class="btn ghost" data-action="week-up-photo">📷 拍照 / 选图</button></div>
    <input type="file" id="wuFile" accept="image/*" hidden>
    <div id="wuImg"></div>
    <label class="lbl">题目文字（可只传图不填字）</label>
    <textarea id="wuText" placeholder="例如：每人分 5 颗多 2 颗，每人分 7 颗少 6 颗，求人数。"></textarea>
    <label class="lbl">归到哪一类 —— 先选「专题」还是「计算」</label>
    <div class="seg" id="wuSeg"><button class="seg-b on" data-action="week-up-kind" data-v="word">专题应用题</button><button class="seg-b" data-action="week-up-kind" data-v="calc">计算</button></div>
    <div id="wuCatBox"></div>
    <label class="lbl">孩子的答案 / 正确答案（可不填）</label>
    <input type="text" id="wuChild" placeholder="孩子写的答案"><input type="text" id="wuCorrect" placeholder="正确答案">
    <label class="lbl">错在哪</label>
    <select id="wuReason">${D.reasons.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('')}</select>
    <input type="text" id="wuNote" placeholder="补一句具体原因（可不填）">
    <div class="btn-row"><button class="btn" data-action="week-up-save">✓ 保存这一题</button></div>`;
  renderWeekUploadCats();
}
function updateFileSeqHint(){
  const sel=$('#wuFTopic'), hint=$('#wuFSeqHint'); if(!sel||!hint) return;
  const seq=nextFileSeq(sel.value);
  hint.innerHTML=`保存后命名为 <b>${esc(fileBatchName(sel.value,seq))}</b>（这个专题第 ${seq} 份，以后再传会自动接着编号）`;
}
async function weekFilePicked(file){
  if(!file) return;
  if(file.size>WK_FILE_MAX){ toast('文件超过 12MB，请压缩或拆成几份再传'); return; }
  try{
    const data=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsDataURL(file); });
    WK_UP.file=file; WK_UP.dataURL=data;
    const info=$('#wuFInfo');
    if(info) info.innerHTML=`<b>📎 ${esc(file.name)}</b><small>${(file.size/1024).toFixed(0)} KB ｜ ${esc(file.type||'未知格式')}</small>`;
    toast('✓ 文件已就绪');
  }catch(e){ toast('读取文件失败：'+(e.message||e)); }
}
async function weekFileSave(){
  if(!WK_UP.file||!WK_UP.dataURL){ toast('请先选择文件'); return; }
  const topic=$('#wuFTopic')?$('#wuFTopic').value:'综合';
  const seq=nextFileSeq(topic), name=fileBatchName(topic,seq);
  const d=($('#wuDate')&&$('#wuDate').value)||activeDate();
  const note=($('#wuFNote')&&$('#wuFNote').value.trim())||'';
  const key='att:'+uid();
  try{ await IMG.put(key,WK_UP.dataURL); }
  catch(e){ toast((e&&e.message)||'文件保存失败，可能存储空间不足'); return; }
  addMistake({taskId:'',stage:'第'+wkViewWeek()+'周',tag:topic,topicTag:topic,type:'file',source:'文件合集',date:d,
    question:'📄《'+name+'》'+(WK_UP.file.name?'（'+WK_UP.file.name+'）':''),
    fileKey:key,fileName:WK_UP.file.name||name,fileType:WK_UP.file.type||'',fileBatch:true,fileSeq:seq,
    reason:'待线下重做判定',note:note});
  const ws=weekState(), vw=wkViewWeek(); WK_VIEW=null; ws.done[`W${pad2(vw)}/upload`]=activeDate();
  save(); closeSheet(); renderAll(); toast('✓ 已存为《'+name+'》，按 1 / 3 / 7 天排进复习提醒');
}
function renderWeekUploadCats(){
  const box=$('#wuCatBox'); if(!box||!WK_UP) return;
  const list=WK_UP.kind==='calc'?WK_UP.calcNames:WK_UP.cats;
  box.innerHTML=`<label class="lbl">${WK_UP.kind==='calc'?'计算类型':'专题'}</label><select id="wuCat">${list.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>`;
}
async function weekUploadPicked(file){
  if(!file) return;
  try{ WK_UP.imageKey='i'+uid(); await IMG.put(WK_UP.imageKey, await compress(file));
    const img=$('#wuImg'); if(img) img.innerHTML=`<img class="thumb" src="${attBlobURL(WK_UP.imageKey,'')}" alt="错题照片">`;
    toast('✓ 照片已附'); }
  catch(e){ toast('照片保存失败：'+(e.message||e)); }
}
function weekUploadSave(){
  const text=($('#wuText')&&$('#wuText').value.trim())||'';
  if(!text&&!WK_UP.imageKey){ toast('请填题目文字或上传照片'); return; }
  const cat=$('#wuCat')?$('#wuCat').value:'综合';
  const d=($('#wuDate')&&$('#wuDate').value)||activeDate();
  addMistake({taskId:'',stage:'第'+wkViewWeek()+'周',tag:cat,topicTag:cat,
    type:WK_UP.kind==='calc'?'calc':'word',source:'本周错题',date:d,
    question:text,imageKey:WK_UP.imageKey,
    childAnswer:($('#wuChild')&&$('#wuChild').value.trim())||'',correctAnswer:($('#wuCorrect')&&$('#wuCorrect').value.trim())||'',
    reason:($('#wuReason')&&$('#wuReason').value)||'思路错误',note:($('#wuNote')&&$('#wuNote').value.trim())||''});
  const ws=weekState(), vw=wkViewWeek(); WK_VIEW=null; ws.done[`W${pad2(vw)}/upload`]=activeDate();
  save(); closeSheet(); renderAll(); toast('✓ 已存入错题本，之后每天会排重做');
}
/* 每日题型/题量编辑 */
function openWeekCalcEdit(){
  const w=wkViewWeek();
  const allTags=Object.keys(D.calcTagNames||{});
  openSheet(`第 ${w} 周 · 调整每日计算`, `
    <div class="card"><p class="hint">这一周每天做的计算类型和题量。可以只留 1 类，也可以加几类；家长按孩子情况改。改完这一周每天都按这个来。</p>
      <div id="wceRows"></div>
      <div class="btn-row"><button class="btn ghost" data-action="week-calcedit-add">+ 加一类</button></div>
      <div class="btn-row"><button class="btn" data-action="week-calcedit-save">保存这一周的设置</button></div>
    </div>`);
  WK_EDIT=weekCalcDefault(w).map(c=>({tag:c.tag,n:c.n}));
  renderCalcEditRows(allTags);
}
let WK_EDIT=[];
function renderCalcEditRows(tags){
  const box=$('#wceRows'); if(!box) return;
  box.innerHTML=WK_EDIT.map((c,i)=>`<div class="wce-row">
    <select data-wce-tag="${i}">${tags.map(t=>`<option value="${esc(t)}" ${c.tag===t?'selected':''}>${esc(calcName(t))}</option>`).join('')}</select>
    <input type="number" min="1" max="60" value="${c.n}" data-wce-n="${i}" aria-label="题量">
    <button class="btn tiny ghost" data-action="week-calcedit-del" data-id="${i}">删</button></div>`).join('');
}
function weekCalcEditSave(){
  const ws=weekState(), w=wkViewWeek();
  WK_EDIT.forEach((c,i)=>{
    const ts=document.querySelector(`[data-wce-tag="${i}"]`), ns=document.querySelector(`[data-wce-n="${i}"]`);
    if(ts) c.tag=ts.value; if(ns) c.n=clamp(parseInt(ns.value,10)||10,1,60);
  });
  for(let i=0;i<7;i++){ const ds=addDays((wkAt(w)||{start:TODAY()}).start,i); ws.calc[`W${pad2(w)}/c/${ds}`]=WK_EDIT.map(c=>({tag:c.tag,n:c.n})); }
  save(); closeSheet(); renderAll(); toast('✓ 这一周的计算设置已保存');
}

/* 周切换（仅看视图，不改任务进度）/ 家长强制确认当前项 */
function weekViewShift(d){
  const base=wkViewWeek(), v=clamp(base+d,1,WPW.length||94);
  WK_VIEW=(v===wpCurWeek())?null:v; renderAll();
}
function weekViewCur(){ WK_VIEW=null; renderAll(); }
function weekUnlock(){
  const t=wpCurTask();
  if(!t){ closeSheet(); toast('主任务已全部完成'); return; }
  if(t.kind==='gate'){ WK_VIEW=t.w; weekOpenGate(); return; }   /* 阶段测去填达标率，不直接放行 */
  wpConfirmDone(t.no);   /* 和其他打钩入口一样，先确认再推进 */
}
function weekJump(){
  const ct=wpCurTask(), cw=wpCurWeek();
  openSheet('看指定周', `<div class="card"><p class="hint">只是查看某一周的执行表，不影响任务序号。落下没做完的任务永远停在原地，不会随日期跳过。</p>
    <label class="lbl">第几周（1–${WPW.length||94}）</label><input type="number" id="wjNum" min="1" max="${WPW.length||94}" value="${wkViewWeek()}">
    <div class="btn-row"><button class="btn" data-action="week-jump-go">查看这一周</button>
      <button class="btn ghost" data-action="week-cur">回到当前任务</button></div>
    <p class="hint">当前任务：第 ${ct?wpSeq(ct.no):'—'} 项 · 第 ${cw} 周 · 计划 ${esc((wkAt(cw)||{}).start||'')} 起</p></div>`);
}
function weekJumpGo(){
  const v=parseInt($('#wjNum')&&$('#wjNum').value,10);
  if(!(v>=1&&v<=WPW.length)){ toast('请输入 1–'+WPW.length+' 之间的周次'); return; }
  WK_VIEW=(v===wpCurWeek())?null:v; closeSheet(); renderAll();
  toast('已切到第 '+v+' 周'+(WK_VIEW?'（仅查看，不影响任务进度）':''));
}

/* ---------------- 阶段达标测试：AI 关键词出题（工作台不出题，家长拿关键词让 AI 出） ----------------
   覆盖「上一个关卡周之后 ~ 本关卡周」的全部所学内容：主线、视频讲次、计算类型、回炉专题。
   家长复制关键词去问 AI → AI 出题 → 孩子线下做 → 回来填达标率；≥80% 放行。 */
function gateWeekRange(w){
  const gates=Object.keys(WP.gateWeeks||{}).map(Number).sort((a,b)=>a-b);
  let from=1;
  gates.forEach(g=>{ if(g<w) from=g+1; });
  return {from,to:w,weeks:WPW.filter(x=>x.w>=from&&x.w<=w)};
}
function gateAIKeyword(w){
  const wk=wkAt(w)||{}, range=gateWeekRange(w);
  const title=(WP.gateWeeks||{})[String(w)]||'阶段达标测试';
  const stages=[...new Set(range.weeks.map(x=>x.stage))].join(' / ');
  const mains=range.weeks.map(x=>`第${x.w}周：${x.main||''}`).filter(s=>s.indexOf('：')<s.length-1);
  const vids=[]; range.weeks.forEach(x=>(x.videos||[]).filter(v=>!v.opt).forEach(v=>{ if(vids.indexOf(v.t)<0) vids.push(v.t); }));
  const calcs=[]; range.weeks.forEach(x=>(x.calc||[]).forEach(c=>{ const n=calcName(c.tag); if(calcs.indexOf(n)<0) calcs.push(n); }));
  const topics=[]; range.weeks.forEach(x=>(x.review||[]).forEach(t=>{ const n=String(t).replace(/（[^）]*）$/,''); if(topics.indexOf(n)<0) topics.push(n); }));
  const kp=[]; topics.forEach(t=>{ const pts=D.keyPoints[t]; if(pts) pts.forEach(p=>{ if(kp.indexOf(p)<0) kp.push(p); }); });
  let s=`【小学数学达标测试·出题任务】\n`;
  s+=`请按下面列出的全部内容，出一套达标测试卷，检验孩子是否真正学懂（阶段：${stages}；关卡：${title}）。\n\n`;
  s+=`一、考查范围（逐周主线）：\n${mains.map((m,i)=>`${i+1}. ${m}`).join('\n')}\n\n`;
  if(vids.length) s+=`二、对应培优A讲次（按其知识点命题，不超纲）：\n${vids.map(v=>'· '+v).join('\n')}\n\n`;
  if(calcs.length) s+=`三、计算类型（必考，给出梯度）：\n${calcs.map(c=>'· '+c).join('、')}\n\n`;
  if(topics.length) s+=`四、应用题专题（覆盖每个）：\n${topics.map(t=>'· '+t).join('、')}\n`;
  if(kp.length) s+=`　每个专题要考查的要点：\n${kp.slice(0,20).map(p=>'　- '+p).join('\n')}\n\n`;
  s+=`五、试卷要求：\n`;
  s+=`· 共 10 题：6 道计算（口算+笔算混合，含 2 道本周新学类型）+ 4 道应用题（每个专题至少 1 道）。\n`;
  s+=`· 难度按课标内为主，可含 1–2 道本阶段易错/变式题，不要超纲到下一阶段。\n`;
  s+=`· 每题附答案与简要过程；应用题先给题目，答案单独放最后。\n`;
  s+=`· 我会把孩子的作答结果告诉你，请帮我按题号统计正确率并指出薄弱知识点。`;
  return s;
}
function weekOpenGate(){
  const ws=weekState(), w=wkViewWeek(), wk=wkAt(w)||{}, g=ws.gate[`W${pad2(w)}`];
  const kw=gateAIKeyword(w);
  openSheet(`第 ${w} 周 · 阶段达标测试`, `
    <div class="card"><h3>${esc((WP.gateWeeks||{})[String(w)]||'阶段达标测试')}</h3>
      <p class="hint">孩子学完这一整阶段的视频、要进入下一专题前做一次达标。工作台<b>不直接出题</b>：把下面这段关键词复制发给 AI，让 AI 出题打印给孩子线下做；做完把达标率填回来，≥80% 才放行进入下一专题。</p>
      <div class="btn-row"><button class="btn" data-action="week-gate-copy">📋 复制 AI 出题关键词</button></div>
      <textarea id="wgKey" rows="12" style="font-size:12px" readonly>${esc(kw)}</textarea>
      <p class="hint">关键词已覆盖第 ${gateWeekRange(w).from}–${w} 周的全部主线、视频讲次、计算类型和回炉专题。</p>
      <label class="lbl">孩子做完后的达标率（做对题数 ÷ 总题数）</label>
      <div class="gate-rate"><input type="number" id="wgRight" min="0" placeholder="做对" ><span>/</span><input type="number" id="wgTotal" min="1" placeholder="总题数" value="10"><span class="gr-pct" id="wgPct">—</span></div>
      <div class="btn-row"><button class="btn" data-action="week-gate-save">✓ 保存达标率</button></div>
      ${g?`<p class="hint">最近一次：${g.rate}% · ${g.passed?'✅ 通过':'未过'} · ${esc(g.at)}</p>`:''}
      <p class="hint">达到 80% 会自动放行到序列下一项；没过就把错的题补进错题本，过几天再测一次。</p>
    </div>`);
  const calc=()=>{ const r=parseInt($('#wgRight').value,10), t=parseInt($('#wgTotal').value,10);
    const el=$('#wgPct'); if(el) el.textContent=(r>=0&&t>0)?Math.round(r/t*100)+'%':'—'; };
  ['wgRight','wgTotal'].forEach(id=>{ const el=$('#'+id); if(el) el.addEventListener('input',calc); });
}
function calcGateRate(){ const r=parseInt($('#wgRight')&&$('#wgRight').value,10), t=parseInt($('#wgTotal')&&$('#wgTotal').value,10);
  return (r>=0&&t>0)?Math.round(r/t*100):null; }
function weekGateSave(){
  const ws=weekState(), w=wkViewWeek(), rate=calcGateRate();
  if(rate===null){ toast('请填做对题数和总题数'); return; }
  const passed=rate>=80, k='W'+pad2(w);
  ws.gate[k]={rate,passed,at:activeDate(),byParent:true,ai:true};
  /* 没填错题就不自动建错题条目（线下题，家长自己决定要不要传） */
  if(passed) ws.done[k+'/gate']=activeDate(); else delete ws.done[k+'/gate'];
  save(); closeSheet(); renderAll();
  toast(passed?`✅ 达标 ${rate}%，已放行到下一项`:`${rate}% 未达 80%，把错题传进错题本，过几天再测`);
}
async function weekGateCopy(){
  const ta=$('#wgKey'); if(!ta) return;
  try{ await navigator.clipboard.writeText(ta.value); toast('✓ 关键词已复制，去发给 AI 出题'); }
  catch(e){ ta.select(); try{ document.execCommand('copy'); toast('✓ 已复制'); }catch(_){ toast('请长按文本框手动复制'); } }
}

/* ---------------- 强制清缓存（版本号卡住时用，不动用户数据） ---------------- */
async function clearCacheAndReload(){
  try{
    if('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations){
      const regs=await navigator.serviceWorker.getRegistrations();
      for(const r of regs){ try{ await r.unregister(); }catch(e){} }
    }
  }catch(e){}
  try{
    if(window.caches && caches.keys){
      const ks=await caches.keys();
      for(const k of ks){ try{ await caches.delete(k); }catch(e){} }
    }
  }catch(e){}
  /* localStorage（进度/错题/照片索引）一律不动 */
  const base=String(location.href||'').split('?')[0].split('#')[0];
  location.href=base+'?_bust='+Date.now();
}

/* ---------------- 启动 ---------------- */
if('serviceWorker' in navigator && /^https?:/.test(location.protocol)){
  navigator.serviceWorker.register('sw.js').then(reg=>{ if(reg&&reg.update) reg.update().catch(()=>{}); }).catch(()=>{});
}
boot();
})();
