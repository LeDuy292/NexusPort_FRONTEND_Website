import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPlateNumber, matchesPlateSearch, normalizePlate } from '../src/utils/format.js'
import { gateBookingLookup } from '../src/features/booking-dispatch/gateBookingLookup.js'

test('OCR, old booking and gate order use the same plate identity and display', () => {
  for (const input of ['29Y3-036.58', '29-Y3036.58', '29Y303658', ' 29 y3 036 58 ']) {
    assert.equal(normalizePlate(input), '29Y303658')
    assert.equal(formatPlateNumber(input), '29Y3-036.58')
    assert.ok(matchesPlateSearch('29-Y3036.58', input))
  }
  assert.equal(matchesPlateSearch('29Y3-036.58', '29Y3-036.59'), false)
  assert.equal(matchesPlateSearch('29Y3-036.58', '---'), false)
})

test('car and multi-letter series are formatted without dropping or moving digits', () => {
  assert.equal(formatPlateNumber('51c12345'), '51C-123.45')
  assert.equal(formatPlateNumber('80ld12345'), '80LD-123.45')
  assert.equal(formatPlateNumber('29C-1234'), '29C-1234')
  assert.equal(formatPlateNumber('—'), '—')
  assert.equal(formatPlateNumber(null), '')
})

const canceled = { bookingCode: 'BK-OLD', vehiclePlate: '29-Y3036.58', status: 'Canceled' }
const ready = { bookingCode: 'BK-CURRENT', vehiclePlate: '29Y3-036.58', status: 'Approved' }

test('plate lookup lets the server select the current entry order instead of forcing a canceled booking', () => {
  for (const query of ['29Y3-036.58', '29-Y3036.58', '29Y303658']) {
    const result = gateBookingLookup([canceled, ready], query)
    assert.equal(result.profileBooking, ready)
    assert.equal(result.bookingNumber, undefined)
  }
  assert.equal(gateBookingLookup([canceled], '29Y3-036.58').bookingNumber, undefined)
})

test('only an explicitly entered booking code selects that booking', () => {
  assert.equal(gateBookingLookup([canceled, ready], ' bk-current ').bookingNumber, 'BK-CURRENT')
  assert.equal(gateBookingLookup([canceled, ready], 'BK-OLD').bookingNumber, 'BK-OLD')
  assert.equal(gateBookingLookup([canceled, ready], '29Y3-036.59').profileBooking, undefined)
  assert.equal(gateBookingLookup([canceled, ready], '').profileBooking, undefined)
})
