// SportAgents · web de entrenamientos (modo oscuro)
// Datos de garmin_daily por día: [fecha, FCreposo, HRV, HRVsemanal, estado, puntSueño, horasSueño, BBmax, VO2bici, minVigorosos, VO2carrera]
let A={},E=[],ACT_OK=false,SD={},H={},G=[],W=[],P={},R=[],BASE={low:55,high:74},FTP=225,sb=null,lastSaved=null;
const SPORT={bike:"Bici",run:"Carrera",strength:"Fuerza"};
const DOW=["dom","lun","mar","mié","jue","vie","sáb"];
const DOWL=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MON=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const fmtD=s=>{const d=new Date(s+"T12:00:00");return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`};
const fmtL=s=>{const d=new Date(s+"T12:00:00");return `${DOWL[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`};
const nf=(v,d=1)=>v==null||isNaN(v)?"—":(+v).toLocaleString("es-ES",{minimumFractionDigits:d,maximumFractionDigits:d});
const $=id=>document.getElementById(id);
const ts=s=>new Date(s+"T12:00:00").getTime();
const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const svgI=(p,cls="")=>`<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${p}</svg>`;
const IC={
  check:'<path d="M5 12l5 5L20 7"/>', warn:'<path d="M12 4L21 20H3Z M12 10v4M12 17v.5"/>', down:'<path d="M12 5v14M6 13l6 6 6-6"/>',
  chev:'<path d="M9 6l6 6-6 6"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', swap:'<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  redo:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', close:'<path d="M6 6l12 12M18 6L6 18"/>', play:'<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  video:'<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>',
  bike:'<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17L9 9h6l3.5 8M9 9L7.5 6H5M12 17l3-8"/>',
  run:'<circle cx="14" cy="4.5" r="2"/><path d="M5 21l3.5-6 3 2.5V22M8.5 15l1.5-6 4 2 2.5 3h3.5M10 9l-3.5 1L5 13"/>',
  strength:'<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  zoom:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
};
const triSvg=c=>`<svg class="tri" viewBox="0 0 24 24" role="img" aria-label="por debajo de lo normal"><path d="M12 3L22 20H2Z" fill="var(--${c})"/></svg>`;
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,3500)}

// ---- Selector de día
const todayISO=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Berlin"});
function setupDays(){
  const t=todayISO(), ds=[];
  for(let i=-3;i<=10;i++){const d=new Date(t+"T12:00:00");d.setDate(d.getDate()+i);ds.push(d.toLocaleDateString("sv-SE"))}
  $("daySel").innerHTML=ds.map(d=>`<option value="${d}">${d===t?"Hoy, ":""}${fmtD(d)}</option>`).join("");
  $("daySel").value=t;
  $("daySel").onchange=()=>{renderHoy();renderWeek();setEyebrow();generate()};
}
function planWeek(d){
  const ds=Object.keys(P).sort(); if(!ds.length)return "";
  const m0=new Date(ds[0]+"T12:00:00");m0.setDate(m0.getDate()-((m0.getDay()+6)%7));
  const total=Math.ceil((ts(ds.at(-1))-m0.getTime()+864e5)/(7*864e5));
  const n=Math.floor((ts(d)-m0.getTime())/(7*864e5))+1;
  if(n<1)return `el plan empieza el ${fmtD(ds[0])}`;
  return n>total?"plan terminado":`semana ${n} de ${total}`;
}
function setEyebrow(){
  const v=current, d=$("daySel").value||todayISO();
  $("viewEyebrow").textContent=v==="hoy"?`${fmtL(d)} · ${planWeek(d)}`:v==="progreso"?"Tendencias de Garmin y Withings":v==="fuerza"?`${fmtL(d)} · generador`:"Resumen semanal";
}

// ---- Recuperación: semáforo por métrica
function stHrv(v){if(v==null)return null;if(v>=BASE.low)return "ok";return v>=BASE.low*0.9?"warn":"bad"}
function stRhr(v,avg){if(v==null)return null;if(isNaN(avg)||v<=avg+2)return "ok";return v<=avg+5?"warn":"bad"}
function stSleep(h,sc){if(h==null)return null;if(h<5.5||(sc!=null&&sc<45))return "bad";if(h<6.5||(sc!=null&&sc<60))return "warn";return "ok"}
function stBb(v){if(v==null)return null;return v>=60?"ok":v>=35?"warn":"bad"}
function recovery(){
  const li=G.map(r=>r[2]!=null||r[1]!=null).lastIndexOf(true);
  if(li<0)return {lvl:"ok",txt:"",last:[],li};
  const last=G[li];
  const prev7=G.slice(Math.max(0,li-7),li).map(r=>r[1]).filter(v=>v!=null);
  const rhrAvg=prev7.reduce((a,b)=>a+b,0)/prev7.length;
  const st={hrv:stHrv(last[2]),rhr:stRhr(last[1],rhrAvg),sleep:stSleep(last[6],last[5]),bb:stBb(last[7])};
  const vals=Object.values(st).filter(Boolean), bad=vals.filter(s=>s==="bad").length, warn=vals.filter(s=>s==="warn").length;
  let lvl="ok",txt="Recuperado: entrena según plan";
  if(last[4]==="LOW"||st.hrv==="bad"||bad>=2){lvl="bad";txt="Poco recuperado: valora algo suave"}
  else if(bad||warn){lvl="warn";txt="Recuperación justa: haz la sesión sin pasarte"}
  return {last,li,rhrAvg,st,lvl,txt,inRange:vals.filter(s=>s==="ok").length,n:vals.length};
}
function spark(vals,color){
  const v=vals.filter(x=>x!=null); if(v.length<2)return '<svg class="spark" aria-hidden="true"></svg>';
  const lo=Math.min(...v),hi=Math.max(...v),r=hi-lo||1;
  const pts=vals.map((x,i)=>x==null?null:[2+i*(136/(vals.length-1)),24-((x-lo)/r)*20]);
  let d="",pen=false;pts.forEach(p=>{if(!p){pen=false;return}d+=(pen?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1);pen=true});
  return `<svg class="spark" viewBox="0 0 140 28" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--${color})" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".85" vector-effect="non-scaling-stroke"/></svg>`;
}
function renderRecovery(){
  const el=$("recoveryCard");
  if(!G.length){el.innerHTML='<h2>Recuperación</h2><div class="sub">Sin datos de Garmin todavía</div>';return}
  const r=recovery(), l=r.last, last7=i=>G.slice(Math.max(0,r.li-6),r.li+1).map(x=>x[i]);
  const ic={ok:IC.check,warn:IC.warn,bad:IC.down}[r.lvl];
  const tile=(card,label,val,dec,unit,sub,st,idx)=>{
    const c=st||"muted";
    return `<button class="tile" data-card="${card}" aria-label="${label}: ${nf(val,dec)} ${unit}. Ver gráfico">
      <span class="top"><span class="eyebrow">${label}</span>${svgI(IC.chev)}</span>
      <span class="val"><span class="num ${st?st+"-t":""}">${nf(val,dec)}</span><span class="unit">${unit}</span>${st&&st!=="ok"?triSvg(st):""}</span>
      <span class="sub">${sub}</span>${spark(last7(idx),c==="muted"?"accent":c)}</button>`};
  el.innerHTML=`
    <div class="verdict"><div class="ic" style="background:var(--${r.lvl}-soft);color:var(--${r.lvl})">${svgI(ic)}</div>
      <div style="display:flex;flex-direction:column;gap:4px"><span class="t">${r.txt}</span>
      <span class="sub">${r.inRange} de ${r.n} métricas en tu rango · noche del ${fmtD(l[0])}</span></div></div>
    <div class="tiles">
      ${tile("cardHrv","HRV",l[2],0,"ms",`rango ${BASE.low}–${BASE.high}`,r.st.hrv,2)}
      ${tile("cardRhr","FC reposo",l[1],0,"ppm",`media ${nf(r.rhrAvg,0)}`,r.st.rhr,1)}
      ${tile("cardSleep","Sueño",l[6],1,"h",`${l[5]??"—"} puntos`,r.st.sleep,6)}
      ${tile("cardBb","Body Battery",l[7],0,"","máximo del día",r.st.bb,7)}
    </div>
    <span class="sub" style="font-size:12px">Verde: en tu rango · ámbar: algo por debajo · rojo: muy por debajo. Línea: últimos 7 días. Toca una métrica para ver su gráfico.</span>`;
  el.querySelectorAll(".tile").forEach(b=>b.onclick=()=>goChart(b.dataset.card));
}

// ---- Sesión del día
const SPORT_LABEL={bike_indoor:"rodillo",bike_outdoor:"bici fuera",run:"carrera",strength:"fuerza"};
function flatSteps(steps){const out=[];(steps||[]).forEach(s=>{if(s.type==="repeat")for(let i=0;i<(s.count||1);i++)out.push(...flatSteps(s.steps));else out.push(s)});return out}
function intensity(s){
  const t=s.target||{};
  if(t.kind==="power_pct_ftp"&&t.low!=null)return (t.low+t.high)/200;
  if(t.kind==="power_pct_ftp"&&t.watts_pedals)return (t.watts_pedals[0]+t.watts_pedals[1])/2/FTP;
  if(t.kind==="heart_rate")return ((t.low+t.high)/2)/170;
  return s.type==="interval"?0.7:s.type==="recovery"?0.5:0.4;
}
// Bloques con su contexto (repetición n de N) para el tooltip
function flatCtx(steps,rep){const out=[];(steps||[]).forEach(s=>{if(s.type==="repeat")for(let i=0;i<(s.count||1);i++)out.push(...flatCtx(s.steps,{n:i+1,of:s.count||1}));else out.push({...s,rep})});return out}
const ZONES=[[55,"Z1","Recuperación",[85,95]],[75,"Z2","Resistencia",[85,95]],[90,"Z3","Tempo",[85,95]],[105,"Z4","Umbral",[90,100]],[120,"Z5","VO2 máx",[95,105]],[999,"Z6","Anaeróbico",[100,110]]];
function zoneOf(pct){return ZONES.find(z=>pct<=z[0])}
const cleanNote=n=>String(n||"").replace(/,?\s*sin erg\b/ig,"").trim();
function blockInfo(s,i,n,t0){
  const t=s.target||{}, rows=[];
  const title=(STEP_LABEL[s.type]||(s.type==="interval"?"Bloque":"Paso"))+(s.rep?` · rep. ${s.rep.n} de ${s.rep.of}`:"");
  const dur=s.duration_min?`${s.duration_min}′`:s.distance_km?`${nf(s.distance_km,1)} km`:"";
  rows.push(["Tiempo",`${dur}${s.duration_min?` · min ${Math.round(t0)}–${Math.round(t0+s.duration_min)}`:""}`]);
  let pulse=null;
  if(t.kind==="power_pct_ftp"){
    const w=t.watts_pedals||(t.low!=null?[Math.round(t.low*FTP/100),Math.round(t.high*FTP/100)]:null);
    const pct=t.low!=null?[t.low,t.high]:w?[Math.round(w[0]/FTP*100),Math.round(w[1]/FTP*100)]:null;
    if(w)rows.push(["Vatios",`<b>${w[0]}–${w[1]} W</b>`]);
    if(pct){const z=zoneOf((pct[0]+pct[1])/2);rows.push(["Zona",`${z[1]} ${z[2]} · ${pct[0]}–${pct[1]} % FTP`]);rows.push(["Cadencia",`${z[3][0]}–${z[3][1]} rpm (orientativa)`])}
  }else if(t.kind==="heart_rate"){pulse=`${t.low}–${t.high} ppm`}
  const note=cleanNote(s.note), m=note.match(/pulso\s*([<>]?\s*\d+(?:\s*[–-]\s*\d+)?)/i);
  if(!pulse&&m)pulse=m[1].replace(/\s+/g,"")+" ppm";
  if(pulse)rows.push(["Pulso",pulse]);
  const rest=m?note.replace(m[0],"").replace(/^[;,\s]+|[;,\s]+$/g,""):note;
  if(rest)rows.push(["Nota",esc(rest)]);
  return `<div class="bt-h">${title} <span class="sub">${i+1}/${n}</span></div>`+rows.map(r=>`<div class="bt-r"><span>${r[0]}</span><span>${r[1]}</span></div>`).join("");
}
function ibar(raw){
  const fs=flatCtx(raw), st=fs.map(s=>({min:s.duration_min||(s.distance_km?s.distance_km*6:1),i:intensity(s)}));
  if(st.length<2)return "";
  const tot=st.reduce((a,s)=>a+s.min,0);
  let t0=0;const tips=fs.map((s,i)=>{const h=blockInfo(s,i,fs.length,t0);t0+=st[i].min;return h});
  const id="ib"+(++ibN);IBT[id]=tips;
  return `<div class="ibar" id="${id}" role="img" aria-label="Intensidad de la sesión por bloques, ${Math.round(tot)} minutos. Pasa el ratón o toca un bloque para ver sus datos">${st.map((s,i)=>{const h=Math.max(12,Math.min(100,s.i/1.15*100));const c=s.i>=0.88?"hi":s.i>=0.7?"mid":"lo";return `<div class="${c}" data-b="${i}" style="flex:${s.min};height:${h.toFixed(0)}%"></div>`}).join("")}<div class="btip" hidden></div></div>`;
}
let ibN=0;const IBT={};
function wireIbars(root){
  root.querySelectorAll(".ibar").forEach(bar=>{
    const tip=bar.querySelector(".btip"), tips=IBT[bar.id]; if(!tips)return;
    let cur=null;
    const showB=el=>{
      bar.querySelectorAll("[data-b]").forEach(b=>b.classList.toggle("on",b===el));
      if(!el){tip.hidden=true;cur=null;return}
      cur=el;tip.innerHTML=tips[+el.dataset.b];tip.hidden=false;
      const bw=bar.clientWidth, cx=el.offsetLeft+el.offsetWidth/2, tw=tip.offsetWidth;
      tip.style.left=Math.max(0,Math.min(bw-tw,cx-tw/2))+"px";
    };
    bar.onpointermove=e=>{if(e.pointerType==="mouse"){const el=e.target.closest("[data-b]");if(el&&el!==cur)showB(el)}};
    bar.onpointerleave=e=>{if(e.pointerType==="mouse")showB(null)};
    bar.onclick=e=>{const el=e.target.closest("[data-b]");showB(el&&el!==cur?el:null)};
  });
}
function renderHoy(){
  renderRecovery();
  const d=$("daySel").value, ss=P[d]||[];
  $("sessionsCard").innerHTML=`<div class="row between"><h2>${d===todayISO()?"Entreno de hoy":"Entreno · "+fmtD(d)}</h2>${ss.length>1?`<span class="sub">${ss.reduce((a,s)=>a+s.min,0)} min en total</span>`:""}</div>`+
    (ss.length?ss.map(s=>`
      <div class="ses">
        <div class="ses-head"><div class="sport-ic">${svgI(IC[s.sport]||IC.bike)}</div>
          <div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span class="eyebrow">${[s.h,SPORT_LABEL[s.raw]||SPORT[s.sport],s.key?"clave":""].filter(Boolean).join(" · ")}</span><span class="ses-name">${esc(s.name)}</span></div>
          <span class="ses-min">${s.min}′</span></div>
        ${s.sport!=="strength"?ibar(s.rawSteps):""}
        ${s.sport==="strength"?`<div class="row" style="gap:8px"><span class="sub" style="flex-basis:100%">¿Dónde entrenas?</span><button class="btn" data-go="casa">En casa</button><button class="btn ghost" data-go="gym">En el gimnasio</button></div>`:""}
        ${(s.desc||s.steps.length)?`<details><summary>${s.steps.length?"Ver los pasos":"Ver la descripción"}</summary>${s.desc?`<p class="sub" style="margin:8px 0 0">${esc(s.desc)}</p>`:""}${s.steps.length?`<ol class="steps">${s.steps.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`:""}</details>`:""}
      </div>`).join(""):`<div class="sub">Descanso. Si te apetece, paseo o movilidad suave.</div>`);
  wireIbars($("sessionsCard"));
  $("sessionsCard").querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{state.place=b.dataset.go;state.pick={};syncSeg();generate();show("fuerza")});
  renderWeight();
}
// ---- Peso frente a la línea objetivo (71,4 kg el 1 dic → 67 kg el 28 feb)
const W0=["2026-12-01",71.4],W1=["2027-02-28",67];
const PER_DAY=(W0[1]-W1[1])/((ts(W1[0])-ts(W0[0]))/864e5);
function targetAt(d){const t=ts(d);if(t<=ts(W0[0]))return W0[1];if(t>=ts(W1[0]))return W1[1];return W0[1]-(t-ts(W0[0]))/864e5*PER_DAY}
function avg7(){const t=ts(W.at(-1)[0]);const w=W.filter(x=>ts(x[0])>t-7*864e5).map(x=>x[1]);return w.reduce((a,b)=>a+b,0)/w.length}
function weightGap(){if(!W.length)return null;const a=avg7(),diff=targetAt(W.at(-1)[0])-a;return {a,diff,days:Math.round(Math.abs(diff)/PER_DAY)}}
function trend28(){
  if(!W.length)return null;const t1=ts(W.at(-1)[0]);const p=W.filter(w=>ts(w[0])>t1-28*864e5);
  if(p.length<3||(ts(p.at(-1)[0])-ts(p[0][0]))<10*864e5)return null;
  const xs=p.map(w=>(ts(w[0])-t1)/864e5),ys=p.map(w=>w[1]),mx=xs.reduce((a,b)=>a+b)/xs.length,my=ys.reduce((a,b)=>a+b)/ys.length;
  const k=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0)/xs.reduce((a,x)=>a+(x-mx)**2,0);return k*7;
}
const onLine=g=>Math.abs(g.diff)<0.05;
const gapCls=g=>onLine(g)?"ok":g.diff>0?"ok":"bad";
const gapTxt=g=>onLine(g)?"En la línea":`${nf(Math.abs(g.diff),1)} kg ${g.diff>0?"por delante":"por detrás"}`;
function renderWeight(){
  const el=$("weightCard");
  if(!W.length){el.innerHTML='<h3>Peso</h3><div class="sub">Sin pesadas todavía</div>';return}
  const g=weightGap(), ahead=g.diff>=0, pct=Math.max(0,Math.min(1,(W0[1]-g.a)/(W0[1]-W1[1])));
  el.innerHTML=`<div class="row between" style="align-items:flex-start">
      <div style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow">Peso · media 7 días</span><span><span class="num">${nf(g.a,1)}</span><span class="unit">kg</span></span></div>
      <span class="chip ${gapCls(g)}">${gapTxt(g)}</span></div>
    <div class="bar" role="img" aria-label="Camino hacia 67 kg: ${Math.round(pct*100)} %"><span style="width:${Math.max(2,pct*100)}%"></span></div>
    <div class="row between"><span class="sub">71,4 → 67 kg el 28 feb</span><button class="small-btn quiet" data-card="cardWeight">Ver gráfico ${svgI(IC.chev)}</button></div>`;
  el.querySelector("[data-card]").onclick=()=>goChart("cardWeight");
}
// ---- Aviso de fin de plan
function renderPlanEnd(){
  const el=$("planEndCard"), dates=Object.keys(P).sort();
  if(!dates.length){el.hidden=true;return}
  const last=dates.at(-1), t=todayISO(), days=Math.round((ts(last)-ts(t))/864e5);
  if(days>14){el.hidden=true;return}
  el.hidden=false;
  el.innerHTML=days>=0
    ?`<div class="row between"><h3>El plan termina el ${fmtD(last)}</h3><span class="chip warn">${days===0?"Termina hoy":`Quedan ${days} día${days===1?"":"s"}`}</span></div><div class="sub">Pídele a Claude el siguiente bloque con algo como «revisemos el plan». Analizará cómo te ha ido y lo preparará contigo.</div>`
    :`<div class="row between"><h3>El plan terminó el ${fmtD(last)}</h3><span class="chip bad">Sin plan</span></div><div class="sub">Pídele a Claude el siguiente bloque con algo como «revisemos el plan».</div>`;
}
// ---- Semana (lunes a domingo del día elegido)
const SPORT_OF=a=>/strength|fuerza/i.test(a)?"strength":/run|carrera|trail/i.test(a)?"run":/cycl|bik|ride|bici|virtual/i.test(a)?"bike":a;
// ---- Calendario (tarjeta Semana): semana con flechas, vista de mes y detalle del día
const MONL=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const isoOf=d=>d.toLocaleDateString("sv-SE");
const addD=(iso,n)=>{const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+n);return isoOf(d)};
const mondayOf=iso=>{const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()-((d.getDay()+6)%7));return isoOf(d)};
const cal={mode:"week",start:null,month:null,sel:null,base:null};
// Estado de un día: sesiones del plan (hecha / pendiente / saltada) y actividades extra
function dayInfo(iso){
  const t=todayISO(), ss=P[iso]||[], acts=(A[iso]||[]).map(a=>({...a,s:SPORT_OF(a.sport)}));
  const items=ss.map(s=>{
    let st,mins=0;
    if(s.sport==="strength"&&SD[iso]){st="ok";mins=SD[iso]}
    else{const a=acts.find(a=>a.s===s.sport&&!a.used);if(a){a.used=true;st="ok";mins=a.duration_min||0}}
    if(st!=="ok")st=iso>t?"todo":iso===t?"today":(ACT_OK||s.sport==="strength")?"miss":"unk";
    return {s,st,mins};
  });
  const extra=acts.filter(a=>!a.used);
  if(SD[iso]&&!ss.some(s=>s.sport==="strength"))extra.push({s:"strength",duration_min:SD[iso]});
  return {items,extra};
}
const ST_LAB={ok:"Hecha",todo:"Pendiente",today:"Hoy",miss:"Saltada",unk:"Sin comprobar"};
const ST_CLS={ok:"ok",todo:"plain",today:"neutral",miss:"bad",unk:"warn"};
function dayClass(iso,inf){
  const sts=inf.items.map(i=>i.st);
  if(!sts.length)return inf.extra.length?"ok":iso===todayISO()?"today":"";
  return sts.includes("miss")?"miss":sts.every(s=>s==="ok")?"ok":iso===todayISO()?"today":"";
}
function dayLines(iso,inf){
  const items=inf.items.map(({s,st})=>`<div class="wline"><span>${esc(s.name)} <span class="sub">· ${s.min}′</span></span><span class="chip ${ST_CLS[st]}">${ST_LAB[st]}</span></div>`).join("");
  const extra=inf.extra.map(a=>`<div class="wline"><span class="sub">${inf.items.length?"Extra: ":""}${esc(SPORT[a.s]||a.name||a.sport)} · ${a.duration_min??"?"}′</span><span class="chip ok">Hecha</span></div>`).join("");
  return items+extra;
}
const rangeTxt=(a,b)=>{const x=new Date(a+"T12:00:00"),y=new Date(b+"T12:00:00");return x.getMonth()===y.getMonth()?`${x.getDate()}–${y.getDate()} ${MON[y.getMonth()]}`:`${x.getDate()} ${MON[x.getMonth()]} – ${y.getDate()} ${MON[y.getMonth()]}`};
function renderWeek(){
  const sel=$("daySel").value;
  if(cal.base!==sel){cal.base=sel;cal.start=mondayOf(sel);cal.month=sel.slice(0,7);cal.sel=null}
  const t=todayISO(), el=$("weekCard"), navBtn=(id,lab,dir)=>`<button class="icon-btn sm" id="${id}" aria-label="${lab}">${svgI(IC.chev).replace("<svg",`<svg style="transform:rotate(${dir}deg)"`)}</button>`;
  let body="",title="",sub="";
  if(cal.mode==="week"){
    const d0=cal.start; let plan=0,done=0,nDone=0,nPlan=0,rows="",strip="";
    for(let i=0;i<7;i++){
      const iso=addD(d0,i), inf=dayInfo(iso);
      inf.items.forEach(({s,st,mins})=>{plan+=s.min;nPlan++;if(st==="ok"){done+=mins;nDone++}});
      const dc=dayClass(iso,inf);
      const mark=dc==="ok"?svgI(IC.check).replace("<svg",'<svg role="img" aria-label="hecha"'):dc==="miss"?svgI(IC.close).replace("<svg",'<svg role="img" aria-label="saltada"'):`<span>${iso===t?"hoy":inf.items.length?"·":"—"}</span>`;
      strip+=`<button class="wd ${dc||(iso===t?"today":"")}${cal.sel===iso?" sel":""}" data-d="${iso}" aria-label="${fmtD(iso)}"><span>${"LMXJVSD"[i]} ${new Date(iso+"T12:00:00").getDate()}</span>${mark}</button>`;
      const ln=dayLines(iso,inf); if(ln)rows+=`<div style="padding-top:6px"><div class="eyebrow" style="padding:6px 0 2px">${fmtD(iso)}</div>${ln}</div>`;
    }
    const h=m=>`${Math.floor(m/60)} h ${String(Math.round(m%60)).padStart(2,"0")}`;
    title=rangeTxt(d0,addD(d0,6));
    sub=nPlan?`${nDone} de ${nPlan} hechas · ${h(done)} de ${h(plan)}`:"";
    body=`<div class="week">${strip}</div>`+(cal.sel?"":rows?`<details><summary>Ver las sesiones</summary>${rows}</details>`:'<div class="sub">Sin sesiones planificadas esta semana.</div>');
  } else {
    const [y,m]=cal.month.split("-").map(Number), first=`${cal.month}-01`, g0=mondayOf(first);
    const last=isoOf(new Date(y,m,0,12)), g1=addD(mondayOf(last),6);
    let cells="",nDone=0,nPlan=0;
    for(let iso=g0;iso<=g1;iso=addD(iso,1)){
      const inf=dayInfo(iso), out=iso.slice(0,7)!==cal.month;
      if(!out)inf.items.forEach(i=>{nPlan++;if(i.st==="ok")nDone++});
      const dots=inf.items.map(i=>`<i class="dot ${i.st}"></i>`).join("")+inf.extra.map(()=>'<i class="dot ok"></i>').join("");
      cells+=`<button class="md${out?" out":""}${iso===t?" today":""}${cal.sel===iso?" sel":""}" data-d="${iso}" aria-label="${fmtD(iso)}"><span>${+iso.slice(8)}</span><span class="dots">${dots}</span></button>`;
    }
    title=`${MONL[m-1]} ${y}`;
    sub=nPlan?`${nDone} de ${nPlan} hechas`:"";
    body=`<div class="mgrid">${"LMXJVSD".split("").map(l=>`<span class="mh">${l}</span>`).join("")}${cells}</div>
      <div class="legend"><span><i class="dot ok"></i>Hecha</span><span><i class="dot todo"></i>Pendiente</span><span><i class="dot miss"></i>Saltada</span></div>`;
  }
  let det="";
  if(cal.sel){const inf=dayInfo(cal.sel),ln=dayLines(cal.sel,inf);
    det=`<div class="dayd"><div class="row between"><span class="eyebrow">${fmtD(cal.sel)}</span>${cal.sel!==sel&&[...$("daySel").options].some(o=>o.value===cal.sel)?`<button class="link" id="calGo">Ver este día en Hoy</button>`:""}</div>${ln||'<div class="sub" style="padding-top:6px">Nada planificado ni hecho.</div>'}</div>`}
  const isNow=cal.mode==="week"?cal.start===mondayOf(t):cal.month===t.slice(0,7);
  el.innerHTML=`<div class="row between" style="flex-wrap:nowrap;gap:8px">
      <div style="display:flex;flex-direction:column;gap:2px;min-width:0"><h3>${cal.mode==="week"?"Semana":"Mes"}</h3><span class="sub">${title}${sub?" · "+sub:""}</span></div>
      <div class="seg sm" role="group" aria-label="Vista"><button data-m="week" aria-pressed="${cal.mode==="week"}">Semana</button><button data-m="month" aria-pressed="${cal.mode==="month"}">Mes</button></div></div>
    <div class="row between" style="flex-wrap:nowrap">${navBtn("calPrev",cal.mode==="week"?"Semana anterior":"Mes anterior",180)}
      ${isNow?'<span class="sub">Ahora</span>':'<button class="link" id="calNow">Volver a hoy</button>'}
      ${navBtn("calNext",cal.mode==="week"?"Semana siguiente":"Mes siguiente",0)}</div>
    ${body}${det}
    ${ACT_OK?"":'<div class="sub">Bici y carrera aún no se comprueban: no se han podido leer tus actividades de Garmin.</div>'}`;
  const step=n=>{if(cal.mode==="week")cal.start=addD(cal.start,7*n);else{const d=new Date(cal.month+"-15T12:00:00");d.setMonth(d.getMonth()+n);cal.month=isoOf(d).slice(0,7)}cal.sel=null;renderWeek()};
  $("calPrev").onclick=()=>step(-1);$("calNext").onclick=()=>step(1);
  if($("calNow"))$("calNow").onclick=()=>{cal.start=mondayOf(t);cal.month=t.slice(0,7);cal.sel=null;renderWeek()};
  el.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{cal.mode=b.dataset.m;
    const ref=cal.sel||(cal.mode==="month"?cal.start:sel);cal.month=ref.slice(0,7);if(cal.mode==="week")cal.start=mondayOf(cal.sel||(cal.month===sel.slice(0,7)?sel:cal.month+"-01"));renderWeek()});
  el.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{cal.sel=cal.sel===b.dataset.d?null:b.dataset.d;renderWeek()});
  if($("calGo"))$("calGo").onclick=()=>{const ds=$("daySel");ds.value=cal.sel;ds.onchange();window.scrollTo({top:0,behavior:"smooth"})};
}

