(function(window){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
const styles=['fsSolid','fsDash','fsDot','fsDashDot','fsDashDotDot','fsDouble','fsAltDot','fsSquare'];
const brushes=['bsSolid','bsClear','bsHorizontal','bsVertical','bsFDiagonal','bsBDiagonal','bsCross','bsDiagCross'];
const gradients=['gsHorizontal','gsVertical','gsElliptic','gsRectangle','gsVertCenter','gsHorizCenter'];
const field=(key,label,type='text',fallback='',options)=>({key,label,type,fallback,options});
function fields(kind,highlight=false){
 if(kind==='Font')return [field('Font.Name','Yazı tipi','text','Arial'),field('Font.Height','Yükseklik (piksel; normalde negatif)','number',-11),field('Font.Charset','Karakter kümesi','number',1),field('Font.Color','Yazı rengi','color','0'),field('Font.Style','Stil','fontmask',0)];
 if(kind==='Frame')return [field('Frame.Typ','Kenarlar','framemask',0),field('Frame.Color','Renk','color','0'),field('Frame.Width','Kalınlık','positive',1),field('Frame.Style','Çizgi','select','fsSolid',styles),field('Frame.DropShadow','Gölge','check','False'),field('Frame.ShadowColor','Gölge rengi','color','0'),field('Frame.ShadowWidth','Gölge genişliği','positive',4),...['Left','Right','Top','Bottom'].flatMap((side,i)=>[field('Frame.'+side+'Line.Color',['Sol','Sağ','Üst','Alt'][i]+' renk','color',''),field('Frame.'+side+'Line.Width',['Sol','Sağ','Üst','Alt'][i]+' kalınlık','optionalnumber',''),field('Frame.'+side+'Line.Style',['Sol','Sağ','Üst','Alt'][i]+' çizgi','select','',['',...styles])])];
 if(kind==='Fill')return [field('FillType','Dolgu türü','select','ftBrush',['ftBrush','ftGradient','ftGlass']),field('Fill.BackColor','Arka plan','color','clNone'),field('Fill.ForeColor','Tarama rengi','color','0'),field('Fill.Style','Tarama','select','bsSolid',brushes),field('Fill.StartColor','Geçiş başlangıcı','color','16777215'),field('Fill.EndColor','Geçiş sonu','color','0'),field('Fill.GradientStyle','Geçiş yönü','select','gsHorizontal',gradients),field('Fill.Color','Cam rengi','color','16777215'),field('Fill.Blend','Cam karışımı (0–1)','blend',0.2),field('Fill.Hatch','Cam taraması','check','False'),field('Fill.Orientation','Cam yönü','select','foHorizontal',['foVertical','foHorizontal','foVerticalMirror','foHorizontalMirror'])];
 if(kind==='DisplayFormat')return [field('DisplayFormat.Kind','Biçim türü','select','fkText',['fkText','fkNumeric','fkDateTime','fkBoolean']),field('DisplayFormat.FormatStr','Biçim ifadesi'),field('DisplayFormat.DecimalSeparator','Ondalık ayırıcı'),field('DisplayFormat.ThousandSeparator','Binlik ayırıcı')];
 if(kind==='Hyperlink')return [field('Hyperlink.Kind','Bağlantı türü','select','hkURL',['hkURL','hkAnchor','hkPageNumber','hkDetailReport','hkDetailPage','hkCustom']),field('Hyperlink.Value','Sabit değer'),field('Hyperlink.Expression','Değer ifadesi','expression'),field('Hyperlink.DetailReport','Detay raporu dosyası'),field('Hyperlink.DetailPage','Detay rapor sayfası'),field('Hyperlink.ReportVariable','Aktarılacak değişken'),field('Hyperlink.ValuesSeparator','Değer ayırıcı','text',';'),field('Hyperlink.TabCaption','Sekme başlığı')];
 if(kind==='Highlight')return [field('Condition','Koşul (ör. Value < 0)','expression'),field('ApplyFont','Yazı tipini uygula','check','True'),field('ApplyFill','Dolguyu uygula','check','True'),field('ApplyFrame','Çerçeveyi uygula','check','False'),field('Visible','Koşul sağlandığında görünür','check','True'),...fields('Font',true),...fields('Fill',true),...fields('Frame',true)];
 return [];
}
const labels={Font:'Yazı tipi',Frame:'Çerçeve',Fill:'Dolgu',DisplayFormat:'Görüntüleme biçimi',Hyperlink:'Bağlantı',Highlight:'Koşullu biçimlendirme'};
function mask(value,names){
 if(/^\d+$/.test(String(value)))return Number(value);
 return names.reduce((n,name,i)=>n+(String(value).includes(name)?1<<i:0),0);
}
function background(a,color){
 if(a.FillType==='ftGradient'){
  const s=color(a['Fill.StartColor']??'16777215'),e=color(a['Fill.EndColor']??'0'),g=a['Fill.GradientStyle'];
  if(g==='gsElliptic'||g==='gsRectangle')return 'radial-gradient('+s+','+e+')';
  if(g==='gsVertCenter'||g==='gsHorizCenter')return 'linear-gradient('+(g==='gsVertCenter'?'to bottom':'to right')+','+e+','+s+','+e+')';
  return 'linear-gradient('+(g==='gsVertical'?'to bottom':'to right')+','+s+','+e+')';
 }
 if(a.FillType==='ftGlass')return color(a['Fill.Color']??'16777215');
 if(a['Fill.Style']==='bsClear')return 'transparent';
 const back=color(a['Fill.BackColor']??a.Color??'clNone'),fore=color(a['Fill.ForeColor']??'0');
 const b=a['Fill.Style'];
 const stripe=angle=>'repeating-linear-gradient('+angle+'deg,transparent 0 5px,'+fore+' 5px 6px)';
 if(b==='bsHorizontal')return stripe(0)+','+back;
 if(b==='bsVertical')return stripe(90)+','+back;
 if(b==='bsFDiagonal')return stripe(45)+','+back;
 if(b==='bsBDiagonal')return stripe(-45)+','+back;
 if(b==='bsCross')return stripe(0)+','+stripe(90)+','+back;
 if(b==='bsDiagCross')return stripe(45)+','+stripe(-45)+','+back;
 return back;
}
function open(options){
 const {kind,target,color,toColor,context,onApply}=options;
 const initial=clone(target._appearance||{}),draft=clone(initial),edits={};
 Object.entries(window.FrpAppearance.fields).forEach(([xml,key])=>{if(target[key]!==undefined)draft[xml]=String(target[key]);});
 if(target.fontSize)draft['Font.Height']=String(-Math.abs(target.fontSize));
 const highlights=clone(target._highlights||{rules:[],collection:false,reason:''});
 let selected=highlights.rules.length?0:-1;
 const previous=document.activeElement,d=document.createElement('dialog');
 d.className='fr-property-dialog';d.setAttribute('aria-label',labels[kind]);
 d.innerHTML='<header><strong>'+esc(labels[kind]+' · '+(target.name||''))+'</strong><button type="button" data-close aria-label="Kapat">×</button></header>'+
 (kind==='Highlight'?'<div class="fr-property-rules"><select size="5" aria-label="Koşullar" data-rules></select><div><button data-add>Ekle</button><button data-remove>Sil</button><button data-up>Yukarı</button><button data-down>Aşağı</button></div></div>':'')+
 '<div class="fr-property-body"><div data-fields class="fr-property-fields"></div><aside><div data-preview class="fr-property-preview">Örnek AaBb 123</div><p data-note></p></aside></div><p data-error role="alert"></p><footer><button data-cancel>İptal</button><button data-apply>Uygula</button></footer>';
 document.body.appendChild(d);
 const close=()=>d.close();d.querySelector('[data-close]').onclick=close;d.querySelector('[data-cancel]').onclick=close;
 d.addEventListener('close',()=>{d.remove();if(previous?.isConnected)previous.focus();},{once:true});
 d.addEventListener('keydown',e=>e.stopPropagation());
 const value=()=>kind==='Highlight'?(highlights.rules[selected]?.attrs||{}):draft;
 function set(key,val){value()[key]=val;if(kind==='Highlight'&&key==='Fill.BackColor'&&value().Color!==undefined)value().Color=val;if(kind!=='Highlight')edits[key]=val;preview();}
 function preview(){
  const a=value(),p=d.querySelector('[data-preview]');
  p.removeAttribute('style');
  p.style.background=background(a,color);p.style.color=color(a['Font.Color']??'0');
  p.style.fontFamily=a['Font.Name']||'Arial';p.style.fontSize=Math.max(6,Math.min(48,Math.abs(Number(a['Font.Height']||-14))))+'px';
  const fm=mask(a['Font.Style']||0,['fsBold','fsItalic','fsUnderline','fsStrikeOut']);
  p.style.fontWeight=fm&1?'bold':'normal';p.style.fontStyle=fm&2?'italic':'normal';p.style.textDecoration=[fm&4?'underline':'',fm&8?'line-through':''].filter(Boolean).join(' ');
  const bm=mask(a['Frame.Typ']||0,['ftLeft','ftRight','ftTop','ftBottom']);
  ['Left','Right','Top','Bottom'].forEach((side,i)=>{
   const style=a['Frame.'+side+'Line.Style']||a['Frame.Style']||'fsSolid';
   p.style['border'+side]=(bm&(1<<i))?Math.max(0,Math.min(12,Number(a['Frame.'+side+'Line.Width']||a['Frame.Width']||1)))+'px '+(style==='fsDouble'?'double':style==='fsDot'||style==='fsAltDot'?'dotted':style==='fsSolid'?'solid':'dashed')+' '+color(a['Frame.'+side+'Line.Color']||a['Frame.Color']||'0'):'none';
  });
  if(a['Frame.DropShadow']==='True')p.style.boxShadow='4px 4px '+color(a['Frame.ShadowColor']||'0');
  p.style.opacity=a.Visible==='False'?'.3':'1';
  if(kind==='Highlight'){
   d.querySelector('[data-note]').textContent=highlights.reason||'Koşullar sırayla değerlendirilir; ilk eşleşen uygulanır. Bu örnek yalnızca seçili kuralın stilini gösterir; veri veya PascalScript çalıştırmaz.';
   const list=d.querySelector('[data-rules]');Array.from(list.options).forEach((o,i)=>o.textContent=(i+1)+'. '+(highlights.rules[i].attrs.Condition||'(yeni koşul)'));
  } else d.querySelector('[data-note]').textContent=kind==='DisplayFormat'?'FastReport biçimleri: sayı %2.2n, tarih dd.mm.yyyy, mantıksal Evet,Hayır. Biçim çalışma anında FastReport tarafından uygulanır.':kind==='Hyperlink'?'Sabit değer veya Expression kullanılır. hkPageNumber için değer sayfa numarasıdır. hkCustom eylemi raporun olay kodunda işlenir.':'Örnek görünüm yaklaşıktır. Boş kenar ayarları genel çerçeve ayarlarını kullanır.';
  d.querySelectorAll('[data-key]').forEach(el=>{
   const k=el.dataset.key;let enabled=true;
   if(k.startsWith('Fill.')&&kind!=='Frame'){
    const type=a.FillType||'ftBrush';
    enabled=type==='ftBrush'?['Fill.BackColor','Fill.ForeColor','Fill.Style'].includes(k):type==='ftGradient'?['Fill.StartColor','Fill.EndColor','Fill.GradientStyle'].includes(k):type==='ftGlass'?['Fill.Color','Fill.Blend','Fill.Hatch','Fill.Orientation'].includes(k):false;
   }
   el.closest('label').hidden=!enabled;
  });
 }
 function render(){
  const a=value(),host=d.querySelector('[data-fields]');
  if(kind==='Highlight'){
   const list=d.querySelector('[data-rules]');list.innerHTML=highlights.rules.map((r,i)=>'<option value="'+i+'">'+esc((i+1)+'. '+(r.attrs.Condition||'(yeni koşul)'))+'</option>').join('');list.value=String(selected);
   d.querySelectorAll('[data-remove],[data-up],[data-down]').forEach(b=>b.disabled=selected<0||!!highlights.reason);
   d.querySelector('[data-up]').disabled=selected<=0||!!highlights.reason;d.querySelector('[data-down]').disabled=selected<0||selected>=highlights.rules.length-1||!!highlights.reason;
   d.querySelector('[data-add]').disabled=!!highlights.reason;d.querySelector('[data-apply]').disabled=!!highlights.reason;
   if(selected<0){host.innerHTML='<p>Koşul eklemek için Ekle düğmesini kullanın.</p>';preview();return;}
  }
  host.innerHTML=fields(kind).map(f=>{
   const val=a[f.key]??(f.key==='Fill.BackColor'?a.Color:undefined)??f.fallback;
   let input='';
   if(f.type==='check')input='<input type="checkbox" '+(String(val).toLowerCase()==='true'?'checked':'')+'>';
   else if(f.type==='select'){const opts=[...f.options];if(!opts.includes(String(val)))opts.unshift(String(val));input='<select>'+opts.map(v=>'<option value="'+esc(v)+'" '+(String(val)===v?'selected':'')+'>'+esc(v||'Genel ayarı kullan')+'</option>').join('')+'</select>';}
   else if(f.type==='fontmask'||f.type==='framemask'){
    const names=f.type==='fontmask'?['fsBold','fsItalic','fsUnderline','fsStrikeOut']:['ftLeft','ftRight','ftTop','ftBottom'],m=mask(val,names);
    input='<span class="fr-property-mask">'+names.map((n,i)=>'<span><input type="checkbox" data-bit="'+(1<<i)+'" '+(m&(1<<i)?'checked':'')+'>'+esc(n)+'</span>').join('')+'</span>';
   }else input='<input type="'+(['number','positive','optionalnumber','blend'].includes(f.type)?'number':'text')+'" step="any" value="'+esc(val)+'">';
   if(f.type==='color')input+='<input type="color" aria-label="Renk seç" value="'+esc(/^#[a-f0-9]{6}$/i.test(color(val))?color(val):'#ffffff')+'" data-picker>';
   if(f.type==='expression')input+='<button type="button" data-expression>İfade…</button>';
   return '<label><span>'+esc(f.label)+'</span><div data-key="'+esc(f.key)+'" data-type="'+f.type+'">'+input+'</div></label>';
  }).join('');
  host.querySelectorAll('[data-key]').forEach(row=>{
   const key=row.dataset.key,type=row.dataset.type;
   row.querySelectorAll('input,select').forEach(input=>input.addEventListener('input',()=>{
    if(input.hasAttribute('data-picker')){const v=toColor(input.value);row.querySelector('input[type=text]').value=v;set(key,v);return;}
    let v=input.value;
    if(type==='check')v=input.checked?'True':'False';
    if(type==='fontmask'||type==='framemask')v=String(Array.from(row.querySelectorAll('input:checked')).reduce((n,c)=>n|Number(c.dataset.bit),0));
    if(type==='color'&&/^#[a-f0-9]{6}$/i.test(v))v=toColor(v);
    set(key,v);
   }));
   row.querySelector('[data-expression]')?.addEventListener('click',()=>window.FrpExpressionEditors?.expressionBuilder({...context,mode:'expression',value:value()[key]||'',onApply:r=>{set(key,r.value);row.querySelector('input').value=r.value;}}));
  });
  if(highlights.reason&&kind==='Highlight')host.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
  preview();
 }
 if(kind==='Highlight'){
  d.querySelector('[data-rules]').onchange=e=>{selected=Number(e.target.value);render();};
  d.querySelector('[data-add]').onclick=()=>{highlights.rules.push({attrs:{Condition:'Value < 0',ApplyFont:'True',ApplyFill:'False',ApplyFrame:'False',Visible:'True','Font.Name':target.fontName||'Arial','Font.Height':String(-Math.abs(target.fontSize||11)),'Font.Color':'255','Font.Style':'0'}});selected=highlights.rules.length-1;render();};
  d.querySelector('[data-remove]').onclick=()=>{highlights.rules.splice(selected,1);selected=Math.min(selected,highlights.rules.length-1);render();};
  for(const [attr,dir] of [['up',-1],['down',1]])d.querySelector('[data-'+attr+']').onclick=()=>{const other=selected+dir;[highlights.rules[selected],highlights.rules[other]]=[highlights.rules[other],highlights.rules[selected]];selected=other;render();};
 }
 d.querySelector('[data-apply]').onclick=()=>{
  let error='';
  const objects=kind==='Highlight'?highlights.rules.map(r=>r.attrs):[draft];
  for(const a of objects){
   if(kind==='Highlight'&&!String(a.Condition||'').trim()){error='Her koşul için bir ifade girin.';break;}
   for(const f of fields(kind)){
    const v=a[f.key];if(v===undefined)continue;
    if(['number','positive','optionalnumber','blend'].includes(f.type)){
     if(f.type==='optionalnumber'&&v==='')continue;
     const n=Number(v);
     if(String(v).trim()===''||!Number.isFinite(n)||(f.type==='positive'&&n<0)||(f.type==='optionalnumber'&&n<0)||(f.type==='blend'&&(n<0||n>1))||(f.key==='Font.Height'&&n===0)){error=f.label+': geçerli bir değer girin.';break;}
    }
    if(f.type==='expression'&&v){error=window.FrpExpressionEditors?.validate(String(v),'expression',true,'[,]')||'';if(error)break;}
    if(f.type==='color'&&((!v&&!/^Frame\.(Left|Right|Top|Bottom)Line\./.test(f.key))||(v&&!/^(?:-?\d+|cl[A-Za-z]+|\$[a-f\d]+)$/i.test(v)))){error=f.label+': renk seçiciyi veya Delphi renk değerini kullanın.';break;}
   }
   if(error)break;
  }
  if(error){d.querySelector('[data-error]').textContent=error;return;}
  // Only changed fields are committed. Cancel never touches the live model.
  if(onApply({edits,highlights:kind==='Highlight'?highlights:null})!==false)d.close();
 };
 render();d.showModal();
}
window.FrpPropertyEditors={open,background};
})(window);

