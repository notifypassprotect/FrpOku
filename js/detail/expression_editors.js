(function(window){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
function shell(title,body){
 const previous=document.activeElement,d=document.createElement('dialog');d.className='fr-expression-dialog';
 d.innerHTML='<header><strong>'+esc(title)+'</strong><button type="button" data-close aria-label="Kapat">×</button></header>'+body;
 document.body.appendChild(d);d.querySelector('[data-close]').onclick=()=>d.close();
 d.addEventListener('close',()=>{d.remove();if(previous?.isConnected)previous.focus();},{once:true});
 d.addEventListener('keydown',e=>e.stopPropagation());d.showModal();return d;
}
function delimiters(value){const p=String(value||'[,]').split(',');return p.length===2&&p[0]&&p[1]?p:null;}
function checkCode(code){
 const stack=[];let quote='';
 for(let i=0;i<code.length;i++){
  const c=code[i];
  if(quote){if(c===quote){if(code[i+1]===quote)i++;else quote='';}continue;}
  if(c==="'"||c==='"'){quote=c;continue;}
  if(c==='('||c==='[')stack.push({c,index:i});
  if(c===')'||c===']'){const last=stack.pop();if(!last||(last.c==='('?')':']')!==c)return (i+1)+'. karakterde eşleşmeyen parantez.';}
 }
 if(quote)return 'Kapanmamış tırnak var.';
 return stack.length?(stack[stack.length-1].index+1)+'. karakterde açılan parantez kapanmamış.':'';
}
function validate(value,mode,allow,separator){
 if(mode!=='memo')return checkCode(value);
 if(!allow)return '';
 const pair=delimiters(separator);if(!pair)return 'Ayraçları açılış,kapanış biçiminde girin. Örnek: [,]';
 const [open,close]=pair;let from=0;
 while(from<value.length){
  const start=value.indexOf(open,from);if(start<0)break;
  let end=start+open.length,quote='',nested=0;
  for(;end<value.length;end++){
   const c=value[end];
   if(quote){if(c===quote){if(value[end+1]===quote)end++;else quote='';}continue;}
   if(c==="'"||c==='"'){quote=c;continue;}
   if(value.startsWith(close,end)&&nested===0)break;
   if(c==='[')nested++;else if(c===']'&&nested>0)nested--;
  }
  if(end>=value.length)return (start+1)+'. karakterde açılan ifade ayracı kapanmamış.';
  const content=value.slice(start+open.length,end);if(!content.trim())return 'Boş ifade var.';
  const error=checkCode(content);if(error)return error;
  from=end+close.length;
 }
 return '';
}
function insert(t,text){t.setRangeText(text,t.selectionStart??t.value.length,t.selectionEnd??t.value.length,'end');t.focus();t.dispatchEvent(new Event('input',{bubbles:true}));}
function expressionBuilder(o){
 const mode=o.mode||'expression';
 const d=shell(mode==='memo'?'Memo · Expression Builder':'Expression Builder',
 '<div class="fr-expression-toolbar">'+(mode==='memo'?'<label><input type="checkbox" data-allow> İfadeleri işle</label><label>Ayraçlar <input data-delimiters aria-label="İfade ayraçları" style="width:80px"></label>':'<span>Metin sabitlerini tek tırnak içine alın.</span>')+
 '<button type="button" data-wrap>Seçimi ifadeye çevir</button><button type="button" data-aggregate>Aggregate sihirbazı</button></div>'+
 '<div class="fr-expression-layout"><section class="fr-expression-main"><label>İfade / metin<textarea data-expression spellcheck="false"></textarea></label><p data-validation role="status"></p><p class="fr-expression-note">Kontrol yalnızca ayraç, tırnak ve parantez yapısını inceler. Veri tipleri ve hesaplama FastReport çalıştırılırken doğrulanır.</p>'+
 '<section data-aggregate-form hidden><h4>Aggregate</h4><div class="fr-expression-aggregate"><label>İşlem<select data-function><option>SUM</option><option>COUNT</option><option>MIN</option><option>MAX</option><option>AVG</option></select></label><label>Veri bandı<select data-band></select></label><label>İfade<input data-aggregate-expression placeholder="&lt;Query.&quot;ALAN&quot;&gt;"></label><label><input type="checkbox" data-invisible> Görünmeyen bantları dahil et</label><label><input type="checkbox" data-running> Birikimli toplam</label><code data-aggregate-preview></code><button type="button" data-add-aggregate>İfadeye ekle</button></div><small>İfadeyi ilgili veri bandının footer veya summary bandında kullanın.</small></section></section>'+
 '<aside class="fr-expression-browser"><nav role="tablist">'+['Data','Variables','Functions','Classes'].map((n,i)=>'<button type="button" role="tab" data-tab="'+n+'" aria-selected="'+(i===0)+'">'+n+'</button>').join('')+
 '</nav><input type="search" data-search placeholder="Sorgu, alan, değişken veya tür ara…" aria-label="İfade öğelerinde ara"><div data-catalog class="fr-expression-catalog"></div><div data-preview class="fr-expression-preview">Bir öğe seçin. Çift tıklayarak veya sürükleyerek ekleyin.</div><button type="button" data-insert-selected disabled>Seçileni ekle</button></aside></div>'+
 '<footer><button type="button" data-cancel>İptal</button><button type="button" data-apply>Uygula</button></footer>');
 const q=selector=>d.querySelector(selector),t=q('[data-expression]'),allow=q('[data-allow]'),sep=q('[data-delimiters]');
 t.value=o.value||'';if(allow)allow.checked=o.allowExpressions!==false;if(sep)sep.value=o.delimiters||'[,]';
 const wrap=code=>{if(mode!=='memo')return code;const p=delimiters(sep.value)||['[',']'];return p[0]+code+p[1];};
 const rows=[],collapsed=new Set();let tab='Data',selected=null;
 (o.queries||[]).forEach(query=>{
  const fields=o.getFields?o.getFields(query):[];
  fields.forEach(f=>{const v=typeof f==='string'?{name:f}:f;rows.push({tab:'Data',group:query.name,name:v.name,description:v.type||'Tür bilinmiyor',search:[query.name,query.alias,v.name,v.alias,v.type].join(' '),code:'<'+query.name+'."'+v.name+'">',memo:query.name+'."'+v.name+'"'});});
  if(!fields.length)rows.push({tab:'Data',group:query.name,name:'Alan bilgisi bulunamadı',description:'SELECT * için alan şeması gerekir.',disabled:true,search:query.name});
 });
 (o.categories||[]).forEach(c=>(c.variables||[]).forEach(v=>rows.push({tab:'Variables',group:c.name,name:v.name,description:v.expression||'İfade boş',search:c.name+' '+v.name+' '+v.expression,code:'<'+v.name+'>',memo:v.name})));
 [['Date','Tarih'],['Time','Saat'],['Page#','Sayfa numarası'],['TotalPages#','Toplam sayfa']].forEach(([name,label])=>rows.push({tab:'Variables',group:'Sistem',name,description:label,search:name+' '+label,code:'<'+name+'>',memo:name}));
 [['IIF','IIF(True, 1, 0)','Koşullu değer'],['Round','Round(0)','Yuvarlama'],['Length',"Length('')",'Metin uzunluğu'],['Uppercase',"Uppercase('')",'Büyük harf'],['Lowercase',"Lowercase('')",'Küçük harf'],['FormatFloat',"FormatFloat('0.00', 0)",'Sayı biçimi']].forEach(([name,code,description])=>rows.push({tab:'Functions',group:'Temel fonksiyonlar',name,code,memo:code,description,search:name+' '+description}));
 (o.objects||[]).forEach(object=>{const props=['Name','Left','Top','Width','Height'];if(/Memo/.test(object.type||''))props.push('Text');props.forEach(p=>rows.push({tab:'Classes',group:object.type||'Rapor nesnesi',name:object.name+'.'+p,code:object.name+'.'+p,memo:object.name+'.'+p,description:'Rapordaki nesne özelliği',search:object.name+' '+object.type+' '+p}));});
 const insertion=row=>mode==='memo'?wrap(row.memo??row.code):row.code;
 const choose=row=>{selected=row;q('[data-preview]').textContent=row.disabled?row.description:row.description+'\n'+insertion(row);q('[data-insert-selected]').disabled=!!row.disabled;if(row.tab==='Data')q('[data-aggregate-expression]').value=row.code;updateAggregate();};
 function renderCatalog(){
  const query=q('[data-search]').value.trim().toLocaleLowerCase(),filtered=rows.filter(r=>r.tab===tab&&(!query||(r.search||r.name).toLocaleLowerCase().includes(query))),groups=[...new Set(filtered.map(r=>r.group))],catalog=q('[data-catalog]');
  catalog.innerHTML=groups.length?groups.map(g=>'<details data-group="'+esc(g)+'" '+(!collapsed.has(tab+'|'+g)||query?'open':'')+'><summary>'+esc(g)+'</summary>'+filtered.filter(r=>r.group===g).map(r=>'<button type="button" data-row="'+rows.indexOf(r)+'" draggable="'+!r.disabled+'" '+(r.disabled?'disabled':'')+'><strong>'+esc(r.name)+'</strong><small>'+esc(r.description)+'</small></button>').join('')+'</details>').join(''):'<p>Sonuç yok.</p>';
  catalog.querySelectorAll('details').forEach(group=>group.addEventListener('toggle',()=>{const key=tab+'|'+group.dataset.group;group.open?collapsed.delete(key):collapsed.add(key);}));
  catalog.querySelectorAll('[data-row]').forEach(button=>{const row=rows[Number(button.dataset.row)];button.onclick=()=>choose(row);button.ondblclick=()=>insert(t,insertion(row));button.ondragstart=e=>{e.dataTransfer.setData('application/x-frp-builder',button.dataset.row);e.dataTransfer.setData('text/plain',insertion(row));e.dataTransfer.effectAllowed='copy';};});
 }
 function validateNow(){const error=validate(t.value,mode,allow?.checked!==false,sep?.value||'[,]');q('[data-validation]').textContent=error||(mode==='memo'&&!allow.checked?'İfade işleme kapalı; içerik metin olarak korunacak.':'Parantez ve tırnak yapısı dengeli.');q('[data-validation]').classList.toggle('is-error',!!error);return error;}
 function aggregateCode(){const fn=q('[data-function]').value,band=q('[data-band]').value,expr=q('[data-aggregate-expression]').value.trim(),flags=(q('[data-invisible]').checked?1:0)+(q('[data-running]').checked?2:0);return fn+'('+(fn==='COUNT'?'':expr+', ')+band+(flags?', '+flags:'')+')';}
 function updateAggregate(){q('[data-aggregate-expression]').disabled=q('[data-function]').value==='COUNT';q('[data-aggregate-preview]').textContent=wrap(aggregateCode());}
 q('[data-band]').innerHTML=(o.bands||[]).map(b=>'<option value="'+esc(b.name)+'">'+esc(b.name)+'</option>').join('');
 q('[data-aggregate]').onclick=()=>{q('[data-aggregate-form]').hidden=!q('[data-aggregate-form]').hidden;updateAggregate();};
 q('[data-aggregate-form]').addEventListener('input',updateAggregate);
 q('[data-add-aggregate]').onclick=()=>{
  if(!q('[data-band]').value){q('[data-validation]').textContent='Önce bir veri bandı ekleyin.';return;}
  if(q('[data-function]').value!=='COUNT'&&!q('[data-aggregate-expression]').value.trim()){q('[data-validation]').textContent='Aggregate için alan veya ifade girin.';return;}
  const error=checkCode(aggregateCode());if(error){q('[data-validation]').textContent=error;return;}insert(t,wrap(aggregateCode()));
 };
 d.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{tab=button.dataset.tab;d.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));renderCatalog();});
 q('[data-search]').oninput=renderCatalog;q('[data-insert-selected]').onclick=()=>{if(selected&&!selected.disabled)insert(t,insertion(selected));};
 q('[data-wrap]').onclick=()=>{const value=t.value.slice(t.selectionStart,t.selectionEnd);insert(t,mode==='memo'?wrap(value):'('+value+')');};
 t.oninput=validateNow;t.ondragover=e=>e.preventDefault();t.ondrop=e=>{e.preventDefault();const index=e.dataTransfer.getData('application/x-frp-builder');insert(t,index!==''&&rows[Number(index)]?insertion(rows[Number(index)]):e.dataTransfer.getData('text/plain'));};
 allow?.addEventListener('change',validateNow);sep?.addEventListener('input',()=>{validateNow();updateAggregate();if(selected)choose(selected);});
 const apply=()=>{if(validateNow())return;if(o.onApply({value:t.value,allowExpressions:allow?.checked!==false,delimiters:sep?.value||'[,]'})!==false)d.close();};
 q('[data-apply]').onclick=apply;q('[data-cancel]').onclick=()=>d.close();
 d.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();apply();}});
 renderCatalog();validateNow();t.focus();return d;
}
function variablesEditor(o){
 const draft=clone(o.categories||[]);let ci=draft.length?0:-1,vi=-1;
 const d=shell('Variables · Rapor Değişkenleri','<div class="fr-expression-toolbar"><button type="button" data-add-category>Kategori ekle</button><button type="button" data-add-variable>Değişken ekle</button><button type="button" data-delete>Seçileni sil</button></div><div class="fr-variable-layout"><div data-variable-list class="fr-variable-list"></div><section class="fr-variable-detail"><label>Ad<input data-name></label><label data-expression-label>İfade<textarea data-value spellcheck="false"></textarea></label><button type="button" data-builder>Expression Builder</button><p data-error role="alert"></p><p class="fr-expression-note">Değişken adları rapor genelinde benzersizdir. Kategori silinince içindeki değişkenler de silinir. İsim değişiklikleri mevcut memo veya script ifadelerine otomatik uygulanmaz.</p></section></div><footer><button type="button" data-cancel>İptal</button><button type="button" data-apply>Uygula</button></footer>');
 const q=s=>d.querySelector(s),category=()=>draft[ci],item=()=>vi<0?category():category()?.variables[vi];
 const sync=()=>{const v=item();if(v){v.name=q('[data-name]').value;if(vi>=0)v.expression=q('[data-value]').value;}};
 const unique=(base,names)=>{let n=base,i=1;while(names.some(x=>x.toLocaleLowerCase()===n.toLocaleLowerCase()))n=base+(++i);return n;};
 function render(){
  q('[data-variable-list]').innerHTML=draft.map((c,i)=>'<section><button type="button" data-ci="'+i+'" data-vi="-1" aria-pressed="'+(i===ci&&vi<0)+'">▾ '+esc(c.name||'(Adsız kategori)')+'</button>'+c.variables.map((v,j)=>'<button type="button" class="fr-variable-child" data-ci="'+i+'" data-vi="'+j+'" aria-pressed="'+(i===ci&&j===vi)+'">'+esc(v.name||'(Adsız değişken)')+'</button>').join('')+'</section>').join('')||'<p>İlk kategoriyi ekleyin.</p>';
  d.querySelectorAll('[data-ci]').forEach(b=>b.onclick=()=>{sync();ci=Number(b.dataset.ci);vi=Number(b.dataset.vi);render();});
  q('[data-name]').value=item()?.name||'';q('[data-name]').disabled=!item();q('[data-value]').value=vi>=0?item()?.expression||'':'';
  q('[data-expression-label]').hidden=vi<0;q('[data-builder]').disabled=vi<0;q('[data-delete]').disabled=!item();q('[data-add-variable]').disabled=!category();
 }
 q('[data-add-category]').onclick=()=>{sync();draft.push({name:unique('Kategori',draft.map(c=>c.name)),variables:[]});ci=draft.length-1;vi=-1;render();q('[data-name]').select();};
 q('[data-add-variable]').onclick=()=>{sync();if(!category())return;category().variables.push({name:unique('Degisken',draft.flatMap(c=>c.variables.map(v=>v.name))),expression:"''"});vi=category().variables.length-1;render();q('[data-name]').select();};
 q('[data-delete]').onclick=()=>{sync();if(vi<0){draft.splice(ci,1);ci=Math.min(ci,draft.length-1);}else{category().variables.splice(vi,1);vi=-1;}render();};
 q('[data-builder]').onclick=()=>{sync();const v=item();if(vi<0)return;expressionBuilder({...o,categories:draft,value:v.expression,mode:'expression',onApply:r=>{v.expression=r.value;q('[data-value]').value=r.value;}});};
 q('[data-cancel]').onclick=()=>d.close();
 q('[data-apply]').onclick=()=>{
  sync();const names=new Set(),cats=new Set();let error='';
  draft.forEach(c=>{c.name=c.name.trim();if(!c.name||cats.has(c.name.toLocaleLowerCase()))error='Kategori adları dolu ve benzersiz olmalı.';cats.add(c.name.toLocaleLowerCase());
   c.variables.forEach(v=>{v.name=v.name.trim();if(!v.name||/[<>\[\]"'\r\n]/.test(v.name)||names.has(v.name.toLocaleLowerCase()))error='Değişken adları dolu ve benzersiz olmalı; ayraç ve tırnak içermemeli.';names.add(v.name.toLocaleLowerCase());const e=checkCode(v.expression);if(e)error=v.name+': '+e;});
  });
  if(error){q('[data-error]').textContent=error;return;}if(o.onApply(draft)!==false)d.close();
 };
 render();return d;
}
window.FrpExpressionEditors={expressionBuilder,variablesEditor,validate,delimiters};
})(window);

