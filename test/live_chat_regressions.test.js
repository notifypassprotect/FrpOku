const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { registerChatMessageListRoute } = require('../server/routes/chat_messages');
const { registerChatSendRoute } = require('../server/routes/chat_send');
const { registerChatStateRoutes } = require('../server/routes/chat_state');
function harness() {
  const handlers = new Map();
  const app = Object.fromEntries(['get','post'].map(method => [method, (path, ...fns) => handlers.set(path, fns.at(-1))]));
  function response() {
    const res = new EventEmitter(); res.statusCode = 200;
    res.status = code => { res.statusCode = code; return res; };
    res.json = data => { res.body = data; res.emit('done'); return res; };
    return res;
  }
  return { app, handlers, response };
}
const auth = (req, res, next) => next();
const req = (body = {}, query = {}) => ({ authUser: { id:'me', username:'Me', role:'admin' }, body, query });

test('long poll replies to a new message and releases its disconnect listener', async () => {
  const h = harness(), messages = [];
  registerChatMessageListRoute(h.app, { activeChatTyping:new Map(), canAccessChatGroup:()=>true, canAccessChatRoom:()=>true,
    ensureChatMessagesHydrated:async()=>{}, getChatMessages:()=>messages, requireAuth:auth });
  const handler = h.handlers.get('/api/chat/messages');
  const first = h.response(); await handler(req({}, {peerId:'peer'}), first);
  const waiting = h.response(); await handler(req({}, {peerId:'peer', wait:'1', revision:first.body.revision}), waiting);
  assert.equal(waiting.body, undefined);
  messages.push({id:'new', senderId:'peer', receiverId:'me', text:'Hello'});
  await new Promise(resolve => waiting.once('done', resolve));
  assert.equal(waiting.body.messages.length, 1);
  assert.notEqual(waiting.body.revision, first.body.revision);
  assert.equal(waiting.listenerCount('close'), 0);
  const disconnected = h.response(); await handler(req({}, {peerId:'peer',wait:'1',revision:waiting.body.revision}), disconnected);
  disconnected.emit('close'); assert.equal(disconnected.listenerCount('close'), 0);
});

test('identical client message retries, including concurrent sends, persist once', async () => {
  const h=harness(), messages=[]; let saves=0;
  registerChatSendRoute(h.app, { canAccessChatGroup:()=>true,canAccessChatRoom:()=>true,chatPayloadSize:()=>0,
    ensureChatMessagesHydrated:async()=>{},getChatMessages:()=>messages,requireAuth:auth,
    persistChatMessage:async()=>{saves++; await new Promise(resolve=>setTimeout(resolve,10));},saveChatMessages:()=>{},scheduleChatEmailDigest:async()=>{} });
  const handler=h.handlers.get('/api/chat/send'), body={receiverId:'peer',text:'same',clientMessageId:'retry-id-123'};
  const a=h.response(), b=h.response(); await Promise.all([handler(req(body),a),handler(req(body),b)]);
  assert.equal(saves,1);assert.equal(messages.length,1);assert.equal(a.body.message.id,b.body.message.id);
  const other=h.response();await handler(req({...body,clientMessageId:'different-456'}),other);
  assert.equal(messages.length,2,'same text is still a distinct message when intentionally sent again');
});

test('typing stop clears only the matching conversation and read receipt is bounded by ids', async () => {
  const h=harness(), typing=new Map(); const messages=[{id:'seen',senderId:'peer',receiverId:'me'},{id:'newer',senderId:'peer',receiverId:'me'}];
  registerChatStateRoutes(h.app, {activeChatTyping:typing,canAccessChatGroup:()=>true,canAccessChatRoom:()=>true,
    clearChatEmailTimer:()=>{},ensureChatMessagesHydrated:async()=>{},getChatMessages:()=>messages,requireAuth:auth,safeLogStr:String,saveChatMessages:()=>{},supabase:null});
  const type=h.handlers.get('/api/chat/typing');
  type(req({peerId:'peer'}),h.response());type(req({groupId:'peer'}),h.response());
  type(req({peerId:'peer',isTyping:false}),h.response());assert.equal(typing.size,1);assert.equal([...typing.values()][0].targetType,'group');
  await h.handlers.get('/api/chat/mark-read')(req({peerId:'peer',messageIds:['seen']}),h.response());
  assert.equal(messages[0].isRead,true);assert.equal(messages[1].isRead,undefined);
});

test('unread snapshot updates badges without const reassignment failure', () => {
  const fs=require('node:fs'), vm=require('node:vm');
  const source=fs.readFileSync(require('node:path').join(__dirname,'../js/core/online_presence.js'),'utf8');
  const start=source.indexOf('  function handleUnreadUpdate('), end=source.indexOf('  function updateDockBadges(',start);
  const ctx={unreadData:{bySender:{},total:0},lastTotalUnread:0,areChatNotificationsEnabled:()=>false,updateDockBadges:()=>{},Number,Object};
  vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
  ctx.handleUnreadUpdate({bySender:{peer:3},total:3});
  assert.equal(ctx.unreadData.total,3);assert.equal(ctx.unreadData.bySender.peer,3);
  ctx.handleUnreadUpdate({bySender:{},total:0});assert.equal(ctx.unreadData.total,0);
});
