
// ---- Datos reales (garmin_daily): fecha, FCreposo, HRV, HRVsemanal, estado, puntSueño, horasSueño, BBmax, estrés, minVigorosos
let A={},ACT_OK=false,SD={},H={},G=[],W=[],P={},R=[],BASE={low:55,high:74},FTP=225,sb=null,lastSaved=null;
const SPORT={bike:"Bici",run:"Carrera",strength:"Fuerza"};
const DOW=["dom","lun","mar","mié","jue","vie","sáb"];
const MON=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const fmtD=s=>{const d=new Date(s+"T12:00:00");return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`};
const nf=(v,d=1)=>v==null?"—":v.toLocaleString("es-ES",{minimumFractionDigits:d,maximumFractionDigits:d});
const $=id=>document.getElementById(id);

// ---- Selector de día
const todayISO=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Berlin"});
function setupDays(){
  const t=todayISO(), ds=[];
  for(let i=-3;i<=10;i++){const d=new Date(t+"T12:00:00");d.setDate(d.getDate()+i);ds.push(d.toLocaleDateString("sv-SE"))}
  $("daySel").innerHTML=ds.map(d=>`<option value="${d}">${d===t?"Hoy, ":""}${fmtD(d)}</option>`).join("");
  $("daySel").value=t;
  $("daySel").onchange=()=>{renderHoy();renderWeek()};
}
// ---- Semáforo de recuperación (última noche real)
function recovery(){
  const li=G.map(r=>r[2]!=null||r[1]!=null).lastIndexOf(true);
  const last=G[li];
  const prev7=G.slice(Math.max(0,li-7),li).map(r=>r[1]).filter(v=>v!=null);
  const rhrAvg=prev7.reduce((a,b)=>a+b,0)/prev7.length;
  const hrvOk=last[2]!=null&&last[2]>=BASE.low&&last[2]<=BASE.high;
  const rhrOk=last[1]<=rhrAvg+3;
  const sleepOk=last[6]>=6;
  const fails=(!hrvOk)+(!rhrOk);
  let lvl="ok",txt="Recuperado: el plan sigue tal cual";
  if(last[4]==="LOW"||fails>=2){lvl="bad";txt="Poco recuperado: valora cambiar por algo suave"}
  else if(fails===1||!sleepOk){lvl="warn";txt="Recuperación justa: haz la sesión sin pasarte"}
  return {last,rhrAvg,hrvOk,rhrOk,sleepOk,lvl,txt};
}
function renderHoy(){
  if(!G.length){$("recoveryCard").innerHTML="<h2>Recuperación</h2><div class=sub>Sin datos de Garmin todavía</div>"}
  const r=G.length?recovery():{last:[]},l=r.last;
  if(G.length)
  $("recoveryCard").innerHTML=`
    <div class="row" style="justify-content:space-between"><h2>Recuperación</h2><span class="pill ${r.lvl}"><span class="dot"></span>${r.txt}</span></div>
    <div class="sub">Noche del ${fmtD(l[0])} (último dato de Garmin)</div>
    <div class="metrics">
      <div class="metric"><span class="eyebrow">HRV</span><span class="num">${l[2]}<span class="unit">ms</span></span><span class="sub">Rango normal ${BASE.low}–${BASE.high} · ${r.hrvOk?"dentro":"fuera"}</span></div>
      <div class="metric"><span class="eyebrow">FC en reposo</span><span class="num">${l[1]}<span class="unit">ppm</span></span><span class="sub">Media 7 días ${nf(r.rhrAvg,0)} ppm</span></div>
      <div class="metric"><span class="eyebrow">Sueño</span><span class="num">${nf(l[6])}<span class="unit">h</span></span><span class="sub">Puntuación ${l[5]}/100</span></div>
      <div class="metric"><span class="eyebrow">Body Battery</span><span class="num">${l[7]}</span><span class="sub">Máximo al despertar</span></div>
    </div>`;
  const d=$("daySel").value, ss=P[d]||[];
  $("viewTitle").textContent= "Hoy";
  $("sessionsCard").innerHTML=`<div class="row" style="justify-content:space-between"><h2>Entrenamiento · ${fmtD(d)}</h2><span class="sub">${ss.reduce((a,s)=>a+s.min,0)} min en total</span></div>`+
    (ss.length?ss.map(s=>`
      <div class="session ${s.sport==="strength"?"strength":""}">
        <div class="row" style="justify-content:space-between"><h3>${s.h} · ${s.name}</h3><div class="row" style="gap:6px">${s.key?'<span class="pill neutral">Clave</span>':""}<span class="sub">${SPORT[s.sport]} · ${s.min}′</span></div></div>
        <div class="sub">${s.desc}</div>
        ${s.steps.length?`<ol class="steps">${s.steps.map(x=>`<li>${x}</li>`).join("")}</ol>`:""}
        ${s.sport==="strength"?`<div class="row"><span class="sub">¿Dónde entrenas hoy?</span><button class="btn" data-go="casa">En casa</button><button class="btn ghost" data-go="gym">En el gimnasio</button></div>`:""}
      </div>`).join(""):`<div class="sub">Descanso</div>`);
  $("sessionsCard").querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{state.place=b.dataset.go;syncSeg();generate();show("fuerza")});
  if(!W.length){$("weightCard").innerHTML="<h2>Peso</h2><div class=sub>Sin pesadas todavía</div>";return}
  const last=W[W.length-1], start=71.4, goal=67;
  const pct=Math.max(0,Math.min(1,(start-last[1])/(start-goal)));
  $("weightCard").innerHTML=`
    <div class="row" style="justify-content:space-between"><h2>Peso</h2><span class="sub">Última pesada ${fmtD(last[0])}</span></div>
    <div class="metrics">
      <div class="metric"><span class="eyebrow">Última</span><span class="num">${nf(last[1],2)}<span class="unit">kg</span></span></div>
      <div class="metric"><span class="eyebrow">Media 7 días</span><span class="num">${nf(avg7(),2)}<span class="unit">kg</span></span></div>
      <div class="metric"><span class="eyebrow">Faltan</span><span class="num">${nf(last[1]-goal,1)}<span class="unit">kg</span></span><span class="sub">hasta 67 kg el 28 feb</span></div>
    </div>
    <div class="bar" role="img" aria-label="Progreso hacia 67 kg"><span style="width:${Math.max(2,pct*100)}%"></span></div>
    <div class="sub">${Math.round(pct*100)} % del camino desde 71,4 kg · ritmo necesario ≈ 0,34 kg/semana</div>`;
}
// ---- Aviso de fin de plan
function renderPlanEnd(){
  const el=$("planEndCard"), dates=Object.keys(P).sort();
  if(!dates.length){el.hidden=true;return}
  const last=dates.at(-1), t=todayISO(), days=Math.round((ts(last)-ts(t))/864e5);
  if(days>14){el.hidden=true;return}
  el.hidden=false;
  el.innerHTML=days>=0
    ?`<div class="row" style="justify-content:space-between"><h3>El plan termina el ${fmtD(last)}</h3><span class="pill warn">${days===0?"Termina hoy":`Quedan ${days} día${days===1?"":"s"}`}</span></div><div class="sub">Pídele a Claude el siguiente bloque con algo como «revisemos el plan». Analizará cómo te ha ido y lo preparará contigo.</div>`
    :`<div class="row" style="justify-content:space-between"><h3>El plan terminó el ${fmtD(last)}</h3><span class="pill bad">Sin plan</span></div><div class="sub">Pídele a Claude el siguiente bloque con algo como «revisemos el plan».</div>`;
}
// ---- Vista semanal (lunes a domingo de la semana del día elegido)
const SPORT_OF=a=>/strength|fuerza/i.test(a)?"strength":/run|carrera|trail/i.test(a)?"run":/cycl|bik|ride|bici|virtual/i.test(a)?"bike":a;
function renderWeek(){
  const sel=$("daySel").value, d0=new Date(sel+"T12:00:00"); d0.setDate(d0.getDate()-((d0.getDay()+6)%7));
  const t=todayISO(); let plan=0,done=0,nDone=0,nPlan=0,rows="";
  for(let i=0;i<7;i++){
    const d=new Date(d0);d.setDate(d0.getDate()+i);const iso=d.toLocaleDateString("sv-SE");
    const ss=P[iso]||[]; const acts=(A[iso]||[]).map(a=>({...a,s:SPORT_OF(a.sport)}));
    const items=ss.map(s=>{
      plan+=s.min;nPlan++;
      let st,mins=0;
      if(s.sport==="strength"&&SD[iso]){st="ok";mins=SD[iso]}
      else{const a=acts.find(a=>a.s===s.sport&&!a.used);if(a){a.used=true;st="ok";mins=a.duration_min||0}}
      if(st==="ok"){done+=mins;nDone++}
      else st=iso>t?"todo":iso===t?"today":(ACT_OK||s.sport==="strength")?"miss":"unk";
      const lab={ok:"Hecha",todo:"Pendiente",today:"Hoy",miss:"Saltada",unk:"Sin comprobar"}[st];
      const cls={ok:"ok",todo:"neutral",today:"neutral",miss:"bad",unk:"warn"}[st];
      return `<div class="row" style="justify-content:space-between;gap:8px"><span>${s.name} <span class="sub">· ${s.min}′</span></span><span class="pill ${cls}">${lab}</span></div>`;
    }).join("");
    const extra=acts.filter(a=>!a.used).map(a=>`<div class="row" style="justify-content:space-between"><span class="sub">Extra: ${esc(SPORT[a.s]||a.name||a.sport)} · ${a.duration_min||"?"}′</span><span class="pill ok">Hecha</span></div>`).join("");
    if(!items&&!extra)continue;
    rows+=`<div style="display:flex;flex-direction:column;gap:6px;padding:10px 0;border-top:1px solid var(--line)"><div class="eyebrow">${fmtD(iso)}</div>${items}${extra}</div>`;
  }
  const h=m=>`${Math.floor(m/60)} h ${String(Math.round(m%60)).padStart(2,"0")}`;
  $("weekCard").innerHTML=`<div class="row" style="justify-content:space-between"><h2>Semana</h2><span class="sub">${nDone}/${nPlan} sesiones · ${h(done)} de ${h(plan)}</span></div>
   <div class="bar" role="img" aria-label="Horas hechas frente a planificadas"><span style="width:${plan?Math.min(100,done/plan*100):0}%"></span></div>
   ${rows||'<div class="sub">Sin sesiones planificadas esta semana.</div>'}
   ${ACT_OK?"":'<div class="sub">Bici y carrera aún no se comprueban: no se han podido leer tus actividades de Garmin.</div>'}`;
}

// ---- Gráficos SVG
const ts=s=>new Date(s+"T12:00:00").getTime();
function lineChart(el,{series,band,yMin,yMax,x0,x1,h=200,yTicks,unit="",dots=false,xTicks}){
  const W_=640,H=h,m={l:36,r:12,t:10,b:24};
  const X=t=>m.l+(t-x0)/(x1-x0)*(W_-m.l-m.r), Y=v=>m.t+(1-(v-yMin)/(yMax-yMin))*(H-m.t-m.b);
  let s=`<svg viewBox="0 0 ${W_} ${H}" role="img">`;
  yTicks.forEach(v=>{s+=`<line x1="${m.l}" x2="${W_-m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${m.l-6}" y="${Y(v)+4}" text-anchor="end">${v}${unit}</text>`});
  if(band)s+=`<rect x="${m.l}" y="${Y(band[1])}" width="${W_-m.l-m.r}" height="${Y(band[0])-Y(band[1])}" fill="var(--band)" opacity=".9"/>`;
  (xTicks||[]).forEach(t=>{s+=`<text x="${X(ts(t))}" y="${H-6}" text-anchor="middle">${fmtD(t).split(" ").slice(1).join(" ")}</text>`});
  series.forEach(se=>{
    let d="",pen=false;
    se.pts.forEach(([t,v])=>{if(v==null){pen=false;return}d+=(pen?"L":"M")+X(ts(t)).toFixed(1)+" "+Y(v).toFixed(1);pen=true});
    s+=`<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.w||2}" ${se.dash?`stroke-dasharray="${se.dash}"`:""} stroke-linejoin="round" stroke-linecap="round" opacity="${se.op||1}"/>`;
    if(se.dots)se.pts.forEach(([t,v])=>{if(v!=null)s+=`<circle cx="${X(ts(t))}" cy="${Y(v)}" r="${se.r||3}" fill="${se.color}"/>`});
    if(se.end){const p=se.pts.filter(p=>p[1]!=null).at(-1);s+=`<circle cx="${X(ts(p[0]))}" cy="${Y(p[1])}" r="4.5" fill="${se.color}" stroke="var(--surface)" stroke-width="2"/><text x="${X(ts(p[0]))-8}" y="${Y(p[1])-10}" text-anchor="end" style="fill:var(--fg);font-weight:600">${nf(p[1],se.endDec??0)}${unit}</text>`}
  });
  el.innerHTML=s+"</svg>";
}
function ma7(idx){return G.map((r,i)=>{const w=G.slice(Math.max(0,i-6),i+1).map(x=>x[idx]).filter(v=>v!=null);return [r[0],w.length>=3?w.reduce((a,b)=>a+b,0)/w.length:null]})}
let range=90;
function renderProgreso(){
  const sub=G.slice(-range), x0=ts(sub[0][0]), x1=ts(sub.at(-1)[0]);
  const xt=[];{const d=new Date(sub[0][0]+"T12:00:00");d.setDate(1);for(let k=0;k<5;k++){d.setMonth(d.getMonth()+1);const iso=d.toLocaleDateString("sv-SE");if(ts(iso)<=x1)xt.push(iso)}}
  lineChart($("chHrv"),{x0,x1,yMin:35,yMax:80,yTicks:[40,50,60,70,80],band:[BASE.low,BASE.high],xTicks:xt,
    series:[{pts:sub.map(r=>[r[0],r[2]]),color:"var(--muted)",w:1.2,op:.7},{pts:ma7(2).slice(-range),color:"var(--accent)",w:2.6,end:true}]});
  lineChart($("chRhr"),{x0,x1,yMin:38,yMax:52,yTicks:[40,45,50],h:170,xTicks:xt,unit:"",
    series:[{pts:sub.map(r=>[r[0],r[1]]),color:"var(--muted)",w:1.2,op:.7},{pts:ma7(1).slice(-range),color:"var(--accent)",w:2.4,end:true}]});
  lineChart($("chSleep"),{x0,x1,yMin:3,yMax:10,yTicks:[4,6,8,10],h:170,xTicks:xt,unit:" h",
    series:[{pts:sub.map(r=>[r[0],r[6]]),color:"var(--muted)",w:1.2,op:.7},{pts:ma7(6).slice(-range),color:"var(--accent)",w:2.4,end:true,endDec:1}]});
  // Peso: pesadas reales + línea objetivo
  lineChart($("chWeight"),{x0:ts(W.length?(W[0][0]<"2026-11-20"?"2026-11-20":W[0][0]):"2026-11-20"),x1:ts("2027-02-28"),yMin:66,yMax:72.5,yTicks:[66,67,68,69,70,71,72],xTicks:["2026-12-01","2027-01-01","2027-02-01","2027-02-28"],unit:"",
    series:[{pts:[["2026-12-01",71.4],["2027-02-28",67]],color:"var(--muted)",w:1.6,dash:"5 5"},{pts:W.filter(w=>w[0]>="2026-11-20"),color:"var(--accent)",w:2,dots:true,end:true,endDec:2}]});
}
$("rangeSeg").querySelectorAll("button").forEach(b=>b.onclick=()=>{range=+b.dataset.r;$("rangeSeg").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderProgreso()});

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
const BLOCKS=[["A",["rodilla","traccion"]],["B",["bisagra","empuje"]],["C",["unilateral","core"]]];
const state={place:"casa",dur:40,type:"normal",seed:0,pick:{}};
const kitState={casa:Object.fromEntries(KIT.casa.map(k=>[k[0],k[2]])),gym:Object.fromEntries(KIT.gym.map(k=>[k[0],k[2]]))};
function renderKit(){
  $("kit").innerHTML=KIT[state.place].map(([id,label])=>`<label><input type="checkbox" id="kit-${state.place}-${id}" data-k="${id}" ${kitState[state.place][id]?"checked":""}>${label}</label>`).join("");
  $("kit").querySelectorAll("input").forEach(i=>i.onchange=()=>{kitState[state.place][i.dataset.k]=i.checked;state.pick={};generate()});
}
function options(pattern){return LIB[pattern][state.place].filter(([,need])=>!need||kitState[state.place][need])}
function syncSeg(){
  [["placeSeg","p",state.place],["durSeg","d",String(state.dur)],["typeSeg","t",state.type]].forEach(([id,k,v])=>$(id).querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset[k]===v)));
  renderKit();
}
function generate(){
  const rec=recovery();
  const deload=state.type==="descarga";
  let sets=deload?2:3; if(rec.lvl==="bad")sets=Math.max(2,sets-1);
  const blocks=state.dur===25?BLOCKS.slice(0,2):BLOCKS;
  const reps=state.place==="casa"?"10–15":(state.dur===55?"8–12":"6–10");
  const rest=state.dur===25?"60 s":"75–90 s";
  let html=`<div class="row" style="justify-content:space-between"><h2>${state.place==="casa"?"Fuerza en casa":"Fuerza en el gimnasio"} · ${state.dur}′</h2><span class="pill ${rec.lvl}"><span class="dot"></span>${deload?"Descarga":"Semana normal"}</span></div>
  <div class="sub">Calentamiento 5′: movilidad de cadera y hombro y una serie ligera del primer ejercicio. ${sets} series, ${reps} repeticiones dejando 2 en recámara${deload?", carga −20 %":""}. Descanso ${rest} entre superseries.</div>`;
  let idx=0;
  blocks.forEach(([tag,pats])=>{
    pats.forEach((p,j)=>{
      const i=idx++;
      const opts=options(p); const key=tag+p;
      if(state.pick[key]==null)state.pick[key]=(state.seed+j)%Math.max(1,opts.length);
      const ex=opts[state.pick[key]%Math.max(1,opts.length)];
      const isCore=p==="core";
      html+=`<div class="ex"><span class="tag">${tag}${j+1}</span><div><div class="name">${ex?ex[0]:"Sin material para este patrón"}</div><div class="sub">${sets} × ${isCore?"30–40 s":p==="unilateral"?"8–10 por lado":reps}${ex&&!isCore?(state.place==="casa"?" · si completas todo al tope, la próxima vez más lento o variante más difícil":" · si completas todo al tope, +2,5 kg la próxima vez"):""}</div></div>${opts.length>1?`<button class="swap" data-k="${key}">Cambiar</button>`:"<span></span>"}${ex?logRow(i,ex[0],isCore,deload):""}</div>`;
    });
  });
  html+=`<div class="sub" style="border-top:1px solid var(--line);padding-top:10px">Vuelta a la calma 3′.</div><div class="row"><button class="btn" id="saveBtn">Guardar como hecha</button><span class="sub" id="saveNote">Apunta los kilos y las repeticiones de la última serie de cada ejercicio.</span></div>`;
  state.current=blocks.flatMap(([tag,pats])=>pats.map((p,j)=>{const o=options(p);const ex=o[state.pick[tag+p]%Math.max(1,o.length)];return {tag:tag+(j+1),pattern:p,name:ex?ex[0]:null,sets,reps:p==="core"?"30–40 s":p==="unilateral"?"8–10 por lado":reps}}));
  state.sets=sets;
  $("workout").innerHTML=html;
  $("workout").querySelectorAll(".swap").forEach(b=>b.onclick=()=>{state.pick[b.dataset.k]++;generate()});
  $("genNote").textContent=rec.lvl==="bad"?"Recuperación baja: una serie menos.":"";
  $("saveBtn").onclick=saveSession; lastSaved=null;
}
[["placeSeg","p","place"],["durSeg","d","dur"],["typeSeg","t","type"]].forEach(([id,k,f])=>$(id).querySelectorAll("button").forEach(b=>b.onclick=()=>{state[f]=f==="dur"?+b.dataset[k]:b.dataset[k];state.pick={};syncSeg();generate()}));
$("genBtn").onclick=()=>{state.seed++;state.pick={};generate()};

