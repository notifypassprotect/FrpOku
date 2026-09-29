(function(window){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
function shell(title){
 const previous=document.activeElement,d=document.createElement('dialog');d.className='fr-property-dialog fr-complex-dialog';
 d.innerHTML='<header><strong>'+esc(title)+'</strong><button data-close aria-label="Kapat">×</button></header><main></main><p data-error role="alert"></p><footer><button data-cancel>İptal</button><button data-apply>Uygula</button></footer>';
 document.body.appendChild(d);d.querySelector('[data-close]').onclick=d.querySelector('[data-cancel]').onclick=()=>d.close();
 d.addEventListener('close',()=>{d.remove();if(previous?.isConnected)previous.focus();},{once:true});d.addEventListener('keydown',e=>e.stopPropagation());return d;
}
function chart(options){
 const model=clone(options.model),d=shell('Grafik serileri · '+options.name),host=d.querySelector('main');
 let index=model.series.length?0:-1;
 function draw(){
  const current=model.series[index];
  host.innerHTML='<p>Seriler sırasıyla çizilir. Kaynak ifadeleri rapor çalıştırıldığında değerlendirilir.</p><div class="fr-complex-columns"><section><select data-series size="8" aria-label="Seriler">'+model.series.map((s,i)=>'<option value="'+i+'">'+esc(s.title||s.type)+'</option>').join('')+'</select><div class="fr-complex-actions"><select data-type aria-label="Yeni seri türü">'+window.FrpComplexCodec.supportedSeries.map(t=>'<option>'+t+'</option>').join('')+'</select><button data-add>Seri ekle</button><button data-remove>Sil</button><button data-up>Yukarı</button><button data-down>Aşağı</button></div></section><section data-fields></section></div>';
  host.querySelector('[data-series]').value=String(index);host.querySelector('[data-series]').onchange=e=>{index=Number(e.target.value);draw();};
  host.querySelector('[data-add]').onclick=()=>{model.series.push({type:host.querySelector('[data-type]').value,title:'Seri '+(model.series.length+1),attrs:{DataType:'dtDBData',DataSetName:options.context.queries[0]?.name||'',Source1:'',Source2:'',SortOrder:'soNone',TopN:'0',TopNCaption:'Diğer',XType:'xtText'}});index=model.series.length-1;draw();};
  for(const action of ['remove','up','down'])host.querySelector('[data-'+action+']').disabled=index<0||(action==='up'&&index===0)||(action==='down'&&index===model.series.length-1);
  host.querySelector('[data-remove]').onclick=()=>{model.series.splice(index,1);index=Math.min(index,model.series.length-1);draw();};
  for(const [a,delta] of [['up',-1],['down',1]])host.querySelector('[data-'+a+']').onclick=()=>{const other=index+delta;[model.series[index],model.series[other]]=[model.series[other],model.series[index]];index=other;draw();};
  if(!current){host.querySelector('[data-fields]').textContent='Bir seri ekleyin.';return;}
  const fields=[['title','Seri başlığı'],['DataType','Veri kaynağı',['dtDBData','dtBandData','dtFixedData']],['DataSetName','Veri seti',options.context.queries.map(q=>q.name)],['DataBand','Veri bandı',options.context.bands.map(b=>b.name)],['XType','X değeri türü',['xtText','xtNumber','xtDate']],['Source1','X / etiket ifadesi'],['Source2','Y / değer ifadesi'],['Source3','Kaynak 3'],['Source4','Kaynak 4'],['Source5','Kaynak 5'],['Source6','Kaynak 6'],['SortOrder','Sıralama',['soNone','soAscending','soDescending']],['TopN','En çok değer (0: sınır yok)'],['TopNCaption','Diğer değerlerin başlığı']];
  const area=host.querySelector('[data-fields]');
  area.innerHTML='<p>Seri türü: '+esc(current.type)+'</p>'+fields.map(([key,label,opts])=>{
   const v=key==='title'?current.title:current.attrs[key]??'';
   if(opts)opts=[...new Set(['',v,...opts])];
   return '<label>'+esc(label)+(opts?'<select data-key="'+key+'">'+opts.map(x=>'<option value="'+esc(x)+'" '+(x===v?'selected':'')+'>'+esc(x||'Seçilmedi')+'</option>').join('')+'</select>':'<span><input data-key="'+key+'" type="'+(key==='TopN'?'number':'text')+'" '+(key==='TopN'?'min="0" step="1"':'')+' value="'+esc(v)+'">'+(key.startsWith('Source')?'<button data-expression="'+key+'">İfade…</button>':'')+'</span>')+'</label>';
  }).join('')+'<p>Sabit veride değerleri noktalı virgülle ayırın. Mevcut seri türleri ve özel grafik ayarları korunur; farklı tür için yeni seri ekleyin.</p>';
  area.querySelectorAll('[data-key]').forEach(el=>el.onchange=()=>{const k=el.dataset.key;if(k==='title'){current.title=el.value;host.querySelector('[data-series]').options[index].text=el.value||current.type;}else{current.attrs[k]=el.value;if(k==='DataSetName')delete current.attrs.DataSet;}});
  area.querySelectorAll('[data-expression]').forEach(b=>b.onclick=()=>window.FrpExpressionEditors.expressionBuilder({...options.context,mode:'expression',value:current.attrs[b.dataset.expression]||'',onApply:r=>{current.attrs[b.dataset.expression]=r.value;area.querySelector('[data-key="'+b.dataset.expression+'"]').value=r.value;}}));
 }
 d.querySelector('[data-apply]').onclick=()=>{
  try{
   for(const s of model.series){
    const n=Number(s.attrs.TopN||0);if(!Number.isInteger(n)||n<0)throw Error('Seri limiti sıfır veya pozitif tam sayı olmalı.');
    if(s.attrs.DataType==='dtDBData'&&!s.attrs.DataSetName&&!s.attrs.DataSet)throw Error('Her veri serisi için veri seti seçin.');
    if(s.attrs.DataType==='dtBandData'&&!s.attrs.DataBand)throw Error('Bant verisi için bir bant seçin.');
    if(!String(s.attrs.Source2||'').trim())throw Error('Her seri için Y / değer kaynağı girin.');
    if(s.attrs.DataType!=='dtFixedData')for(let i=1;i<=6;i++){const error=window.FrpExpressionEditors.validate(s.attrs['Source'+i]||'','expression',true,'[,]');if(error)throw Error(error);}
   }
   const propData=window.FrpComplexCodec.writeChart(model);
   if(options.onApply({model,propData})!==false)d.close();
  }catch(e){d.querySelector('[data-error]').textContent=e.message;}
 };
 draw();d.showModal();
}
const memoGroups={cellmemos:'Hücre',cellheadermemos:'Hücre başlığı',columnmemos:'Kolon başlığı',columntotalmemos:'Kolon toplamı',rowmemos:'Satır başlığı',rowtotalmemos:'Satır toplamı',cornermemos:'Köşe'};
function cross(options){
 const model=clone(options.model),codec=window.FrpComplexCodec,doc=codec.xml(model.memos),d=shell('Çapraz tablo · '+options.name),host=d.querySelector('main');
 const manual=options.type==='TfrxCrossView';
 const group=name=>Array.from(doc.documentElement.children).find(n=>n.nodeName===name);
 const numberAt=(name,i,def)=>Number(group(name)?.children[i]?.getAttribute('frp-number')??def);
 let rows=model.rows.map((field,i)=>({field,sort:numberAt('rowsort',i,0)})),columns=model.columns.map((field,i)=>({field,sort:numberAt('columnsort',i,0)})),cells=model.cells.map((field,i)=>({field,aggregate:numberAt('cellfunctions',i,1)}));
 if(manual){
  const titles=(name,n)=>Array.from({length:Math.max(0,Math.min(64,Number(n)||0))},(_,i)=>({field:group(name)?.children[i]?.getAttribute('Text')||'Başlık '+(i+1),sort:numberAt(name==='rowmemos'?'rowsort':'columnsort',i,0),aggregate:numberAt('cellfunctions',i,1)}));
  rows=titles('rowmemos',model.attrs.RowLevels??1);columns=titles('columnmemos',model.attrs.ColumnLevels??1);cells=titles('cellheadermemos',model.attrs.CellLevels??1);
 }
 let formatKey='cellmemos:0';
 function ensureMemos(){
  if(Math.max(1,cells.length)*(rows.length+1)*(columns.length+1)>4096)throw Error('Bu tablonun 4096 üzerindeki hücre biçimi özgün dosyada korunuyor; editör sınırı aşıldı.');
  const counts={cellmemos:Math.max(1,cells.length)*(rows.length+1)*(columns.length+1),cellheadermemos:Math.max(1,cells.length)*(Math.max(rows.length,columns.length)+1),rowmemos:Math.max(1,rows.length),rowtotalmemos:Math.max(1,rows.length),columnmemos:Math.max(1,columns.length),columntotalmemos:Math.max(1,columns.length),cornermemos:rows.length+3};
  for(const [name,count] of Object.entries(counts)){
   const g=group(name);while(g.children.length<count){const n=g.children[0]?g.children[0].cloneNode(true):doc.createElement('TfrxMemoView');n.removeAttribute('Name');if(!n.hasAttribute('Font.Name')){n.setAttribute('Font.Name','Arial');n.setAttribute('Font.Height','-11');n.setAttribute('HAlign','haCenter');n.setAttribute('Frame.Typ','15');}g.appendChild(n);}
  }
 }
 function draw(){
  ensureMemos();
  host.innerHTML='<p>'+ (manual?'Bu tablo verisini rapor kodundan alır. Satır/kolon sayıları ve başlıkları düzenlenir. Veri setine bağlı yeni tablolar için paletten CrossTab ekleyin.':'Alanları satır, kolon ve hücre bölümlerine ekleyin. Sıra, rapordaki gruplama sırasıdır.')+'</p><label>Veri seti<select data-dataset '+(manual?'disabled':'')+'>'+[...new Set(['',model.attrs.DataSetName||model.attrs.DataSet||'',...options.context.queries.map(q=>q.name)])].map(v=>'<option value="'+esc(v)+'">'+esc(v||'Seçilmedi')+'</option>').join('')+'</select></label><div class="fr-cross-dimensions"></div><div class="fr-cross-options"></div><section class="fr-complex-format"><h4>Başlık ve hücre biçimleri</h4><select data-memo aria-label="Biçimlenecek hücre">'+Object.entries(memoGroups).flatMap(([name,label])=>Array.from(group(name).children).map((n,i)=>'<option value="'+name+':'+i+'">'+label+' '+(i+1)+'</option>')).join('')+'</select><div class="fr-complex-actions">'+['Font','Frame','Fill','DisplayFormat'].map(k=>'<button data-format="'+k+'">'+k+'…</button>').join('')+'</div><p>Biçimler konumlarına göre korunur. Yeni hücreler ilk hücrenin biçimini kullanır.</p></section>';
  const ds=host.querySelector('[data-dataset]');ds.value=model.attrs.DataSetName||model.attrs.DataSet||'';ds.onchange=()=>{model.attrs.DataSetName=ds.value;delete model.attrs.DataSet;draw();};
  const query=options.context.queries.find(q=>q.name===ds.value),fields=query?options.context.getFields(query):[];
  const dims=host.querySelector('.fr-cross-dimensions');
  const lists=[['rows','Satırlar',rows],['columns','Kolonlar',columns],['cells','Hücreler',cells]];
  for(const [key,label,list] of lists){
   const section=document.createElement('section');section.innerHTML='<h4>'+label+'</h4><datalist id="fr-cross-'+key+'">'+fields.map(f=>'<option value="'+esc(f.name)+'"></option>').join('')+'</datalist>'+list.map((item,i)=>'<div class="fr-cross-field"><input aria-label="'+label+' alanı '+(i+1)+'" list="fr-cross-'+key+'" data-field="'+i+'" value="'+esc(item.field)+'"><select aria-label="'+(key==='cells'?'Toplama işlemi':'Sıralama')+'" data-order="'+i+'">'+(key==='cells'?['Değer','SUM','MIN','MAX','AVG','COUNT']:['Artan','Azalan','Sırasız','Gruplama']).map((v,n)=>'<option value="'+n+'" '+(n===(key==='cells'?item.aggregate:item.sort)?'selected':'')+'>'+v+'</option>').join('')+'</select><button data-up="'+i+'" '+(i===0?'disabled':'')+' aria-label="Yukarı">↑</button><button data-down="'+i+'" '+(i===list.length-1?'disabled':'')+' aria-label="Aşağı">↓</button><button data-remove="'+i+'" aria-label="Alanı kaldır">×</button></div>').join('')+'<button data-add>Alan ekle</button>';
   dims.appendChild(section);
   section.querySelector('[data-add]').onclick=()=>{if(list.length>=64)return;const count=(Math.max(1,cells.length)+(key==='cells'?1:0))*(rows.length+1+(key==='rows'?1:0))*(columns.length+1+(key==='columns'?1:0));if(count>4096){d.querySelector('[data-error]').textContent='En fazla 4096 hücre biçimi düzenlenebilir.';return;}list.push({field:'',sort:0,aggregate:1});draw();};
   section.querySelectorAll('[data-field]').forEach(el=>el.oninput=()=>list[Number(el.dataset.field)].field=el.value);
   section.querySelectorAll('[data-order]').forEach(el=>el.onchange=()=>list[Number(el.dataset.order)][key==='cells'?'aggregate':'sort']=Number(el.value));
   section.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{list.splice(Number(b.dataset.remove),1);draw();});
   for(const [action,delta] of [['up',-1],['down',1]])section.querySelectorAll('[data-'+action+']').forEach(b=>b.onclick=()=>{const i=Number(b.dataset[action]),j=i+delta;[list[i],list[j]]=[list[j],list[i]];draw();});
  }
  const flags={ShowRowTotal:'Satır toplamları',ShowColumnTotal:'Kolon toplamları',RepeatHeaders:'Başlıkları tekrarla',ShowRowHeader:'Satır başlığı',ShowColumnHeader:'Kolon başlığı',ShowTitle:'Tablo başlığı',ShowCorner:'Köşe başlığı',AutoSize:'Otomatik boyut',KeepTogether:'Birlikte tut',KeepRowsTogether:'Satırları birlikte tut',JoinEqualCells:'Eşit hücreleri birleştir',SuppressNullRecords:'Boş kayıtları atla'};
  host.querySelector('.fr-cross-options').innerHTML=Object.entries(flags).map(([key,label])=>'<label><input type="checkbox" data-flag="'+key+'" '+((model.attrs[key]??(['KeepTogether','KeepRowsTogether','JoinEqualCells'].includes(key)?'False':'True'))==='True'?'checked':'')+'>'+label+'</label>').join('');
  host.querySelectorAll('[data-flag]').forEach(el=>el.onchange=()=>model.attrs[el.dataset.flag]=el.checked?'True':'False');
  const select=host.querySelector('[data-memo]');select.value=formatKey;if(!select.value){select.selectedIndex=0;formatKey=select.value;}select.onchange=()=>formatKey=select.value;
  host.querySelectorAll('[data-format]').forEach(button=>button.onclick=()=>{
   const [g,index]=formatKey.split(':'),node=group(g).children[Number(index)],target={name:select.selectedOptions[0]?.textContent,...window.FrpAppearance.read(node)};
   window.FrpPropertyEditors.open({kind:button.dataset.format,target,color:options.color,toColor:options.toColor,context:options.context,onApply:({edits})=>{
    Object.entries(edits).forEach(([k,v])=>{if(v===''&&/^Frame\.(Left|Right|Top|Bottom)Line\./.test(k))node.removeAttribute(k);else node.setAttribute(k,String(v));});
   }});
  });
 }
 d.querySelector('[data-apply]').onclick=()=>{
  try{
   if(!cells.length)throw Error('En az bir hücre alanı ekleyin.');
   if([...rows,...columns,...cells].some(i=>!i.field.trim()))throw Error('Boş alan adlarını doldurun veya kaldırın.');
   if(!manual&&!model.attrs.DataSetName&&!model.attrs.DataSet)throw Error('Bir veri seti seçin.');
   const setNumbers=(name,list,key)=>{const g=group(name);while(g.children.length<list.length)g.appendChild(doc.createElement('item'));list.forEach((item,i)=>g.children[i].setAttribute('frp-number',String(item[key])));};
   setNumbers('rowsort',rows,'sort');setNumbers('columnsort',columns,'sort');setNumbers('cellfunctions',cells,'aggregate');
   model.rows=rows.map(i=>i.field.trim());model.columns=columns.map(i=>i.field.trim());model.cells=cells.map(i=>i.field.trim());
   model.attrs.RowLevels=String(rows.length);model.attrs.ColumnLevels=String(columns.length);model.attrs.CellLevels=String(cells.length);
   if(manual){for(const [name,list] of [['rowmemos',rows],['columnmemos',columns],['cellheadermemos',cells]])list.forEach((x,i)=>group(name).children[i].setAttribute('Text',x.field));}
   else for(const [key,list] of [['RowFields',model.rows],['ColumnFields',model.columns],['CellFields',model.cells]])model.attrs[key+'.Text']=list.join('\r\n')+'\r\n';
   model.memos=codec.serialize(doc);const propData=codec.writeCross(model);
   if(options.onApply({model,propData})!==false)d.close();
  }catch(e){d.querySelector('[data-error]').textContent=e.message;}
 };
 try{draw();d.showModal();}catch(error){d.remove();throw error;}
}
window.FrpComplexEditors={chart,cross};
})(window);

