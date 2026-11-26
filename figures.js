// Infografías de ejercicios: silueta simplificada en SVG, vista lateral, mirando a la derecha.
// Cada postura se define con ángulos absolutos (0 = arriba, 90 = adelante, 180 = abajo, 270 = atrás).
// N = extremidades del lado cercano (color fuerte), F = lado lejano (color suave).
const FIG=(()=>{
  const L={torso:52,neck:7,head:9,ua:29,fa:27,th:44,sh:42,foot:13};
  const dir=a=>{const r=a*Math.PI/180;return [Math.sin(r),-Math.cos(r)]};
  const add=(p,a,l)=>{const d=dir(a);return [p[0]+d[0]*l,p[1]+d[1]*l]};
  // Posiciones de todas las articulaciones con la cadera en (0,0)
  function joints(p){
    const J={hip:[0,0]};
    J.sho=add(J.hip,p.torso,L.torso);
    J.head=add(J.sho,p.neckA??p.torso,L.neck+L.head);
    for(const s of ["N","F"]){
      const ua=p["ua"+s]??p.ua??180, fa=p["fa"+s]??p.fa??ua, th=p["th"+s]??p.th??180, sh=p["sh"+s]??p.sh??th, ft=p["ft"+s]??p.ft??90;
      J["elb"+s]=add(J.sho,ua,L.ua);J["hand"+s]=add(J["elb"+s],fa,L.fa);
      J["knee"+s]=add(J.hip,th,L.th);J["ank"+s]=add(J["knee"+s],sh,L.sh);J["toe"+s]=add(J["ank"+s],ft,L.foot);
    }
    // Colocar: el punto «at.j» de la postura va a (at.x, at.y)
    const a=J[p.at.j], dx=p.at.x-a[0], dy=p.at.y-a[1];
    for(const k in J)J[k]=[J[k][0]+dx,J[k][1]+dy];
    return J;
  }
  const f=n=>n.toFixed(1);
  const line=(a,b,c,w)=>`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const poly=(pts,c,w)=>`<polyline points="${pts.map(p=>f(p[0])+","+f(p[1])).join(" ")}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  // Material
  function load(kind,p,col){
    const [x,y]=p;
    if(kind==="kb")return `<path d="M${f(x-6)} ${f(y+2)} q0 -9 6 -9 q6 0 6 9" fill="none" stroke="${col}" stroke-width="3"/><circle cx="${f(x)}" cy="${f(y+11)}" r="9.5" fill="${col}"/>`;
    if(kind==="db")return `<rect x="${f(x-11)}" y="${f(y-2)}" width="22" height="4" rx="2" fill="${col}"/><rect x="${f(x-12)}" y="${f(y-7)}" width="7" height="14" rx="2.5" fill="${col}"/><rect x="${f(x+5)}" y="${f(y-7)}" width="7" height="14" rx="2.5" fill="${col}"/>`;
    if(kind==="bar")return `<circle cx="${f(x)}" cy="${f(y)}" r="17" fill="none" stroke="${col}" stroke-width="4"/><circle cx="${f(x)}" cy="${f(y)}" r="3" fill="${col}"/>`;
    if(kind==="cable")return `<rect x="${f(x-3)}" y="${f(y-8)}" width="6" height="16" rx="3" fill="${col}"/>`;
    if(kind==="wheel")return `<circle cx="${f(x)}" cy="${f(y+3)}" r="10" fill="none" stroke="${col}" stroke-width="4"/>`;
    return "";
  }
  function props(list,C){
    let s="";
    (list||[]).forEach(pr=>{
      if(pr.t==="floor")s+=line([pr.x0??6,pr.y],[pr.x1??194,pr.y],C.floor,2);
      if(pr.t==="bench"){const top=pr.y,flo=pr.floor;
        s+=`<rect x="${pr.x0}" y="${top}" width="${pr.x1-pr.x0}" height="7" rx="3" fill="${C.prop}"/>`+line([pr.x0+10,top+7],[pr.x0+10,flo],C.prop,4)+line([pr.x1-10,top+7],[pr.x1-10,flo],C.prop,4);}
      if(pr.t==="incline"){s+=line(pr.a,pr.b,C.prop,7)+line([pr.b[0],pr.b[1]],[pr.b[0],pr.floor],C.prop,4)+line([pr.a[0]+8,pr.a[1]+4],[pr.a[0]+8,pr.floor],C.prop,4);}
      if(pr.t==="col")s+=`<rect x="${pr.x-6}" y="${pr.y0}" width="12" height="${pr.y1-pr.y0}" rx="3" fill="${C.prop}"/>`;
      if(pr.t==="seat")s+=line([pr.x0,pr.y],[pr.x1,pr.y],C.prop,7)+line([(pr.x0+pr.x1)/2,pr.y],[(pr.x0+pr.x1)/2,pr.floor],C.prop,4);
      if(pr.t==="bar")s+=line([pr.x0,pr.y],[pr.x1,pr.y],C.prop,4);
    });
    return s;
  }
  // Dibuja una figura; ghost = postura de partida en transparente
  function figure(p,spec,C,ghost){
    const J=joints(p), W=8.5, far=ghost?C.ghostFar:C.far, near=ghost?C.ghost:C.near, eq=ghost?C.ghost:C.load;
    let s="";
    // Carga detrás del cuerpo si va en la mano lejana o es una barra (los discos quedan detrás)
    const lp=spec.load&&(spec.loadAt?J[spec.loadAt]:J.handN);
    const loadOff=spec.loadOff||[0,0];
    const lpt=lp&&[lp[0]+loadOff[0],lp[1]+loadOff[1]];
    if(lpt&&spec.load==="bar")s+=load("bar",lpt,eq);
    if(spec.cable)s+=line(spec.cable,J.handN,C.loadFar,2);
    s+=poly([J.hip,J.kneeF,J.ankF,J.toeF],far,W)+poly([J.sho,J.elbF,J.handF],far,W);
    s+=poly([J.hip,J.sho],near,W+3)+poly([J.hip,J.kneeN,J.ankN,J.toeN],near,W);
    s+=`<circle cx="${f(J.head[0])}" cy="${f(J.head[1])}" r="${L.head}" fill="${near}"/>`;
    s+=poly([J.sho,J.elbN,J.handN],near,W);
    if(lpt&&spec.load!=="bar")s+=load(spec.load,lpt,eq);
    if(spec.load2==="db"||spec.load2==="kb"){const q=J.handF;s=load(spec.load2,[q[0]+loadOff[0],q[1]+loadOff[1]],ghost?C.ghostFar:C.loadFar)+s}
    return {svg:s,J};
  }
  const COL={near:"var(--accent,#5cc4dc)",far:"#2c6a7c",ghost:"rgba(92,196,220,.22)",ghostFar:"rgba(92,196,220,.12)",load:"var(--fg,#e8eef2)",loadFar:"#8c9aa5",prop:"#3a4a57",floor:"#2a3843",arrow:"var(--warn,#f2bd5a)"};
  function arrow(a,b,C,bend=0.25){
    const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=b[0]-a[0],dy=b[1]-a[1];
    const cx=mx-dy*bend,cy=my+dx*bend;
    // Punta en la dirección final de la curva, retranqueada para no tapar la carga
    const len=Math.hypot(b[0]-cx,b[1]-cy)||1,ux=(b[0]-cx)/len,uy=(b[1]-cy)/len,e=[b[0]-ux*8,b[1]-uy*8];
    const h1=[e[0]-ux*8-uy*5,e[1]-uy*8+ux*5],h2=[e[0]-ux*8+uy*5,e[1]-uy*8-ux*5];
    return `<path d="M${f(a[0])} ${f(a[1])} Q${f(cx)} ${f(cy)} ${f(e[0])} ${f(e[1])}" fill="none" stroke="${C.arrow}" stroke-width="2.5" stroke-dasharray="5 4"/><path d="M${f(h1[0])} ${f(h1[1])} L${f(e[0])} ${f(e[1])} L${f(h2[0])} ${f(h2[1])}" fill="none" stroke="${C.arrow}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // Estilo «dos viñetas»: posición inicial | posición final
  function panels(spec,C=COL){
    const a=figure(spec.start,spec,C,false),b=figure(spec.end,spec,C,false);
    const lab=(x,t)=>`<text x="${x}" y="-4" text-anchor="middle" fill="var(--muted,#93a4b1)" font-size="11" font-family="Inter,sans-serif" letter-spacing=".06em">${t}</text>`;
    return `<svg viewBox="0 -18 400 232" role="img" aria-label="${spec.label||""}" class="fig">`+
      `<g>${lab(100,"INICIO")}${props(spec.props,C)}${a.svg}</g>`+
      `<line x1="200" y1="6" x2="200" y2="200" stroke="#1f2b35" stroke-width="1.5"/>`+
      `<g transform="translate(200 0)">${lab(100,"FINAL")}${props(spec.props,C)}${b.svg}</g></svg>`;
  }
  // Estilo «superpuesto»: inicio en transparente, final sólido y flecha del recorrido
  function overlay(spec,C=COL){
    const a=figure(spec.start,spec,C,true),b=figure(spec.end,spec,C,false);
    const t=spec.track||"handN";
    const off=spec.loadOff||[0,0],pa=[a.J[t][0]+off[0],a.J[t][1]+off[1]],pb=[b.J[t][0]+off[0],b.J[t][1]+off[1]];
    return `<svg viewBox="0 0 200 214" role="img" aria-label="${spec.label||""}" class="fig">${props(spec.props,C)}${a.svg}${b.svg}${arrow(pa,pb,C,spec.bend??0.25)}</svg>`;
  }
  return {panels,overlay,L,joints};
})();


// Posturas por ejercicio (clave = nombre exacto en LIB). Suelo en y=200; tobillo apoyado en y≈195.
const FL={t:"floor",y:200};
const sq=(x,torsoEnd,arm)=>({start:{at:{j:"ankN",x,y:195},torso:2,...arm[0],th:180,sh:180},end:{at:{j:"ankN",x,y:195},torso:torsoEnd,...arm[1],th:96,sh:203,thF:100,shF:200}});
const sides={ua:180,fa:180};
const bulg=(load)=>({label:"Sentadilla búlgara",load,load2:load,props:[FL,{t:"bench",x0:22,x1:78,y:152,floor:200}],
  start:{at:{j:"ankN",x:122,y:195},torso:4,...sides,thN:175,shN:183,thF:195,shF:275,ftF:230},
  end:{at:{j:"ankN",x:122,y:195},torso:12,...sides,thN:100,shN:195,thF:180,shF:330,ftF:250}});
const rowBench=(load,lo)=>({label:"Remo a una mano en el banco",load,loadOff:lo,props:[FL,{t:"bench",x0:40,x1:168,y:152,floor:200}],
  start:{at:{j:"hip",x:66,y:108},torso:76,uaN:180,faN:180,uaF:178,faF:178,thF:180,shF:270,ftF:200,thN:176,shN:186},
  end:{at:{j:"hip",x:66,y:108},torso:76,uaN:290,faN:182,uaF:178,faF:178,thF:180,shF:270,ftF:200,thN:176,shN:186}});
const rdl=(load,lo)=>({label:"Peso muerto rumano",load,loadOff:lo,load2:load==="bar"?null:load,props:[FL],
  start:{at:{j:"ankN",x:96,y:195},torso:2,...sides,th:180,sh:180},
  end:{at:{j:"ankN",x:96,y:195},torso:80,...sides,th:168,sh:190}});
const hipT=(load)=>({label:"Hip thrust",load,loadAt:"hip",loadOff:[0,-15],props:[FL,{t:"bench",x0:8,x1:62,y:150,floor:200}],
  start:{at:{j:"hip",x:98,y:169},torso:304,ua:205,fa:215,th:70,sh:180,...(load?{}:{thF:60,shF:80})},
  end:{at:{j:"hip",x:105,y:146},torso:277,ua:205,fa:215,th:100,sh:182,...(load?{}:{thF:100,shF:100})}});
const benchP=(load,lo,x=132)=>({label:"Press de banca",load,loadOff:lo,props:[FL,{t:"bench",x0:30,x1:148,y:136,floor:200}],
  start:{at:{j:"hip",x,y:130},torso:270,neckA:270,ua:0,fa:0,th:120,sh:180,thF:115,shF:178},
  end:{at:{j:"hip",x,y:130},torso:270,neckA:270,ua:120,fa:345,th:120,sh:180,thF:115,shF:178}});
const stepUp=(load)=>({label:"Step-up al banco",load,load2:load,props:[FL,{t:"bench",x0:100,x1:176,y:170,floor:200}],
  start:{at:{j:"ankF",x:80,y:195},torso:8,...sides,thF:180,shF:180,thN:108,shN:182},
  end:{at:{j:"ankN",x:122,y:165},torso:2,...sides,thN:180,shN:180,thF:175,shF:205}});
const lunge=(load,anchor)=>({label:"Zancada",load,load2:load,props:[FL],
  start:{at:anchor[0],torso:2,...sides,th:180,sh:180},
  end:{at:anchor[1],torso:4,...sides,thN:95,shN:185,thF:190,shF:280,ftF:170}});
const farmer=(load)=>({label:"Paseo del granjero",load,load2:load,props:[FL],
  start:{at:{j:"hip",x:78,y:112},torso:2,...sides,thN:160,shN:175,thF:200,shF:220,ftF:120},
  end:{at:{j:"hip",x:118,y:112},torso:2,...sides,thN:200,shN:220,ftN:120,thF:160,shF:175}});

const FIGS={
  "Sentadilla frontal con 2 kettlebells (24 kg)":{label:"Sentadilla frontal con kettlebells",load:"kb",load2:"kb",loadOff:[6,-6],props:[FL],...sq(96,22,[{ua:160,fa:5},{ua:178,fa:30}])},
  "Sentadilla búlgara con kettlebells, pie atrás en el banco":bulg("kb"),
  "Sentadilla goblet con kettlebell, tempo 3-1-1":{label:"Sentadilla goblet",load:"kb",loadOff:[4,-2],props:[FL],...sq(96,28,[{ua:168,fa:12},{ua:176,fa:38}])},
  "Sentadilla trasera con barra":{label:"Sentadilla trasera",load:"bar",loadAt:"sho",loadOff:[-10,0],props:[FL],...sq(96,38,[{ua:200,fa:20},{ua:215,fa:35}])},
  "Sentadilla frontal con barra":{label:"Sentadilla frontal con barra",load:"bar",loadAt:"sho",loadOff:[10,-2],props:[FL],...sq(96,14,[{ua:105,fa:300},{ua:118,fa:310}])},
  "Sentadilla búlgara con mancuernas":bulg("db"),
  "Remo con kettlebell a una mano apoyado en el banco":rowBench("kb",[0,0]),
  "Remo con 2 kettlebells con el pecho en el banco inclinado":{label:"Remo con pecho apoyado",load:"kb",load2:"kb",props:[FL,{t:"incline",a:[64,130],b:[104,100],floor:200}],
    start:{at:{j:"ankN",x:40,y:195},torso:55,...sides,th:200,sh:190},
    end:{at:{j:"ankN",x:40,y:195},torso:55,ua:290,fa:180,th:200,sh:190}},
  "Remo renegado con mancuernas":{label:"Remo renegado",load:"db",load2:"db",loadOff:[0,4],props:[FL],
    start:{at:{j:"handN",x:150,y:186},torso:67,ua:180,fa:180,th:247,sh:247,ft:170},
    end:{at:{j:"handF",x:150,y:186},torso:67,uaN:290,faN:180,uaF:180,faF:180,th:247,sh:247,ft:170}},
  "Dominadas (lastradas si haces más de 8)":{label:"Dominadas",props:[{t:"bar",x0:40,x1:170,y:22}],
    start:{at:{j:"handN",x:104,y:22},torso:0,ua:0,fa:0,th:175,sh:262,ft:180},
    end:{at:{j:"handN",x:104,y:22},torso:6,ua:195,fa:12,th:170,sh:258,ft:180}},
  "Remo con mancuerna a una mano en el banco":rowBench("db",[0,4]),
  "Remo en polea baja de pie":{label:"Remo en polea baja",load:"cable",cable:[176,150],props:[FL,{t:"col",x:182,y0:40,y1:200}],
    start:{at:{j:"ankN",x:80,y:195},torso:18,ua:118,fa:118,th:172,sh:186},
    end:{at:{j:"ankN",x:80,y:195},torso:8,ua:200,fa:95,th:172,sh:186}},
  "Swing con kettlebell":{label:"Swing",load:"kb",props:[FL],
    start:{at:{j:"ankN",x:80,y:195},torso:72,ua:212,fa:212,th:162,sh:192},
    end:{at:{j:"ankN",x:80,y:195},torso:0,ua:92,fa:92,th:180,sh:180}},
  "Peso muerto rumano a una pierna con kettlebell":{label:"Peso muerto rumano a una pierna",load:"kb",props:[FL],
    start:{at:{j:"ankN",x:110,y:195},torso:2,...sides,thN:178,shN:182,thF:192,shF:205},
    end:{at:{j:"ankN",x:110,y:195},torso:84,...sides,thN:172,shN:186,thF:268,shF:270,ftF:180}},
  "Hip thrust a una pierna con la espalda en el banco":hipT(null),
  "Peso muerto rumano con barra":rdl("bar",[0,0]),
  "Hip thrust con barra":hipT("bar"),
  "Peso muerto rumano con mancuernas":rdl("db",[0,4]),
  "Flexiones con los pies en el banco":{label:"Flexiones con pies elevados",props:[FL,{t:"bench",x0:2,x1:50,y:152,floor:200}],
    start:{at:{j:"handN",x:150,y:194},torso:85,ua:180,fa:180,th:265,sh:265,ft:160},
    end:{at:{j:"handN",x:150,y:194},torso:102,ua:300,fa:150,th:282,sh:282,ft:170}},
  "Press de banca con mancuernas de 8 kg, tempo 3-1-1":benchP("db",[0,-4]),
  "Press militar con kettlebell a una mano":{label:"Press militar",load:"kb",props:[FL],
    start:{at:{j:"ankN",x:96,y:195},torso:2,ua:165,fa:8,uaF:180,faF:180,th:180,sh:180},
    end:{at:{j:"ankN",x:96,y:195},torso:0,ua:4,fa:2,uaF:180,faF:180,th:180,sh:180}},
  "Press de banca con barra":benchP("bar",[0,-6]),
  "Press inclinado con barra":{label:"Press inclinado",load:"bar",loadOff:[0,-6],props:[FL,{t:"incline",a:[124,150],b:[62,98],floor:200},{t:"seat",x0:112,x1:150,y:152,floor:200}],
    start:{at:{j:"hip",x:122,y:144},torso:312,neckA:320,ua:10,fa:10,th:98,sh:182,thF:94,shF:178},
    end:{at:{j:"hip",x:122,y:144},torso:312,neckA:320,ua:160,fa:30,th:98,sh:182,thF:94,shF:178}},
  "Press de banca con mancuernas":benchP("db",[0,-4]),
  "Step-up al banco con kettlebells":stepUp("kb"),
  "Zancada atrás con kettlebells":lunge("kb",[{j:"ankN",x:124,y:195},{j:"ankN",x:124,y:195}]),
  "Gemelo a una pierna con mancuerna":{label:"Gemelo a una pierna",load:"db",loadOff:[0,4],props:[FL],
    start:{at:{j:"toeN",x:110,y:196},torso:0,...sides,thN:180,shN:180,ftN:90,thF:185,shF:250},
    end:{at:{j:"toeN",x:110,y:196},torso:0,...sides,thN:180,shN:180,ftN:132,thF:185,shF:250}},
  "Zancada caminando con mancuernas":lunge("db",[{j:"ankF",x:70,y:195},{j:"toeF",x:56,y:196}]),
  "Step-up al banco con mancuernas":stepUp("db"),
  "Paseo del granjero con 2 kettlebells (40 m)":farmer("kb"),
  "Dead bug":{label:"Dead bug",props:[FL],
    start:{at:{j:"hip",x:106,y:192},torso:270,neckA:270,ua:0,fa:0,th:0,sh:90,ft:0},
    end:{at:{j:"hip",x:106,y:192},torso:270,neckA:270,uaN:262,faN:262,uaF:0,faF:0,thN:0,shN:90,ftN:0,thF:84,shF:86,ftF:0}},
  "Plancha lateral":{label:"Plancha lateral",props:[FL],
    start:{at:{j:"elbN",x:150,y:192},torso:58.7,uaN:180,faN:90,uaF:160,faF:250,th:265,sh:265,ft:100},
    end:{at:{j:"elbN",x:150,y:192},torso:76.6,uaN:180,faN:90,uaF:160,faF:250,th:256.6,sh:256.6,ft:100}},
  "Pallof en polea":{label:"Pallof",load:"cable",props:[FL],
    start:{at:{j:"ankN",x:90,y:195},torso:2,ua:165,fa:15,th:176,sh:184},
    end:{at:{j:"ankN",x:90,y:195},torso:2,ua:92,fa:92,th:176,sh:184}},
  "Paseo del granjero con mancuernas pesadas":farmer("db"),
  "Rueda abdominal o plancha con toque de hombro":{label:"Rueda abdominal",load:"wheel",loadOff:[0,0],props:[FL],
    start:{at:{j:"kneeN",x:48,y:192},torso:70,ua:175,fa:175,th:170,sh:270,ft:200},
    end:{at:{j:"kneeN",x:48,y:192},torso:82,ua:118,fa:118,th:230,sh:270,ft:200}}
};
