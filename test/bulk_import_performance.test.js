const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

async function storeFixture(saveReport, cloudOptions = {}) {
  const storage = new Map();
  const user = { id: 'u1', role: 'admin' };
  const element = { classList: { add(){}, remove(){}, toggle(){} }, style: { setProperty(){} }, setAttribute(){} };
  const context = { console, Event: class {}, CustomEvent: class {}, setTimeout, clearTimeout, setInterval:()=>0,
    addEventListener(){}, dispatchEvent(){},
    localStorage: { getItem:k=>storage.get(k)||null, setItem:(k,v)=>storage.set(k,v), removeItem:k=>storage.delete(k) },
    document: { documentElement:element, body:element, getElementById:()=>null, querySelectorAll:()=>[], addEventListener(){} },
    FrpAuth: { getUser:()=>user, isLoggedIn:()=>true },
    FrpCloud: { loadActiveReports:async()=>[], saveReport, ...cloudOptions }
  };
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/store/store_main.js'),'utf8'),context);
  await context.FrpStoreReady;
  return {store:context.FrpStore,user,cloud:context.FrpCloud,context,storage};
}
async function settled(store) {
  for(let i=0;i<300;i++) { if(!store.getSyncStatus().pending) return; await new Promise(r=>setTimeout(r,5)); }
  throw Error('Sync did not settle');
}
const report = name => ({fileName:name,fileSize:100,parsedData:{rawXml:'<TfrxReport/>',queries:[]}});

test('bulk saves use at most four requests and keep all reports', async()=>{
  let active=0,max=0,saved=0;
  const {store}=await storeFixture(async r=>{
    max=Math.max(max,++active);await new Promise(resolve=>setTimeout(resolve,2));active--;saved++;return {version:r.version+1};
  });
  store.addMany(Array.from({length:200},(_,i)=>report(`${i}.frp`)));
  await settled(store);
  assert.equal(saved,200);assert.equal(max,4);assert.equal(store.getAll().length,200);
  assert.ok(store.getAll().every(r=>r.version===1));
});

test('duplicate names in one import update one record and retain visibility restrictions', async()=>{
  const {store,user}=await storeFixture(async r=>({version:r.version+1}));
  const result=store.addMany([report('same.frp'),report('same.frp')]);
  assert.equal(result.added,1);assert.equal(result.updated,1);
  await settled(store);const id=store.getAll()[0].id;
  user.role='user';user.id='other';assert.equal(store.getById(id),null);
  user.id='u1';assert.equal(store.getById(id).name,'same.frp');
});

test('refresh does not replace records while bulk saves are pending', async()=>{
  let release;const gate=new Promise(r=>release=r);
  const {store}=await storeFixture(async()=>{await gate;return {version:1}});
  store.addMany([report('pending.frp')]);
  await store.refreshFromCloud();assert.equal(store.getAll().length,1);
  release();await settled(store);assert.equal(store.getAll()[0].version,1);
});

const archive = n => Array.from({length:n},(_,i)=>({id:String(i),name:`Report${i}`,userId:'u1',version:1,tags:[],rawXml:'x'.repeat(1000)}));

test('50-report delete has intermediate progress and bounded requests',async()=>{
  let active=0,max=0;const updates=[];
  const {store}=await storeFixture(null,{loadActiveReports:async()=>archive(2300),moveToTrash:async()=>{
    max=Math.max(max,++active);await new Promise(r=>setTimeout(r,2));active--;return {version:2};
  }});
  await store.moveManyToTrash(Array.from({length:50},(_,i)=>String(i)),{onProgress:p=>updates.push(p)});
  assert.equal(max,4);assert.equal(store.getAll().length,2250);assert.equal(store.getTrash().length,50);
  assert.equal(updates[0].completed,0);assert.equal(updates.at(-1).completed,50);
  assert.ok(updates.some(p=>p.completed===4&&p.total===50));
  assert.ok(store.getTrash().every(r=>r.version===2));
});

test('partial delete keeps successful deletions and retains failed records',async()=>{
  const {store}=await storeFixture(null,{loadActiveReports:async()=>archive(50),moveToTrash:async id=>{
    if(id==='3'||id==='7')throw Error('Simulated failure');return {version:2};
  }});
  await assert.rejects(store.moveManyToTrash(archive(50).map(r=>r.id)),/48 rapor işlendi, 2 rapor işlenemedi/);
  assert.deepEqual(Array.from(store.getAll(),r=>r.id).sort(),['3','7']);
  assert.equal(store.getTrash().length,48);
});

