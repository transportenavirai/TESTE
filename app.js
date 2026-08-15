// =============================================================================
// GMS · APP UNIFICADO
// Une o REGISTRO GERAL e a ESCALA/VIAGENS em um modelo interno único.
// =============================================================================

let REGISTRO = [], ESCALA_ROWS = [], VIAGENS = [], STATS_ROWS = [];
let selMes = new Set(), selSem = new Set(), selMot = new Set(), selVei = new Set(), selDest = new Set();
let MCORE = {}, retryCount = 0, fetchTimer = null, nextAt = null, firstLoad = true;
let logRowsCache = [];

const MES_N = ["","JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const DIAS_S = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DIAS_F = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

function esc(s){return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;");}
function norm(s){return String(s ?? "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();}
function initials(n){const p=String(n||"").trim().split(/\s+/);return p.length>1?p[0][0]+p[1][0]:String(n||"").slice(0,2);}
function parseCSV(text){
  const rows=[]; let row=[], cell="", q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(q && text[i+1]==='"'){cell+='"';i++;} else q=!q;
    } else if(c===',' && !q){row.push(cell.trim());cell="";}
    else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());cell="";if(row.some(v=>v!==""))rows.push(row);row=[];}
    else cell+=c;
  }
  row.push(cell.trim()); if(row.some(v=>v!=="")) rows.push(row); return rows;
}
function normalizeDate(v){
  let s=String(v||"").trim(); if(!s)return "";
  const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/); if(!m)return "";
  return `${m[1].padStart(2,"0")}/${m[2].padStart(2,"0")}/${m[3].length===2?"20"+m[3]:m[3]}`;
}
function dateKey(v){const d=normalizeDate(v).split("/");return d.length===3?`${d[2]}-${d[1]}-${d[0]}`:"";}
function keyDateToBr(k){if(!k)return "";const p=k.split("-");return `${p[2]}/${p[1]}/${p[0]}`;}
function monthOf(dt){const p=normalizeDate(dt).split("/");return p.length===3?MES_N[Number(p[1])]||"?":"?";}
function weekOf(dt){const p=normalizeDate(dt).split("/");if(p.length!==3)return "?";return "Sem "+Math.min(5,Math.floor((Number(p[0])-1)/7)+1);}
function daysAgoKey(n){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function todayRef(){const d=new Date(); if(d.getHours()<6)d.setDate(d.getDate()-1);d.setHours(0,0,0,0);return d;}
function dk(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function fmtDia(dt){const n=normalizeDate(dt),p=n.split("/");return p.length===3?`${p[0]}/${p[1]}`:"--";}
function parseNum(v){const n=Number(String(v??"").replace(",","."));return Number.isFinite(n)?n:0;}
function destIs(dest,set){const d=norm(dest);for(const x of set){if(d.includes(norm(x)))return true;}return false;}
function sourceTypeLabel(s){return s==="registro"?"REGISTRO GERAL":"ESCALA";}

function parseConfig(){
  const [d0,m0,y0]=CONFIG.INICIO.split("/").map(Number), [d1,m1,y1]=CONFIG.FIM.split("/").map(Number);
  return CONFIG.MOTORISTAS.map(m=>{
    const map={};
    const add=(d,posto)=>{if(!Number.isFinite(d)||d<1||d>31)return;const month=d>=d0?m0:m1,year=d>=d0?y0:y1;map[`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`]=posto.toUpperCase();};
    String(m.ESCALA||"").split(/\s+/).forEach(e=>{if(!e.includes(":"))return;const i=e.lastIndexOf(":"), ds=e.slice(0,i), p=e.slice(i+1);if(ds.includes("-")){const [a,b]=ds.split("-").map(Number);for(let d=a;d<=b;d++)add(d,p);}else add(Number(ds),p);});
    return {nome:m.NOME.toUpperCase(),fone:m.FONE,placa:m.PLACA.toUpperCase(),escalaMap:map};
  });
}
const MOTS=parseConfig();
const ESC_INICIO=new Date(CONFIG.INICIO.split("/").reverse().join("-"));
const ESC_FIM=new Date(CONFIG.FIM.split("/").reverse().join("-"));
MOTS.forEach((m,i)=>MCORE[m.nome]=COLORS[i%COLORS.length]);

function normalizeRegistro(rows){
  const out=[];
  rows.forEach((p,i)=>{
    if(i===0 && norm(p[0]).includes("PLACA"))return;
    const placa=String(p[0]||"").trim().toUpperCase(), motorista=String(p[1]||"").trim().toUpperCase(), destino=String(p[2]||"").trim().toUpperCase();
    const hora=String(p[3]||"").trim(), dt=normalizeDate(p[4]); const obs=String(p[5]||"").trim();
    if(!motorista||!destino||!dt||motorista==="MOTORISTA"||destino==="DESTINO")return;
    out.push({source:"registro",placa,veiculo:placa,m: motorista,d:destino,hora,saida:hora,pac:0,obs,dt,mes:monthOf(dt),wk:weekOf(dt),ok:"OK"});
  });
  return out;
}
function normalizeEscala(rows){
  const out=[];
  rows.forEach((p,i)=>{
    if(i===0 && norm(p[0]).includes("VEICULO"))return;
    const veiculo=String(p[0]||"").trim().toUpperCase(), m=String(p[1]||"").trim().toUpperCase(), d=String(p[2]||"").trim().toUpperCase();
    const saida=String(p[3]||"").trim(), pac=String(p[4]||"").trim(), obs=String(p[5]||"").trim();
    const dt=normalizeDate(p[6]), ok=String(p[7]||"").trim().toUpperCase(), mes=String(p[8]||"").trim().toUpperCase();
    if(!m||!d||!dt||m==="MOTORISTA"||d==="DESTINO"||m.startsWith("-")||d.startsWith("-"))return;
    if(veiculo==="VEICULO"||veiculo==="VEICULOS / MOTORISTAS")return;
    const placa=extractPlate(veiculo);
    out.push({source:"escala",placa,veiculo,m,d,hora:saida,saida,pac,obs,dt,mes:mes||monthOf(dt),wk:weekOf(dt),ok});
  });
  return out;
}
function extractPlate(v){const m=String(v||"").match(/\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/i);return m?m[0].toUpperCase():String(v||"").split(" - ")[0].trim().toUpperCase();}
function dedupeRows(rows){
  const map=new Map();
  rows.forEach(r=>{
    const key=[dateKey(r.dt),norm(r.m),norm(r.d),norm(r.hora||r.saida),norm(r.placa||r.veiculo)].join("|");
    const prev=map.get(key);
    if(!prev)map.set(key,r);
    else if(prev.source==="registro" && r.source==="escala") map.set(key,{...prev,...r,source:"unificado",placa:r.placa||prev.placa,veiculo:r.veiculo||prev.veiculo,pac:r.pac||prev.pac,obs:r.obs||prev.obs});
  });
  return [...map.values()].sort((a,b)=>dateKey(b.dt).localeCompare(dateKey(a.dt))||(a.hora||"").localeCompare(b.hora||""));
}
function isStatRow(r){return !destIs(r.d,SKIP);}
function isKpiRow(r){return !destIs(r.d,SKIP_KPI);}
function buildModels(registroRows,escalaRows){
  REGISTRO=normalizeRegistro(registroRows); ESCALA_ROWS=normalizeEscala(escalaRows);
  VIAGENS=dedupeRows([...REGISTRO,...ESCALA_ROWS]);
  STATS_ROWS=VIAGENS.filter(isStatRow);
  [...new Set(VIAGENS.map(r=>r.m))].sort().forEach((m,i)=>{if(!MCORE[m])MCORE[m]=COLORS[i%COLORS.length];});
}

function showLoadingDone(){if(firstLoad){document.getElementById("loadingScreen").style.display="none";document.getElementById("mainContent").classList.remove("hidden");firstLoad=false;}}
function showError(msg){if(firstLoad){document.getElementById("loadingScreen").style.display="none";document.getElementById("errorScreen").style.display="flex";}document.getElementById("errorMsg").textContent=msg;}
function banner(html){const b=document.getElementById("banner");b.style.display="flex";b.innerHTML=html;}

async function fetchSource(url){const res=await fetch(url+(url.includes("?")?"&":"?")+"cb="+Date.now(),{cache:"no-store"});if(!res.ok)throw new Error("HTTP "+res.status);return parseCSV(await res.text());}
async function fetchAll(){
  banner('<span style="color:var(--p1)">⏳ Atualizando...</span> · Buscando Registro Geral e Escala/Viagens...');
  try{
    const [a,b]=await Promise.allSettled([fetchSource(SOURCES.REGISTRO_GERAL),fetchSource(SOURCES.ESCALA_VIAGENS)]);
    if(a.status!=="fulfilled"&&b.status!=="fulfilled")throw new Error("As duas fontes falharam. Verifique se os dois CSVs estão publicados.");
    buildModels(a.status==="fulfilled"?a.value:[],b.status==="fulfilled"?b.value:[]);
    retryCount=0;showLoadingDone();renderAll();
    const status=[];if(a.status==="fulfilled")status.push(`Registro: ${REGISTRO.length}`);else status.push("Registro: erro");if(b.status==="fulfilled")status.push(`Escala: ${ESCALA_ROWS.length}`);else status.push("Escala: erro");
    banner(`<span style="color:var(--p1)">🟢 Atualizado às ${new Date().toLocaleTimeString("pt-BR")}</span> · ${status.join(" · ")} · Base unificada: ${VIAGENS.length}`);
    document.getElementById("statusTag").innerHTML='<span class="live-dot"></span>AO VIVO';
    nextAt=Date.now()+REFRESH_MS;scheduleFetch(REFRESH_MS);
  }catch(err){
    retryCount++;showError(err.message);banner(`<span style="color:var(--red)">⚠️ ${esc(err.message)}</span>`);scheduleFetch(retryCount<=MAX_RETRY?RETRY_MS:60000);
  }
}
function scheduleFetch(ms){if(fetchTimer)clearTimeout(fetchTimer);nextAt=Date.now()+Math.max(0,ms);fetchTimer=setTimeout(fetchAll,Math.max(0,ms));}

function switchTab(tab){document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));document.getElementById("panel"+tab[0].toUpperCase()+tab.slice(1)).classList.add("active");}
function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
function colorFor(name){return MCORE[name]||COLORS[0];}
function initialsHtml(name){const c=colorFor(name);return `<div class="av" style="background:${c}18;color:${c};border:1.5px solid ${c}50">${esc(initials(name))}</div>`;}

