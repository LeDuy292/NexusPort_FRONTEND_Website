import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
const source = (await readFile(new URL('../src/services/apiClient.js', import.meta.url), 'utf8')).replace('import.meta.env.VITE_API_URL', 'undefined').replace("'./sessionValidation'", JSON.stringify(new URL('../src/services/sessionValidation.js', import.meta.url).href))
const api = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default
const storage = () => { const entries = new Map(); return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) } }
const login = token => { localStorage.setItem('user', JSON.stringify({token})); window.location.href = '' }
globalThis.localStorage = storage(); globalThis.sessionStorage = storage()
globalThis.window = { location: { origin: 'http://localhost:5173', pathname: '/drivers', href: '' } }

test('fleet API errors preserve valid sessions and ignore stale 401 responses', async () => {
  login('current')
  globalThis.fetch = async url => { assert.equal(url.searchParams.get('status'), 'active'); assert.equal(url.searchParams.get('carrierId'), 'one'); return Response.json({Message:'Company profile missing'}, {status:403}) }
  await assert.rejects(api.get('/v1/Vehicle?status=active', {params:{carrierId:'one'}}), /Company profile missing/)
  assert.ok(localStorage.getItem('user')); assert.equal(window.location.href, '')
  globalThis.fetch = async () => { login('new-login'); return Response.json({message:'Old request'}, {status:401}) }
  await assert.rejects(api.get('/v1/Vehicle'))
  assert.equal(JSON.parse(localStorage.getItem('user')).token, 'new-login'); assert.equal(window.location.href, '')
  globalThis.fetch = async url => Response.json(url.pathname === '/api/auth/me' ? {success:false,code:'TOKEN_EXPIRED'} : {message:'Session expired'}, {status:401})
  await assert.rejects(api.get('/v1/Vehicle'), /Session expired/)
  assert.equal(localStorage.getItem('user'), null); assert.equal(window.location.href, '/login')
})
test('network failures and timeouts do not clear login', async () => {
  login('valid')
  globalThis.fetch = async () => { throw new TypeError('Network failure') }
  await assert.rejects(api.get('/v1/Vehicle'), /Network failure/)
  globalThis.fetch = async () => { throw new DOMException('Timeout', 'TimeoutError') }
  await assert.rejects(api.get('/v1/Driver'), /phản hồi quá chậm/)
  assert.ok(localStorage.getItem('user')); assert.equal(window.location.href, '')
})
test('multipart requests retain browser boundary and JSON payloads keep headers', async () => {
  const form = new FormData(); form.append('file', 'fixture')
  globalThis.fetch = async (_url, options) => { assert.equal(options.headers['Content-Type'], undefined); assert.equal(options.body, form); return Response.json({ok:true}) }
  await api.post('/v1/Vehicle/upload-photo', form, {headers:{'Content-Type':'multipart/form-data'}})
  globalThis.fetch = async (_url, options) => { assert.equal(options.headers['Content-Type'], 'application/json'); assert.deepEqual(JSON.parse(options.body), {driverId:'fixture'}); return new Response(null, {status:204}) }
  assert.deepEqual(await api.patch('/v1/Vehicle/fixture/assign-driver', {driverId:'fixture'}), {data:null})
})

test('business-service 401 cannot end a valid login session', async () => {
  login('still-valid')
  globalThis.fetch = async url => url.pathname === '/api/auth/me' ? Response.json({success:true,data:{user:{}}}) : Response.json({code:'SESSION_KICKED'}, {status:401})
  await assert.rejects(api.get('/v1/Vehicle'), /chưa xác thực/)
  assert.equal(JSON.parse(localStorage.getItem('user')).token, 'still-valid'); assert.equal(window.location.href, '')
})
test('unknown auth errors and an unavailable auth server keep the login', async () => {
  for (const mode of ['empty-401','offline']) {
    login('valid')
    globalThis.fetch = async url => {
      if (url.pathname === '/api/auth/me' && mode === 'offline') throw new TypeError('offline')
      return Response.json({}, {status:401})
    }
    await assert.rejects(api.get('/v1/Driver'))
    assert.ok(localStorage.getItem('user')); assert.equal(window.location.href, '')
  }
})
test('a delayed auth verdict cannot delete a newer login', async () => {
  const {verifySession} = await import('../src/services/sessionValidation.js')
  login('old-login')
  let release
  globalThis.fetch = () => new Promise(resolve => { release = resolve })
  const verdict = verifySession('old-login')
  login('new-login')
  release(Response.json({success:false,code:'TOKEN_EXPIRED'}, {status:401}))
  assert.equal(await verdict, 'stale')
  assert.equal(JSON.parse(localStorage.getItem('user')).token, 'new-login'); assert.equal(window.location.href, '')
})
test('simultaneous service failures share one session verification request', async () => {
  const {verifySession} = await import('../src/services/sessionValidation.js')
  login('same-session')
  let calls=0, release
  globalThis.fetch = () => { calls++; return new Promise(resolve => { release=resolve }) }
  const first=verifySession('same-session'); const second=verifySession('same-session')
  assert.equal(calls,1)
  release(Response.json({success:true}))
  assert.deepEqual(await Promise.all([first,second]), ['valid','valid'])
})

test('Node and Express clients also verify the login authority before redirecting', async () => {
  for (const name of ['nodeApiClient','expressApiClient']) {
    const body=(await readFile(new URL('../src/services/' + name + '.js', import.meta.url),'utf8'))
      .replace('import.meta.env.VITE_NODE_API_URL','undefined')
      .replace("'./sessionValidation'",JSON.stringify(new URL('../src/services/sessionValidation.js',import.meta.url).href))
    const client=(await import('data:text/javascript;base64,'+Buffer.from(body).toString('base64'))).default
    login('active-session')
    globalThis.fetch=async url => new URL(url,window.location.origin).pathname === '/api/auth/me'
      ? Response.json({success:true}) : Response.json({message:'Service unauthorized'},{status:401})
    await assert.rejects(client.get('/fixture'))
    assert.ok(localStorage.getItem('user'));assert.equal(window.location.href,'')
  }
})
