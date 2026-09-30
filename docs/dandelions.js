// Эскизы одуванчиков для значков обложки (утверждены ею 30.09.2026) — перенести в vitrina.js во втором заходе.
// А logoD() — копия из логотипа; Б thin('line', 1.5) — прямой, тонкий; В thin('wave', 1.5, mirror) — на изгибе (+ зеркально).
// У Б и В стебель чуть толще лучей (1.1·k против 0.7·k). Запуск: node docs/dandelions.js out.html — страница сравнения.
function xy(x,y){return x.toFixed(2)+' '+y.toFixed(2);}
function dot(x,y,k){return 'M'+xy(x-k,y)+'a'+k+' '+k+' 0 1 0 '+2*k+' 0a'+k+' '+k+' 0 1 0 '+(-2*k)+' 0';}
// A: точная копия из логотипа — клиновидные лучи, кисточки из трёх точек, стебель с зазором
function logoD(){
  var C=[50,42],R=34,w='',t='',d='';
  for(var i=0;i<12;i++){var a=(15+30*i)*Math.PI/180,s=Math.sin(a),c=Math.cos(a),px=c,py=s; // перпендикуляр
    var ex=C[0]+s*R,ey=C[1]-c*R;
    w+='M'+xy(C[0]+px*1.25,C[1]+py*1.25)+'L'+xy(ex+px*.8,ey+py*.8)+'L'+xy(ex-px*.8,ey-py*.8)+'L'+xy(C[0]-px*1.25,C[1]-py*1.25)+'Z';
    [[0,3.4],[-0.95,3.1],[0.95,3.1]].forEach(function(q){var qx=ex+Math.sin(a+q[0])*q[1],qy=ey-Math.cos(a+q[0])*q[1];t+='M'+xy(ex,ey)+'L'+xy(qx,qy);d+=dot(qx,qy,1.3);});
  }
  return '<svg viewBox="0 0 100 124"><path fill="currentColor" d="'+w+'"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width=".8" d="'+t+'"/><path fill="currentColor" d="'+d+'"/><circle cx="50" cy="42" r="4.6" fill="currentColor"/><rect x="47" y="69" width="6" height="53" fill="currentColor"/></svg>';
}
// B и C: в стиле её рисунка — тонкие лучи, вилочка из трёх веточек; стебель прямой или волной (mirror — зеркально)
function thin(stem,k,mirror){
  var C=[50,40],r='',t='',d='';
  for(var i=0;i<12;i++){var a=(15+30*i)*Math.PI/180,s=Math.sin(a),c=Math.cos(a),F=24;
    var fx=C[0]+s*F,fy=C[1]-c*F; r+='M'+xy(C[0]+s*3.2,C[1]-c*3.2)+'L'+xy(fx,fy);
    [[0,9.6],[-0.45,5.3],[0.45,5.3]].forEach(function(q){var ex=fx+Math.sin(a+q[0])*q[1],ey=fy-Math.cos(a+q[0])*q[1];t+='M'+xy(fx,fy)+'L'+xy(ex,ey);d+=dot(ex,ey,1.2*k+.1);});
  }
  var st=stem==='wave'?'M50 43.2C50.9 56 51.2 66 49.4 80C47.6 93 47.3 102 48.4 109C49.2 113.5 50.3 116 51.8 118.2':'M50 43.2V118.2';
  return '<svg viewBox="0 0 100 122"'+(mirror?' style="transform:scaleX(-1)"':'')+'><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="'+(.7*k)+'" d="'+r+'"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="'+(.55*k)+'" d="'+t+'"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="'+(1.1*k)+'" d="'+st+'"/><path fill="currentColor" d="'+d+'"/><circle cx="50" cy="40" r="'+(3.6+.5*(k-1))+'" fill="currentColor"/></svg>';
}
var items=[['А. Точная копия из логотипа',logoD()],['Б. Прямой, в стиле вашего рисунка',thin('line',1.5)],['В. На изгибе, потолще',thin('wave',1.5)],['В. Зеркально',thin('wave',1.5,true)]];
var html='<html><body style="margin:0;font:15px sans-serif;padding:20px;background:#fff"><div style="display:grid;grid-template-columns:repeat(4,220px);gap:24px;color:#111">'+
items.map(function(x){return '<div>'+x[1].replace('<svg','<svg width="220"')+'<p>'+x[0]+'</p></div>';}).join('')+'</div>'+
'<div style="margin-top:14px;display:grid;grid-template-columns:repeat(4,220px);gap:24px;background:#17120c;padding:20px 0;border-radius:14px;color:#ecd3a3">'+
items.map(function(x){return '<div style="display:flex;gap:18px;align-items:end;justify-content:center">'+[80,50,30].map(function(w){return '<div style="width:'+w+'px">'+x[1]+'</div>';}).join('')+'</div>';}).join('')+'</div></body></html>';
if (process.argv[2]) require('fs').writeFileSync(process.argv[2],html);
