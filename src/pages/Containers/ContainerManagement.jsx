import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { containerService } from "../../services/containerService";

const STATUSES = [
  "expected",
  "discharged",
  "in_yard",
  "reserved",
  "moving",
  "gate_in",
  "gate_out",
  "loaded",
  "damaged",
  "canceled",
];
const STATUS_LABELS = {
  expected: "Dự kiến",
  discharged: "Đã dỡ tàu",
  in_yard: "Trong bãi",
  reserved: "Đã giữ chỗ",
  moving: "Đang di chuyển",
  gate_in: "Đã vào cổng",
  gate_out: "Đã ra cổng",
  loaded: "Đã xếp tàu",
  damaged: "Hư hỏng",
  canceled: "Đã xóa",
};
const STATUS_STYLES = {
  expected: "bg-blue-50 text-blue-700",
  discharged: "bg-indigo-50 text-indigo-700",
  in_yard: "bg-emerald-50 text-emerald-700",
  reserved: "bg-amber-50 text-amber-700",
  moving: "bg-cyan-50 text-cyan-700",
  gate_in: "bg-violet-50 text-violet-700",
  gate_out: "bg-slate-100 text-slate-700",
  loaded: "bg-green-50 text-green-700",
  damaged: "bg-red-50 text-red-700",
  canceled: "bg-gray-100 text-gray-500",
};
const LIFECYCLE_LABELS = {
  registered: "Đã đăng ký",
  booked: "Đã đặt lịch",
  gate_in: "Đã vào cổng",
  in_yard: "Trong bãi",
  ready_for_gate_out: "Sẵn sàng ra cổng",
  gate_out: "Đã ra cổng",
};
const NEXT_LIFECYCLE_STATUS = {
  registered: "booked",
  booked: "gate_in",
  gate_in: "in_yard",
  in_yard: "ready_for_gate_out",
  ready_for_gate_out: "gate_out",
  gate_out: null,
};
const LIFECYCLE_ORDER = [
  "registered",
  "booked",
  "gate_in",
  "in_yard",
  "ready_for_gate_out",
  "gate_out",
];
const EMPTY_FORM = {
  containerNumber: "",
  containerTypeId: "",
  carrierId: "",
};

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const displaySize = (size) =>
  ({ ft20: "20'", ft40: "40'", ft45: "45'" })[size] || size;
const activityLabel = (activity) =>
  ({ in: "Hạ (In)", out: "Bốc (Out)" })[activity] || "—";
const loadStatusLabel = (status) =>
  ({ full: "Có hàng", empty: "Rỗng", unknown: "Chưa xác định" })[status] || "—";
const visitStatusLabel = (status) =>
  ({ planned: "Dự kiến", active: "Đang ở cảng", completed: "Hoàn tất", canceled: "Đã hủy" })[status] || status || "—";

function Field({ label, required, children }) {
  return (
    <label className="space-y-1.5 text-xs font-bold text-graphite">
      <span>
        {label}
        {required && " *"}
      </span>
      {children}
    </label>
  );
}