function currentScheduleKey(){return dk(todayRef());}
function renderRule(id){const el=document.getElementById(id),h=new Date().getHours();if(h>=19){el.style.cssText="background:#fff0f2;border:1px solid #f0aab5;color:var(--red)";el.textContent=`🚫 São ${h}h — NENHUM acionamento`;}else if(h>=14){el.style.cssText="background:#fdf5e0;border:1px solid #e8c96a;color:var(--p2)";el.textContent=`⚠️ São ${h}h — só viagens <${CONFIG.REGRAS.LIMITE_KM_APOS_14}km`;}else{el.style.cssText="background:#e6f9f2;border:1px solid #9adfc5;color:var(--p1)";el.textContent=`✅ São ${h}h — livre para acionar`;}}
function scheduleLists(key){const groups={P1:[],P2:[],P3:[],OFF:[]};MOTS.forEach(m=>{const v=m.escalaMap[key]||"";if(groups[v])groups[v].push(m);else if(v==="FERIAS"||v==="RECESSO")groups.OFF.push({...m,status:v});});return groups;}
function miniPlantao(){const g=scheduleLists(currentScheduleKey());return ["P1","P2","P3"].map(p=>{const m=g[p][0];return `<div class="mini-card" style="border-color:${p==="P1"?"var(--p1)":p==="P2"?"var(--p2)":"var(--p3)"}"><div style="font-size:10px;color:var(--muted)">${p}</div>${m?initialsHtml(m.nome)+` <b style="color:${colorFor(m.nome)}">${esc(m.nome)}</b><div style="font-size:10px;color:var(--muted);margin-top:3px">🚐 ${esc(m.placa)}</div>`:`<b style="color:var(--muted)">— sem escala —</b>`}</div>`;}).join("");}
function plantaoCards(){const g=scheduleLists(currentScheduleKey());function card(p,desc,cls){if(!g[p].length)return `<div class="pc ${cls}" style="opacity:.55"><div class="pc-badge">${p}</div><div class="pc-nome">—</div><div class="pc-desc">Sem escala</div></div>`;return g[p].map(m=>`<div class="pc ${cls}"><div class="pc-badge">${p}</div><div style="display:flex;gap:10px;align-items:center">${initialsHtml(m.nome)}<div class="pc-nome">${esc(m.nome)}</div></div><div class="pc-desc">${desc}</div><div class="pc-fone">📱 ${esc(m.fone||"—")}</div><span class="pc-placa">🚐 ${esc(m.placa||"—")}</span></div>`).join("");}
}
const P_DESC={P1:"🏥 Plantão hospitalar — atende chamadas internas",P2:"🚐 2ª opção para viagens externas",P3:"🚑 1ª opção para viagem"};
function renderPlantao(){
  const now=new Date(),ref=todayRef(),key=dk(ref);setText("dateHoje",`${DIAS_F[ref.getDay()]}, ${String(ref.getDate()).padStart(2,"0")}/${String(ref.getMonth()+1).padStart(2,"0")}/${ref.getFullYear()}`);setText("dateSub",`${CONFIG.MES_LABEL} · ${MOTS.length} motoristas`);setText("tsLbl",`Atualizado ${now.toLocaleTimeString("pt-BR")}`);renderRule("regraHora");
  const alert=document.getElementById("alertaPeriodo");if(ref<ESC_INICIO||ref>ESC_FIM){alert.style.display="flex";alert.textContent=`⚠️ Hoje está fora do ciclo configurado (${CONFIG.INICIO} – ${CONFIG.FIM}). Atualize o CONFIG no GitHub.`;}else alert.style.display="none";
  document.getElementById("plantaoGrid").innerHTML=plantaoCards("P1",P_DESC.P1,"pc-p1")+plantaoCards("P2",P_DESC.P2,"pc-p2")+plantaoCards("P3",P_DESC.P3,"pc-p3");
  const rows=[];for(let i=0;i<=7;i++){const d=new Date(ref);d.setDate(ref.getDate()+i);if(d<ESC_INICIO||d>ESC_FIM)continue;const g=scheduleLists(dk(d));const chips=(arr,cl)=>arr.length?arr.map(m=>`<span class="${cl}">${esc(m.nome)}</span>`).join(" "):"—";const off=g.OFF.map(m=>`${m.nome} (${m.status==="RECESSO"?"Rec":"Fér"})`);rows.push(`<tr><td><b>${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}</b>${i===0?' <span style="color:var(--p1)">● HOJE</span>':''}</td><td>${DIAS_S[d.getDay()]}</td><td>${chips(g.P1,"chip-p1")}</td><td>${chips(g.P2,"chip-p2")}</td><td>${chips(g.P3,"chip-p3")}</td><td>${off.length?off.map(x=>`<span class="chip-off">🏖️ ${esc(x)}</span>`).join(" "):"—"}</td></tr>`);}document.getElementById("proxTbody").innerHTML=rows.join("")||'<tr><td colspan="6" class="empty">Sem dados no ciclo.</td></tr>';
}
function renderEscala(){
  const dias=[];for(let d=new Date(ESC_INICIO);d<=ESC_FIM;d.setDate(d.getDate()+1))dias.push({date:new Date(d),key:dk(d),d:d.getDate(),ds:DIAS_S[d.getDay()]});const hoje=dk(new Date());
  let left='<table class="esc-table"><thead><tr><th class="mc">Motorista</th></tr></thead><tbody>';MOTS.forEach(m=>left+=`<tr><td class="mc" style="color:${colorFor(m.nome)}" title="${esc(m.fone)} · ${esc(m.placa)}">${esc(m.nome)}</td></tr>`);left+='</tbody></table>';
  let right='<table class="esc-table"><thead><tr>';dias.forEach(x=>right+=`<th class="${x.key===hoje?'eh':''}">${x.d}<br><small>${x.ds}</small></th>`);right+='</tr></thead><tbody>';MOTS.forEach(m=>{right+='<tr>';dias.forEach(x=>{const v=m.escalaMap[x.key]||"";let b="";if(v==="P1")b='<span class="ep1">P1</span>';else if(v==="P2")b='<span class="ep2">P2</span>';else if(v==="P3")b='<span class="ep3">P3</span>';else if(v==="FERIAS")b='<span class="efe">FER</span>';else if(v==="RECESSO")b='<span class="ere">REC</span>';right+=`<td style="${x.key===hoje?'background:#f0faf6':''}">${b}</td>`;});right+='</tr>';});right+='</tbody></table>';document.getElementById("escalaNomes").innerHTML=left;document.getElementById("escalaDias").innerHTML=right;setText("escalaSub",`${CONFIG.MES_LABEL} · ${dias.length} dias`);
}

