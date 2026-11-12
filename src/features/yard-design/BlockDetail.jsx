import {useLayoutEffect,useRef,useState} from 'react'
import {padPosition,slotAddress,slotCoveringModule} from './positions'

export default function BlockDetail({area,onBack,maxModules=32,inventorySlots,onOpenHistory,onOpenContainerDetail}){
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
     {Array.from({length:rows},(_,i)=>rows-i).map(row=>{
        let skipUntil = -1;
        return <div className="yard-detail-row" key={row}>
          <span className="yard-grid-row">Row {padPosition(row)}</span>
          {Array.from({length:bayModules},(_,index)=>{
            if (index <= skipUntil) {
              return null;
            }

            const stored = inventorySlots?.find(s => 
              s.row === row && 
              s.tier === selection.tier && 
              (s.status === 'reserved' || s.status === 'occupied' || Boolean(s.containerNumber)) &&
              ((s.moduleSpan === 2 && (index === s.moduleStart - 1 || index === s.moduleStart)) || Number(s.bay) === index * 2 + 1 || Number(s.bay) === index * 2 + 2)
            ) || slotCoveringModule(inventorySlots, index, row, selection.tier);

            const contNumber = stored?.containerNumber || stored?.reservedContainerNumber;
            const isReserved = stored?.status === 'reserved';
            const isOccupied = stored?.status === 'occupied';
            const hasContainer = stored && (isReserved || isOccupied || (Boolean(contNumber) && stored.status !== 'empty'));

            const is40 = hasContainer
              ? (Number(stored.containerLengthFt) === 40 || Number(stored.size) === 40 || stored.moduleSpan === 2 || (stored.containerType && String(stored.containerType).includes('40')))
              : (!live && size === 40 && row === selection.row && (index === selection.module || index === selection.module + 1));
            
            const span = is40 ? 2 : 1;

            if (span > 1 && (hasContainer || (!live && size === 40 && row === selection.row && index === selection.module))) {
              skipUntil = index + span - 1;
            }

            const selected = row === selection.row && (live ? (!!activeSlot && stored?.id === activeSlot.id) : (index === selection.module || (size === 40 && index === selection.module + 1)));
            const displayBay = span > 1 ? (stored?.bay || (index * 2 + 2)) : (stored?.bay || (index * 2 + 1));

            let gridStyle = {};
            if (span > 1 && (hasContainer || (!live && size === 40 && row === selection.row && index === selection.module))) {
              gridStyle = {
                gridColumn: `span ${span}`,
                background: '#ffedd5',
                borderColor: '#ea580c',
                borderWidth: '2px',
                borderStyle: 'solid',
                borderRadius: '10px',
                boxShadow: '0 1px 3px rgba(234, 88, 12, 0.15)',
                zIndex: 10,
              };
            }

            return <button
              type="button"
              key={index}
              style={gridStyle}
              title={hasContainer ? `${contNumber || 'Container 40ft'} · ${stored.containerLengthFt || (span * 20)}ft · ${stored.status || 'Đã giữ'}` : `Bay ${padPosition(index * 2 + 1)} Row ${padPosition(row)} Tier ${selection.tier}`}
              aria-label={`Bay ${padPosition(displayBay)} Row ${padPosition(row)}`}
              aria-pressed={selected}
              className={[selected ? 'chosen-slot' : '', hasContainer ? `inventory-${stored.status}` : ''].join(' ')}
              onClick={() => {
                setSelection(current => ({ ...current, module: stored ? (stored.moduleStart ? stored.moduleStart - 1 : index) : index, row }));
                if (hasContainer) {
                  onOpenContainerDetail?.({
                    ...stored,
                    containerNumber: contNumber || 'CONT-40',
                    block: area.code,
                    blockCode: area.code,
                    row,
                    tier: selection.tier,
                    slotCode: `${area.code}.${padPosition(displayBay)}.${padPosition(row)}.${selection.tier}`
                  });
                }
              }}
            >
              {span > 1 && (hasContainer || (!live && size === 40 && row === selection.row && index === selection.module)) ? (
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  width: '100%',
                  padding: '2px 4px',
                  fontWeight: 900,
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#c2410c',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  pointerEvents: 'none'
                }}>
                  {contNumber || (stored?.containerId || '40FT')}
                </span>
              ) : hasContainer ? (
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  width: '100%',
                  fontWeight: 800,
                  fontSize: '9px',
                  color: '#1e40af',
                  pointerEvents: 'none'
                }}>
                  {contNumber ? contNumber.slice(0, 7) : '20FT'}
                </span>
              ) : (
                <span style={{ display: 'block', border: '1px dashed #cfdee4', width: '100%', height: '100%', borderRadius: '2px', opacity: 0.7 }} />
              )}
            </button>;
          })}
        </div>;
      })}</div></div>
    <p className="yard-detail-convention">Quy ước đề xuất: bay lẻ cho 20ft; 40ft dùng bay chẵn giữa hai ô 20ft liền nhau. Row đánh số 01–06 theo chiều ngang block; không mặc định phía xe tiếp cận. Tier 1 bắt đầu tại nền bãi.</p>
   </div>
   <aside className="yard-slot-detail" aria-label="Vị trí quy hoạch đang chọn">
    <div className="yard-position-summary"><span className="yard-detail-eyebrow">VỊ TRÍ ĐANG CHỌN</span><output>{address?.code}</output>
    <dl><div><dt>Bay</dt><dd>{padPosition(address?.bay)}</dd></div><div><dt>Row</dt><dd>{padPosition(selection.row)}</dd></div><div><dt>Tier</dt><dd>{selection.tier}</dd></div></dl>
    <p>{live?`${displayedSize}ft · ${activeSlot?.containerNumber?`Đang lưu: ${activeSlot.containerNumber}`:activeSlot?.reservedContainerNumber?`Đã giữ: ${activeSlot.reservedContainerNumber}`:activeSlot?.status==='empty'?'Ô trống':activeSlot?.status||'Chưa cấu hình'}`:size===40?`40ft phủ hai ô 20ft: ${address?.modules.map(padPosition).join(' + ')}.`:'20ft sử dụng một ô nền.'}</p>
    {activeSlot?.containerLengthFt===45&&<p>Vị trí 45ft được chừa thêm khoảng đệm ở hai đầu.</p>}
    {area.sector==='D'&&activeSlot&&<p>{activeSlot.hasReeferPlug?'Vị trí có ổ cắm điện.':'Vị trí chưa gắn ổ cắm điện.'}</p>}
    <div style={{marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px'}}>
      <button
        type="button"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '8px 12px',
          background: '#ff6600',
          color: '#ffffff',
          borderRadius: '10px',
          fontSize: '12px',
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer'
        }}
        onClick={()=>onOpenHistory?.({
          mode: 'slot',
          slotCode: address?.code,
          slotId: activeSlot?.id,
          block: area.code,
          bay: address?.bay,
          row: selection.row,
          tier: selection.tier
        })}
      >
        <span className="material-symbols-outlined" style={{fontSize: '15px'}}>timeline</span>
        Lịch sử Slot {address?.code}
      </button>
      {(activeSlot?.containerNumber || activeSlot?.reservedContainerNumber) && (
        <button
          type="button"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 12px',
            background: '#0284c7',
            color: '#ffffff',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer'
          }}
          onClick={() => onOpenContainerDetail?.({
            ...activeSlot,
            containerNumber: activeSlot.containerNumber || activeSlot.reservedContainerNumber,
            bay: address?.bay,
            block: area.code,
            blockCode: area.code,
            row: selection.row,
            tier: selection.tier,
            slotCode: address?.code
          })}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>info</span>
          Xem Chi Tiết Cont {activeSlot.containerNumber || activeSlot.reservedContainerNumber}
        </button>
      )}
      {activeSlot?.containerNumber && (
        <button
          type="button"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '7px 12px',
            background: '#f4f6f8',
            color: '#1a202c',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 600,
            border: '1px solid #e2e8f0',
            cursor: 'pointer'
          }}
          onClick={()=>onOpenHistory?.({
            mode: 'container',
            containerNo: activeSlot.containerNumber
          })}
        >
          <span className="material-symbols-outlined" style={{fontSize: '15px', color: '#ff6600'}}>inventory_2</span>
          Lịch sử Cont {activeSlot.containerNumber}
        </button>
      )}
    </div>
    </div><div className="yard-position-controls">    {!live&&<div className="yard-size-switch" role="group" aria-label="Kích thước container">{[20,40].map(value=><button type="button" key={value} disabled={value===40&&bayModules<2} aria-pressed={size===value} onClick={()=>chooseSize(value)}>{value}ft</button>)}</div>}
    <label className="yard-tier-select">Chọn tier<select aria-label="Chọn tier" value={selection.tier} onChange={event=>setSelection(current=>({...current,tier:Number(event.target.value)}))}>{Array.from({length:tiers},(_,i)=><option key={i+1} value={i+1}>Tier {i+1}</option>)}</select></label>
</div><div>    <div className="yard-tier-profile" aria-label="Mặt cắt tầng">{Array.from({length:tiers},(_,i)=>tiers-i).map(tier=><button type="button" key={tier} aria-pressed={selection.tier===tier} onClick={()=>setSelection(current=>({...current,tier}))}>Tier {tier}</button>)}<span>NỀN BÃI</span></div>
</div>
   </aside>
  </div>
 </section>
}