function ContainerFormModal({ container, types, onClose, onSaved }) {
  const editing = Boolean(container);
  const [form, setForm] = useState(() =>
    container
      ? {
          containerNumber: container.containerNumber,
          containerTypeId: container.containerTypeId,
          carrierId: container.carrierId || "",
        }
      : { ...EMPTY_FORM, containerTypeId: types[0]?.id || "" },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      containerNumber: form.containerNumber
        .toUpperCase()
        .replace(/[\s-]+/g, ""),
      containerTypeId: form.containerTypeId,
      carrierId: form.carrierId || null,
    };
    try {
      const saved = editing
        ? await containerService.updateContainer(container.id, payload)
        : await containerService.createContainer(payload);
      onSaved(saved);
    } catch (requestError) {
      const detail =
        requestError.details && Object.values(requestError.details).flat()[0];
      setError(detail || requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-chalk bg-fog px-3 py-2.5 text-sm font-medium text-carbon outline-none focus:border-signal-orange focus:ring-2 focus:ring-orange-100";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-chalk bg-white px-6 py-4">
          <div>
            <h2 className="font-heading text-xl font-bold text-carbon">
              {editing ? "Cập nhật Container" : "Đăng ký Container"}
            </h2>
            <p className="mt-1 text-xs text-slate">
              Hồ sơ vật lý cố định theo tiêu chuẩn ISO 6346
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-fog text-graphite hover:bg-chalk"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={submit} className="space-y-5 p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Container ID" required>
              <input
                className={`${inputClass} font-mono uppercase tracking-wider`}
                required
                maxLength={14}
                placeholder="MSCU6639871"
                value={form.containerNumber}
                onChange={(e) => update("containerNumber", e.target.value)}
              />
            </Field>
            <Field label="Size / Type" required>
              <select
                className={inputClass}
                required
                value={form.containerTypeId}
                onChange={(e) => update("containerTypeId", e.target.value)}
              >
                <option value="">Chọn loại container</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.code} · {displaySize(type.size)} ·{" "}
                    {type.category.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Carrier ID">
              <input
                className={`${inputClass} font-mono`}
                placeholder="UUID (không bắt buộc)"
                value={form.carrierId}
                onChange={(e) => update("carrierId", e.target.value)}
              />
            </Field>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Seal, hàng hóa, trọng lượng, chuyến tàu và thời gian vào/ra thuộc từng lượt cảng/EIR nên được lấy từ dữ liệu nghiệp vụ, không ghi đè vào hồ sơ vật lý Container.
          </div>
          {!types.length && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Chưa có dữ liệu Container Type trong database. Administrator cần
              seed bảng container_types trước khi đăng ký.
            </p>
          )}
          <div className="flex justify-end gap-3 border-t border-chalk pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-chalk px-5 py-2.5 text-sm font-bold text-graphite hover:bg-fog"
            >
              Hủy
            </button>
            <button
              disabled={saving || !types.length}
              className="rounded-lg bg-signal-orange px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Đăng ký"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InfoItem({ label, value, mono = false }) {
  return (
    <div className="rounded-lg border border-chalk bg-white p-3">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold text-carbon ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

function EirCard({ eir, containerNumber, defaultOpen = false }) {
  const seals = eir.seals?.map((seal) => seal.rawValue || seal.sealNumber).filter(Boolean).join(", ");
  return (
    <details open={defaultOpen} className="group rounded-xl border border-chalk bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-extrabold text-carbon">{eir.referenceNumber}</span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${eir.activity === "in" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
              {activityLabel(eir.activity)}
            </span>
            <span className="rounded-full bg-fog px-2.5 py-1 text-[11px] font-bold text-graphite">
              {eir.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate">
            {formatDate(eir.checkInAt)} → {formatDate(eir.checkOutAt)}
          </p>
        </div>
        <span className="material-symbols-outlined text-slate transition group-open:rotate-180">expand_more</span>
      </summary>
      <div className="border-t border-chalk bg-fog/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem label="Container" value={containerNumber} mono />
          <InfoItem label="Vị trí" value={eir.locationCode} mono />
          <InfoItem label="Số xe" value={eir.plateNumber} mono />
          <InfoItem label="BL / Booking" value={eir.blBookingNumber} mono />
          <InfoItem label="Tình trạng hàng" value={loadStatusLabel(eir.loadStatus)} />
          <InfoItem label="Seal" value={seals} mono />
          <InfoItem label="ISO / Loại / Size" value={[eir.isoCode, eir.containerTypeDescription, eir.sizeFeet && `${eir.sizeFeet} ft`].filter(Boolean).join(" · ")} />
          <InfoItem label="Khối lượng" value={eir.grossWeightKg != null ? `${Number(eir.grossWeightKg).toLocaleString("vi-VN")} kg` : null} />
          <InfoItem label="Hàng hóa" value={eir.cargoTypeDescription} />
          <InfoItem label="Khách hàng" value={eir.customerName} />
          <InfoItem label="Đơn vị vận tải" value={eir.transportCompanyName} />
          <InfoItem label="Tàu / Chuyến" value={[eir.vesselName, eir.voyageIn, eir.voyageOut].filter(Boolean).join(" · ")} />
          <InfoItem label="Cổng / Làn" value={[eir.gateLabel, eir.laneCode].filter(Boolean).join(" · ")} />
          <InfoItem label="Hư hỏng" value={eir.soundDamageCode || (eir.damages?.length ? `${eir.damages.length} ghi nhận` : null)} />
          <InfoItem label="Hình ảnh / tài liệu" value={eir.media?.length ? `${eir.media.length} tệp` : null} />
        </div>
        {eir.remark && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><strong>Ghi chú:</strong> {eir.remark}</p>}
      </div>
    </details>
  );
}

function ContainerDetailModal({ detail, loading, onClose, onEdit, onTransition, transitioning, canWrite }) {
  const lifecycleStatus = detail?.lifecycleStatus?.status;
  const nextStatus = lifecycleStatus ? NEXT_LIFECYCLE_STATUS[lifecycleStatus] : null;
  const latestVisit = detail?.visits?.[0];
  const latestEir = latestVisit?.eirs?.[0];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 lg:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-chalk px-5 py-4 lg:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-signal-orange">
              Hồ sơ Container · Lượt cảng · EIR
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-2xl font-bold text-carbon">{detail?.containerNumber || "Đang tải..."}</h2>
              {detail && <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[detail.status]}`}>{STATUS_LABELS[detail.status]}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-fog"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {loading || !detail ? (
          <div className="py-20 text-center text-slate">
            Đang tải thông tin...
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)] lg:overflow-hidden">
            <main className="space-y-6 overflow-y-auto p-5 lg:p-7">
              <section>
              <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate">
                Hồ sơ vật lý Container
              </h3>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoItem label="Container ID" value={detail.containerNumber} mono />
                <InfoItem label="Type" value={detail.containerType?.code} />
                <InfoItem label="Kích thước" value={displaySize(detail.containerType?.size)} />
                <InfoItem label="Phân loại" value={detail.containerType?.category?.replaceAll("_", " ")} />
                <InfoItem label="Carrier" value={detail.carrierName} />
                <InfoItem label="Ngày đăng ký" value={formatDate(detail.createdAt)} />
              </dl>
              <p className="mt-3 text-xs text-slate">Seal, hàng hóa, trọng lượng và tàu được hiển thị theo từng EIR bên dưới, không coi là thuộc tính cố định của vỏ Container.</p>
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate">Lượt cảng gần nhất</h3>
                    <p className="mt-1 text-sm text-graphite">Thông tin vận hành tương tự màn tra cứu EIR tại cảng.</p>
                  </div>
                  {latestVisit && <span className="rounded-full bg-fog px-3 py-1 text-xs font-bold text-graphite">{visitStatusLabel(latestVisit.status)}</span>}
                </div>
                {latestVisit ? (
                  <div className="rounded-xl border border-chalk bg-carbon p-4 text-white">
                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        ["Mã lượt cảng", latestVisit.visitReference],
                        ["BL / Booking", latestVisit.blBookingNumber],
                        ["Khách hàng", latestVisit.customerName],
                        ["Đơn vị vận tải", latestVisit.transportCompanyName],
                        ["Tình trạng hàng", loadStatusLabel(latestVisit.loadStatus)],
                        ["Khối lượng", latestVisit.grossWeightKg != null ? `${Number(latestVisit.grossWeightKg).toLocaleString("vi-VN")} kg` : null],
                        ["Bắt đầu", formatDate(latestVisit.startedAt)],
                        ["Hoàn tất", formatDate(latestVisit.completedAt)],
                      ].map(([label, value]) => (
                        <div key={label}><dt className="text-[11px] uppercase text-gray-400">{label}</dt><dd className="mt-1 text-sm font-semibold">{value || "—"}</dd></div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-chalk bg-fog p-5 text-sm text-slate">Chưa có lượt cảng/EIR. Hồ sơ Container vẫn được giữ độc lập để liên kết khi phát sinh giao nhận.</p>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate">EIR và lịch sử giao nhận ({detail.visits?.reduce((sum, visit) => sum + (visit.eirs?.length || 0), 0) || 0})</h3>
                <div className="space-y-3">
                  {detail.visits?.flatMap((visit) => visit.eirs || []).length ? detail.visits.flatMap((visit) => visit.eirs || []).map((eir, index) => (
                    <EirCard key={eir.id} eir={eir} containerNumber={detail.containerNumber} defaultOpen={index === 0} />
                  )) : <p className="rounded-lg bg-fog p-4 text-sm text-slate">Chưa phát hành Equipment Interchange Receipt cho Container này.</p>}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate">Booking liên kết ({detail.bookings?.length || 0})</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {detail.bookings?.length ? detail.bookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between rounded-lg border border-chalk p-3">
                      <div><p className="font-mono text-sm font-bold text-carbon">{booking.bookingCode}</p><p className="text-xs text-slate">{booking.bookingType} · {formatDate(booking.appointmentStart)}</p></div>
                      <span className="rounded-full bg-fog px-2.5 py-1 text-xs font-bold text-graphite">{booking.status}</span>
                    </div>
                  )) : <p className="rounded-lg bg-fog p-4 text-sm text-slate">Chưa liên kết Booking.</p>}
                </div>
              </section>
            </main>

            <aside className="space-y-6 border-t border-chalk bg-fog/60 p-5 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:p-6">
              <section>
              <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate">
                Vòng đời Container
              </h3>
              {lifecycleStatus ? (
                <div className="rounded-xl border border-blue-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-blue-700">Trạng thái nghiệp vụ hiện tại</p>
                      <p className="mt-1 font-bold text-blue-900">{LIFECYCLE_LABELS[lifecycleStatus]}</p>
                    </div>
                    {canWrite && nextStatus && (
                      <button
                        disabled={transitioning}
                        onClick={() => onTransition(detail, nextStatus)}
                        className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                      >
                        {transitioning ? "Đang chuyển..." : `Chuyển sang ${LIFECYCLE_LABELS[nextStatus]}`}
                      </button>
                    )}
                  </div>
                  {!nextStatus && <p className="mt-2 text-xs text-blue-700">Container đã hoàn tất vòng đời qua cổng.</p>}
                  <ol className="mt-5 space-y-0">
                    {LIFECYCLE_ORDER.map((status, index) => {
                      const currentIndex = LIFECYCLE_ORDER.indexOf(lifecycleStatus);
                      const complete = index <= currentIndex;
                      const current = status === lifecycleStatus;
                      return (
                        <li key={status} className="relative flex gap-3 pb-4 last:pb-0">
                          {index < LIFECYCLE_ORDER.length - 1 && (
                            <span className={`absolute left-[11px] top-6 h-full w-0.5 ${index < currentIndex ? "bg-blue-600" : "bg-chalk"}`} />
                          )}
                          <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-black ${complete ? "border-blue-600 bg-blue-600 text-white" : "border-chalk bg-white text-slate"}`}>
                            {index < currentIndex ? "✓" : index + 1}
                          </span>
                          <div className="pt-0.5">
                            <p className={`text-sm font-bold ${current ? "text-blue-800" : complete ? "text-carbon" : "text-slate"}`}>{LIFECYCLE_LABELS[status]}</p>
                            {current && <p className="mt-0.5 text-[11px] font-semibold text-blue-600">Đang ở bước này</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : (
                <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                  Trạng thái hiện tại nằm ngoài vòng đời cổng tiêu chuẩn.
                </p>
              )}
              </section>
              <section>
              <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate">
                Lịch sử trạng thái ({detail.statusHistory?.length || 0})
              </h3>
              <div className="space-y-2">
                {detail.statusHistory?.length ? detail.statusHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg border border-chalk p-3 text-sm">
                    <div className="font-semibold text-carbon">
                      {LIFECYCLE_LABELS[entry.fromStatus] || entry.fromStatus}
                      <span className="mx-2 text-slate">→</span>
                      {LIFECYCLE_LABELS[entry.toStatus] || entry.toStatus}
                    </div>
                    <div className="text-right"><span className="block text-xs text-slate">{formatDate(entry.changedAt)}</span><span className="mt-1 block text-[11px] font-semibold text-graphite">{entry.changedByName || entry.changedBy || "Hệ thống"}</span></div>
                  </div>
                )) : <p className="rounded-lg bg-fog p-4 text-sm text-slate">Chưa có lịch sử chuyển trạng thái.</p>}
              </div>
              </section>
              <section>
              <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate">
                Vị trí hiện tại
              </h3>
              {detail.currentPosition ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-bold text-emerald-800">
                    Block {detail.currentPosition.blockCode} · Bay{" "}
                    {detail.currentPosition.bay} · Row{" "}
                    {detail.currentPosition.row} · Tier{" "}
                    {detail.currentPosition.tier}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Đặt lúc {formatDate(detail.currentPosition.placedAt)}
                  </p>
                </div>
              ) : latestEir?.locationCode ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-mono font-bold text-blue-800">{latestEir.locationCode}</p><p className="mt-1 text-xs text-blue-700">Vị trí ghi nhận trên EIR gần nhất</p></div>
              ) : (
                <p className="rounded-lg bg-fog p-4 text-sm text-slate">
                  Container chưa có vị trí hiện tại trong bãi.
                </p>
              )}
              </section>
            {canWrite && detail.status !== "canceled" && (
              <button
                onClick={() => onEdit(detail)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-signal-orange py-3 text-sm font-bold text-white"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
                Cập nhật Container
              </button>
            )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContainerManagement() {
  const user = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("user") || sessionStorage.getItem("user"),
      );
    } catch {
      return null;
    }
  }, []);
  const canWrite = ["Administrator", "Dispatcher", "Gate Officer"].includes(
    user?.role,
  );
  const canIntake = ["Administrator", "Dispatcher"].includes(user?.role);
  const canDelete = user?.role === "Administrator";
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: "",
    status: "",
    size: "",
    category: "",
  });
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [formContainer, setFormContainer] = useState(undefined);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await containerService.getContainers(filters);
      setItems(result.items);
      setPagination(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    containerService
      .getContainerTypes()
      .then(setTypes)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const openDetail = async (id) => {
    setShowDetail(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const container = await containerService.getContainerById(id);
      const isManagedStatus = ["expected", "reserved", "gate_in", "in_yard", "moving", "gate_out"].includes(container.status);
      const [lifecycleStatus, statusHistory] = await Promise.all([
        isManagedStatus ? containerService.getContainerStatus(id) : Promise.resolve(null),
        containerService.getContainerStatusHistory(id),
      ]);
      setDetail({ ...container, lifecycleStatus, statusHistory });
    } catch (e) {
      setError(e.message);
      setShowDetail(false);
    } finally {
      setDetailLoading(false);
    }
  };
  const transitionStatus = async (container, targetStatus) => {
    setTransitioning(true);
    setError("");
    try {
      await containerService.transitionContainerStatus(container.id, targetStatus);
      setNotice(`Đã chuyển trạng thái sang ${LIFECYCLE_LABELS[targetStatus]}.`);
      await openDetail(container.id);
      await load();
      setTimeout(() => setNotice(""), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setTransitioning(false);
    }
  };
  const saved = () => {
    setShowForm(false);
    setFormContainer(undefined);
    setNotice("Đã lưu thông tin Container thành công.");
    load();
    setTimeout(() => setNotice(""), 3000);
  };
  const edit = (container) => {
    setShowDetail(false);
    setFormContainer(container);
    setShowForm(true);
  };
  const remove = async (container) => {
    if (
      !window.confirm(
        `Bạn có chắc muốn xóa mềm Container ${container.containerNumber}? Dữ liệu lịch sử vẫn được giữ lại.`,
      )
    )
      return;
    try {
      await containerService.deleteContainer(container.id);
      setNotice("Container đã được xóa mềm thành công.");
      load();
      setTimeout(() => setNotice(""), 3000);
    } catch (e) {
      setError(e.message);
    }
  };
  const setFilter = (key, value) =>
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? value : 1,
    }));

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 p-1">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-signal-orange">
            <span className="h-2 w-2 rounded-full bg-signal-orange" />
            Central Registry · Đăng kiểm trung tâm
          </div>
          <h1 className="font-heading text-3xl font-bold text-carbon">
            Quản lý Container
          </h1>
          <p className="mt-1 text-sm text-slate">
            Theo dõi xuyên suốt Booking → Gate-In → Yard → Gate-Out
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canIntake && (
            <Link
              to="/container-intake"
              className="flex items-center justify-center gap-2 rounded-lg border border-carbon bg-white px-5 py-3 text-sm font-bold text-carbon hover:bg-fog"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              Nhập / Import Excel
            </Link>
          )}
          {canWrite && (
            <button
              onClick={() => {
                setFormContainer(undefined);
                setShowForm(true);
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-signal-orange px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-600"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Đăng ký Container
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          {notice}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Tổng kết quả", pagination.total || 0, "inventory_2", "text-carbon"],
          [
            "Trong bãi",
            items.filter((x) => x.status === "in_yard").length,
            "warehouse",
            "text-emerald-600",
          ],
          [
            "Đang di chuyển",
            items.filter((x) => x.status === "moving").length,
            "local_shipping",
            "text-cyan-600",
          ],
          [
            "Hư hỏng",
            items.filter((x) => x.status === "damaged").length,
            "warning",
            "text-red-600",
          ],
        ].map(([label, value, icon, color]) => (
          <div
            key={label}
            className="rounded-xl border border-chalk bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate">
                {label}
              </p>
              <span className={`material-symbols-outlined ${color}`}>
                {icon}
              </span>
            </div>
            <p className={`mt-2 font-heading text-2xl font-bold ${color}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-chalk bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-xl text-slate">
              search
            </span>
            <input
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder="Tìm Container, EIR, số xe, B/L hoặc seal..."
              className="w-full rounded-lg border border-chalk bg-fog py-2.5 pl-10 pr-3 text-sm outline-none focus:border-signal-orange"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="rounded-lg border border-chalk bg-fog px-3 py-2.5 text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <select
            value={filters.size}
            onChange={(e) => setFilter("size", e.target.value)}
            className="rounded-lg border border-chalk bg-fog px-3 py-2.5 text-sm"
          >
            <option value="">Mọi kích thước</option>
            <option value="ft20">20 feet</option>
            <option value="ft40">40 feet</option>
            <option value="ft45">45 feet</option>
          </select>
          <select
            value={filters.category}
            onChange={(e) => setFilter("category", e.target.value)}
            className="rounded-lg border border-chalk bg-fog px-3 py-2.5 text-sm"
          >
            <option value="">Mọi phân loại</option>
            {["dry", "reefer", "tank", "open_top", "flat_rack"].map(
              (category) => (
                <option key={category} value={category}>
                  {category.replaceAll("_", " ")}
                </option>
              ),
            )}
          </select>
          <button
            onClick={() =>
              setFilters({
                page: 1,
                limit: 10,
                search: "",
                status: "",
                size: "",
                category: "",
              })
            }
            className="rounded-lg border border-chalk px-4 py-2 text-sm font-bold text-graphite hover:bg-fog"
          >
            Xóa lọc
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-chalk bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left">
            <thead className="border-b border-chalk bg-fog text-[11px] font-extrabold uppercase tracking-wider text-slate">
              <tr>
                <th className="px-5 py-3.5">Container ID</th>
                <th className="px-4 py-3.5">Số xe</th>
                <th className="px-4 py-3.5">Hạ / Bốc</th>
                <th className="px-4 py-3.5">Vị trí</th>
                <th className="px-4 py-3.5">Thời gian vào</th>
                <th className="px-4 py-3.5">Thời gian ra</th>
                <th className="px-4 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="py-16 text-center text-sm text-slate"
                  >
                    Đang tải danh sách Container...
                  </td>
                </tr>
              ) : !items.length ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-chalk">
                      inventory_2
                    </span>
                    <p className="mt-2 text-sm font-semibold text-slate">
                      Không tìm thấy Container phù hợp
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((container) => (
                  <tr key={container.id} className="hover:bg-orange-50/30">
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openDetail(container.id)}
                        className="font-mono text-sm font-extrabold tracking-wide text-carbon hover:text-signal-orange"
                      >
                        {container.containerNumber}
                      </button>
                      <p className="mt-1 text-[11px] text-slate">
                        {container.latestEirReference || `${displaySize(container.size)} · ${container.typeCode}`}
                      </p>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs font-semibold text-graphite">
                      {container.latestPlateNumber || "—"}
                    </td>
                    <td className="px-4 py-4 text-xs font-bold text-graphite">
                      {activityLabel(container.latestActivity)}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs font-semibold text-graphite">
                      {container.latestLocationCode || "—"}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate">
                      {formatDate(container.latestCheckInAt)}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate">
                      {formatDate(container.latestCheckOutAt)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[container.status]}`}
                      >
                        {STATUS_LABELS[container.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          title="Xem chi tiết"
                          onClick={() => openDetail(container.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate hover:bg-fog hover:text-carbon"
                        >
                          <span className="material-symbols-outlined text-lg">
                            visibility
                          </span>
                        </button>
                        {canWrite && container.status !== "canceled" && (
                          <button
                            title="Cập nhật"
                            onClick={() => edit(container)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate hover:bg-orange-50 hover:text-signal-orange"
                          >
                            <span className="material-symbols-outlined text-lg">
                              edit
                            </span>
                          </button>
                        )}
                        {canDelete && container.status !== "canceled" && (
                          <button
                            title="Xóa mềm"
                            onClick={() => remove(container)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate hover:bg-red-50 hover:text-red-600"
                          >
                            <span className="material-symbols-outlined text-lg">
                              delete
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-chalk px-5 py-3 sm:flex-row">
          <p className="text-xs text-slate">
            Trang {filters.page}/{Math.max(pagination.totalPages || 1, 1)} ·{" "}
            {pagination.total || 0} kết quả
          </p>
          <div className="flex gap-2">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilter("page", filters.page - 1)}
              className="rounded-md border border-chalk px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            >
              Trước
            </button>
            <button
              disabled={filters.page >= pagination.totalPages}
              onClick={() => setFilter("page", filters.page + 1)}
              className="rounded-md border border-chalk px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
      {showForm && (
        <ContainerFormModal
          container={formContainer}
          types={types}
          onClose={() => setShowForm(false)}
          onSaved={saved}
        />
      )}
      {showDetail && (
        <ContainerDetailModal
          detail={detail}
          loading={detailLoading}
          onClose={() => setShowDetail(false)}
          onEdit={edit}
          onTransition={transitionStatus}
          transitioning={transitioning}
          canWrite={canWrite}
        />
      )}
    </div>
  );

}
