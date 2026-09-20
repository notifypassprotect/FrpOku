const test=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs'), path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/list/rich_note_editor.js'),'utf8');
const saveCode=source.slice(source.indexOf('    async function saveNote('),source.indexOf("    overlay.querySelector('#btnRichNoteSave').addEventListener",source.indexOf('    async function saveNote(')));
function setup(ok) {
  const button={disabled:false}, status={}, calls={draft:0,update:0,closed:0};
  const ctx={saveBusy:false,uploadsPending:0,editorUserId:'me',fileId:'report',draftKey:'draft',savedSnapshot:'old',
    editor:{innerText:'New note',innerHTML:'<p>New note</p>'},attachments:[],saveStatus:status,
    snapshot:()=> 'new',sanitizeRichHtml:v=>v,overlay:{querySelector:()=>button},
    window:{FrpAuth:{getUser:()=>({id:'me'}),getAuthHeaders:()=>({})},FrpStore:{updateNote:()=>calls.update++},refreshAll(){},toast(){}},
    fetch:async()=>({ok,json:async()=>({success:ok,reason:'Denied'})}),
    localStorage:{removeItem(){}},persistDraft:()=>calls.draft++,close:()=>calls.closed++};
  vm.createContext(ctx);vm.runInContext(saveCode,ctx);return {ctx,calls,button,status};
}
test('failed note save retains editor and draft without updating local report',async()=>{
  const {ctx,calls,button,status}=setup(false);await ctx.saveNote();
  assert.equal(calls.closed,0);assert.equal(calls.update,0);assert.equal(calls.draft,1);
  assert.equal(button.disabled,false);assert.match(status.textContent,/Kaydedilemedi/);
});
test('confirmed note save updates local report and closes once',async()=>{
  const {ctx,calls}=setup(true);await ctx.saveNote();assert.equal(calls.update,1);assert.equal(calls.closed,1);
});
test('edits made during a save remain open as a new draft',async()=>{
  const {ctx,calls}=setup(true);let i=0;ctx.snapshot=()=>++i===1?'sent':'new edits';await ctx.saveNote();
  assert.equal(calls.update,1);assert.equal(calls.closed,0);assert.equal(calls.draft,1);
});
test('changed session does not submit an old users note',async()=>{
  const {ctx,calls}=setup(true);ctx.window.FrpAuth.getUser=()=>({id:'another'});
  ctx.fetch=()=>{throw new Error('Must not send')};await ctx.saveNote();assert.equal(calls.update,0);assert.equal(calls.closed,0);
});

test('attachment requests never place authentication tokens in URLs', () => {
  const editorSource = fs.readFileSync(path.join(__dirname,'../js/list/rich_note_editor.js'),'utf8');
  assert.doesNotMatch(editorSource, /[?&]token=|encodeURIComponent\(token\)|frpoku_auth_token/);
  assert.match(editorSource, /resolved\.origin !== window\.location\.origin/);
  assert.match(editorSource, /credentials: 'same-origin'/);
});