// ---- Gráficos SVG con valor al tocar
let clipN=0;
function lineChart(el,opts){
  const {series,band,bands,yMin,yMax,x0,x1,h=200,yTicks,unit="",xTicks,tip,label,xFmt,zoom=true,ml=30}=opts;
  const W_=Math.max(260,Math.round(el.clientWidth||640)),H=Math.round(h*Math.max(0.75,Math.min(1,W_/640))),m={l:ml,r:10,t:12,b:22};
  const X=t=>m.l+(t-x0)/((x1-x0)||1)*(W_-m.l-m.r), Y=v=>m.t+(1-(v-yMin)/(yMax-yMin))*(H-m.t-m.b);
  const cid="clip"+(++clipN);
  let s=`<svg viewBox="0 0 ${W_} ${H}" role="img" aria-label="${esc(label||"")}"><defs><clipPath id="${cid}"><rect x="${m.l}" y="0" width="${W_-m.l-m.r+6}" height="${H-m.b+2}"/></clipPath></defs>`;
  (bands||[]).forEach(b=>{const a=Y(Math.min(yMax,b[1])),z=Y(Math.max(yMin,b[0]));if(z>a)s+=`<rect x="${m.l}" y="${a}" width="${W_-m.l-m.r}" height="${z-a}" fill="${b[2]}"/>`});
  if(band)s+=`<rect x="${m.l}" y="${Y(band[1])}" width="${W_-m.l-m.r}" height="${Math.max(0,Y(band[0])-Y(band[1]))}" fill="var(--band)"/>`;
  yTicks.forEach(v=>{s+=`<line x1="${m.l}" x2="${W_-m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1d2933"/><text x="${m.l-6}" y="${Y(v)+4}" text-anchor="end">${v}</text>`});
  (xTicks||[]).forEach(t=>{s+=`<text x="${X(ts(t))}" y="${H-6}" text-anchor="middle">${xFmt?xFmt(t):MON[new Date(t+"T12:00:00").getMonth()]}</text>`});
  s+=`<g clip-path="url(#${cid})">`;
  series.forEach(se=>{
    let d="",pen=false;
    se.pts.forEach(([t,v])=>{if(v==null){pen=false;return}d+=(pen?"L":"M")+X(ts(t)).toFixed(1)+" "+Y(v).toFixed(1);pen=true});
    s+=`<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.w||2}" ${se.dash?`stroke-dasharray="${se.dash}"`:""} stroke-linejoin="round" stroke-linecap="round" opacity="${se.op||1}"/>`;
    if(se.dots)se.pts.forEach(([t,v])=>{if(v!=null)s+=`<circle cx="${X(ts(t))}" cy="${Y(v)}" r="${se.r||3}" fill="${se.color}"/>`});
    if(se.end){const p=se.pts.filter(p=>p[1]!=null).at(-1);if(p)s+=`<circle cx="${X(ts(p[0]))}" cy="${Y(p[1])}" r="5" fill="${se.color}" stroke="var(--surface)" stroke-width="2"/>`}
  });
  s+=`</g>`;
  s+=`<line class="cursor" x1="0" x2="0" y1="${m.t}" y2="${H-m.b}" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/><circle class="cdot" r="5" fill="var(--fg)" visibility="hidden"/></svg><div class="tip" hidden></div>`;
  el.innerHTML=s;
  if(zoom){el._args=opts;const zb=document.createElement("button");zb.className="zbtn";zb.setAttribute("aria-label","Ampliar: "+(label||"gráfico"));zb.innerHTML=svgI(IC.zoom);zb.onclick=ev=>{ev.stopPropagation();openZoom(el._args)};zb.onpointerdown=ev=>ev.stopPropagation();el.appendChild(zb)}
  if(!tip)return;
  const pts=tip.pts.filter(p=>p[1]!=null&&ts(p[0])>=x0-DAY/2&&ts(p[0])<=x1+DAY/2); if(!pts.length)return;
  const svg=el.querySelector("svg"),tp=el.querySelector(".tip"),cur=svg.querySelector(".cursor"),dot=svg.querySelector(".cdot");
  const move=e=>{
    const r=svg.getBoundingClientRect(), sx=(e.clientX-r.left)/r.width*W_;
    let best=pts[0],bd=1e9;pts.forEach(p=>{const dd=Math.abs(X(ts(p[0]))-sx);if(dd<bd){bd=dd;best=p}});
    const px=X(ts(best[0])),py=Y(best[1]);
    cur.setAttribute("x1",px);cur.setAttribute("x2",px);cur.setAttribute("visibility","visible");
    dot.setAttribute("cx",px);dot.setAttribute("cy",py);dot.setAttribute("visibility","visible");
    tp.hidden=false;tp.innerHTML=`<b>${nf(best[1],tip.dec??0)}${tip.unit||""}</b><br>${fmtD(best[0])}`;
    tp.style.left=Math.min(r.width-50,Math.max(50,px/W_*r.width))+"px";tp.style.top=(py/H*r.height)+"px";
  };
  el.onpointerdown=move;el.onpointermove=e=>{if(e.pointerType==="mouse"||e.buttons)move(e)};
  el.onpointerleave=()=>{tp.hidden=true;cur.setAttribute("visibility","hidden");dot.setAttribute("visibility","hidden")};
}
function ma7(idx){return G.map((r,i)=>{const w=G.slice(Math.max(0,i-6),i+1).map(x=>x[idx]).filter(v=>v!=null);return [r[0],w.length>=3?w.reduce((a,b)=>a+b,0)/w.length:null]})}
function ticks(lo,hi,n=3){const st=(hi-lo)/(n-1);return Array.from({length:n},(_,i)=>Math.round(lo+st*i))}
let range=90;
function renderProgreso(){
  if(!G.length)return;
  const sub=range?G.slice(-range):G, n=sub.length, x0=ts(sub[0][0]), x1=ts(sub.at(-1)[0]);
  const xt=[];{const d=new Date(sub[0][0]+"T12:00:00");d.setDate(1);for(let k=0;k<8;k++){d.setMonth(d.getMonth()+1);const iso=d.toLocaleDateString("sv-SE");if(ts(iso)<=x1)xt.push(iso)}}
  const mm=idx=>ma7(idx).slice(-n);
  const thin="#4d6573";
  const span=(idx,pad)=>{const v=sub.map(r=>r[idx]).filter(x=>x!=null);return v.length?[Math.floor(Math.min(...v)-pad),Math.ceil(Math.max(...v)+pad)]:[0,1]};
  const last=idx=>{const r=[...G].reverse().find(r=>r[idx]!=null);return r?r[idx]:null};
  // HRV
  {const [lo,hi]=span(2,3);const yMin=Math.min(lo,BASE.low-5),yMax=Math.max(hi,BASE.high+5);
   $("hrvNow").innerHTML=`${nf(last(2),0)}<span class="unit">ms</span>`;
   lineChart($("chHrv"),{x0,x1,yMin,yMax,yTicks:[BASE.low,BASE.high],band:[BASE.low,BASE.high],xTicks:xt,label:"HRV nocturna",
    series:[{pts:G.map(r=>[r[0],r[2]]),color:thin,w:1.2},{pts:ma7(2),color:"var(--accent)",w:3,end:true}],tip:{pts:G.map(r=>[r[0],r[2]]),unit:" ms"}});}
  {const [lo,hi]=span(1,2);$("rhrNow").textContent=`${nf(last(1),0)} ppm`;
   lineChart($("chRhr"),{x0,x1,yMin:lo,yMax:hi,yTicks:ticks(lo,hi),h:170,xTicks:xt,label:"FC en reposo",
    series:[{pts:G.map(r=>[r[0],r[1]]),color:thin,w:1.2},{pts:ma7(1),color:"var(--accent)",w:2.6,end:true}],tip:{pts:G.map(r=>[r[0],r[1]]),unit:" ppm"}});}
  {$("sleepNow").textContent=`${nf(last(6),1)} h`;
   lineChart($("chSleep"),{x0,x1,yMin:3,yMax:10,yTicks:[4,7,10],h:170,xTicks:xt,label:"Horas de sueño",
    series:[{pts:G.map(r=>[r[0],r[6]]),color:thin,w:1.2},{pts:ma7(6),color:"var(--accent)",w:2.6,end:true}],tip:{pts:G.map(r=>[r[0],r[6]]),unit:" h",dec:1}});}
  {$("bbNow").textContent=`${nf(last(7),0)}`;
   lineChart($("chBb"),{x0,x1,yMin:0,yMax:100,yTicks:[0,50,100],h:150,xTicks:xt,label:"Body Battery máximo",
    series:[{pts:G.map(r=>[r[0],r[7]]),color:thin,w:1.2},{pts:ma7(7),color:"var(--accent)",w:2.6,end:true}],tip:{pts:G.map(r=>[r[0],r[7]])}});}
  renderWeightChart(x0);
  renderLoad(x0,xt);
  renderEndurance(x0,x1,xt);
  renderVo2(sub,x0,x1,xt);
}
function renderWeightChart(x0p){
  if(!W.length){$("chWeight").innerHTML='<div class="sub">Sin pesadas todavía</div>';$("weightStats").innerHTML="";return}
  const g=weightGap(), ahead=g.diff>=0, tr=trend28();
  $("weightStats").innerHTML=`<div class="stat ${gapCls(g)}"><span class="big">${gapTxt(g)}</span><span class="sub">${g.days?`≈ ${g.days} día${g.days===1?"":"s"} ${ahead?"de ventaja":"de retraso"} sobre la línea`:"justo en la línea"}</span></div>
    <div class="stat"><span class="big">${tr==null?"—":(tr>0?"+":"")+nf(tr,2)}</span><span class="sub">kg/semana (4 sem.)</span></div>
    <div class="stat"><span class="big">${nf(g.a-W1[1],1)}</span><span class="sub">kg hasta 67</span></div>`;
  const first=W.find(w=>ts(w[0])>=x0p)||W.at(-1);
  const x0=Math.min(ts(first[0]),ts(W0[0])), vals=W.filter(w=>ts(w[0])>=x0).map(w=>w[1]);
  const yMax=Math.ceil(Math.max(W0[1],...vals)+0.3), yMin=66.5;
  const xt=[];{const d=new Date(x0);d.setDate(1);for(let k=0;k<6;k++){d.setMonth(d.getMonth()+1);const iso=d.toLocaleDateString("sv-SE");if(ts(iso)<=ts(W1[0]))xt.push(iso)}}
  const pts=W.filter(w=>ts(w[0])>=x0);
  lineChart($("chWeight"),{x0,x1:ts(W1[0]),yMin,yMax,yTicks:ticks(67,yMax-0.5|0,3),xTicks:xt,label:"Peso frente a la línea objetivo",
    series:[{pts:[[new Date(x0).toLocaleDateString("sv-SE"),W0[1]],W0,W1],color:"var(--muted)",w:1.5,dash:"5 5"},{pts,color:"var(--accent)",w:2.4,dots:true,r:2.5,end:true}],tip:{pts,unit:" kg",dec:1}});
}
function renderVo2(sub,x0,x1,xt){
  const bike=sub.filter(r=>r[8]!=null).map(r=>[r[0],r[8]]), run=sub.filter(r=>r[10]!=null).map(r=>[r[0],r[10]]);
  const allB=G.filter(r=>r[8]!=null), lastB=allB.at(-1), lastR=G.filter(r=>r[10]!=null).at(-1);
  $("vo2Now").innerHTML=lastB?`${nf(lastB[8],1)}`:"—";
  const ref=allB.find(r=>ts(r[0])>=ts(lastB?.[0]||todayISO())-30*864e5);
  $("vo2Delta").textContent=lastB&&ref&&ref!==lastB?`${lastB[8]-ref[8]>=0?"+":""}${nf(lastB[8]-ref[8],1)} en ${Math.round((ts(lastB[0])-ts(ref[0]))/864e5)} días`:"";
  $("vo2Sub").textContent=lastB?`${nf(lastB[8],1)} bici${lastR?` · ${nf(lastR[10],1)} carrera`:""}`:"";
  if(!bike.length&&!run.length){$("chVo2").innerHTML=`<div class="sub">Sin datos de VO2 máx en este periodo</div>`;return}
  const vals=[...bike,...run].map(p=>p[1]), lo=Math.floor(Math.min(...vals))-1, hi=Math.ceil(Math.max(...vals))+1;
  lineChart($("chVo2"),{x0,x1,yMin:lo,yMax:hi,yTicks:ticks(lo,hi),h:160,xTicks:xt,label:"VO2 máx",
    series:[{pts:run,color:"var(--muted)",w:1.4,dots:true},{pts:bike,color:"var(--accent)",w:2.4,dots:true,end:bike.length>0}],tip:{pts:bike.length?bike:run,dec:1}});
}
$("rangeSeg").querySelectorAll("button").forEach(b=>b.onclick=()=>{range=+b.dataset.r;$("rangeSeg").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderProgreso()});
function goChart(card){
  show("progreso");
  requestAnimationFrame(()=>{const el=$(card);if(!el)return;el.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
    el.classList.remove("flash");void el.offsetWidth;el.classList.add("flash")});
}

