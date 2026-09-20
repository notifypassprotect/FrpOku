const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { registerChatMessageListRoute } = require('../server/routes/chat_messages');
const { registerChatSendRoute } = require('../server/routes/chat_send');
const { registerChatStateRoutes } = require('../server/routes/chat_state');
const { createChatMessageService } = require('../server/services/chat_message_service');
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
  const reply=h.response();await handler(req({receiverId:'peer',text:'reply',clientMessageId:'reply-id-789',replyTo:{id:a.body.message.id,text:'spoof'}}),reply);
  assert.equal(reply.statusCode,200);assert.equal(reply.body.message.replyTo.id,a.body.message.id);
  assert.equal(reply.body.message.replyTo.text,'same','reply preview is rebuilt from the server message');
  const invalid=h.response();await handler(req({receiverId:'peer',text:'bad reply',clientMessageId:'reply-id-000',replyTo:{id:'missing'}}),invalid);
  assert.equal(invalid.statusCode,400);assert.equal(messages.length,3);
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

test('chat UI keeps read-only reconnect safe and reaction pills interactive', () => {
  const fs=require('node:fs'), path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../js/core/online_presence.js'),'utf8');
  assert.match(source,/if \(input\) input\.disabled = true/);
  assert.match(source,/if \(btnSend\) btnSend\.disabled = true/);
  assert.ok(source.includes('class="frp-chat-reaction-pill'));
  assert.match(source,/pendingNewCount \+= newIncomingCount/);
  assert.match(source,/behavior: reducedMotion \? 'auto' : 'smooth'/);
});

test('chat reconnect, deletion and mobile viewport flows fail safely', () => {
  const fs=require('node:fs'), path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../js/core/online_presence.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../css/online_presence.css'),'utf8');
  assert.match(source,/window\.addEventListener\('offline', onNetworkOffline\)/);
  assert.match(source,/Date\.now\(\) - failedText\.failedAt > 10 \* 60 \* 1000/);
  assert.match(source,/autoRetryAttempts >= 1/);
  assert.match(source,/if \(!response\.ok \|\| !data\.success\) throw new Error/);
  assert.match(source,/window\.visualViewport\?\.addEventListener\('resize', syncMobileViewport\)/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
});

test('chat removes canned replies and groups nearby messages from the same sender', () => {
  const fs=require('node:fs'), path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../js/core/online_presence.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../css/online_presence.css'),'utf8');
  assert.doesNotMatch(source,/frp-chat-quick-replies|frp-chat-quick-chip|data-quick=/);
  assert.match(source,/charCount\.hidden = length < 800/);
  assert.match(source,/elapsed <= 5 \* 60 \* 1000/);
  assert.match(source,/classList\.add\('grouped-with-previous'\)/);
  assert.match(source,/previousMessage\.classList\.add\('grouped-with-next'\)/);
  assert.match(css,/\.frp-chat-msg\.grouped-with-previous/);
  assert.match(css,/\.frp-chat-msg\.grouped-with-next \.frp-chat-msg-time/);
  assert.match(css,/\.frp-chat-msg\.incoming\.grouped-with-previous \.frp-chat-sender-name/);
});

test('conversation list reflects open chats and the composer uses a unified focus surface', () => {
  const fs=require('node:fs'), path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../js/core/online_presence.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../css/online_presence.css'),'utf8');
  assert.match(source,/row\.classList\.toggle\('conversation-open', activeChatWindows\.has\(chatKey\)\)/);
  assert.match(source,/syncOpenConversationRows\(\)/);
  assert.match(css,/\.frp-presence-item\.conversation-open/);
  assert.match(css,/\.frp-chat-input-row:focus-within/);
});

test('reply metadata is validated, persisted and rendered as navigation', () => {
  const fs=require('node:fs'), path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../js/core/online_presence.js'),'utf8');
  const service=fs.readFileSync(path.join(__dirname,'../server/services/chat_message_service.js'),'utf8');
  const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/012_chat_replies.sql'),'utf8');
  assert.ok(source.includes('class="frp-chat-reply-composer"'));
  assert.ok(source.includes('class="frp-chat-reply-quote"'));
  assert.match(source,/replyTo: payload\.replyTo\?\.id \? \{ id: payload\.replyTo\.id \} : null/);
  assert.match(service,/reply_to: message\.replyTo \|\| null/);
  assert.match(migration,/add column if not exists reply_to jsonb/);
});

test('reply persistence falls back safely before the reply column migration runs', async () => {
  const calls=[];
  const supabase={from:()=>({upsert:async row=>{calls.push(row);return calls.length===1
    ? {error:{message:"Could not find the 'reply_to' column"}}:{error:null};}})};
  const service=createChatMessageService({safeLogStr:String,store:{read:()=>[],write:()=>{}},supabase});
  await service.persistChatMessage({id:'m1',senderId:'me',receiverId:'peer',roomId:null,groupId:null,
    senderName:'Me',senderUsername:'me',senderAvatar:'M',text:'reply',attachment:null,voice:null,
    replyTo:{id:'original',senderName:'Peer',text:'hello'},reactions:{},createdAt:new Date().toISOString()});
  assert.equal(calls.length,2);assert.equal(calls[1].reply_to,undefined);
  assert.equal(calls[1].attachment.replyTo.id,'original');
});
