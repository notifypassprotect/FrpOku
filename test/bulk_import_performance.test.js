const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

async function storeFixture(saveReport) {
  const storage = new Map();
  const user = { id: 'u1', role: 'admin' };
  const element = { classList: { add(){}, remove(){}, toggle(){} }, style: { setProperty(){} }, setAttribute(){} };
  const context = { console, Event: class {}, CustomEvent: class {}, setTimeout, clearTimeout, setInterval:()=>0,
    addEventListener(){}, dispatchEvent(){},
    localStorage: { getItem:k=>storage.get(k)||null, setItem:(k,v)=>storage.set(k,v), removeItem:k=>storage.delete(k) },
    document: { documentElement:element, body:element, getElementById:()=>null, querySelectorAll:()=>[], addEventListener(){} },
    FrpAuth: { getUser:()=>user, isLoggedIn:()=>true },
    FrpCloud: { loadActiveReports:async()=>[], saveReport }
  };
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/store/store_main.js'),'utf8'),context);
  await context.FrpStoreReady;
  return {store:context.FrpStore,user};
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