function rowsToday(){const key=dk(todayRef());return VIAGENS.filter(r=>dateKey(r.dt)===key).sort((a,b)=>(a.hora||a.saida||"99:99").localeCompare(b.hora||b.saida||"99:99"));}
function futureRows(){const key=dk(todayRef());return VIAGENS.filter(r=>dateKey(r.dt)>key).sort((a,b)=>dateKey(a.dt).localeCompare(dateKey(b.dt))||(a.hora||a.saida||"99:99").localeCompare(b.hora||b.saida||"99:99"));}
function rowHtml(r,showDate=false){const c=colorFor(r.m);return `<tr><td>${showDate?`<span class="fut-date">${esc(r.dt)}</span>`:esc(r.dt)}</td><td><div style="display:flex;align-items:center;gap:7px">${initialsHtml(r.m)}<b style="color:${c}">${esc(r.m)}</b></div></td><td><span class="placa-badge">${esc(r.veiculo||r.placa||"—")}</span></td><td><span class="dest-badge">📍 ${esc(r.d)}</span></td><td><span class="hora-badge">${esc(r.hora||r.saida||"—")}</span></td><td><span class="pac-badge">${parseNum(r.pac)||"—"}</span></td><td><span class="obs-txt">${esc(r.obs||"")}</span></td></tr>`;}
function renderViagens(){
  const ref=todayRef(),hk=dk(ref),od=new Date(ref);od.setDate(ref.getDate()-1);const ok=dk(od), hoje=VIAGENS.filter(r=>dateKey(r.dt)===hk),ont=VIAGENS.filter(r=>dateKey(r.dt)===ok),fut=futureRows();
  setText("vkHoje",hoje.length||"--");setText("vkOntem",ont.length||"--");setText("vkMots",new Set(hoje.map(r=>r.m)).size||"--");setText("vkPac",hoje.reduce((s,r)=>s+parseNum(r.pac),0)||"--");setText("vkFuturas",fut.length||"--");setText("vkHojeData",keyDateToBr(hk));setText("vkOntemData",keyDateToBr(ok));setText("vSubtitle",`${hoje.length} hoje · ${ont.length} ontem`);setText("vFuturasSub",`${fut.length} viagem(ns) · ${new Set(fut.map(r=>dateKey(r.dt))).size} dia(s)`);
  const q=norm(document.getElementById("viagensSearch").value);const all=hoje.map(r=>({...r,_hoje:true})).concat(ont.map(r=>({...r,_hoje:false})));const filtered=q?all.filter(r=>[r.m,r.d,r.veiculo,r.placa,r.dt].some(x=>norm(x).includes(q))):all;document.getElementById("viagensTbody").innerHTML=filtered.length?filtered.map(r=>`<tr class="${r._hoje?'row-hoje':'row-ontem'}"><td>${r._hoje?'<b style="color:var(--p1)">● HOJE</b>':'<b style="color:var(--p2)">ONTEM</b>'}<br><small>${fmtDia(r.dt)}</small></td>${rowHtml(r).replace(/^<tr>|<\/tr>$/g,"")}</tr>`).join(""):'<tr><td colspan="7" class="empty">Nenhum registro.</td></tr>';
  document.getElementById("cardFuturas").style.display=fut.length?"block":"none";let html="",last="";fut.forEach(r=>{const k=dateKey(r.dt);if(k!==last){last=k;html+=`<tr><td colspan="7" class="fut-date">${esc(r.dt)} · ${DIAS_S[new Date(k+"T00:00:00").getDay()]}</td></tr>`;}html+=rowHtml(r,true);});document.getElementById("futurasTbody").innerHTML=html;
}
function renderOverview(){
  const ref=todayRef(),today=rowsToday(),fut=futureRows();setText("vgData",`${DIAS_F[ref.getDay()]}, ${String(ref.getDate()).padStart(2,"0")}/${String(ref.getMonth()+1).padStart(2,"0")}/${ref.getFullYear()}`);setText("vgSub",`${CONFIG.MES_LABEL} · base unificada em tempo real`);setText("vgViagens",today.length||"--");setText("vgPac",today.reduce((s,r)=>s+parseNum(r.pac),0)||"--");setText("vgMot",new Set(today.map(r=>r.m)).size||"--");setText("vgFut",fut.length||"--");setText("vgHist",STATS_ROWS.length||"--");setText("vgDest",new Set(STATS_ROWS.map(r=>r.d)).size||"--");renderRule("vgRegraHora");
  document.getElementById("vgTbody").innerHTML=today.length?today.map(r=>`<tr><td><span class="hora-badge">${esc(r.hora||r.saida||"—")}</span></td><td>${initialsHtml(r.m)} <b style="color:${colorFor(r.m)}">${esc(r.m)}</b></td><td><span class="placa-badge">${esc(r.veiculo||r.placa||"—")}</span></td><td><span class="dest-badge">📍 ${esc(r.d)}</span></td><td><span class="pac-badge">${parseNum(r.pac)||"—"}</span></td><td class="obs-txt">${esc(r.obs||"")}</td></tr>`).join(""):'<tr><td colspan="6" class="empty">Nenhuma viagem para hoje.</td></tr>';
  document.getElementById("vgPlantao").innerHTML=miniPlantao();setText("vgViagensSub",`${today.length} registros`);setText("vgFutSub",`${fut.length} agendadas`);document.getElementById("vgFutTbody").innerHTML=fut.slice(0,80).map(r=>rowHtml(r,true)).join("")||'<tr><td colspan="7" class="empty">Sem próximas viagens.</td></tr>';
}

