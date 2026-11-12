import assert from 'node:assert/strict'
import { declarationProblems, equipmentAssessment, equipmentDemand, preparationContent, preparedSource, requestProblems } from '../src/features/booking-dispatch/exportPreparation.js'

const source = { containerId: 'a', declarationId: 'd', containerNumber: 'MSCU1234566', containerTypeCode: '20GP', cargoType: 'general', sealNumber: 'SOURCE', grossWeightKg: 18000 }
assert.equal(preparedSource(source).vgmKg, null, 'declared cargo weight never becomes VGM')
assert.equal(preparedSource(source).sealNumber, 'SOURCE', 'seal retains declaration provenance')
const selected = preparationContent({ shippingLineId: 'line', voyageId: 'voyage', containers: [source, { ...source, containerId: 'b', declarationId: 'e', containerTypeCode: '40HC' }] })
assert.deepEqual(equipmentDemand(selected), [{ typeCode: '20GP', quantity: 1 }, { typeCode: '40HC', quantity: 1 }], 'mixed sizes are counted independently')
assert.deepEqual(requestProblems(selected), [], 'VGM and fleet are optional at capacity request stage')
const capacity = preparationContent({ mode: 'capacity', shippingLineId: 'line', voyageId: 'voyage', equipmentRequests: [{ typeCode: '40HC', quantity: 50 }] })
assert.deepEqual(requestProblems(capacity), [], 'unknown container numbers can request capacity up to 50')
assert.ok(requestProblems({ ...capacity, equipmentRequests: [{ typeCode: '40HC', quantity: 51 }] }).length, '51 exceeds the booking limit')
assert.ok(requestProblems({ ...selected, containers: [selected.containers[0], selected.containers[0]] }).length, 'duplicate physical container rejected')
assert.ok(requestProblems({ ...selected, containers: [selected.containers[0], { ...selected.containers[1], cargoType: 'reefer' }] }).length, 'different cargo cannot silently form a batch')
const restored = preparationContent({ ...selected, containers: [{ ...source, vgmKg: '', targetTemperature: '' }] }, 'booking')
assert.equal(restored.containers[0].vgmKg, null, 'blank verified weight is preserved as missing')
assert.equal(restored.bookingId, 'booking', 'draft can resume the same dossier')
const approved = [{ typeCode: '20GP', quantity: 1 }, { typeCode: '40HC', quantity: 1 }]
assert.deepEqual(equipmentAssessment(approved, selected.containers), [
  { typeCode: '20GP', approved: 1, selected: 1, remaining: 0, excess: 0 },
  { typeCode: '40HC', approved: 1, selected: 1, remaining: 0, excess: 0 },
], 'approved structure distinguishes declared equipment sizes')
assert.deepEqual(declarationProblems(selected, approved), [], 'exact approved structure can proceed to cargo verification')
assert.ok(declarationProblems({ ...selected, containers: [selected.containers[0]] }, approved).some(problem => problem.includes('40HC: còn thiếu 1')), 'missing equipment is identified before sending')
const wrongSizes = { ...selected, containers: [selected.containers[0], { ...selected.containers[1], containerTypeCode: '20GP' }] }
assert.ok(declarationProblems(wrongSizes, approved).some(problem => problem.includes('20GP: đã chọn 2, vượt 1')), 'same total with wrong size allocation is blocked')
assert.ok(declarationProblems(selected, [{ typeCode: '20GP', quantity: 2 }]).some(problem => problem.includes('40HC: đã chọn 1, vượt 1')), 'unapproved equipment is reported explicitly')
const fifty = Array.from({ length: 50 }, (_, index) => ({ ...source, containerId: `container-${index}`, declarationId: `declaration-${index}` }))
assert.deepEqual(declarationProblems({ ...selected, containers: fifty }, [{ typeCode: '20GP', quantity: 50 }]), [], 'an exact 50-container allocation remains valid')
console.log('16 export preparation checks passed.')
