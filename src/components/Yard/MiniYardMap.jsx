import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';

export default function MiniYardMap({ onReserve, selectedSlot }) {
  const [blocksData, setBlocksData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedBay, setSelectedBay] = useState(null);

  useEffect(() => {
    fetchYardMap();
  }, []);

  const fetchYardMap = async () => {
    try {
      const res = await apiClient.get('/v1/Yard/Map');
      const blocks = Array.isArray(res) ? res : (res?.data || []);
      setBlocksData(blocks);
      
      // If a block is currently selected, refresh its data
      if (selectedBlock) {
        const updatedBlock = blocks.find(b => b.id === selectedBlock.id);
        if (updatedBlock) setSelectedBlock(updatedBlock);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReserveSpecificSlot = async (slotId, blockCode) => {
    try {
      const res = await apiClient.post(`/v1/Yard/Slots/${slotId}/Reserve`);
      if (res && onReserve) {
        // Mock the return signature expected by onReserve or adapt it
        await onReserve(slotId, blockCode, res);
        fetchYardMap(); 
      }
    } catch (error) {
      console.error(error);
      alert('Không thể giữ chỗ vị trí này.');
    }
  };

  if (loading) return <div className="p-4 text-center text-xs text-slate">Đang tải bản đồ bãi...</div>;

  // VIEW 1: BLOCK SELECTION
  if (!selectedBlock) {
    return (
      <div className="space-y-3">
        {selectedSlot && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-xs font-bold flex justify-between items-center">
            <span>Đã giữ chỗ: Block {selectedSlot.blockCode} - Bay {selectedSlot.bay} / Row {selectedSlot.row} / Tier {selectedSlot.tier}</span>
            <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
          </div>
        )}
        <div className="text-xs font-bold text-slate">Vui lòng chọn 1 Block:</div>
        <div className="grid grid-cols-2 gap-3">
          {blocksData.map(block => {
            const totalSlots = (block.maxBays || 10) * (block.maxRows || 6) * (block.maxTiers || 4);
            const occupied = block.slots?.filter(s => s.status === 'occupied').length || 0;
            const reserved = block.slots?.filter(s => s.status === 'reserved').length || 0;
            const isFull = occupied + reserved >= totalSlots;

            return (
              <div key={block.id} 
                onClick={() => setSelectedBlock(block)}
                className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col gap-2 relative overflow-hidden cursor-pointer hover:border-signal-orange hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-center">
                  <strong className="text-sm font-extrabold text-carbon group-hover:text-signal-orange truncate">{block.blockCode || block.description}</strong>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {isFull ? 'Hết chỗ' : 'Còn trống'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  Đã chứa: {occupied}/{totalSlots} | Đã đặt: {reserved}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // VIEW 2 & 3: BAY & SLOT SELECTION
  const slotsByBay = {};
  if (selectedBlock.slots) {
    selectedBlock.slots.forEach(slot => {
      if (!slotsByBay[slot.bay]) slotsByBay[slot.bay] = [];
      slotsByBay[slot.bay].push(slot);
    });
  }
  
  const bays = Object.keys(slotsByBay).sort((a,b) => parseInt(a) - parseInt(b));

  return (
    <div className="space-y-3">
      {/* Header with Back button */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => { setSelectedBlock(null); setSelectedBay(null); }} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700 flex items-center">
          <span className="material-symbols-outlined text-[14px]">arrow_back</span> Trở lại
        </button>
        <span className="font-extrabold text-carbon text-sm">Block {selectedBlock.blockCode}</span>
      </div>

      {!selectedBay ? (
        // VIEW 2: BAY SELECTION
        <div>
          <div className="text-xs font-bold text-slate mb-2">Chọn 1 Bay (Dãy):</div>
          <div className="grid grid-cols-5 gap-2">
            {bays.map(bayNum => {
              const baySlots = slotsByBay[bayNum];
              const emptySlots = baySlots.filter(s => s.status === 'empty').length;
              const isEmpty = emptySlots > 0;
              return (
                <div 
                  key={bayNum} 
                  onClick={() => isEmpty && setSelectedBay(bayNum)}
                  className={`border rounded-lg p-2 text-center flex flex-col items-center justify-center ${isEmpty ? 'border-slate-200 hover:border-signal-orange cursor-pointer bg-white' : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'}`}
                >
                  <span className="text-xs font-extrabold text-carbon">BAY {bayNum.padStart(2, '0')}</span>
                  <span className="text-[9px] font-bold text-slate-500 mt-1">{emptySlots} trống</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        // VIEW 3: SLOT SELECTION
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-slate">Chọn 1 Slot trong Bay {selectedBay.padStart(2, '0')}:</div>
            <button onClick={() => setSelectedBay(null)} className="text-[10px] text-blue-600 font-bold hover:underline">Đổi Bay</button>
          </div>
          
          <div className="border border-slate-200 rounded-xl p-3 bg-fog overflow-x-auto">
             <div className="flex flex-col gap-1 min-w-max">
               {/* Render slots grouped by Tier (descending) and Row */}
               {Array.from({ length: selectedBlock.maxTiers || 4 }, (_, i) => (selectedBlock.maxTiers || 4) - i).map(tier => (
                 <div key={`tier-${tier}`} className="flex gap-1 items-center">
                   <div className="w-8 text-[9px] font-bold text-slate-500 text-right pr-2">T{tier}</div>
                   {Array.from({ length: selectedBlock.maxRows || 6 }, (_, i) => i + 1).map(row => {
                     const slot = slotsByBay[selectedBay].find(s => s.tier === tier && s.row === row);
                     if (!slot) return <div key={`r${row}`} className="w-10 h-10"></div>;
                     
                     let bgColor = 'bg-white border-slate-200';
                     let content = '';
                     let isClickable = false;
                     
                     if (slot.status === 'empty') {
                       bgColor = 'bg-green-50 border-green-300 hover:bg-green-100 cursor-pointer hover:border-green-500 transition-colors shadow-sm';
                       isClickable = true;
                     } else if (slot.status === 'reserved') {
                       bgColor = 'bg-amber-100 border-amber-300 opacity-80';
                       content = 'R';
                     } else if (slot.status === 'occupied') {
                       bgColor = 'bg-slate-300 border-slate-400 opacity-60';
                       content = 'X';
                     } else if (slot.status === 'maintenance') {
                       bgColor = 'bg-red-100 border-red-300 opacity-80';
                       content = 'M';
                     }

                     return (
                       <div 
                         key={slot.id} 
                         onClick={() => isClickable && handleReserveSpecificSlot(slot.id, selectedBlock.blockCode)}
                         title={isClickable ? `Click để giữ chỗ Row ${row} - Tier ${tier}` : `Trạng thái: ${slot.status}`}
                         className={`w-10 h-10 border rounded flex items-center justify-center text-[10px] font-extrabold text-carbon ${bgColor}`}
                       >
                         {content || `R${row}`}
                       </div>
                     )
                   })}
                 </div>
               ))}
               <div className="flex gap-1 items-center mt-1">
                 <div className="w-8"></div>
                 {Array.from({ length: selectedBlock.maxRows || 6 }, (_, i) => i + 1).map(row => (
                   <div key={`lbl-r${row}`} className="w-10 text-[9px] font-bold text-slate-500 text-center">Row {row}</div>
                 ))}
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