function getFiltered(){return STATS_ROWS.filter(r=>(!selMes.size||selMes.has(r.mes))&&(!selSem.size||selSem.has(r.wk))&&(!selMot.size||selMot.has(r.m))&&(!selVei.size||selVei.has(r.veiculo||r.placa))&&(!selDest.size||selDest.has(r.d)));}
function resetFilters(){selMes.clear();selSem.clear();selMot.clear();selVei.clear();selDest.clear();buildFilters();renderStats();}
function makeChips(id,items,set,cls){const el=document.getElementById(id);el.innerHTML="";items.forEach(v=>{const b=document.createElement("button");b.className="chip"+(set.has(v)?` ${cls}`:"");b.textContent=v;b.onclick=()=>{set.has(v)?set.delete(v):set.add(v);buildFilters();renderStats();};el.appendChild(b);});}
function buildFilters(){makeChips("fMes",[...new Set(STATS_ROWS.map(r=>r.mes))].filter(Boolean).sort(),selMes,"on");makeChips("fSem",[...new Set(STATS_ROWS.map(r=>r.wk))].filter(Boolean).sort(),selSem,"on");makeChips("fMot",[...new Set(STATS_ROWS.map(r=>r.m))].sort(),selMot,"on");makeChips("fVei",[...new Set(STATS_ROWS.map(r=>r.veiculo||r.placa))].filter(Boolean).sort(),selVei,"on");makeChips("fDest",[...new Set(STATS_ROWS.map(r=>r.d))].sort(),selDest,"ob");}
function equityScore(list){if(!list.length)return null;const vals=list.map(x=>x.trips),avg=vals.reduce((a,b)=>a+b,0)/vals.length;if(avg===0)return 100;const meanAbs=vals.reduce((s,v)=>s+Math.abs(v-avg),0)/vals.length;return Math.max(0,Math.min(100,Math.round(100-(meanAbs/avg*100))));}
function renderStats(){
  const rows=getFiltered(),byM={};rows.forEach(r=>{const k=r.m;byM[k]??={name:k,trips:0,dests:{},veic:{}};byM[k].trips++;byM[k].dests[r.d]=(byM[k].dests[r.d]||0)+1;const v=r.veiculo||r.placa||"—";byM[k].veic[v]=(byM[k].veic[v]||0)+1;});const list=Object.values(byM).sort((a,b)=>b.trips-a.trips||a.name.localeCompare(b.name));list.forEach(x=>{x.topDest=Object.entries(x.dests).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";x.topVei=Object.entries(x.veic).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";x.color=colorFor(x.name);});const tot=rows.length,avg=list.length?tot/list.length:0,max=list[0]?.trips||0,min=list.length?list[list.length-1].trips:0;
  setText("fResult",`${tot} viagens`);setText("kT",tot);setText("kP",[...selMes].join(", ")||"Todos os meses");setText("kA",avg?avg.toFixed(1):"--");setText("kD",new Set(rows.map(r=>r.d)).size);setText("kTop",max||"--");setText("kTopN",list[0]?.name||"--");setText("kV",list.length?max-min:"--");setText("tblSub",`${list.length} motoristas`);setText("donutN",tot);setText("avgLbl",avg?avg.toFixed(1):"--");setText("destSub",`${new Set(rows.map(r=>r.d)).size} destinos`);setText("veiSub",`${new Set(rows.map(r=>r.veiculo||r.placa)).size} veículos`);const eq=equityScore(list);setText("eqScore",eq===null?"--":eq);
  document.getElementById("drvTbody").innerHTML=list.length?list.map((d,i)=>{const df=d.trips-avg;const cls=df>0?"up":"down";return `<tr><td>${i+1}º</td><td><div style="display:flex;gap:7px;align-items:center">${initialsHtml(d.name)}<b>${esc(d.name)}</b></div></td><td><span class="n-big" style="color:${d.color}">${d.trips}</span></td><td><div class="bar-row"><div class="bar-bg"><div class="bar-fill" style="width:${max?(d.trips/max*100):0}%;background:${d.color}"></div></div><span class="bar-pct">${tot?(d.trips/tot*100).toFixed(1):0}%</span></div></td><td>${esc(d.topDest)}</td><td><span class="vb">${esc(d.topVei)}</span></td><td><span style="color:${df>=0?'var(--p1)':'var(--red)'};font-weight:700">${df>=0?'+':''}${df.toFixed(1)}</span></td></tr>`;}).join(""):'<tr><td colspan="7" class="empty">Nenhuma viagem encontrada.</td></tr>';
  renderDonut(list,tot);renderEquity(list,avg);renderHeat(rows,list);renderWeekly(rows);renderDestinations(rows);renderVehicles(rows);logRowsCache=rows.slice().sort((a,b)=>dateKey(b.dt).localeCompare(dateKey(a.dt)));renderLog();
}
function renderDonut(list,tot){const svg=document.getElementById("donutSvg"),cx=70,cy=70,r=54,sw=15,circ=2*Math.PI*r;svg.innerHTML="";const bg=document.createElementNS("http://www.w3.org/2000/svg","circle");Object.entries({cx,cy,r,fill:"none",stroke:"#e8eef4","stroke-width":sw}).forEach(([k,v])=>bg.setAttribute(k,v));svg.appendChild(bg);let off=0;list.forEach(d=>{const p=tot?d.trips/tot:0,c=document.createElementNS("http://www.w3.org/2000/svg","circle");c.setAttribute("cx",cx);c.setAttribute("cy",cy);c.setAttribute("r",r);c.setAttribute("fill","none");c.setAttribute("stroke",d.color);c.setAttribute("stroke-width",sw);c.setAttribute("stroke-dasharray",`${Math.max(0,p*circ-1)} ${circ-Math.max(0,p*circ-1)}`);c.setAttribute("stroke-dashoffset",-off*circ);svg.appendChild(c);off+=p;});document.getElementById("donutLeg").innerHTML=list.slice(0,10).map(d=>`<div class="li"><div class="ll"><i class="ld" style="background:${d.color}"></i>${esc(d.name)}</div><div class="lr"><b style="color:${d.color}">${tot?(d.trips/tot*100).toFixed(1):0}%</b><span class="lt">${d.trips}v</span></div></div>`).join("");}
function renderEquity(list,avg){document.getElementById("eqGrid").innerHTML=list.map(d=>{const delta=d.trips-avg,good=delta>=0;return `<div class="eq-item"><div class="eq-name" style="color:${d.color}">${esc(d.name)}</div><div class="eq-num" style="color:${good?'var(--p1)':'var(--red)'}">${d.trips}</div><div style="font-size:10px;color:var(--muted)">${good?'▲ acima':'▼ abaixo'} ${Math.abs(delta).toFixed(1)} da média</div></div>`;}).join("")||'<div class="empty">Sem dados.</div>';}
function renderHeat(rows,list){const dc={};rows.forEach(r=>dc[r.d]=(dc[r.d]||0)+1);const dests=Object.entries(dc).sort((a,b)=>b[1]-a[1]).slice(0,12).map(x=>x[0]);const max=Math.max(1,...list.flatMap(m=>dests.map(d=>m.dests[d]||0)));let h=`<div class="heat-hdr">${dests.map(d=>`<span title="${esc(d)}">${esc(d)}</span>`).join("")}</div>`;list.forEach(m=>{h+=`<div class="heat-row"><div class="heat-lbl">${esc(m.name.split(" ")[0])}</div>`+dests.map(d=>{const v=m.dests[d]||0;return `<div class="heat-cell" style="${v?`background:${m.color};opacity:${.3+v/max*.7}`:'background:var(--s3)'}" title="${esc(m.name)} → ${esc(d)}: ${v}">${v||""}</div>`;}).join("")+`</div>`;});document.getElementById("heatWrap").innerHTML=h||'<div class="empty">Sem dados.</div>';}
function renderWeekly(rows){const wk={};rows.forEach(r=>wk[r.wk]=(wk[r.wk]||0)+1);const entries=Object.entries(wk).sort((a,b)=>a[0].localeCompare(b[0],"pt-BR",{numeric:true}));const max=Math.max(1,...entries.map(x=>x[1]));document.getElementById("wChart").innerHTML=entries.map(([w,n])=>`<div class="wbar" style="height:${Math.max(8,n/max*150)}px"><span>${n}</span><small>${w.replace("Sem ","S")}</small></div>`).join("")||'<div class="empty">Sem dados.</div>';setText("wLeg",`${entries.length} semana(s) no período filtrado`);}
function renderDestinations(rows){const map={};rows.forEach(r=>{map[r.d]??={n:0,m:new Set()};map[r.d].n++;map[r.d].m.add(r.m);});const arr=Object.entries(map).sort((a,b)=>b[1].n-a[1].n),max=arr[0]?.[1].n||1,total=rows.length;document.getElementById("destTbody").innerHTML=arr.map(([d,x])=>`<tr><td>📍 ${esc(d)}</td><td><b class="n-big" style="color:var(--p2)">${x.n}</b></td><td><div class="bar-row"><div class="bar-bg"><div class="bar-fill" style="width:${x.n/max*100}%;background:var(--p2)"></div></div><span class="bar-pct">${(x.n/total*100).toFixed(1)}%</span></div></td><td>${x.m.size}</td></tr>`).join("")||'<tr><td colspan="4" class="empty">Sem dados.</td></tr>';}
function renderVehicles(rows){const map={};rows.forEach(r=>{const v=r.veiculo||r.placa||"—";map[v]??={n:0,m:new Set()};map[v].n++;map[v].m.add(r.m);});const arr=Object.entries(map).sort((a,b)=>b[1].n-a[1].n),max=arr[0]?.[1].n||1,total=rows.length;document.getElementById("veiTbody").innerHTML=arr.map(([v,x])=>`<tr><td>🚐 ${esc(v)}</td><td><b class="n-big" style="color:var(--p3)">${x.n}</b></td><td><div class="bar-row"><div class="bar-bg"><div class="bar-fill" style="width:${x.n/max*100}%;background:var(--p3)"></div></div><span class="bar-pct">${(x.n/total*100).toFixed(1)}%</span></div></td><td>${x.m.size}</td></tr>`).join("")||'<tr><td colspan="4" class="empty">Sem dados.</td></tr>';}
function renderLog(){const q=norm(document.getElementById("logSearch").value),rows=q?logRowsCache.filter(r=>[r.m,r.d,r.veiculo,r.placa,r.dt,r.obs].some(x=>norm(x).includes(q))):logRowsCache;setText("logSub",`${Math.min(rows.length,500)} de ${rows.length} registros`);document.getElementById("logTbody").innerHTML=rows.slice(0,500).map(r=>`<tr><td>${esc(r.dt)}</td><td style="color:${colorFor(r.m)};font-weight:700">${esc(r.m)}</td><td>${esc(r.d)}</td><td><span class="vb">${esc(r.veiculo||r.placa||"—")}</span></td><td class="hv">${esc(r.hora||r.saida||"—")}</td><td>${parseNum(r.pac)||"—"}</td><td><span class="vb">${sourceTypeLabel(r.source)}</span></td><td class="obs-txt">${esc(r.obs||"")}</td></tr>`).join("")||'<tr><td colspan="8" class="empty">Nenhum registro.</td></tr>';}
function exportCSV(rows,filename){const headers=["Data","Motorista","Destino","Veiculo","Saida/Hora","Pacientes","Origem","Obs"];const csv=[headers,...rows.map(r=>[r.dt,r.m,r.d,r.veiculo||r.placa||"",r.hora||r.saida||"",r.pac||"",sourceTypeLabel(r.source),r.obs||""])].map(a=>a.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);}

