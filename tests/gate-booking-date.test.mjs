import {test} from 'node:test'
import assert from 'node:assert/strict'
import {gateBookingDate} from '../src/features/booking-dispatch/gateBookingDate.js'

test('gate bookings after Vietnam midnight belong to the new day, even before UTC midnight',()=>{
  assert.equal(gateBookingDate('2026-10-17T18:36:00.588Z'),'2026-10-18')
  assert.equal(gateBookingDate('2026-10-17T17:00:00Z'),'2026-10-18')
  assert.equal(gateBookingDate('2026-10-17T16:59:59Z'),'2026-10-17')
})
test('invalid or missing booking date is not invented',()=>{
  assert.equal(gateBookingDate(null),'')
  assert.equal(gateBookingDate('invalid'),'')
})
