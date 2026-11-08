import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createSessionHeartbeat,SESSION_HEARTBEAT_MS} from '../src/services/sessionHeartbeat.js'

function setup(request=async()=>({status:200})){
  let time=0,visible=true,token='first',calls=0,kicks=0
  const heartbeat=createSessionHeartbeat({getToken:()=>token,isVisible:()=>visible,now:()=>time,
    request:async(...args)=>{calls++;return request(...args)},onUnauthorized:()=>kicks++})
  return {heartbeat,setTime:n=>time=n,setVisible:v=>visible=v,setToken:v=>token=v,counts:()=>({calls,kicks})}
}
test('heartbeat interval is 15 seconds and hidden tabs do not poll',async()=>{
  assert.equal(SESSION_HEARTBEAT_MS,15000)
  const h=setup();h.setVisible(false);await h.heartbeat.check();assert.equal(h.counts().calls,0)
  h.setVisible(true);await h.heartbeat.check();assert.equal(h.counts().calls,1)
})
test('overlapping checks and duplicate focus events issue only one request',async()=>{
  let resolve
  const h=setup(()=>new Promise(r=>{resolve=r}))
  const first=h.heartbeat.check();h.setTime(3000);await h.heartbeat.check();assert.equal(h.counts().calls,1)
  resolve({status:200});await first
  const next=h.heartbeat.check();assert.equal(h.counts().calls,2)
  resolve({status:200});await next
})
test('completed checks debounce focus/visibility events within two seconds',async()=>{
  const h=setup();await h.heartbeat.check();await h.heartbeat.check();assert.equal(h.counts().calls,1)
  h.setTime(15000);await h.heartbeat.check();assert.equal(h.counts().calls,2)
})
test('a confirmed 401 still kicks the current session; network failure does not',async()=>{
  const h=setup(async()=>({status:401,json:async()=>({success:false,code:'SESSION_KICKED'})}))
  await h.heartbeat.check();assert.equal(h.counts().kicks,1)
  const offline=setup(async()=>{throw new Error('offline')});await offline.heartbeat.check();assert.equal(offline.counts().kicks,0)
})
test('late 401 cannot clear a newer account or a stopped listener',async()=>{
  for(const stop of [false,true]){
    let resolve
    const h=setup(()=>new Promise(r=>{resolve=r}));const pending=h.heartbeat.check()
    if(stop)h.heartbeat.stop();else h.setToken('second')
    resolve({status:401,json:async()=>({success:false})});await pending
    assert.equal(h.counts().kicks,0)
  }
})