// ---- Zoom: el gráfico a pantalla completa con una barra para elegir el tramo de fechas
const DAY=864e5;
function dayTicks(x0,x1){
  const d=Math.round((x1-x0)/DAY), out=[];
  if(d>75){const t=new Date(x0);t.setDate(1);for(let k=0;k<30;k++){t.setMonth(t.getMonth()+1);const iso=isoOf(t);if(ts(iso)>x1)break;out.push(iso)}return {ticks:out,fmt:null}}
  const step=d<=14?2:d<=35?7:14;
  for(let t=x0+DAY;t<x1;t+=step*DAY)out.push(isoOf(new Date(t)));
  return {ticks:out,fmt:t=>{const x=new Date(t+"T12:00:00");return `${x.getDate()} ${MON[x.getMonth()]}`}};
}
function openZoom(args){
  const all=args.series.flatMap(s=>s.pts).filter(p=>p[1]!=null).map(p=>ts(p[0]));
  const lo=Math.min(args.x0,...all), hi=Math.max(args.x1,...all), n=Math.max(1,Math.round((hi-lo)/DAY));
  let a=Math.round((args.x0-lo)/DAY), b=Math.round((args.x1-lo)/DAY);
  const dlg=$("zoom");
  $("zoomIn").innerHTML=`<div class="row between" style="flex-wrap:nowrap"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span class="eyebrow">Gráfico ampliado</span><h2>${esc(args.label||"")}</h2></div>
      <button class="icon-btn" id="zoomClose" aria-label="Cerrar">${svgI(IC.close)}</button></div>
    <div class="chart" id="zBig"></div>
    <div class="zrange"><span id="zFrom"></span><span id="zDays" class="sub"></span><span id="zTo"></span></div>
    <div class="brush"><div class="mini" id="zMini"></div><div class="sel" id="zSel"></div>
      <input type="range" id="zA" min="0" max="${n}" step="1" aria-label="Desde">
      <input type="range" id="zB" min="0" max="${n}" step="1" aria-label="Hasta"></div>
    <div class="seg" role="group" aria-label="Tramo rápido" style="align-self:flex-start"><button data-z="14">14 días</button><button data-z="30">30 días</button><button data-z="90">90 días</button><button data-z="0">Todo</button></div>
    <span class="sub">Arrastra los extremos de la barra para elegir las fechas. Toca el gráfico para ver cada valor.</span>`;
  const draw=()=>{
    const x0=lo+a*DAY, x1=lo+b*DAY, {ticks,fmt}=dayTicks(x0,x1);
    lineChart($("zBig"),{...args,x0,x1,h:Math.min(420,Math.max(240,innerHeight*0.45)),xTicks:ticks,xFmt:fmt,zoom:false});
    $("zA").value=a;$("zB").value=b;
    $("zSel").style.left=(a/n*100)+"%";$("zSel").style.width=((b-a)/n*100)+"%";
    $("zFrom").textContent=fmtD(isoOf(new Date(x0)));$("zTo").textContent=fmtD(isoOf(new Date(x1)));$("zDays").textContent=`${b-a} días`;
  };
  lineChart($("zMini"),{...args,x0:lo,x1:hi,h:64,yTicks:[],xTicks:[],band:null,bands:null,tip:null,zoom:false,series:args.series.map(s=>({...s,dots:false,end:false}))});
  $("zA").oninput=()=>{a=Math.min(+$("zA").value,b-3);draw()};
  $("zB").oninput=()=>{b=Math.max(+$("zB").value,a+3);draw()};
  $("zoomIn").querySelectorAll("[data-z]").forEach(btn=>btn.onclick=()=>{const z=+btn.dataset.z;const end=Math.min(n,Math.round((Math.min(hi,ts(todayISO())+21*DAY)-lo)/DAY));
    if(!z){a=0;b=n}else{b=Math.max(z,end);a=Math.max(0,b-z)}draw()});
  $("zoomClose").onclick=()=>dlg.close();
  if(!dlg.open)dlg.showModal();
  requestAnimationFrame(draw);
}

