import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {cleanDesign,MODULE_PITCH} from '../src/features/yard-design/geometry.js'
import {slotAddress} from '../src/features/yard-design/positions.js'
const layout=cleanDesign(JSON.parse(fs.readFileSync(new URL('../src/features/yard-design/tienSaLayout.json',import.meta.url))))
test('user length counts drive proportional block geometry and distinguish estimates',()=>{
 for(const area of layout.areas){
  const count=area.sector==='A'?[29,27,24,20][Number(area.code.slice(1))-1]:area.sector==='B'?28:area.sector==='C'?29:area.sector==='D'?16:null
  if(count!==null){assert.equal(area.planning.bayModules,count);assert.equal(area.planning.lengthBasis,'user-count')}
  else{assert.equal(area.planning.lengthBasis,'estimated');assert.ok(area.planning.bayModules>0)}
  assert.equal(area.height,area.planning.bayModules*MODULE_PITCH)
 }
})
test('20ft addresses and 40ft paired modules respect block, row and tier limits',()=>{
 const area=layout.areas.find(a=>a.code==='A01')
 assert.equal(slotAddress(area,28,4,3,20).code,'A01.57.04.3')
 assert.deepEqual(slotAddress(area,27,4,3,40),{bay:56,row:4,tier:3,code:'A01.56.04.3',modules:[55,57]})
 for(const args of [[28,1,1,40],[29,1,1,20],[-1,1,1,20],[0,7,1,20],[0,1,5,20],[0,0,1,20],[0,1,0,20],[0,1,1,45]])assert.equal(slotAddress(area,...args),null)
})
