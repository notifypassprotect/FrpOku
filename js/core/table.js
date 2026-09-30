(function(window){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d)=>{const n=Number(String(v??'').replace(',','.'));return v!==null&&v!==undefined&&v!==''&&Number.isFinite(n)?n:d;};
const parse=s=>{const d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror'))throw Error('Tablo XML okunamadı.');return d;};
const serialize=n=>new XMLSerializer().serializeToString(n);
const children=(n,type)=>Array.from(n.children).filter(c=>c.nodeName===type);
function shape(root){return {columns:children(root,'TfrxTableColumn'),rows:children(root,'TfrxTableRow').map(node=>({node,cells:children(node,'TfrxTableCell')}))};}
function dimensions(root){const s=shape(root);return {width:s.columns.reduce((n,c)=>n+num(c.getAttribute('Width'),80),0),height:s.rows.reduce((n,r)=>n+num(r.node.getAttribute('Height'),28),0)};}
function coverage(root){
 const s=shape(root),covered=new Map(),anchors=[];
 for(let r=0;r<s.rows.length;r++)for(let c=0;c<s.columns.length;c++){
  const cell=s.rows[r].cells[c];if(!cell)throw Error('Satırların hücre sayıları eşleşmiyor.');
  if(covered.has(r+':'+c))continue;
  const rs=num(cell.getAttribute('RowSpan'),1),cs=num(cell.getAttribute('ColSpan'),1);
  if(!Number.isInteger(rs)||!Number.isInteger(cs)||rs<1||cs<1||r+rs>s.rows.length||c+cs>s.columns.length)throw Error('Hücre birleşimi tablo sınırını aşıyor.');
  const anchor={r,c,rs,cs,cell};anchors.push(anchor);
  for(let y=r;y<r+rs;y++)for(let x=c;x<c+cs;x++){const k=y+':'+x;if(covered.has(k))throw Error('Hücre birleşimleri çakışıyor.');covered.set(k,anchor);}
 }
 return {covered,anchors};
}
function read(node){
 const xml=serialize(node);try{
  const s=shape(node);if(!s.columns.length||!s.rows.length)throw Error('Boş tablo yapısı.');
  if(s.columns.length*s.rows.length>2500)throw Error('2500 hücre üzerindeki tablolar salt okunur.');
  if(s.rows.some(r=>r.cells.length!==s.columns.length))throw Error('Düzensiz tablo yapısı özgün dosyada korunuyor.');
  coverage(node);return {xml,reason:'',...dimensions(node)};
 }catch(e){const size=dimensions(node);return {xml,reason:e.message,width:size.width||num(node.getAttribute('Width'),240),height:size.height||num(node.getAttribute('Height'),100)};}
}
function write(node,model){
 if(!model._table)return;
 const doc=parse(model._table.xml),root=doc.documentElement,s=shape(root),size=dimensions(root);
 Array.from(root.attributes).forEach(a=>{if(!['Name','Left','Top','Width','Height'].includes(a.name)&&!node.hasAttribute(a.name))node.setAttribute(a.name,a.value);});
 const x=num(model.width,size.width)/size.width,y=num(model.height,size.height)/size.height;
 if(!model._table.reason){
  if(!(x>0&&y>0&&Number.isFinite(x)&&Number.isFinite(y)))throw Error('Tablo boyutu geçersiz.');
  if(Math.abs(x-1)>0.00001)s.columns.forEach(c=>c.setAttribute('Width',String(num(c.getAttribute('Width'),80)*x)));
  if(Math.abs(y-1)>0.00001)s.rows.forEach(r=>r.node.setAttribute('Height',String(num(r.node.getAttribute('Height'),28)*y)));
  coverage(root);
 }else if(num(model.width,model._table.width)!==model._table.width||num(model.height,model._table.height)!==model._table.height){
  throw Error('Salt okunur tablonun boyutları değiştirilemez.');
 }
 // Replace only with the retained full table subtree; unknown cell contents survive.
 while(node.firstChild)node.removeChild(node.firstChild);
 Array.from(root.childNodes).forEach(child=>node.appendChild(node.ownerDocument.importNode(child,true)));
}
function make(name,unique){
 const d=parse('<TfrxTableObject/>'),root=d.documentElement;root.setAttribute('Name',name);
 for(let c=0;c<3;c++){const n=d.createElement('TfrxTableColumn');n.setAttribute('Name',unique('TableColumn'));n.setAttribute('Width','90');root.appendChild(n);}
 for(let r=0;r<3;r++){const row=d.createElement('TfrxTableRow');row.setAttribute('Name',unique('TableRow'));row.setAttribute('Height','28');root.appendChild(row);for(let c=0;c<3;c++)row.appendChild(newCell(d,unique));}
 return read(root);
}
function newCell(doc,unique){const n=doc.createElement('TfrxTableCell');n.setAttribute('Name',unique('TableCell'));n.setAttribute('Text','');n.setAttribute('Frame.Typ','15');n.setAttribute('Font.Name','Arial');n.setAttribute('Font.Height','-11');n.setAttribute('Restrictions','8');return n;}
function preview(model,color){
 if(!model||model.reason)return '<span>'+esc(model?.reason||'Table')+'</span>';
 try{
  const root=parse(model.xml).documentElement,s=shape(root),{covered}=coverage(root),size=dimensions(root);
  return '<table style="border-collapse:collapse;table-layout:fixed;width:100%;height:100%;font:11px Arial"><colgroup>'+s.columns.map(c=>'<col style="width:'+num(c.getAttribute('Width'),80)/size.width*100+'%">').join('')+'</colgroup>'+s.rows.map((row,r)=>'<tr style="height:'+num(row.node.getAttribute('Height'),28)/size.height*100+'%">'+row.cells.map((cell,c)=>{
   const a=covered.get(r+':'+c);if(a.r!==r||a.c!==c)return '';
   const mask=num(cell.getAttribute('Frame.Typ'),0),fontMask=num(cell.getAttribute('Font.Style'),0);
   const frameWidth=Math.max(0,num(cell.getAttribute('Frame.Width'),1)),frameColor=esc(color(cell.getAttribute('Frame.Color')||'0'));
   const borders=['left','right','top','bottom'].map((side,i)=>'border-'+side+':'+((mask&(1<<i))?frameWidth+'px solid '+frameColor:'none')).join(';');
   const align=({haCenter:'center',haRight:'right',haBlock:'justify'})[cell.getAttribute('HAlign')]||'left';
   return '<td colspan="'+a.cs+'" rowspan="'+a.rs+'" style="'+borders+';overflow:hidden;padding:2px;font-size:'+Math.max(1,Math.abs(num(cell.getAttribute('Font.Height'),-11)))+'px;font-weight:'+(fontMask&1?'bold':'normal')+';font-style:'+(fontMask&2?'italic':'normal')+';text-align:'+align+';background:'+esc(color(cell.getAttribute('Fill.BackColor')||'clNone'))+';color:'+esc(color(cell.getAttribute('Font.Color')||'0'))+'">'+(cell.getAttribute('Visible')==='False'?'':esc(cell.getAttribute('Text')||cell.getAttribute('Memo.Text')||''))+'</td>';
  }).join('')+'</tr>').join('')+'</table>';
 }catch(e){return esc(e.message);}
}
function open(options){
 const doc=parse(options.model.xml),root=doc.documentElement,previous=document.activeElement;
 let from={r:0,c:0},to={r:0,c:0};
 const d=document.createElement('dialog');d.className='fr-property-dialog fr-table-dialog';
 d.innerHTML='<header><strong>Table · '+esc(options.name)+'</strong><button data-close aria-label="Kapat">×</button></header><div class="fr-table-tools"><button data-add-row>Satır ekle</button><button data-add-col>Kolon ekle</button><button data-del-row>Satırı sil</button><button data-del-col>Kolonu sil</button><button data-merge>Birleştir</button><button data-split>Böl</button><button data-text>Metin / ifade…</button>'+['Font','Frame','Fill','DisplayFormat'].map(k=>'<button data-format="'+k+'">'+k+'…</button>').join('')+'</div><div class="fr-table-size"><label>Kolon genişliği <input type="number" min="1" step="any" data-width></label><label>Satır yüksekliği <input type="number" min="1" step="any" data-height></label></div><p class="fr-table-hint">Bir hücreyi seçin; Shift ile ikinci hücreye tıklayarak dikdörtgen alan seçin. Birleştirmede sol üst hücre gösterilir; diğer içerikler bölmek üzere korunur.</p><div data-grid class="fr-table-grid"></div><p data-error role="alert"></p><footer><button data-cancel>İptal</button><button data-apply>Uygula</button></footer>';
 document.body.appendChild(d);const close=()=>d.close();d.querySelector('[data-close]').onclick=d.querySelector('[data-cancel]').onclick=close;
 d.addEventListener('close',()=>{d.remove();if(previous?.isConnected)previous.focus();},{once:true});d.addEventListener('keydown',e=>e.stopPropagation());
 const fail=e=>d.querySelector('[data-error]').textContent=e.message||e;
 const range=()=>({r0:Math.min(from.r,to.r),r1:Math.max(from.r,to.r),c0:Math.min(from.c,to.c),c1:Math.max(from.c,to.c)});
 function draw(){
  const s=shape(root),{covered}=coverage(root),rangeNow=range();
  from.r=Math.min(from.r,s.rows.length-1);to.r=Math.min(to.r,s.rows.length-1);from.c=Math.min(from.c,s.columns.length-1);to.c=Math.min(to.c,s.columns.length-1);
  d.querySelector('[data-grid]').innerHTML='<table><thead><tr><th></th>'+s.columns.map((c,i)=>'<th>'+String(i+1)+'</th>').join('')+'</tr></thead><tbody>'+s.rows.map((row,r)=>'<tr><th>'+(r+1)+'</th>'+row.cells.map((cell,c)=>{
   const a=covered.get(r+':'+c);if(a.r!==r||a.c!==c)return '';
   const chosen=r>=rangeNow.r0&&r<=rangeNow.r1&&c>=rangeNow.c0&&c<=rangeNow.c1;
   return '<td colspan="'+a.cs+'" rowspan="'+a.rs+'"><button data-cell="'+r+':'+c+'" class="'+(chosen?'selected':'')+'">'+esc(cell.getAttribute('Text')||cell.getAttribute('Memo.Text')||'·')+'</button></td>';
  }).join('')+'</tr>').join('')+'</tbody></table>';
  d.querySelectorAll('[data-cell]').forEach(b=>b.onclick=e=>{const [r,c]=b.dataset.cell.split(':').map(Number);if(e.shiftKey)to={r,c};else from=to={r,c};draw();});
  d.querySelector('[data-width]').value=num(s.columns[from.c].getAttribute('Width'),80);d.querySelector('[data-height]').value=num(s.rows[from.r].node.getAttribute('Height'),28);
 }
 const act=fn=>{try{d.querySelector('[data-error]').textContent='';fn();draw();}catch(e){fail(e);}};
 d.querySelector('[data-width]').onchange=e=>act(()=>{const n=Number(e.target.value);if(!(n>0))throw Error('Genişlik sıfırdan büyük olmalı.');shape(root).columns[from.c].setAttribute('Width',String(n));});
 d.querySelector('[data-height]').onchange=e=>act(()=>{const n=Number(e.target.value);if(!(n>0))throw Error('Yükseklik sıfırdan büyük olmalı.');shape(root).rows[from.r].node.setAttribute('Height',String(n));});
 d.querySelector('[data-add-row]').onclick=()=>act(()=>{const s=shape(root);if((s.rows.length+1)*s.columns.length>2500)throw Error('En fazla 2500 hücre düzenlenebilir.');const row=doc.createElement('TfrxTableRow');row.setAttribute('Name',options.unique('TableRow'));row.setAttribute('Height','28');s.columns.forEach(()=>row.appendChild(newCell(doc,options.unique)));root.appendChild(row);});
 d.querySelector('[data-add-col]').onclick=()=>act(()=>{const s=shape(root);if((s.columns.length+1)*s.rows.length>2500)throw Error('En fazla 2500 hücre düzenlenebilir.');const col=doc.createElement('TfrxTableColumn');col.setAttribute('Name',options.unique('TableColumn'));col.setAttribute('Width','90');root.insertBefore(col,s.rows[0].node);s.rows.forEach(row=>row.node.appendChild(newCell(doc,options.unique)));});
 for(const axis of ['row','col'])d.querySelector('[data-del-'+axis+']').onclick=()=>act(()=>{
  const s=shape(root);if((axis==='row'?s.rows.length:s.columns.length)<=1)throw Error('Tabloda en az bir satır ve kolon kalmalı.');
  if(coverage(root).anchors.some(a=>a.rs>1||a.cs>1))throw Error('Satır/kolon silmeden önce birleşik hücreleri bölün.');
  const nodes=axis==='row'?[s.rows[from.r].node]:[s.columns[from.c],...s.rows.map(row=>row.cells[from.c])];
  if(nodes.some(n=>Array.from(n.getElementsByTagName('*')).some(x=>!['TfrxTableCell'].includes(x.nodeName))))throw Error('İç içe özel nesneleri olan bu satır/kolon özgün dosyada korunuyor.');
  nodes.forEach(n=>n.remove());from=to={r:0,c:0};
 });
 d.querySelector('[data-merge]').onclick=()=>act(()=>{
  const s=shape(root),bounds=range(),{anchors}=coverage(root);
  if(bounds.r0===bounds.r1&&bounds.c0===bounds.c1)return;
  if(anchors.some(a=>a.r<=bounds.r1&&a.r+a.rs-1>=bounds.r0&&a.c<=bounds.c1&&a.c+a.cs-1>=bounds.c0&&(a.r<bounds.r0||a.c<bounds.c0||a.r+a.rs-1>bounds.r1||a.c+a.cs-1>bounds.c1)))throw Error('Seçim mevcut birleşik hücrenin tamamını içermeli.');
  for(let r=bounds.r0;r<=bounds.r1;r++)for(let c=bounds.c0;c<=bounds.c1;c++){const cell=s.rows[r].cells[c];cell.setAttribute('ColSpan','1');cell.setAttribute('RowSpan','1');cell.setAttribute('Visible',r===bounds.r0&&c===bounds.c0?'True':'False');}
  const cell=s.rows[bounds.r0].cells[bounds.c0];cell.setAttribute('ColSpan',String(bounds.c1-bounds.c0+1));cell.setAttribute('RowSpan',String(bounds.r1-bounds.r0+1));from=to={r:bounds.r0,c:bounds.c0};
 });
 d.querySelector('[data-split]').onclick=()=>act(()=>{
  const s=shape(root),a=coverage(root).covered.get(from.r+':'+from.c);a.cell.setAttribute('ColSpan','1');a.cell.setAttribute('RowSpan','1');
  for(let r=a.r;r<a.r+a.rs;r++)for(let c=a.c;c<a.c+a.cs;c++)s.rows[r].cells[c].setAttribute('Visible','True');
 });
 const selected=()=>shape(root).rows[from.r].cells[from.c];
 d.querySelector('[data-text]').onclick=()=>{
  const cell=selected();
  const field=cell.getAttribute('DataField'),dataset=cell.getAttribute('DataSetName')||cell.getAttribute('DataSet');
  const binding=field?'['+(dataset?dataset+'.':'')+'"'+field+'"]':'';
  window.FrpExpressionEditors.expressionBuilder({...options.context,mode:'memo',value:cell.getAttribute('Text')||cell.getAttribute('Memo.Text')||binding,allowExpressions:cell.getAttribute('AllowExpressions')!=='False',delimiters:cell.getAttribute('ExpressionDelimiters')||'[,]',onApply:r=>{
   cell.setAttribute(cell.hasAttribute('Memo.Text')?'Memo.Text':'Text',r.value);cell.setAttribute('AllowExpressions',r.allowExpressions?'True':'False');cell.setAttribute('ExpressionDelimiters',r.delimiters);cell.removeAttribute('DataField');cell.removeAttribute('DataSet');cell.removeAttribute('DataSetName');draw();
  }});
 };
 d.querySelectorAll('[data-format]').forEach(b=>b.onclick=()=>{
  const cell=selected();window.FrpPropertyEditors.open({kind:b.dataset.format,target:{name:cell.getAttribute('Name'),...window.FrpAppearance.read(cell)},context:options.context,color:options.color,toColor:options.toColor,onApply:({edits})=>{Object.entries(edits).forEach(([k,v])=>{if(v===''&&/^Frame\.(Left|Right|Top|Bottom)Line\./.test(k))cell.removeAttribute(k);else cell.setAttribute(k,String(v));});cell.setAttribute('ParentFont','False');draw();}});
 });
 d.querySelector('[data-apply]').onclick=()=>{try{coverage(root);const next=read(root);if(next.reason)throw Error(next.reason);if(options.onApply(next)!==false)d.close();}catch(e){fail(e);}};
 draw();d.showModal();
}
window.FrpTable={read,write,make,open,preview,parse,shape,coverage,dimensions};
})(window);

