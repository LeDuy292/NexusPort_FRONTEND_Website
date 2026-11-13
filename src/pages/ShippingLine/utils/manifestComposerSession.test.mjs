import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { saveManifestComposerSession, readManifestComposerSession, clearManifestComposerSession } from './manifestComposerSession.js'

function storage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
}
beforeEach(() => {
  globalThis.localStorage = storage()
  globalThis.sessionStorage = storage()
  localStorage.setItem('user', JSON.stringify({ id: 'shipping-line-a' }))
})
test('round trip to registration preserves the currently edited bill and all other bills', () => {
  const session = { form: { requestKey: 'same-save-key', voyageNumber: 'V-001', bills: [{ blNumber: 'BL-A', containers: [{ commodity: 'Hàng đã nhập', grossWeightKg: 18000 }] }] },
    editingBill: { blNumber: 'BL-B', shipper: 'Exporter', consignee: 'Importer', containers: [{ containerNumber: 'CSQU3054383', sealNumber: 'SEAL-A', commodity: 'Cá đông lạnh', grossWeightKg: '23000' }] },
    billIndex: null, initialManifest: { id: 'existing-draft', revision: 3 } }
  saveManifestComposerSession(session)
  assert.deepEqual(readManifestComposerSession(), session)
  clearManifestComposerSession()
  assert.equal(readManifestComposerSession(), null)
})
test('does not expose another account’s unfinished cargo after account changes', () => {
  saveManifestComposerSession({ editingBill: { consignee: 'Private cargo' } })
  localStorage.setItem('user', JSON.stringify({ id: 'shipping-line-b' }))
  assert.equal(readManifestComposerSession(), null)
  clearManifestComposerSession()
  localStorage.setItem('user', JSON.stringify({ id: 'shipping-line-a' }))
  assert.equal(readManifestComposerSession().editingBill.consignee, 'Private cargo')
})
test('unavailable or corrupt browser storage does not crash the Manifest page', () => {
  sessionStorage.getItem = () => '{invalid json'
  assert.equal(readManifestComposerSession(), null)
  localStorage.getItem = () => { throw new Error('Storage denied') }
  assert.equal(readManifestComposerSession(), null)
  assert.doesNotThrow(clearManifestComposerSession)
})