// ---- Informes (web.v_reports)
let rSel=0;
const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const md=t=>esc(t).replace(/\*([^*\n]+)\*/g,"<strong>$1</strong>").replace(/_([^_\n]+)_/g,"<em>$1</em>").replace(/\n/g,"<br>");
function renderInformes(){
  if(!R.length){$("rlist").innerHTML='<div class="sub">Todavía no hay informes. El primero llegará el domingo a las 20:00.</div>';$("report").hidden=true;return}
  $("report").hidden=false;
  $("rlist").innerHTML=R.map((r,i)=>`<button data-i="${i}" aria-pressed="${i===rSel}"><span><strong>Semana del ${fmtD(r.week_start)}</strong></span><span class="sub">${(r.alerts||[]).length?`<span class="pill warn">${r.alerts.length} aviso${r.alerts.length>1?"s":""}</span>`:'<span class="pill ok">sin avisos</span>'}</span></button>`).join("");
  $("rlist").querySelectorAll("button").forEach(b=>b.onclick=()=>{rSel=+b.dataset.i;renderInformes()});
  const r=R[rSel];
  $("report").innerHTML=`<h2>Semana ${fmtD(r.week_start)} – ${fmtD(r.week_end)}</h2><p>${md(r.summary_md)}</p>${(r.alerts||[]).map(a=>`<p><span class="pill warn">Aviso</span> ${esc(a)}</p>`).join("")}`;
}

