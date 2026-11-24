import { useEffect, useState } from "react";
import yardRestackService from "../../services/yardRestackService";
import Select from '../../components/ui/Select'

const getMessage = (error) => error?.response?.data?.detail || error?.response?.data?.message || error?.message || "Không thể kết nối hệ thống bãi.";

export default function LiveRestackPanel({ onTasksChanged, onOpenMap }) {
  const [number, setNumber] = useState("");
  const [destination, setDestination] = useState("Xe đến lấy tại cổng");
  const [analysis, setAnalysis] = useState(null);
  const [plan, setPlan] = useState(null);
  const [history, setHistory] = useState([]);
  const [risks, setRisks] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshHistory = () => yardRestackService.getAllPlans()
    .then((items) => setHistory(Array.isArray(items) ? items : []))
    .catch((err) => setError(getMessage(err)));
  const refreshRisks = () => yardRestackService.getRisks()
    .then((items) => setRisks(Array.isArray(items) ? items : []))
    .catch((err) => setError(getMessage(err)));

  useEffect(() => {
    refreshHistory();
    refreshRisks();
  }, []);

  const run = async (work) => {
    setBusy(true);
    setError("");
    try { await work(); } catch (err) { setError(getMessage(err)); }
    finally { setBusy(false); }
  };

  const analyze = () => run(async () => {
    setAnalysis(null);
    setPlan(null);
    const result = await yardRestackService.analyzeBlockedContainer({
      containerNo: number.trim().toUpperCase(),
      targetDestination: destination,
      restackBackToOriginal: false,
    });
    setAnalysis(result);
  });

  const deploy = () => run(async () => {
    if (!analysis?.canExecute) return;
    // Backend recalculates against current inventory; UI steps are only a preview.
    const draft = await yardRestackService.createPlan({
      targetContainerNo: analysis.targetContainer.containerNo,
      targetLocation: analysis.targetContainer.currentLocation,
      blockCode: analysis.targetContainer.blockCode,
      targetDestination: destination,
      restackBackToOriginal: false,
      isBillable: false,
    });
    setPlan(draft);
    await refreshHistory();
    const deployed = await yardRestackService.deployPlan(draft.id);
    setPlan(deployed.plan);
    window.dispatchEvent(new Event("yard-reservation-updated"));
    await refreshHistory();
    await refreshRisks();
    await onTasksChanged?.();
  });

  const deployDraft = () => run(async () => {
    const deployed = await yardRestackService.deployPlan(plan.id);
    setPlan(deployed.plan);
    window.dispatchEvent(new Event("yard-reservation-updated"));
    await refreshHistory();
    await refreshRisks();
    await onTasksChanged?.();
  });

  const complete = (step) => run(async () => {
    const updated = await yardRestackService.completeStep(plan.id, step.stepNumber, {
      completedLocation: step.toLocation,
    });
    setPlan(updated);
    window.dispatchEvent(new Event("yard-reservation-updated"));
    await refreshHistory();
    await refreshRisks();
    await onTasksChanged?.();
  });

  const cancel = () => run(async () => {
    const updated = await yardRestackService.cancelPlan(plan.id, { notes: "Điều độ hủy kế hoạch" });
    setPlan(updated);
    window.dispatchEvent(new Event("yard-reservation-updated"));
    await refreshHistory();
    await refreshRisks();
    await onTasksChanged?.();
  });

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Lệnh di chuyển container</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">Phân tích và đảo chuyển theo vị trí bãi thật</h2>
          <p className="mt-1 text-sm text-slate-600">
            Kiểm tra container đè, chọn ô tạm hợp lệ và phát lệnh cẩu theo thứ tự. Sơ đồ chỉ đổi sau khi xác nhận từng bước.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenMap?.()}
          className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">map</span>
          Xem sơ đồ bãi 2D
        </button>
      </header>

      {risks.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-700 text-lg">warning</span>
            <h3 className="font-bold text-amber-900">Cảnh báo: Lịch lấy hàng có container đang bị đè ({risks.length})</h3>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            {risks.map((risk) => (
              <button
                type="button"
                key={risk.containerNo}
                onClick={() => {
                  setNumber(risk.containerNo);
                  setAnalysis(null);
                  setPlan(null);
                }}
                className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-left text-sm hover:border-orange-500 hover:shadow-xs transition cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="font-mono text-slate-900">{risk.containerNo}</strong>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">
                    {risk.blockingCount} cont đè
                  </span>
                </div>
                <span className="block text-xs text-slate-600 mt-1">
                  Vị trí: {risk.currentLocation}
                </span>
                <span className="block text-[11px] text-orange-700 mt-0.5 font-medium">
                  Hẹn: {risk.appointmentAt ? new Date(risk.appointmentAt).toLocaleString("vi-VN") : "Chưa có giờ"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
        <label className="text-sm font-bold text-slate-700">
          Số container trong bãi
          <input
            value={number}
            onChange={(e) => {
              setNumber(e.target.value.toUpperCase());
              setAnalysis(null);
            }}
            placeholder="VD: HLCU1234567"
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-slate-900 focus:border-orange-500 focus:outline-hidden"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Đích giao nhận
          <Select
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value);
              setAnalysis(null);
            }}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-800 focus:border-orange-500 focus:outline-hidden"
          >
            <option value="Xe đến lấy tại cổng">Xe đến lấy tại cổng (Hàng nhập pickup)</option>
            <option value="Khu chuẩn bị xếp tàu">Khu chuẩn bị xếp tàu (Hàng xuất bãi)</option>
          </Select>
        </label>
        <button
          type="button"
          disabled={busy || !number.trim()}
          onClick={analyze}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-5 py-2.5 font-bold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">search</span>
          Phân tích bãi
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Quy tắc an toàn: Container chắn được giữ tại ô tạm hợp lệ (cùng kích thước, tầng đỡ thực tế, có ổ cắm nếu là Reefer). Không trả về vị trí cũ vì container đích đã rời bãi.
      </p>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-red-600">error</span>
          <span>{error}</span>
        </div>
      )}

      {analysis && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-xl font-mono text-slate-900">{analysis.targetContainer.containerNo}</strong>
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                  {analysis.targetContainer.currentLocation}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-slate-600">
                {analysis.targetContainer.isoCode && (
                  <span className="rounded bg-white border border-slate-200 px-2 py-0.5 font-mono">
                    ISO: {analysis.targetContainer.isoCode}
                  </span>
                )}
                {analysis.targetContainer.weightKg > 0 && (
                  <span className="rounded bg-white border border-slate-200 px-2 py-0.5">
                    Tải trọng: {(analysis.targetContainer.weightKg / 1000).toFixed(1)}T
                  </span>
                )}
                {analysis.targetContainer.dwellDays > 0 && (
                  <span className="rounded bg-white border border-slate-200 px-2 py-0.5">
                    Lưu bãi: {analysis.targetContainer.dwellDays} ngày
                  </span>
                )}
                {analysis.targetContainer.bookingNo && (
                  <span className="rounded bg-blue-100 text-blue-800 px-2 py-0.5 font-semibold">
                    Booking: {analysis.targetContainer.bookingNo}
                  </span>
                )}
                {analysis.targetContainer.appointmentAt && (
                  <span className="rounded bg-orange-100 text-orange-800 px-2 py-0.5 font-semibold">
                    Hẹn lấy: {new Date(analysis.targetContainer.appointmentAt).toLocaleString('vi-VN')}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1.5">
              <span className="text-sm font-bold text-slate-800">
                {analysis.blockingContainers?.length || 0} container chắn · {analysis.totalMoves} bước dự kiến
              </span>
              <button
                type="button"
                onClick={() => onOpenMap?.(analysis.targetContainer.currentLocation, null, analysis.targetContainer.containerNo)}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer shadow-2xs"
              >
                <span className="material-symbols-outlined text-xs">location_searching</span>
                Xem vị trí trên sơ đồ 2D
              </button>
            </div>
          </div>

          <p className={`text-sm font-semibold rounded-lg p-2.5 ${analysis.canExecute ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
            {analysis.validationMessage}
          </p>

          <ol className="space-y-2">
            {analysis.blockingContainers?.map((item) => (
              <li
                key={item.containerNo}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-2xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-800 text-xs font-bold">
                      {item.stepOrder}
                    </span>
                    <strong className="font-mono text-slate-900">{item.containerNo}</strong>
                    <span className="text-xs text-slate-500 font-medium">tầng {item.tier}</span>
                  </div>
                  <span className="block text-xs font-mono text-slate-700 mt-1">
                    {item.currentLocation} <span className="font-sans text-slate-400">➔</span> <span className="text-emerald-700 font-bold">{item.recommendedBufferSlot}</span>
                    <span className="font-sans text-slate-500 ml-2">({item.reason})</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenMap?.(item.currentLocation, item.recommendedBufferSlot, item.containerNo)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Xem bước đảo
                </button>
              </li>
            ))}
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-300 bg-white p-3 text-sm shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                    {(analysis.blockingContainers?.length || 0) + 1}
                  </span>
                  <strong className="font-mono text-blue-900">Giao đích: {analysis.targetContainer.containerNo}</strong>
                </div>
                <span className="block text-xs font-mono text-slate-600 mt-1">
                  {analysis.targetContainer.currentLocation} <span className="font-sans text-slate-400">➔</span> <span className="text-blue-800 font-bold">{destination}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onOpenMap?.(analysis.targetContainer.currentLocation, null, analysis.targetContainer.containerNo)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer"
              >
                Xem vị trí lấy
              </button>
            </li>
          </ol>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={busy || !analysis.canExecute || !!plan}
              onClick={deploy}
              className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2.5 font-bold text-white shadow-xs hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">send</span>
              Giữ ô tạm và phát lệnh RTG
            </button>
          </div>
        </div>
      )}

      {plan && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/30 p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
            <div>
              <span className="text-xs uppercase font-bold text-emerald-800">Lệnh cẩu đang kích hoạt:</span>
              <strong className="ml-2 font-mono text-slate-900 text-base">{plan.planCode}</strong>
              <span className={`ml-3 text-xs font-bold px-2 py-0.5 rounded-full ${plan.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800 animate-pulse'}`}>
                {plan.status}
              </span>
            </div>
            <div className="flex gap-2">
              {plan.status === "Draft" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={deployDraft}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800 cursor-pointer"
                >
                  Kiểm tra lại và phát lệnh
                </button>
              )}
              {["Draft", "In_Progress"].includes(plan.status) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancel}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  Hủy phần việc còn lại
                </button>
              )}
            </div>
          </div>

          <ol className="space-y-2">
            {plan.steps?.map((step) => (
              <li
                key={step.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border border-slate-200 p-3 text-sm shadow-2xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-800 text-xs font-bold">
                      {step.stepNumber}
                    </span>
                    <strong className="font-mono text-slate-900">{step.containerNo}</strong>
                  </div>
                  <span className="block text-xs font-mono text-slate-600 mt-1">
                    {step.fromLocation} <span className="font-sans text-slate-400">➔</span> {step.toLocation}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenMap?.(step.fromLocation, step.toLocation, step.containerNo)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Xem sơ đồ
                  </button>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded ${step.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : step.status === 'In_Progress' ? 'bg-blue-100 text-blue-800 animate-pulse' : 'bg-slate-200 text-slate-700'}`}>
                    {step.status}
                  </span>
                  {step.status === "In_Progress" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => complete(step)}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 font-bold text-xs text-white hover:bg-emerald-800 cursor-pointer shadow-xs"
                    >
                      Xác nhận cẩu xong
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-slate-500">
            Chỉ bấm "Xác nhận cẩu xong" khi cẩu RTG đã hạ container vào đúng vị trí đích. Tọa độ bãi thực tế và sơ đồ 2D sẽ được cập nhật ngay lập tức.
          </p>
        </div>
      )}

      <div className="border-t border-slate-200 pt-4">
        <h3 className="font-bold text-slate-800 text-sm">Lịch sử kế hoạch di dời gần đây</h3>
        <div className="mt-2.5 space-y-2">
          {history.length === 0 ? (
            <p className="text-xs text-slate-400">Chưa có kế hoạch di dời nào.</p>
          ) : (
            history.slice(0, 8).map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setPlan(item);
                  setAnalysis(null);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:bg-slate-50 transition cursor-pointer"
              >
                <div>
                  <strong className="font-mono text-slate-900">{item.planCode}</strong>
                  <span className="ml-2 font-mono text-xs text-slate-600">Mục tiêu: {item.targetContainerNo}</span>
                  <span className="ml-2 text-xs text-slate-500">({item.steps?.length || 0} bước)</span>
                </div>
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : item.status === 'In_Progress' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
                  {item.status}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