// ---- Estado de forma: forma (media de 42 días), fatiga (7 días) y frescura (forma − fatiga) con la carga de Garmin
function loadModel(){
  const acts=Object.values(A).flat().filter(a=>a.training_load!=null);
  if(!acts.length)return null;
  const byDay={};acts.forEach(a=>byDay[a.activity_date]=(byDay[a.activity_date]||0)+(+a.training_load));
  // Carga por minuto de cada deporte (últimos 60 días) para prever las sesiones del plan
  const lim=addD(todayISO(),-60), rate={}, tot={};
  acts.filter(a=>a.activity_date>=lim&&a.duration_min).forEach(a=>{const s=SPORT_OF(a.sport);rate[s]=rate[s]||[0,0];rate[s][0]+=+a.training_load;rate[s][1]+=+a.duration_min});
  const all=Object.values(rate).reduce((x,r)=>[x[0]+r[0],x[1]+r[1]],[0,0]), rOf=s=>rate[s]&&rate[s][1]>30?rate[s][0]/rate[s][1]:all[1]?all[0]/all[1]:1;
  const start=Object.keys(byDay).sort()[0], t=todayISO(), endF=addD(t,28);
  let ctl=0,atl=0;const out=[];
  for(let d=start;d<=endF;d=addD(d,1)){
    const fut=d>t;
    const L=fut?(P[d]||[]).reduce((x,s)=>x+s.min*rOf(s.sport),0):(byDay[d]||0);
    ctl+=(L-ctl)/42;atl+=(L-atl)/7;
    out.push({d,ctl,atl,tsb:ctl-atl,fut,L});
  }
  return out;
}
function tsbLabel(v){return v>5?["Descansado","ok"]:v>-10?["Neutro","plain"]:v>-30?["Productivo","ok"]:["Sobrecarga","bad"]}
function renderLoad(x0,xt){
  const M=loadModel();
  if(!M){$("chLoad").innerHTML='<div class="sub">Sin carga de Garmin todavía.</div>';$("chTsb").innerHTML="";$("loadStats").innerHTML="";return}
  const t=todayISO(), now=M.find(r=>r.d===t)||M.filter(r=>!r.fut).at(-1), wk=M.find(r=>r.d===addD(t,-7));
  const [lab,cls]=tsbLabel(now.tsb);
  const delta=wk?now.ctl-wk.ctl:null;
  $("loadStats").innerHTML=`<div class="stat"><span class="big" style="color:var(--accent)">${nf(now.ctl,0)}</span><span class="sub">Forma${delta!=null?` · ${delta>=0?"+":""}${nf(delta,1)} en 7 días`:""}</span></div>
    <div class="stat"><span class="big" style="color:var(--warn)">${nf(now.atl,0)}</span><span class="sub">Fatiga</span></div>
    <div class="stat ${cls==="bad"?"bad":cls==="ok"?"ok":""}"><span class="big">${now.tsb>0?"+":""}${nf(now.tsb,0)}</span><span class="sub">Frescura · ${lab}</span></div>`;
  const x1=ts(addD(t,28)), xs=Math.max(x0,ts(M[0].d));
  const past=M.filter(r=>!r.fut||r.d===addD(t,1)), fut=M.filter(r=>r.fut||r.d===t);
  const vis=M.filter(r=>ts(r.d)>=xs), hi=Math.ceil(Math.max(10,...vis.map(r=>Math.max(r.ctl,r.atl)))/10)*10;
  const xt2=[...xt];{const d=new Date(xt.length?xt.at(-1)+"T12:00:00":x0);for(let k=0;k<2;k++){d.setMonth(d.getMonth()+1);const iso=isoOf(d);if(ts(iso)<=x1&&!xt2.includes(iso))xt2.push(iso)}}
  lineChart($("chLoad"),{x0:xs,x1,yMin:0,yMax:hi,yTicks:ticks(0,hi),h:190,xTicks:xt2,label:"Forma y fatiga",
    series:[{pts:fut.map(r=>[r.d,r.atl]),color:"var(--warn)",w:1.6,dash:"4 4",op:.7},{pts:fut.map(r=>[r.d,r.ctl]),color:"var(--accent)",w:2.2,dash:"4 4",op:.7},
      {pts:past.map(r=>[r.d,r.atl]),color:"var(--warn)",w:1.8},{pts:past.map(r=>[r.d,r.ctl]),color:"var(--accent)",w:3,end:true}],
    tip:{pts:M.map(r=>[r.d,r.ctl]),unit:" de forma"}});
  const tv=vis.map(r=>r.tsb), tlo=Math.floor(Math.min(-35,...tv)/10)*10, thi=Math.ceil(Math.max(15,...tv)/10)*10;
  lineChart($("chTsb"),{x0:xs,x1,yMin:tlo,yMax:thi,yTicks:[-30,0,thi],h:150,xTicks:xt2,label:"Frescura",
    bands:[[-30,-10,"var(--ok-soft)"],[tlo,-30,"var(--bad-soft)"]],
    series:[{pts:[[isoOf(new Date(xs)),0],[addD(t,28),0]],color:"#2a3843",w:1},{pts:fut.map(r=>[r.d,r.tsb]),color:"var(--fg)",w:1.6,dash:"4 4",op:.6},{pts:past.map(r=>[r.d,r.tsb]),color:"var(--fg)",w:2.2,end:true}],
    tip:{pts:M.map(r=>[r.d,r.tsb]),unit:" de frescura"}});
}
// Endurance score de Garmin (vía no oficial, una vez al día)
const END_LEVELS=[["Intermedio","classificationLowerLimitIntermediate"],["Entrenado","classificationLowerLimitTrained"],["Bien entrenado","classificationLowerLimitWellTrained"],["Experto","classificationLowerLimitExpert"],["Superior","classificationLowerLimitSuperior"],["Élite","classificationLowerLimitElite"]];
function renderEndurance(x0,x1,xt){
  const card=$("cardEnd"); if(!card)return;
  if(!E.length){$("endStats").innerHTML="";$("chEnd").innerHTML='<div class="sub">Todavía no hay datos de Garmin. Se cargan cada mañana.</div>';return}
  const pts=E.map(r=>[r.calendar_date,r.score]), now=E.at(-1), ago=E.find(r=>r.calendar_date>=addD(now.calendar_date,-28));
  const raw=[...E].reverse().find(r=>r.raw&&r.raw.classificationLowerLimitTrained)?.raw||{};
  const lim=END_LEVELS.map(([n,k])=>[n,+raw[k]||null]).filter(l=>l[1]);
  const next=lim.find(l=>l[1]>now.score);
  const d=ago&&ago!==now?now.score-ago.score:null;
  $("endStats").innerHTML=`<div class="stat"><span class="big" style="color:var(--accent)">${nf(now.score,0)}</span><span class="sub">${now.classification||"Endurance score"}${d!=null?` · ${d>=0?"+":""}${nf(d,0)} en 4 semanas`:""}</span></div>`+
    (next?`<div class="stat"><span class="big">${nf(next[1]-now.score,0)}</span><span class="sub">para «${next[0]}» (${nf(next[1],0)})</span></div>`:"");
  const vis=pts.filter(p=>ts(p[0])>=x0).map(p=>p[1]), all=vis.length?vis:pts.map(p=>p[1]);
  let lo=Math.min(...all), hi=Math.max(...all);
  const near=lim.filter(l=>l[1]>=lo-800&&l[1]<=hi+800).map(l=>l[1]);
  lo=Math.floor((Math.min(lo,...near)-200)/100)*100; hi=Math.ceil((Math.max(hi,...near)+200)/100)*100;
  lineChart($("chEnd"),{x0:Math.max(x0,ts(pts[0][0])),x1,yMin:lo,yMax:hi,yTicks:near.length?near:ticks(lo,hi),h:170,ml:40,xTicks:xt,label:"Endurance score",
    series:[{pts,color:"var(--accent)",w:2.6,end:true}],tip:{pts}});
  $("endLegend").innerHTML=lim.length?`<span>Líneas horizontales: niveles de Garmin (${lim.filter(l=>near.includes(l[1])).map(l=>`${l[0]} ${nf(l[1],0)}`).join(" · ")})</span>`:"";
}

