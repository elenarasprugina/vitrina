// Жёлтое Солнце: как получена разметка кирпичей по умолчанию (zones в data/journeys.json). Запуск: node docs/yellow-sun-zones.js
// Кольца плит измерены по картинкам: [R, центр x, центр y, полуось x, полуось y спереди, сзади] в пикселях; R 3 → 1 — внешнее → внутреннее.
// Путь: от входа слева (θ0) по часовой стрелке два оборота, R меняется на стыках витков спереди справа. Дальше её правки — в панели.
// Генератор разметки по умолчанию: 25 точек пути (x, y, толщина) в долях картинки + центр.
function make(cfg){
  const rings=cfg.rings.slice().sort((a,b)=>a[0]-b[0]);
  function lerp(arr,x){ for(let i=0;i<arr.length-1;i++){const a=arr[i],b=arr[i+1]; if(x<=b[0]||i===arr.length-2){const t=(x-a[0])/(b[0]-a[0]); return a.map((v,k)=>v+(b[k]-v)*t);} } }
  function P(th,R){ const g=lerp(rings,R); const a=th*Math.PI/180; const ay=Math.cos(a)>0?g[4]:g[5]; return [g[1]-g[3]*Math.sin(a), g[2]+ay*Math.cos(a)]; }
  const Rof=th=>lerp(cfg.Rpts,th)[1];
  const pts=[];
  for(let k=0;k<=24;k++){
    const th=cfg.th0+(cfg.th1-cfg.th0)*k/24, R=Rof(th), p=P(th,R);
    const a=P(th,R+cfg.h), b=P(th,R-cfg.h); const w=Math.hypot(a[0]-b[0],a[1]-b[1]);
    pts.push([+(p[0]/cfg.W).toFixed(4), +(p[1]/cfg.H).toFixed(4), +(w/cfg.W).toFixed(4)]);
  }
  const c=cfg.center; return { path: pts, center: { x:+(c[0]/cfg.W).toFixed(4), y:+(c[1]/cfg.H).toFixed(4), rx:+(c[2]/cfg.W).toFixed(4), ry:+(c[3]/cfg.H).toFixed(4) } };
}
const Rpts=[[0,3],[290,3],[340,2],[650,2],[700,1],[800,1]];
const out={
 desktop: make({W:1672,H:941,th0:12,th1:732,h:0.26,Rpts,rings:[[1,815,398,178,52,54],[2,818,420,372,88,92],[3,815,455,650,160,157]],center:[788,398,98,32]}),
 mobile: make({W:941,H:1672,th0:13,th1:733,h:0.26,Rpts,rings:[[1,460,910,140,48,48],[2,465,922,245,78,82],[3,465,950,385,135,138]],center:[457,905,68,22]})
};
console.log(JSON.stringify(out));
