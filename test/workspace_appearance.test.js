const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
test('pool refresh preserves dark mode, palette and local font changes without cloud writeback', async () => {
  const storage = new Map([['frpoku_theme:u1','dark'], ['frpoku_theme','dark']]);
  const classes = new Set(), attributes = {}, styles = {};
  const root = { classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}, setAttribute:(k,v)=>attributes[k]=v,
    style:{setProperty:(k,v)=>styles[k]=v} };
  let cloudWrites=0;
  const context={console, setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
    addEventListener(){},dispatchEvent(){},CustomEvent:class{},MutationObserver:class{observe(){}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    document:{documentElement:root,body:root,readyState:'complete',getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){}},
    FrpAuth:{getUser:()=>({id:'u1'}),getToken:()=> 'token',isLoggedIn:()=>true},
    FrpCloud:{loadActiveReports:async()=>[],loadSettings:async()=>({theme:'light',preferences:{theme:'light',fontFamily:'inter'}}),saveSettings:async()=>{cloudWrites++;return true;}}
  };
  context.window=context;vm.createContext(context);
  for(const file of ['js/core/themes.js','js/store/store_main.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  await context.FrpStoreReady;
  assert.equal(attributes['data-theme'],'dark');assert.equal(cloudWrites,0);
  context.FrpThemes.applyCodeTheme('dracula');
  context.FrpStore.setPreferences({fontFamily:'manrope',codeFont:'ibmplexmono'});
  context.FrpStore.applyPreferences();
  const before=cloudWrites;
  context.FrpStore.setActiveWorkspace('pool');await context.FrpStore.refreshFromCloud();
  assert.equal(attributes['data-theme'],'dark');assert.ok(classes.has('code-theme-dracula'));
  assert.equal(styles['--font'],"'Manrope', sans-serif");assert.equal(styles['--mono'],"'IBM Plex Mono', monospace");
  assert.equal(cloudWrites,before);
});