// ---- Generador de fuerza
const KIT={
  casa:[["db","Mancuernas de 8 kg",true],["kb","2 kettlebells de 12 kg",true],["bench","Banco",true]],
  gym:[["db","Mancuernas (todos los pesos)",true],["bench","Bancos",true],["bar","Barra de dominadas",true],["cable","Poleas",true],["barbell","Barra olímpica y rack",true]]
};
// Ejercicios por patrón y lugar; need = material requerido. Solo peso libre, sin máquinas.
const LIB={
  rodilla:{casa:[["Sentadilla frontal con 2 kettlebells (24 kg)","kb"],["Sentadilla búlgara con kettlebells, pie atrás en el banco","kb"],["Sentadilla goblet con kettlebell, tempo 3-1-1","kb"]],
           gym:[["Sentadilla trasera con barra","barbell"],["Sentadilla frontal con barra","barbell"],["Sentadilla búlgara con mancuernas","db"]]},
  traccion:{casa:[["Remo con kettlebell a una mano apoyado en el banco","kb"],["Remo con 2 kettlebells con el pecho en el banco inclinado","kb"],["Remo renegado con mancuernas","db"]],
            gym:[["Dominadas (lastradas si haces más de 8)","bar"],["Remo con mancuerna a una mano en el banco","db"],["Remo en polea baja de pie","cable"]]},
  bisagra:{casa:[["Swing con kettlebell","kb"],["Peso muerto rumano a una pierna con kettlebell","kb"],["Hip thrust a una pierna con la espalda en el banco",null]],
           gym:[["Peso muerto rumano con barra","barbell"],["Hip thrust con barra","barbell"],["Peso muerto rumano con mancuernas","db"]]},
  empuje:{casa:[["Flexiones con los pies en el banco",null],["Press de banca con mancuernas de 8 kg, tempo 3-1-1","db"],["Press militar con kettlebell a una mano","kb"]],
          gym:[["Press de banca con barra","barbell"],["Press inclinado con barra","barbell"],["Press de banca con mancuernas","db"]]},
  unilateral:{casa:[["Step-up al banco con kettlebells","kb"],["Zancada atrás con kettlebells","kb"],["Gemelo a una pierna con mancuerna","db"]],
              gym:[["Zancada caminando con mancuernas","db"],["Step-up al banco con mancuernas","db"],["Gemelo a una pierna con mancuerna","db"]]},
  core:{casa:[["Paseo del granjero con 2 kettlebells (40 m)","kb"],["Dead bug",null],["Plancha lateral",null]],
        gym:[["Pallof en polea","cable"],["Paseo del granjero con mancuernas pesadas","db"],["Rueda abdominal o plancha con toque de hombro",null]]}
};
const PAT_LABEL={rodilla:"rodilla",traccion:"tracción",bisagra:"bisagra de cadera",empuje:"empuje",unilateral:"unilateral",core:"core"};
const BLOCKS=[["A",["rodilla","traccion"]],["B",["bisagra","empuje"]],["C",["unilateral","core"]]];
const state={place:"casa",dur:40,type:"normal",seed:0,pick:{}};
const kitState={casa:Object.fromEntries(KIT.casa.map(k=>[k[0],k[2]])),gym:Object.fromEntries(KIT.gym.map(k=>[k[0],k[2]]))};
function renderKit(){
  const k=$("kit"); if(!k)return;
  k.innerHTML=KIT[state.place].map(([id,label])=>`<label><input type="checkbox" data-k="${id}" ${kitState[state.place][id]?"checked":""}>${label}</label>`).join("");
  k.querySelectorAll("input").forEach(i=>i.onchange=()=>{kitState[state.place][i.dataset.k]=i.checked;state.pick={};generate();const d=document.querySelector("#workout details.kitbox");if(d)d.open=true});
}
function options(pattern){return LIB[pattern][state.place].filter(([,need])=>!need||kitState[state.place][need])}
function syncSeg(){
  [["placeSeg","p",state.place],["durSeg","d",String(state.dur)],["typeSeg","t",state.type]].forEach(([id,k,v])=>$(id).querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset[k]===v)));
  renderKit();
}
const repsOf=p=>p==="core"?"30–40 s":p==="unilateral"?"8–10 por lado":state.place==="casa"?"10–15":(state.dur===55?"8–12":"6–10");
function generate(){
  if(!$("daySel").value)return;
  const rec=G.length?recovery():{lvl:"ok"};
  const deload=state.type==="descarga";
  let sets=deload?2:3; if(rec.lvl==="bad")sets=Math.max(2,sets-1);
  const blocks=state.dur===25?BLOCKS.slice(0,2):BLOCKS;
  const rest=state.dur===25?60:90;
  const d=$("daySel").value;
  let html=`<div class="row between" style="flex-wrap:nowrap;align-items:flex-start">
      <div style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow">${fmtD(d)} · ${deload?"semana de descarga":"semana normal"}</span>
      <h2>${state.place==="casa"?"Casa":"Gimnasio"} · ${state.dur}′ · ${blocks.length} superseries</h2></div>
      <button class="icon-btn" id="genBtn" aria-label="Generar otro entreno">${svgI(IC.redo)}</button></div>
    <div class="sub">Calentamiento 5′. ${sets} series de ${repsOf("rodilla")} repeticiones dejando 2 en recámara${deload?", carga −20 %":""}. Descanso ${state.dur===25?"60 s":"75–90 s"} entre superseries.${rec.lvl==="bad"?" Recuperación baja: una serie menos.":""}</div>`;
  let idx=0;
  blocks.forEach(([tag,pats])=>{
    pats.forEach((p,j)=>{
      const i=idx++;
      const opts=options(p); const key=tag+p;
      if(state.pick[key]==null)state.pick[key]=(state.seed+j)%Math.max(1,opts.length);
      const ex=opts[state.pick[key]%Math.max(1,opts.length)];
      const isCore=p==="core", sg=ex?suggest(ex[0],deload):null;
      const hint=ex&&!isCore?(sg?`última vez ${nf(sg.h.load_kg,1)} kg × ${sg.h.reps_done??"?"}${sg.h.top?" al tope":""}`:"primera vez: elige una carga con la que te sobren 2"):"";
      html+=`<div class="ex"><span class="tag">${tag}${j+1}</span>
        <div style="display:flex;flex-direction:column;gap:3px;min-width:0"><span class="name">${ex?esc(ex[0]):"Sin material para este patrón"}</span><span class="sub">${sets} × ${repsOf(p)}${hint?" · "+hint:""}</span></div>
        <span class="acts">${ex&&GUIDES[ex[0]]?`<button class="small-btn" data-guide="${i}" aria-label="Guía: ${esc(ex[0])}">${svgI(IC.info)}<span class="lbl">Guía</span></button>`:""}${opts.length>1?`<button class="small-btn quiet swap" data-k="${key}" aria-label="Cambiar ejercicio">${svgI(IC.swap)}</button>`:""}</span>
        ${ex?logRow(i,ex[0],isCore,deload):""}</div>`;
    });
  });
  html+=`<details class="kitbox"><summary>Material disponible</summary><div class="kit" id="kit"></div></details>
    <div class="sub">Vuelta a la calma 3′.</div>
    <button class="btn block" id="startBtn">${svgI(IC.play)}Empezar entreno</button>
    <div class="row" style="gap:10px"><button class="btn ghost" id="garminBtn" style="flex:1">Enviar a Garmin</button><button class="btn quiet" id="saveBtn" style="flex:1">Guardar como hecha</button></div>
    <span class="sub" id="garminNote"></span><span class="sub" id="saveNote">Apunta kilos y repeticiones de la última serie, o usa «Empezar entreno» y se apuntan solos.</span>`;
  state.current=blocks.flatMap(([tag,pats])=>pats.map((p,j)=>{const o=options(p);const ex=o[state.pick[tag+p]%Math.max(1,o.length)];return {tag:tag+(j+1),pattern:p,name:ex?ex[0]:null,sets,reps:repsOf(p)}}));
  state.sets=sets;state.rest=rest;
  $("workout").innerHTML=html;
  renderKit();
  $("workout").querySelectorAll(".swap").forEach(b=>b.onclick=()=>{state.pick[b.dataset.k]++;generate()});
  $("workout").querySelectorAll("[data-guide]").forEach(b=>b.onclick=()=>openGuide(+b.dataset.guide));
  $("genBtn").onclick=()=>{state.seed++;state.pick={};generate()};
  $("startBtn").onclick=startTrainer;
  $("saveBtn").onclick=saveSession; $("garminBtn").onclick=sendToGarmin; lastSaved=null;
}
[["placeSeg","p","place"],["durSeg","d","dur"],["typeSeg","t","type"]].forEach(([id,k,f])=>$(id).querySelectorAll("button").forEach(b=>b.onclick=()=>{state[f]=f==="dur"?+b.dataset[k]:b.dataset[k];state.pick={};syncSeg();generate()}));

