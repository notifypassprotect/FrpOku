const test=require('node:test');
const assert=require('node:assert/strict');
const {registerReportLifecycleRoutes}=require('../server/routes/report_lifecycle');
const access=require('../lib/report_access');

function fixture(records, supabase=null) {
  let rows=structuredClone(records),writes=0;const handlers={};
  const app={post:(path,...f)=>handlers[path]=f.at(-1),delete(){},patch(){}};
  registerReportLifecycleRoutes(app,{...access,supabase,apiWriteRateLimiter(){},requireAuth(){},
    readLocalReports:()=>structuredClone(rows),writeLocalReports:data=>{rows=data;writes++}});
  return {get rows(){return rows},get writes(){return writes},async request(body,user={id:'u1',role:'user'}){
    let status=200,payload;
    const res={status:n=>{status=n;return res},json:v=>{payload=v}};
    await handlers['/api/reports/bulk-lifecycle']({body,authUser:user},res);return {status,payload};
  }};
}
const records=()=>Array.from({length:50},(_,i)=>({id:String(i),user_id:i===49?'u2':'u1',version:2,rawXml:'private XML',data:{custom:'preserve'}}));

test('bulk trash checks ownership and version, preserves report contents, writes archive once',async()=>{
  const f=fixture(records());
  const response=await f.request({action:'trash',items:records().map(r=>({id:r.id,version:r.id==='3'?1:2}))});
  assert.equal(response.status,200);assert.equal(response.payload.results.filter(r=>r.success).length,48);
  assert.equal(f.writes,1);assert.equal(f.rows.find(r=>r.id==='3').isDeleted,undefined);
  assert.equal(f.rows.find(r=>r.id==='49').isDeleted,undefined);
  assert.equal(f.rows[0].version,3);assert.equal(f.rows[0].rawXml,'private XML');
  assert.deepEqual(f.rows[0].data,{custom:'preserve'});
});
test('bulk purge cannot delete another owner and rejects oversized batches',async()=>{
  const f=fixture(records());
  assert.equal((await f.request({action:'purge',items:Array.from({length:51},(_,i)=>({id:String(i)}))})).status,400);
  assert.equal(f.writes,0);
  const r=await f.request({action:'purge',items:[{id:'49'},{id:'0'}]});
  assert.equal(r.payload.results.filter(r=>r.success).length,1);assert.equal(f.rows.length,49);
  assert.ok(f.rows.some(r=>r.id==='49'));
});
test('administrator reset batch removes selected records and missing IDs are idempotent',async()=>{
  const f=fixture(records());
  const r=await f.request({action:'purge',items:[{id:'49'},{id:'missing'}]},{id:'admin',role:'admin'});
  assert.ok(r.payload.results.every(r=>r.success));assert.equal(f.rows.length,49);
});
test('database batch uses compact columns, ownership/version predicates and reports concurrent changes',async()=>{
  const calls=[];
  const sb={from(){let mutating=false;const q={
    select(columns){calls.push(['select',columns]);return q},
    update(values){mutating=true;calls.push(['update',values]);return q},
    delete(){mutating=true;calls.push(['delete']);return q},
    in(k,v){calls.push(['in',k,v]);return q},eq(k,v){calls.push(['eq',k,v]);return q},is(k,v){calls.push(['is',k,v]);return q},
    then(resolve){return Promise.resolve(mutating?{data:[{id:'0'}]}:{data:records().slice(0,2)}).then(resolve)}
  };return q}};
  const f=fixture([],sb);const r=await f.request({action:'trash',items:[{id:'0',version:2},{id:'1',version:2}]});
  assert.equal(r.payload.results.find(r=>r.id==='0').success,true);
  assert.equal(r.payload.results.find(r=>r.id==='1').success,false);
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='version'&&c[2]===2));
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='u1'));
  assert.ok(calls.filter(c=>c[0]==='select').every(c=>!c[1].includes('*')&&!c[1].includes('data')));
  assert.equal(calls.find(c=>c[0]==='update')[1].data,undefined);
});
test('restore batches keep missing/conflicting reports failed and preserve XML',async()=>{
 const f=fixture(records().map(r=>({...r,is_deleted:true,deleted_at:'2026-01-01'})));
 const r=await f.request({action:'restore',items:[{id:'0',version:2},{id:'1',version:1},{id:'missing',version:2},{id:'49',version:2}]});
 assert.equal(r.payload.results.filter(r=>r.success).length,1);
 assert.equal(f.rows[0].is_deleted,false);assert.equal(f.rows[0].deleted_at,null);
 assert.equal(f.rows[0].version,3);assert.equal(f.rows[0].rawXml,'private XML');
 assert.equal(f.rows[1].is_deleted,true);assert.equal(f.rows[49].is_deleted,true);
});