test('2300-report reset reports progress and clears only after verified server results',async()=>{
  let count=0,emptied=0;const updates=[];
  const {store}=await storeFixture(null,{loadActiveReports:async()=>archive(2300),purgeReport:async()=>{count++;return true},emptyTrash:async()=>{emptied++;return true}});
  await store.resetAllUserData({onProgress:p=>updates.push(p)});
  assert.equal(count,2300);assert.equal(emptied,1);assert.equal(store.getAll().length,0);
  assert.ok(updates.some(p=>p.completed===24&&p.total===2300));
  assert.equal(updates.at(-1).completed,2300);
});

test('reset failure is visible, keeps failed reports, and skips later destructive steps',async()=>{
  let emptied=false;
  const {store}=await storeFixture(null,{loadActiveReports:async()=>archive(12),purgeReport:async id=>id!=='5',emptyTrash:async()=>{emptied=true;return true}});
  await assert.rejects(store.resetAllUserData(),/1 rapor işlenemedi/);
  assert.equal(store.getAll().length,1);assert.equal(store.getAll()[0].id,'5');assert.equal(emptied,false);
});

test('barcode classification is reused until source changes',async()=>{
  const records=archive(2300);records.forEach(r=>r.tags=['Barkod']);
  const {store,context}=await storeFixture(null,{loadActiveReports:async()=>records});
  let checks=0;context.FrpTags={isBarcodeReport:()=>{checks++;return true}};
  for(let i=0;i<6;i++)store.getAll();
  assert.equal(checks,2300);
  records[0].rawXml+='changed';store.getAll();assert.equal(checks,2301);
});

test('2300-report reset uses 46 compact batch requests and tracks actual completed reports',async()=>{
  let calls=0;const updates=[];
  const {store}=await storeFixture(null,{loadActiveReports:async()=>archive(2300),emptyTrash:async()=>true,
    bulkLifecycle:async(action,items)=>{assert.equal(action,'purge');assert.ok(items.length<=50);calls++;return items.map(r=>({id:r.id,success:true}))}});
  await store.resetAllUserData({onProgress:p=>updates.push(p)});
  assert.equal(calls,46);assert.equal(store.getAll().length,0);
  assert.ok(updates.some(p=>p.completed===50));assert.equal(updates.at(-1).completed,2300);
});

test('886-report bulk delete uses 18 requests and retains unconfirmed results',async()=>{
  let calls=0;const updates=[];
  const {store}=await storeFixture(null,{loadActiveReports:async()=>archive(2300),
    bulkLifecycle:async(action,items)=>{assert.equal(action,'trash');calls++;return items.map(r=>({id:r.id,success:r.id!=='10',version:2}))}});
  await assert.rejects(store.moveManyToTrash(archive(886).map(r=>r.id),{onProgress:p=>updates.push(p)}),/885 rapor işlendi, 1 rapor işlenemedi/);
  assert.equal(calls,18);assert.equal(store.getAll().length,1415);assert.ok(store.getById('10'));
  assert.equal(store.getTrash().length,885);assert.equal(updates.at(-1).completed,886);
});
test('trash restore and purge use bounded batches and retain failed records',async()=>{
 const calls=[];
 const {store}=await storeFixture(null,{loadActiveReports:async()=>archive(120),bulkLifecycle:async(action,items)=>{
 calls.push({action,count:items.length});return items.map(item=>({...item,success:!(action==='restore'&&item.id==='3'),version:item.version+1}));
 }});
 await store.refreshFromCloud();await store.moveManyToTrash(archive(120).map(r=>r.id));
 const updates=[];
 await assert.rejects(store.restoreManyFromTrash(archive(120).map(r=>r.id),{onProgress:p=>updates.push({...p})}),/119 rapor işlendi, 1 rapor işlenemedi/);
 assert.equal(store.getAll().length,119);assert.equal(store.getTrash().length,1);
 assert.equal(store.getAll()[0].version,3);assert.equal(updates.at(-1).completed,120);
 await store.purgeManyFromTrash(['3']);assert.equal(store.getTrash().length,0);
 assert.ok(calls.every(c=>c.count<=50));assert.equal(calls.filter(c=>c.action==='restore').length,3);
});