// ---- Ficha del ejercicio (hoja inferior)
function openGuide(i){
  const e=state.current[i], g=GUIDES[e?.name]; if(!g)return;
  const dlg=$("guide");
  $("guideIn").innerHTML=`<div class="grab" aria-hidden="true"></div>
    <div class="row between" style="flex-wrap:nowrap;align-items:flex-start"><div style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow">${e.tag} · ${PAT_LABEL[e.pattern]} · ${state.place==="casa"?"casa":"gimnasio"}</span><h2 style="font-size:26px">${esc(e.name)}</h2></div>
      <button class="icon-btn" id="guideClose" aria-label="Cerrar">${svgI(IC.close)}</button></div>
    ${typeof FIGS!=="undefined"&&FIGS[e.name]?`<div class="figbox">${FIG.panels(FIGS[e.name])}</div>`:""}
    <div class="row" style="gap:8px"><span class="chip neutral">${esc(g.m)}</span><span class="chip plain">${e.sets} × ${esc(e.reps)}</span></div>
    <div style="display:flex;flex-direction:column;gap:10px"><span class="eyebrow">3 claves</span>${g.k.map((k,n)=>`<div class="li"><span class="n">${n+1}</span><span>${esc(k)}</span></div>`).join("")}</div>
    <div style="display:flex;flex-direction:column;gap:10px"><span class="eyebrow">Errores típicos</span>${g.e.map(x=>`<div class="li"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3L22 20H2Z" fill="none" stroke="var(--warn)" stroke-width="2.2"/><path d="M12 10v4M12 17v.5" stroke="var(--warn)" stroke-width="2.2"/></svg><span>${esc(x)}</span></div>`).join("")}</div>
    <div class="two"><div class="box"><span class="eyebrow">Más fácil</span><span>${esc(g.f)}</span></div><div class="box"><span class="eyebrow">Más difícil</span><span>${esc(g.d)}</span></div></div>
    <a class="btn ghost" href="https://www.youtube.com/results?search_query=${encodeURIComponent(g.q)}" target="_blank" rel="noopener">${svgI(IC.video)}Ver vídeo en YouTube</a>`;
  $("guideClose").onclick=()=>dlg.close();
  dlg.onclick=ev=>{if(ev.target===dlg)dlg.close()};
  if(!dlg.open)dlg.showModal();
}

// ---- Modo entreno: un ejercicio cada vez, superseries y descanso automático
let TR=null;
const topOf=r=>{const m=String(r).match(/(\d+)\D+(\d+)/);return m?+m[2]:null};
const lowOf=r=>{const m=String(r).match(/(\d+)/);return m?+m[1]:10};
function startTrainer(){
  const ex=state.current.map((e,i)=>({...e,i})).filter(e=>e.name);
  if(!ex.length)return;
  const seq=[];
  const blocks=[...new Set(ex.map(e=>e.tag[0]))];
  blocks.forEach(b=>{const list=ex.filter(e=>e.tag[0]===b);for(let s=1;s<=state.sets;s++){list.forEach(e=>seq.push({k:"set",e,s}));seq.push({k:"rest",block:b,s,last:s===state.sets})}});
  const vals={};
  ex.forEach(e=>{const kgIn=$("kg-"+e.i)?.value;const sg=suggest(e.name,state.type==="descarga");
    vals[e.i]={kg:kgIn!==""&&kgIn!=null?+kgIn:(sg?sg.kg:(e.pattern==="core"?0:null)),reps:e.pattern==="core"?30:lowOf(e.reps),done:[]}});
  TR={seq,pos:0,vals,ex,timer:null,end:0};
  $("trainer").showModal();
  renderTrainer();
}
function stopTimer(){if(TR&&TR.timer){clearInterval(TR.timer);TR.timer=null}}
// Carga de partida cuando no hay historial: la del material que nombra el ejercicio
function defKg(name){const m=name.match(/\((\d+(?:,\d+)?) kg\)/)||name.match(/de (\d+) kg/);if(m)return +m[1].replace(",",".");
  const n=name.toLowerCase();if(n.includes("barra"))return 20;if(n.includes("2 kettlebells"))return 24;if(n.includes("kettlebell"))return 12;
  if(n.includes("mancuernas"))return state.place==="gym"?20:16;if(n.includes("mancuerna"))return state.place==="gym"?10:8;return state.place==="gym"?10:8}
function renderTrainer(){
  stopTimer();
  const el=$("trainerIn"), t=TR, step=t.seq[t.pos];
  const sets=t.seq.filter(x=>x.k==="set"), doneSets=t.seq.slice(0,t.pos).filter(x=>x.k==="set").length;
  const bar=`<div class="prog" role="progressbar" aria-label="Progreso del entreno" aria-valuemin="0" aria-valuemax="${sets.length}" aria-valuenow="${doneSets}"><span style="width:${doneSets/sets.length*100}%"></span></div>`;
  const top=(mid,guideI)=>`<div class="row between" style="flex-wrap:nowrap"><button class="icon-btn" id="trClose" aria-label="Salir del modo entreno">${svgI(IC.close)}</button><span class="sub" style="text-align:center">${mid}</span>${guideI!=null&&GUIDES[state.current[guideI]?.name]?`<button class="icon-btn" id="trGuide" aria-label="Guía del ejercicio" style="color:var(--accent);border-color:var(--accent-dim)">${svgI(IC.info)}</button>`:'<span style="width:44px"></span>'}</div>`;
  if(!step){ // resumen final
    el.innerHTML=top("Entreno completado",null)+bar.replace(/width:[^%]+%/,"width:100%")+
      `<h1>¡Hecho!</h1><div class="card" style="gap:0">${t.ex.map(e=>{const v=t.vals[e.i],last=v.done.at(-1);return `<div class="wline"><span><strong>${e.tag}</strong> ${esc(e.name)}</span><span class="sub">${last?`${e.pattern==="core"?"":nf(last.kg,1)+" kg × "}${last.reps}${e.pattern==="core"?" s":""}`:"—"}</span></div>`}).join("")}</div>
      <button class="btn block" id="trSave" style="margin-top:auto;min-height:56px">Guardar como hecha</button>`;
    $("trSave").onclick=async()=>{
      t.ex.forEach(e=>{const v=t.vals[e.i],last=v.done.at(-1);if(!last)return;
        if($("kg-"+e.i))$("kg-"+e.i).value=last.kg??"";if($("reps-"+e.i))$("reps-"+e.i).value=e.pattern==="core"?"":last.reps;
        const tp=topOf(e.reps);if($("top-"+e.i))$("top-"+e.i).checked=!!tp&&v.done.length>=state.sets&&v.done.every(x=>x.reps>=tp)});
      await saveSession();$("trainer").close();toast($("saveNote").textContent);
    };
  } else if(step.k==="rest"){
    const nxt=t.seq.slice(t.pos+1).find(x=>x.k==="set");
    const secs=step.last?Math.min(state.rest,60):state.rest; t.end=Date.now()+secs*1000;
    el.innerHTML=top(`Bloque ${step.block} · ronda ${step.s} de ${state.sets}`,null)+bar+
      `<div style="display:flex;flex-direction:column;gap:8px;padding-top:6px"><span class="eyebrow">Descanso</span><h1 id="restT" style="font-size:72px">0:00</h1>
       <span class="sub">${nxt?`Después: ${nxt.e.tag} ${esc(nxt.e.name)} · serie ${nxt.s}`:"Último descanso"}</span></div>
      <div class="row" style="gap:10px"><button class="btn quiet" id="trPlus" style="flex:1">+30 s</button><button class="btn" id="trSkip" style="flex:1">Saltar</button></div>`;
    const tick=()=>{const left=Math.max(0,Math.round((t.end-Date.now())/1000));const e=$("restT");if(e)e.textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}`;
      if(left<=0){stopTimer();try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(_){ }t.pos++;renderTrainer()}};
    tick();t.timer=setInterval(tick,250);
    $("trPlus").onclick=()=>{t.end+=30000;tick()};
    $("trSkip").onclick=()=>{t.pos++;renderTrainer()};
  } else {
    const e=step.e, v=t.vals[e.i], isCore=e.pattern==="core", sg=suggest(e.name,state.type==="descarga");
    const stepKg=state.place==="gym"?2.5:1;
    el.innerHTML=top(`${e.tag} · serie ${step.s} de ${state.sets}`,e.i)+bar+
      `<div style="display:flex;flex-direction:column;gap:8px;padding-top:4px"><span class="eyebrow">${e.tag[0]===e.tag?"":"Superserie "+e.tag[0]} · ${PAT_LABEL[e.pattern]}</span>
        <h1 style="font-size:32px;line-height:1.05">${esc(e.name)}</h1>
        <span class="sub">Objetivo ${esc(e.reps)}${sg?` · la última vez ${nf(sg.h.load_kg,1)} kg × ${sg.h.reps_done??"?"}`:""}${v.done.length?` · serie anterior ${v.done.at(-1).reps}`:""}</span></div>
      <div class="card" style="gap:18px">
        <div class="stepper"><button id="kgM" aria-label="Menos kilos">−</button><div class="v"><b id="kgV">${v.kg==null?"—":nf(v.kg,v.kg%1?1:0)}</b><span class="eyebrow">${isCore?"lastre kg":"kg"}</span></div><button id="kgP" aria-label="Más kilos">+</button></div>
        <div style="height:1px;background:var(--line)"></div>
        <div class="stepper"><button id="rM" aria-label="Menos ${isCore?"segundos":"repeticiones"}">−</button><div class="v"><b id="rV">${v.reps}</b><span class="eyebrow">${isCore?"segundos":"repeticiones"}</span></div><button id="rP" aria-label="Más ${isCore?"segundos":"repeticiones"}">+</button></div>
      </div>
      <button class="btn block" id="trDone" style="margin-top:auto;min-height:56px">Serie hecha</button>`;
    const upd=()=>{$("kgV").textContent=v.kg==null?"—":nf(v.kg,v.kg%1?1:0);$("rV").textContent=v.reps};
    $("kgM").onclick=()=>{v.kg=Math.max(0,(v.kg??0)-stepKg);upd()};
    $("kgP").onclick=()=>{v.kg=v.kg==null?(isCore?stepKg:defKg(e.name)):v.kg+stepKg;upd()};
    $("rM").onclick=()=>{v.reps=Math.max(0,v.reps-(isCore?5:1));upd()};
    $("rP").onclick=()=>{v.reps+=isCore?5:1;upd()};
    $("trDone").onclick=()=>{v.done.push({kg:v.kg,reps:v.reps});t.pos++;renderTrainer()};
    if($("trGuide"))$("trGuide").onclick=()=>openGuide(e.i);
  }
  $("trClose").onclick=()=>{stopTimer();$("trainer").close()};
}
$("trainer").addEventListener("close",stopTimer);

