(function(window){
'use strict';
const num=(v,d=0)=>{if(v===undefined||v===null||v==='')return d;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:d;};
function inspect(pages){
 const issues=[],add=(object,page,code,message)=>issues.push({severity:'warning',code,path:page.data.name+' / '+(object.name||object.type),message,objectName:object.name,pageIndex:pages.indexOf(page)});
 for(const page of pages){
  if(page.type!=='report')continue;
  const width=(num(page.data.paperWidth,210)-num(page.data.leftMargin,10)-num(page.data.rightMargin,10))*96/25.4;
  const height=(num(page.data.paperHeight,297)-num(page.data.topMargin,10)-num(page.data.bottomMargin,10))*96/25.4;
  for(const band of page.data.bands||[]){
   const objects=(band.components||[]).filter(o=>o.visible!==false&&o.printable!==false).sort((a,b)=>num(a.left)-num(b.left));
   const rect=o=>({x:num(o.left),y:num(o.top),w:num(o.width),h:num(o.height)});
   for(const o of objects){
    const r=rect(o),absoluteY=num(band.top)+r.y;
    if(r.x<0||r.y<0||(!page.data.endlessWidth&&r.x+r.w>width+0.5)||(!page.data.endlessHeight&&absoluteY+r.h>height+0.5))add(o,page,'outside-page','Nesne yazdırılabilir sayfa alanının dışına taşıyor.');
    if(r.y+r.h>num(band.height)+0.5&&band.type!=='TfrxPageContent')add(o,page,'outside-band','Nesne bandın alt sınırını aşıyor; bant yüksekliğini kontrol edin.');
    const mask=num(o.frameTyp),a=o._appearance||{};
    if(mask<0||mask>15||!Number.isInteger(mask))add(o,page,'invalid-frame-mask','Çerçeve kenar seçimi geçersiz.');
    for(const [key,value] of [['Frame.Width',o.frameWidth],...['Left','Right','Top','Bottom'].map(s=>['Frame.'+s+'Line.Width',a['Frame.'+s+'Line.Width']])]){
     if(value===undefined||value==='')continue;
     const n=Number(String(value).replace(',','.'));
     if(!Number.isFinite(n)||n<0)add(o,page,'invalid-frame',key+' sıfır veya pozitif bir sayı olmalı.');
     else if(mask&&n*2>Math.min(r.w,r.h))add(o,page,'oversized-frame',key+' nesnenin iç alanına göre çok kalın.');
    }
    if(mask&&o.frameStyle==='fsDouble'&&num(o.frameWidth,1)<2)add(o,page,'double-frame-thin','Çift çizgili çerçeve çok ince; bazı dışa aktarmalarda tek çizgi görünebilir.');
    if(o.type==='TfrxTableObject'&&o._table?.reason)add(o,page,'table-structure',o._table.reason);
   }
   // Containment commonly represents a deliberate background; only partial overlaps are reported.
   for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++){
    const a=objects[i],b=objects[j];if(num(b.left)>=num(a.left)+num(a.width)-0.5)break;if(/LineView/.test(a.type)||/LineView/.test(b.type))continue;
    const x=rect(a),y=rect(b),iw=Math.min(x.x+x.w,y.x+y.w)-Math.max(x.x,y.x),ih=Math.min(x.y+x.h,y.y+y.h)-Math.max(x.y,y.y);
    if(iw<=0.5||ih<=0.5)continue;
    const contains=(a,b)=>a.x<=b.x&&a.y<=b.y&&a.x+a.w>=b.x+b.w&&a.y+a.h>=b.y+b.h;
    const equal=Math.abs(x.x-y.x)<0.5&&Math.abs(x.y-y.y)<0.5&&Math.abs(x.w-y.w)<0.5&&Math.abs(x.h-y.h)<0.5;
    if(!equal&&(contains(x,y)||contains(y,x)))continue;
    add(a,page,'overlap','“'+(a.name||a.type)+'” ile “'+(b.name||b.type)+'” çakışıyor. Excel/HTML yerleşimini kontrol edin.');
    if(issues.length>=500){issues.push({severity:'warning',code:'diagnostic-limit',path:page.data.name,message:'İlk 500 tasarım sorunu gösteriliyor. Düzeltmelerden sonra yeniden denetleyin.'});return issues;}
   }
  }
 }
 return issues;
}
window.FrpDesignValidator={inspect};
})(window);