// ---- Navegación
const TITLES={hoy:"Hoy",progreso:"Progreso",fuerza:"Fuerza",informes:"Informes"};
function show(v){
  ["hoy","progreso","fuerza","informes"].forEach(x=>$("v-"+x).hidden=x!==v);
  document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-selected",t.dataset.v===v));
  $("viewTitle").textContent=TITLES[v];
  document.querySelector("header.top .row").style.visibility=v==="hoy"?"visible":"hidden";
  if(v==="progreso")renderProgreso();
}
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>show(t.dataset.v));


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
  return [STEP_LABEL[st.type]||"",`${st.duration_min}′`,tgt,st.note?`(${st.note})`:""].filter(Boolean).join(" ").replace(/^./,c=>c.toUpperCase());
}
function mapSession(row){
  const d=row.data||{};
  const steps=(d.steps||[]);
  const trivial=steps.length===1&&!steps[0].target&&!steps[0].note;
  return {h:d.start_local||"",sport:SPORT_MAP[row.sport]||row.sport,name:d.name||row.sport,min:d.duration_min||0,
    key:(d.tags||[]).includes("key"),desc:d.description||"",steps:trivial?[]:steps.map(stepText),id:row.id};
}
async function loadData(){
  const since=new Date();since.setDate(since.getDate()-120);
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
  G=rec.data.map(r=>[r.calendar_date,r.rhr,r.hrv,r.hrv_week,r.hrv_status,r.sleep_score,r.sleep_h==null?null:+r.sleep_h,r.body_battery,null,r.vigorous_min]);
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
  try{const act=await sb.from("v_activities").select("activity_date,sport,name,duration_min");
    if(!act.error){ACT_OK=true;act.data.forEach(a=>(A[a.activity_date]=A[a.activity_date]||[]).push(a))}}catch(e){}
  H={};str.data.forEach(r=>(r.exercises||[]).forEach(e=>{if(e.name&&e.load_kg!=null)H[e.name]={date:r.session_date,load_kg:+e.load_kg,reps_done:e.reps_done,top:!!e.top}}));
  if(ftp.data.length)FTP=ftp.data.at(-1).ftp_watts;
  $("ftpNow").innerHTML=`${FTP}<span class="unit">W</span>`;
  const done=ftp.data.filter(t=>t.test_date>="2026-12-01").length;
  $("ftpTests").textContent=`${done}/2`;
  $("ftpNext").textContent=done===0?"Próximo test 1 dic":done===1?"Próximo test 9 feb":"Tests completados";
}
function avg7(){
  const t=ts(W.at(-1)[0]);const w=W.filter(x=>ts(x[0])>t-7*864e5).map(x=>x[1]);
  return w.reduce((a,b)=>a+b,0)/w.length;
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
  const last=sg?`Última vez (${fmtD(sg.h.date)}): ${nf(sg.h.load_kg,1)} kg × ${sg.h.reps_done??"?"}${sg.h.top?" al tope":""} · hoy ${nf(sg.kg,1)} kg (${sg.why})`:"Primera vez: elige una carga con la que te sobren 2 repeticiones";
  const inp='style="width:72px;font:inherit;padding:6px 8px;border-radius:7px;border:1px solid var(--line);background:var(--bg);color:var(--fg)"';
  return `<div style="grid-column:2/4;display:flex;flex-direction:column;gap:6px"><div class="sub">${isCore?"Opcional: lastre en kg":last}</div>
   <div class="row" style="gap:8px"><input id="kg-${i}" type="number" inputmode="decimal" step="0.5" min="0" placeholder="kg" aria-label="Kilos" value="${sg?sg.kg:""}" ${inp}>
   <input id="reps-${i}" type="number" inputmode="numeric" min="0" placeholder="reps" aria-label="Repeticiones de la última serie" ${inp}>
   <label class="sub" style="display:inline-flex;gap:6px;align-items:center"><input id="top-${i}" type="checkbox">todas las series al tope</label></div></div>`;
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
  }catch(e){$("status").textContent="Error al cargar datos: "+(e.message||e)}
  setupDays();renderHoy();renderPlanEnd();renderWeek();syncSeg();generate();renderInformes();
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