// ---- Informes (web.v_reports)
let rSel=0;
const md=t=>esc(t).replace(/\*([^*\n]+)\*/g,"<strong>$1</strong>").replace(/_([^_\n]+)_/g,"<em>$1</em>").replace(/\n/g,"<br>");
function renderInformes(){
  if(!R.length){$("rlist").innerHTML='<div class="sub">Todavía no hay informes. El primero llegará el domingo a las 20:00.</div>';$("report").hidden=true;return}
  $("report").hidden=false;
  $("rlist").innerHTML=R.map((r,i)=>`<button data-i="${i}" aria-pressed="${i===rSel}"><strong>Semana del ${fmtD(r.week_start)}</strong>${(r.alerts||[]).length?`<span class="chip warn">${r.alerts.length} aviso${r.alerts.length>1?"s":""}</span>`:'<span class="chip ok">sin avisos</span>'}</button>`).join("");
  $("rlist").querySelectorAll("button").forEach(b=>b.onclick=()=>{rSel=+b.dataset.i;renderInformes()});
  const r=R[rSel];
  $("report").innerHTML=`<h2>Semana ${fmtD(r.week_start)} – ${fmtD(r.week_end)}</h2><p>${md(r.summary_md)}</p>${(r.alerts||[]).map(a=>`<p><span class="chip warn">Aviso</span> ${esc(a)}</p>`).join("")}`;
}

// ---- Navegación
const TITLES={hoy:"Hoy",progreso:"Progreso",fuerza:"Fuerza",informes:"Informes"};
let current="hoy";
function show(v){
  current=v;
  ["hoy","progreso","fuerza","informes"].forEach(x=>{const s=$("v-"+x);s.hidden=x!==v;if(x===v){s.classList.remove("view");void s.offsetWidth;s.classList.add("view")}});
  document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-selected",t.dataset.v===v));
  $("viewTitle").textContent=TITLES[v];
  $("dayBox").style.visibility=v==="hoy"||v==="fuerza"?"visible":"hidden";
  setEyebrow();
  if(v==="progreso")renderProgreso();
  window.scrollTo({top:0});
}
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>show(t.dataset.v));
let rzT,rzW=innerWidth;addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(innerWidth!==rzW&&current==="progreso"){rzW=innerWidth;renderProgreso()}},200)});

