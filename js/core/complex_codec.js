(function(window){
'use strict';
// Delphi value tags are decoded only to locate boundaries. Untouched values retain their exact bytes.
const utf8=new TextEncoder(),decode=b=>new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(b));
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
function unhex(s){s=String(s||'').replace(/\s/g,'');if(s.length%2||/[^0-9a-f]/i.test(s))throw Error('Geçersiz PropData');return Array.from(s.match(/../g)||[],v=>parseInt(v,16));}
const u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
function short(s){const b=Array.from(utf8.encode(s));if(b.length>255||b.some(x=>x>127))throw Error('Geçersiz bileşen adı');return [b.length,...b];}
function str(s){s=String(s);const b=[];for(let i=0;i<s.length;i++){const n=s.charCodeAt(i);b.push(n&255,n>>>8);}return [18,...u32(s.length),...b];}
const ident=s=>[7,...short(s)],binary=b=>[10,...u32(b.length),...b];
function reader(bytes){
 let pos=0;
 const take=n=>{if(!Number.isSafeInteger(n)||n<0||pos+n>bytes.length)throw Error('Eksik ikili veri');const b=bytes.slice(pos,pos+n);pos+=n;return b;};
 const byte=()=>take(1)[0],len=()=>{const a=take(4);return (a[0]+a[1]*256+a[2]*65536+a[3]*16777216);};
 const text=()=>decode(take(byte()));
 function value(depth=0){
  if(depth>64)throw Error('İkili veri çok derin');
  const start=pos,tag=byte();let data=null;
  if([0,8,9,13].includes(tag))data=tag===9;
  else if(tag===1){data=[];while(bytes[pos]!==0)data.push(value(depth+1));byte();}
  else if(tag===2){data=byte();if(data>127)data-=256;}
  else if(tag===3){const a=take(2);data=a[0]+a[1]*256;if(data>32767)data-=65536;}
  else if(tag===4){data=len()|0;}
  else if(tag===5)take(10);
  else if(tag===6||tag===7)data=text();
  else if(tag===10)data=take(len());
  else if(tag===11){data=[];while(bytes[pos]!==0)data.push(text());byte();}
  else if(tag===12||tag===20)data=decode(take(len()));
  else if(tag===18){data=new TextDecoder('utf-16le',{fatal:true}).decode(Uint8Array.from(take(len()*2)));}
  else if([15].includes(tag))take(4);
  else if([16,17,19,21].includes(tag))take(8);
  else if(tag===14){
   data=[];while(bytes[pos]!==0){
    const prefix=[];if(bytes[pos]!==1)prefix.push(value(depth+1));
    if(byte()!==1)throw Error('Bilinmeyen koleksiyon');
    data.push({prefix,props:properties(true)});
   }byte();
  } else throw Error('Desteklenmeyen Delphi değer türü: '+tag);
  return {tag,data,raw:bytes.slice(start,pos)};
 }
 function properties(terminated){
  const props=[];
  while(pos<bytes.length&&bytes[pos]!==0){const name=text();props.push({name,value:value()});}
  if(terminated){if(byte()!==0)throw Error('Özellik sonu bulunamadı');}
  return props;
 }
 function component(depth=0){
  if(depth>64)throw Error('Bileşen ağacı çok derin');
  const prefix=[];
  if(bytes[pos]>=240){const flags=byte();prefix.push(flags);if(flags&2)prefix.push(...value().raw);}
  const type=text(),name=text(),props=properties(true),children=[];
  while(bytes[pos]!==0)children.push(component(depth+1));byte();
  return {prefix,type,name,props,children};
 }
 return {value,properties,component,take,get pos(){return pos;}};
}
function stream(s){const b=unhex(s),r=reader(b),props=r.properties(false),tail=b.slice(r.pos);if(tail.some(v=>v!==0))throw Error('Bilinmeyen veri sonu');return {props,tail};}
const prop=(o,n)=>o.props.find(p=>p.name===n);
function put(o,name,raw){const p=prop(o,name);if(p)p.value={raw};else o.props.push({name,value:{raw}});}
function emitProps(o){return o.props.flatMap(p=>[...short(p.name),...p.value.raw]);}
function emitComponent(o){return [...o.prefix,...short(o.type),...short(o.name),...emitProps(o),0,...o.children.flatMap(emitComponent),0];}
function chartTree(b){const r=reader(b);if(decode(r.take(4))!=='TPF0')throw Error('Desteklenmeyen grafik akışı');const t=r.component();if(r.pos!==b.length)throw Error('Grafik sonu tanınmıyor');return t;}
const xml=s=>{const d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror'))throw Error('Gömülü XML okunamadı');return d;};
const serialize=n=>new XMLSerializer().serializeToString(n);
function itemAttrs(s){return Object.fromEntries(Array.from(xml('<item '+s+'/>').documentElement.attributes).map(a=>[a.name,a.value]));}
function attrsText(a){const n=xml('<item/>').documentElement;Object.entries(a).forEach(([k,v])=>n.setAttribute(k,String(v)));return serialize(n).replace(/^<item\s*/,'').replace(/\/>$/,'');}
function seriesBindings(v){
 if(!v)return [];
 if(v.tag!==1)throw Error('Bu SeriesData koleksiyonu henüz düzenlenemiyor');
 return v.data.map(row=>{if(row.tag!==1||row.data.length!==1||typeof row.data[0].data!=='string')throw Error('SeriesData yapısı tanınmıyor');return itemAttrs(row.data[0].data);});
}
const supportedSeries=['TLineSeries','TFastLineSeries','TBarSeries','THorizBarSeries','TAreaSeries','TPieSeries','TPointSeries'];
function readChart(node){
 const raw=node.getAttribute('PropData')||'';
 try{
  const data=stream(raw),value=prop(data,'Chart')?.value;
  const tree=value?chartTree(value.data):{prefix:[],type:'TChart',name:'',props:[],children:[]};
  const nodes=tree.children.filter(c=>/Series$/.test(c.type)),bindings=seriesBindings(prop(data,'SeriesData')?.value);
  if(nodes.length!==bindings.length)throw Error('Grafik serileri ve veri bağları eşleşmiyor');
  return {raw,tree,series:nodes.map((n,i)=>({node:n,attrs:bindings[i],title:prop(n,'Title')?.value.data||n.name,type:n.type})),reason:''};
 }catch(e){return {raw,series:[],reason:e.message};}
}
function writeChart(model){
 const data=stream(model.raw),tree=JSON.parse(JSON.stringify(model.tree));
 const used=new Set([...tree.children,...model.series.map(x=>x.node).filter(Boolean)].map(x=>x.name));
 const series=model.series.map((s,i)=>{
  const n=s.node?JSON.parse(JSON.stringify(s.node)):{prefix:[],type:s.type,name:'',props:[],children:[]};
  if(!s.node&&!supportedSeries.includes(s.type))throw Error('Desteklenmeyen seri türü');
  if(!s.node){let index=i+1;while(used.has('Series'+index))index++;n.name='Series'+index;used.add(n.name);}
  put(n,'Title',str(s.title||n.name));return n;
 });
 // Preserve every non-series child and each existing series subtree.
 const first=tree.children.findIndex(c=>/Series$/.test(c.type));
 tree.children=tree.children.filter(c=>!/Series$/.test(c.type));
 tree.children.splice(first<0?tree.children.length:Math.min(first,tree.children.length),0,...series);
 if(!model.raw){put(tree,'View3D',[8]);put(tree,'Legend.Visible',[9]);}
 put(data,'Chart',binary([84,80,70,48,...emitComponent(tree)]));
 if(!prop(data,'ChartElevation'))put(data,'ChartElevation',[2,0]);
 put(data,'SeriesData',[1,...model.series.flatMap(s=>[1,...str(attrsText(s.attrs)),0]),0]);
 return hex([...emitProps(data),...data.tail]);
}
const crossLists=['cellmemos','cellheadermemos','columnmemos','columntotalmemos','cornermemos','rowmemos','rowtotalmemos','cellfunctions','columnsort','rowsort'];
function crossDoc(text){
 // FastReport's numeric item text lives in the tag, unlike standard XML attributes.
 return xml(text.replace(/<item\s+(-?\d+)\s*\/>/g,'<item frp-number="$1"/>'));
}
function readCross(node){
 const raw=node.getAttribute('PropData')||'';
 try{
  const data=stream(raw),m=prop(data,'Memos')?.value;if(m&&m.tag!==10)throw Error('Memos akışı tanınmıyor');
  const doc=m?crossDoc(decode(m.data)):xml('<cross/>');
  if(doc.documentElement.nodeName!=='cross')throw Error('Çapraz tablo biçimi tanınmıyor');
  crossLists.forEach(name=>{if(!Array.from(doc.documentElement.children).some(n=>n.nodeName===name))doc.documentElement.appendChild(doc.createElement(name));});
  const attrs=Object.fromEntries(Array.from(node.attributes).map(a=>[a.name,a.value]));
  const lines=key=>String(attrs[key+'.Text']||'').split(/\r?\n/).filter(Boolean);
  return {raw,memos:serialize(doc),attrs,rows:lines('RowFields'),columns:lines('ColumnFields'),cells:lines('CellFields'),reason:''};
 }catch(e){return {raw,reason:e.message,rows:[],columns:[],cells:[],attrs:{}};}
}
function writeCross(model){
 const data=stream(model.raw),doc=xml(model.memos);
 let text=serialize(doc).replace(/\sfrp-number="(-?\d+)"/g,' $1');
 if(!text.startsWith('<?xml'))text='<?xml version="1.0" encoding="utf-8" standalone="no"?>\r\n'+text;
 put(data,'Memos',binary(Array.from(utf8.encode(text))));return hex([...emitProps(data),...data.tail]);
}
window.FrpComplexCodec={readChart,writeChart,readCross,writeCross,supportedSeries,xml,serialize};
})(window);

