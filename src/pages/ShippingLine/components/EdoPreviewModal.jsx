import React from 'react';

export default function EdoPreviewModal({ isOpen, edo, edoData, onClose }) {
  const targetEdo = edo || edoData;
  if (!isOpen || !targetEdo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-chalk max-w-3xl w-full overflow-hidden max-h-[92vh] flex flex-col animate-fadeIn">
        
        {/* Modal Toolbar */}
        <div className="px-6 py-4 border-b border-chalk bg-fog flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-signal-orange text-xl">receipt_long</span>
            <span className="text-xs font-bold text-carbon tracking-wider">
              Bản thể hiện lệnh giao hàng điện tử (eDO)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 text-xs font-bold bg-white border border-chalk hover:bg-chalk text-carbon rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              In lệnh eDO
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate hover:bg-chalk flex items-center justify-center cursor-pointer font-bold text-lg"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Official Document Body */}
        <div className="p-8 overflow-y-auto flex-1 bg-white font-sans text-carbon">
          {/* Document Header */}
          <div className="border-b-2 border-carbon pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black text-carbon tracking-tight flex items-center gap-1">
                NEXUSPORT SHIPPING LINE<span className="text-signal-orange">.</span>
              </h1>
              <p className="text-[11px] text-slate uppercase tracking-widest mt-0.5">Dịch Vụ Hãng Tàu &amp; Khai Thác Cảng Container Quốc Tế</p>
              <p className="text-xs text-slate mt-1">Cảng Quốc Tế Tiên Sa - Đà Nẵng, Việt Nam</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate uppercase font-bold tracking-wider">Số Lệnh Điện Tử</div>
              <div className="text-base font-black font-mono text-signal-orange">{targetEdo.edoNumber}</div>
              <div className="text-[11px] text-slate mt-1">Ngày phát hành: <span className="font-semibold text-carbon font-mono">{targetEdo.issueDate}</span></div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-6">
            <h2 className="text-lg font-black text-carbon uppercase tracking-wide">
              LỆNH GIAO HÀNG ĐIỆN TỬ (eDO)
            </h2>
            <p className="text-xs text-slate mt-1">
              Lệnh này có giá trị làm thủ tục nhận container nhập khẩu tại cổng kiểm soát và bãi cảng NexusPort
            </p>
          </div>

          {/* Key Metadata Table */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-fog border border-chalk text-xs mb-6">
            <div className="space-y-2">
              <div>
                <span className="text-slate block text-[11px] font-bold uppercase">Người Nhận Hàng:</span>
                <strong className="text-carbon text-sm">{targetEdo.consignee}</strong>
              </div>
              <div>
                <span className="text-slate block text-[11px] font-bold uppercase">Số Vận Đơn (B/L):</span>
                <strong className="font-mono text-carbon text-sm">{targetEdo.blNumber}</strong>
              </div>
              <div>
                <span className="text-slate block text-[11px] font-bold uppercase">Tàu &amp; Chuyến Tàu:</span>
                <span className="font-semibold text-carbon">{targetEdo.vesselName} ({targetEdo.voyageNumber})</span>
              </div>
              <div>
                <span className="text-slate block text-[11px] font-bold uppercase">Nơi Trả Vỏ Rỗng:</span>
                <span className="font-semibold text-carbon">{targetEdo.emptyReturnDepot || 'Bãi Depot Cảng Tiên Sa (Khu C)'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-slate block text-[11px] font-bold uppercase">Hiệu Lực Giao Hàng Đến:</span>
                <strong className="font-mono text-emerald-700 text-sm font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                  {targetEdo.validUntil}
                </strong>
              </div>
              <div>
                <span className="text-slate block text-[11px] font-bold uppercase">Thời Gian Miễn Phí (Free Time):</span>
                <span className="font-semibold text-carbon">{targetEdo.freeTimeDays || 7} ngày (Lưu bãi / Lưu vỏ)</span>
              </div>
              <div>
                <span className="text-slate block text-[11px] font-bold uppercase">Mã PIN Nhận Hàng:</span>
                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{targetEdo.pinCode}</span>
              </div>
              <div>
                <span className="text-slate block text-[11px] font-bold uppercase">Cán Bộ Cấp Lệnh:</span>
                <span className="font-semibold text-carbon">{targetEdo.releaseOfficer === 'shipping01' ? 'Đại diện Hãng tàu' : (targetEdo.releaseOfficer || 'Đại diện Hãng tàu')}</span>
              </div>
            </div>
          </div>

          {/* Container List Table */}
          <div className="mb-6">
            <h4 className="text-xs font-bold text-carbon uppercase tracking-wider mb-2">
              Danh Sách Container Được Cấp Lệnh Nhận Hàng:
            </h4>
            <table className="w-full text-left text-xs border border-chalk rounded-lg overflow-hidden">
              <thead className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                <tr>
                  <th className="py-2.5 px-3">STT</th>
                  <th className="py-2.5 px-3 font-mono">Số Container</th>
                  <th className="py-2.5 px-3">Loại Container</th>
                  <th className="py-2.5 px-3">Số Niêm Chì</th>
                  <th className="py-2.5 px-3">Trạng Thái Hàng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk font-medium">
                {(targetEdo.containers || []).map((c, i) => (
                  <tr key={c.containerNumber} className="hover:bg-fog/60">
                    <td className="py-2.5 px-3 text-slate">{i + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-carbon">{c.containerNumber}</td>
                    <td className="py-2.5 px-3 font-bold">{c.isoType}</td>
                    <td className="py-2.5 px-3 font-mono">{c.sealNumber || 'N/A'}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                        ● Được phép nhận hàng
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes & Terms */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1 mb-8">
            <div className="font-bold">Lưu ý nghiệp vụ:</div>
            <div>- Lệnh giao hàng eDO này được xác thực điện tử trực tiếp trên hệ thống cảng NexusPort.</div>
            <div>- Khi tài xế đưa xe đến cổng cảng lấy container, hệ thống cổng sẽ tự động đối chiếu mã số eDO và thời hạn hiệu lực lệnh.</div>
            <div>- Quá thời hạn hiệu lực nêu trên, chủ hàng phải liên hệ hãng tàu để làm thủ tục gia hạn trước khi nhận container.</div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 text-center text-xs pt-4 border-t border-chalk">
            <div>
              <div className="text-slate uppercase text-[10px] font-bold">Đại Diện Khách Hàng</div>
              <div className="h-16 flex items-center justify-center text-slate italic">Đã xác nhận điện tử</div>
              <div className="font-bold text-carbon">{targetEdo.consignee}</div>
            </div>
            <div>
              <div className="text-slate uppercase text-[10px] font-bold">Xác Nhận Của Hãng Tàu</div>
              <div className="h-16 flex items-center justify-center">
                <span className="inline-block border-2 border-emerald-600 text-emerald-700 font-black px-3 py-1 rounded text-xs uppercase tracking-wider rotate-[-2deg]">
                  ĐÃ DUYỆT ĐIỆN TỬ
                </span>
              </div>
              <div className="font-bold text-carbon">{targetEdo.releaseOfficer === 'shipping01' ? 'Đại diện Hãng tàu' : (targetEdo.releaseOfficer || 'Đại diện Hãng tàu')}</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-chalk bg-fog/50 flex justify-end no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-carbon hover:bg-black text-white rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