function validateSchedule(){
  const alerts=[], map={};
  MOTS.forEach(m=>Object.entries(m.escalaMap).forEach(([k,v])=>{
    map[k] ??= {};
    map[k][v] ??= [];
    map[k][v].push(m.nome);
  }));
  Object.entries(map).forEach(([k,g])=>["P1","P2","P3"].forEach(p=>{
    if((g[p]||[]).length>1) alerts.push({type:"err",msg:`⚠️ Conflito ${p} em ${keyDateToBr(k)}: ${g[p].join(" + ")}`});
  }));
  MOTS.forEach(m=>{
    const fer=Object.entries(m.escalaMap).filter(([,v])=>v==="FERIAS"||v==="RECESSO").map(([k])=>k);
    const trab=Object.entries(m.escalaMap).filter(([,v])=>v!=="FERIAS"&&v!=="RECESSO").map(([k])=>k);
    fer.forEach(k=>{
      if(trab.includes(k)) alerts.push({type:"err",msg:`⚠️ ${m.nome} está indisponível e escalado em ${keyDateToBr(k)}`});
    });
  });
  return alerts;
}

function renderValidation(){const a=validateSchedule();document.getElementById("valBanner").innerHTML=a.length?a.map(x=>`<div class="val-item ${x.type==='err'?'val-err':'val-warn'}">${esc(x.msg)}</div>`).join(""):`<div class="val-item val-ok">✅ Escala válida — nenhum conflito estrutural detectado em ${esc(CONFIG.MES_LABEL)}</div>`;}
function renderAll(){renderValidation();renderPlantao();renderEscala();renderViagens();renderOverview();buildFilters();renderStats();setText("footerUTI",CONFIG.VEICULOS_UTI);setText("footerFone",CONFIG.FONE_TRANSPORTE);}

function init(){
  document.querySelectorAll(".tab-btn").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  document.getElementById("btnRefresh").addEventListener("click",()=>fetchAll());document.getElementById("btnRetryErr").addEventListener("click",()=>fetchAll());document.getElementById("btnResetF").addEventListener("click",resetFilters);document.getElementById("logSearch").addEventListener("input",renderLog);document.getElementById("viagensSearch").addEventListener("input",renderViagens);document.getElementById("btnExportLog").addEventListener("click",()=>exportCSV(logRowsCache,"GMS-viagens-filtradas.csv"));
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){if(fetchTimer)clearTimeout(fetchTimer);}else{scheduleFetch(Math.max(0,(nextAt||Date.now())-Date.now()));}});
  fetchAll();
}
document.addEventListener("DOMContentLoaded",init);