// ---- Conexión
function netState(){
  const off=!navigator.onLine; $("offline").hidden=!off;
  if(off)$("offlineTxt").textContent=G.length?`Sin conexión · datos de Garmin hasta el ${fmtD(G.at(-1)[0])}`:"Sin conexión";
}
addEventListener("online",netState);addEventListener("offline",netState);

// ---- Supabase: login con enlace mágico, carga de datos y guardado de fuerza
const SUPABASE_URL="https://pldkcccczzzxzdytvope.supabase.co";
const SUPABASE_KEY="sb_publishable_gU0FpPNVguPg_we7DA7nAQ_ridFaArW"; // clave pública; los datos los protege el login + RLS
sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{db:{schema:"web"}});

const SPORT_MAP={bike_indoor:"bike",bike_outdoor:"bike",run:"run",strength:"strength"};
const STEP_LABEL={warmup:"Calentamiento",cooldown:"Vuelta a la calma",recovery:"Suave",interval:""};
function stepText(st){
  if(st.type==="repeat")return `${st.count} × (${st.steps.map(stepText).join(" + ")})`;
  const t=st.target||{};
  let tgt="";
  if(t.kind==="power_pct_ftp"&&t.watts_pedals)tgt=`a ${t.watts_pedals[0]}–${t.watts_pedals[1]} W`;
  else if(t.kind==="heart_rate")tgt=`a ${t.low}–${t.high} ppm`;
  return [STEP_LABEL[st.type]||"",`${st.duration_min}′`,tgt,cleanNote(st.note)?`(${cleanNote(st.note)})`:""].filter(Boolean).join(" ").replace(/^./,c=>c.toUpperCase());
}
function mapSession(row){
  const d=row.data||{};
  const steps=(d.steps||[]);
  const trivial=steps.length===1&&!steps[0].target&&!steps[0].note;
  return {h:d.start_local||"",sport:SPORT_MAP[row.sport]||row.sport,raw:row.sport,name:d.name||row.sport,min:d.duration_min||0,
    key:(d.tags||[]).includes("key"),desc:d.description||"",steps:trivial?[]:steps.map(stepText),rawSteps:steps,id:row.id};
}
async function loadData(){
  const since=new Date();since.setDate(since.getDate()-180);
  const sinceISO=since.toLocaleDateString("sv-SE");
  const [rec,wt,plan,rep,ftp,str]=await Promise.all([
    sb.from("v_recovery").select("*").gte("calendar_date",sinceISO).order("calendar_date"),
    sb.from("v_weight").select("*").order("measured_at"),
    sb.from("v_plan").select("*").order("session_date"),
    sb.from("v_reports").select("*").order("week_start",{ascending:false}),
    sb.from("v_ftp").select("*").order("test_date"),
    sb.from("strength_sessions").select("session_date,exercises,done_at,duration_min").not("done_at","is",null).order("session_date")
  ]);
  const err=[rec,wt,plan,rep,ftp,str].find(r=>r.error);
  if(err)throw err.error;
  G=rec.data.map(r=>[r.calendar_date,r.rhr,r.hrv,r.hrv_week,r.hrv_status,r.sleep_score,r.sleep_h==null?null:+r.sleep_h,r.body_battery,r.vo2_bike==null?null:+r.vo2_bike,r.vigorous_min,r.vo2_run==null?null:+r.vo2_run]);
  const lastBase=[...rec.data].reverse().find(r=>r.hrv_low&&r.hrv_high);
  if(lastBase)BASE={low:lastBase.hrv_low,high:lastBase.hrv_high};
  const byDay={};
  wt.data.forEach(r=>{const d=new Date(r.measured_at).toLocaleDateString("sv-SE",{timeZone:"Europe/Berlin"});byDay[d]=+r.weight_kg});
  W=Object.entries(byDay).sort((a,b)=>a[0]<b[0]?-1:1);
  P={};plan.data.forEach(r=>{(P[r.session_date]=P[r.session_date]||[]).push(mapSession(r))});
  Object.values(P).forEach(a=>a.sort((x,y)=>x.h<y.h?-1:1));
  R=rep.data;
  SD={};str.data.forEach(r=>{SD[r.session_date]=(SD[r.session_date]||0)+(r.duration_min||0)});
  A={};ACT_OK=false;
  try{const act=await sb.from("v_activities").select("activity_date,sport,name,duration_min,training_load");
    if(!act.error){ACT_OK=true;act.data.forEach(a=>(A[a.activity_date]=A[a.activity_date]||[]).push(a))}}catch(e){}
  E=[];try{const en=await sb.from("v_endurance").select("calendar_date,score,classification,raw").order("calendar_date");if(!en.error)E=en.data}catch(e){}
  H={};str.data.forEach(r=>(r.exercises||[]).forEach(e=>{if(e.name&&e.load_kg!=null)H[e.name]={date:r.session_date,load_kg:+e.load_kg,reps_done:e.reps_done,top:!!e.top}}));
  if(ftp.data.length)FTP=ftp.data.at(-1).ftp_watts;
  $("ftpNow").innerHTML=`${FTP}<span class="unit">W</span>`;
  const done=ftp.data.filter(t=>t.test_date>="2026-12-01").length;
  $("ftpTests").textContent=`${done}/2`;
  $("ftpNext").textContent=done===0?"Próximo test 1 dic":done===1?"Próximo test 9 feb":"Tests completados";
}
// Historial de cargas: última vez que se hizo cada ejercicio
function suggest(name,deload){
  const h=H[name]; if(!h||h.load_kg==null)return null;
  let kg=h.load_kg, why="misma carga";
  if(h.top){ if(state.place==="gym"){kg=h.load_kg+2.5;why="+2,5 kg: la última vez llegaste al tope"} else why="llegaste al tope: hazlo más lento (3-1-1) o pasa a la variante más difícil"}
  if(deload){kg=Math.round(kg*0.8/2.5)*2.5;why="descarga: −20 %"}
  return {kg,why,h};
}
function logRow(i,name,isCore,deload){
  const sg=suggest(name,deload);
  return `<div class="log">${sg&&!isCore?`<span class="sub" style="font-size:12px">Hoy ${nf(sg.kg,1)} kg (${sg.why})</span>`:""}
   <div class="row" style="gap:8px"><input class="inp" id="kg-${i}" type="number" inputmode="decimal" step="0.5" min="0" placeholder="${isCore?"lastre":"kg"}" aria-label="Kilos" value="${sg?sg.kg:""}">
   <input class="inp" id="reps-${i}" type="number" inputmode="numeric" min="0" placeholder="reps" aria-label="Repeticiones de la última serie">
   <label class="sub" style="display:inline-flex;gap:6px;align-items:center;min-height:40px"><input id="top-${i}" type="checkbox">todas al tope</label></div></div>`;
}
async function saveSession(){
  const d=$("daySel").value, ses=(P[d]||[]).find(s=>s.sport==="strength");
  const num=id=>{const v=$(id)?.value;return v===""||v==null?null:+v};
  const exercises=state.current.map((e,i)=>({...e,load_kg:num("kg-"+i),reps_done:num("reps-"+i),top:!!$("top-"+i)?.checked,done:true}));
  const row={plan_session_id:ses?ses.id:null,session_date:d,place:state.place,duration_min:state.dur,deload:state.type==="descarga",exercises,done_at:new Date().toISOString()};
  $("saveNote").textContent="Guardando…";
  const q=lastSaved?sb.from("strength_sessions").update(row).eq("id",lastSaved).select("id").single():sb.from("strength_sessions").insert(row).select("id").single();
  const {data,error}=await q;
  if(error){$("saveNote").textContent="No se pudo guardar: "+error.message;return}
  lastSaved=data.id;
  SD[d]=state.dur;renderWeek();
  exercises.forEach(e=>{if(e.name&&e.load_kg!=null)H[e.name]={date:d,load_kg:e.load_kg,reps_done:e.reps_done,top:e.top}});
  $("saveNote").textContent="Guardada como hecha. Si corriges algo, vuelve a pulsar y se actualiza.";
  toast("Entreno guardado como hecho");
}

// Manda la fuerza generada a Garmin: se guarda en web.garmin_strength y se avisa al programa de Garmin.
async function sendToGarmin(){
  const d=$("daySel").value;
  const exercises=state.current.filter(e=>e.name).map(e=>{const v=$("kg-"+state.current.indexOf(e))?.value;const sug=suggest(e.name,state.type==="descarga");
    return {tag:e.tag,name:e.name,reps:e.reps,load_kg:v!==""&&v!=null?+v:(sug?sug.kg:null)}});
  const row={session_date:d,place:state.place,duration_min:state.dur,sets:state.sets,rest_s:state.rest,exercises,requested_at:new Date().toISOString()};
  $("garminNote").textContent="Enviando…";
  const {error}=await sb.from("garmin_strength").upsert(row);
  if(error){$("garminNote").textContent="No se pudo guardar: "+error.message;return}
  let msg="Guardada, pero no se pudo avisar a Garmin ahora: se subirá en la sincronización del domingo si el día no ha pasado.";
  try{const {data}=await sb.functions.invoke("garmin-dispatch",{method:"POST"});
    if(data?.dispatched)msg=`Enviada: en 2–3 minutos estará en Garmin para el ${fmtD(d)}. Sincroniza el reloj.`}catch(e){}
  $("garminNote").textContent=msg+" Si la vuelves a enviar, sustituye a la de ese día.";
  toast(msg.split(":")[0]);
}

// ---- Arranque
async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){$("login").hidden=false;$("app").hidden=true;$("tabs").hidden=true;return}
  $("login").hidden=true;$("app").hidden=false;$("tabs").hidden=false;
  try{
    await loadData();
    const lastG=G.length?G.at(-1)[0]:null;
    $("status").textContent=lastG?`Datos de Garmin hasta el ${fmtD(lastG)} · ${session.user.email}`:"Sin datos todavía";
    if(!G.length&&!W.length&&!Object.keys(P).length)$("status").textContent="No se ven datos: este correo no está autorizado o faltan permisos.";
  }catch(e){$("status").textContent=navigator.onLine?"Error al cargar datos: "+(e.message||e):"Sin conexión y sin datos guardados todavía"}
  setupDays();setEyebrow();renderHoy();renderPlanEnd();renderWeek();syncSeg();generate();renderInformes();netState();
}
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("email").value.trim();
  $("loginMsg").textContent="Enviando…";
  const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});
  $("loginMsg").textContent=error?"No se pudo enviar: "+error.message:"Revisa tu correo y abre el enlace en este dispositivo.";
});
$("logout").onclick=async()=>{await sb.auth.signOut();location.reload()};
sb.auth.onAuthStateChange((ev)=>{if(ev==="SIGNED_IN"&&$("app").hidden)boot()});
boot();
// Al activarse una versión nueva de la app, recargar una vez para usarla
if("serviceWorker" in navigator){const had=!!navigator.serviceWorker.controller;let reloaded=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(had&&!reloaded){reloaded=true;location.reload()}});
  navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>r.update()).catch(()=>{})}
