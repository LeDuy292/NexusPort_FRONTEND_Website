import {useLayoutEffect,useRef,useState} from 'react'
import {padPosition,slotAddress,slotCoveringModule} from './positions'

export default function BlockDetail({area,onBack,maxModules=32,inventorySlots}){
 const gridViewport=useRef(null)
 const [cellWidth,setCellWidth]=useState(40)
 useLayoutEffect(()=>{
  const element=gridViewport.current
  if(!element)return
  const resize=()=>setCellWidth(Math.max(30,Math.floor((element.clientWidth-65-4*maxModules)/maxModules)))
  resize()
  const observer=new ResizeObserver(resize);observer.observe(element)
  return ()=>observer.disconnect()
 },[maxModules])
 const [size,setSize]=useState(area.planning.bayModules>1?40:20)
 const [selection,setSelection]=useState({module:0,row:1,tier:1})
 const {bayModules,rows,tiers,lengthBasis}=area.planning
 const live=Array.isArray(inventorySlots)
 const activeSlot=slotCoveringModule(inventorySlots,selection.module,selection.row,selection.tier)
 const address=activeSlot?{bay:activeSlot.bay,code:`${area.code}.${padPosition(activeSlot.bay)}.${padPosition(activeSlot.row)}.${activeSlot.tier}`,modules:Array.from({length:activeSlot.moduleSpan},(_,i)=>(activeSlot.moduleStart+i)*2-1)}:slotAddress(area,selection.module,selection.row,selection.tier,size)
 const displayedSize=activeSlot?.containerLengthFt||size
 const chooseSize=value=>{setSize(value);setSelection(current=>({...current,module:Math.min(current.module,bayModules-(value===40?2:1))}))}
 return <section className="yard-block-detail" aria-label={`Chi tiết block ${area.code}`}>
  <header className="yard-detail-heading"><div><button type="button" onClick={onBack}>← Toàn cảng</button><h2>Block {area.code}</h2><span className={lengthBasis==='user-count'?'count-source':'count-estimate'}>{lengthBasis==='user-count'?'Chiều dài theo số bạn cung cấp':'Chiều dài ước tính theo tỷ lệ'}</span></div><strong>{bayModules} vị trí 20ft / row</strong></header>
  <div className="yard-detail-metrics"><span><strong>{bayModules}</strong> mô-đun dọc Bay</span><span><strong>{rows}</strong> row</span><span><strong>{tiers}</strong> tier tối đa</span><span><strong>{bayModules*rows*tiers}</strong> TEU hình học</span></div>
  <p className="yard-detail-basis">{rows} row và {tiers} tier là giả định thiết kế. {live?'Xanh: đang lưu bãi · Vàng: đã giữ vị trí · Xám: bảo trì. Ô trống lấy theo cấu hình tồn kho hiện tại.':'Các ô dưới đây là ô quy hoạch, chưa có snapshot tồn kho.'}</p>
  <div className="yard-detail-workspace">
   <div className="yard-detail-plan">
    <div className="yard-detail-plan-heading"><h3>Mặt bằng Bay × Row</h3><span>Đầu dãy → cuối dãy · ô nền 20ft</span></div>
    <div ref={gridViewport} className="yard-detail-grid-scroll"><div className="yard-detail-grid" style={{gridTemplateColumns:`65px repeat(${bayModules},${cellWidth}px)`}}>
     <span className="yard-grid-axis">ROW / BAY</span>{Array.from({length:bayModules},(_,i)=><span className="yard-grid-bay" key={`b-${i}`}>{padPosition(i*2+1)}</span>)}
     {Array.from({length:rows},(_,i)=>rows-i).map(row=><div className="yard-detail-row" key={row}><span className="yard-grid-row">Row {padPosition(row)}</span>{Array.from({length:bayModules},(_,index)=>{
      const stored=slotCoveringModule(inventorySlots,index,row,selection.tier)
      const valid=live?!!stored:!!slotAddress(area,index,row,selection.tier,size)
      const selected=row===selection.row&&(live?!!activeSlot&&stored?.id===activeSlot.id:index===selection.module||size===40&&index===selection.module+1)
      return <button type="button" key={index} disabled={!valid} title={stored?`${stored.containerNumber||stored.reservedContainerNumber||'Ô trống'} · ${stored.containerLengthFt}ft · ${stored.status}`:undefined} aria-label={`Chọn Bay ${padPosition(stored?.bay??index*2+(size===40?2:1))} Row ${padPosition(row)}`} aria-pressed={selected} className={[selected?'chosen-slot':'',stored?`inventory-${stored.status}`:''].join(' ')} onClick={()=>setSelection(current=>({...current,module:stored?stored.moduleStart-1:index,row}))}><span/></button>
     })}</div>)}
    </div></div>
    <p className="yard-detail-convention">Quy ước đề xuất: bay lẻ cho 20ft; 40ft dùng bay chẵn giữa hai ô 20ft liền nhau. Row đánh số 01–06 theo chiều ngang block; không mặc định phía xe tiếp cận. Tier 1 bắt đầu tại nền bãi.</p>
   </div>
   <aside className="yard-slot-detail" aria-label="Vị trí quy hoạch đang chọn">
    <div className="yard-position-summary"><span className="yard-detail-eyebrow">VỊ TRÍ ĐANG CHỌN</span><output>{address?.code}</output>
    <dl><div><dt>Bay</dt><dd>{padPosition(address?.bay)}</dd></div><div><dt>Row</dt><dd>{padPosition(selection.row)}</dd></div><div><dt>Tier</dt><dd>{selection.tier}</dd></div></dl>
    <p>{live?`${displayedSize}ft · ${activeSlot?.containerNumber?`Đang lưu: ${activeSlot.containerNumber}`:activeSlot?.reservedContainerNumber?`Đã giữ: ${activeSlot.reservedContainerNumber}`:activeSlot?.status==='empty'?'Ô trống':activeSlot?.status||'Chưa cấu hình'}`:size===40?`40ft phủ hai ô 20ft: ${address?.modules.map(padPosition).join(' + ')}.`:'20ft sử dụng một ô nền.'}</p>
    {activeSlot?.containerLengthFt===45&&<p>Vị trí 45ft được chừa thêm khoảng đệm ở hai đầu.</p>}
    {area.sector==='D'&&activeSlot&&<p>{activeSlot.hasReeferPlug?'Vị trí có ổ cắm điện.':'Vị trí chưa gắn ổ cắm điện.'}</p>}
    </div><div className="yard-position-controls">    {!live&&<div className="yard-size-switch" role="group" aria-label="Kích thước container">{[20,40].map(value=><button type="button" key={value} disabled={value===40&&bayModules<2} aria-pressed={size===value} onClick={()=>chooseSize(value)}>{value}ft</button>)}</div>}
    <label className="yard-tier-select">Chọn tier<select aria-label="Chọn tier" value={selection.tier} onChange={event=>setSelection(current=>({...current,tier:Number(event.target.value)}))}>{Array.from({length:tiers},(_,i)=><option key={i+1} value={i+1}>Tier {i+1}</option>)}</select></label>
</div><div>    <div className="yard-tier-profile" aria-label="Mặt cắt tầng">{Array.from({length:tiers},(_,i)=>tiers-i).map(tier=><button type="button" key={tier} aria-pressed={selection.tier===tier} onClick={()=>setSelection(current=>({...current,tier}))}>Tier {tier}</button>)}<span>NỀN BÃI</span></div>
</div>
   </aside>
  </div>
 </section>
}
