import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { containerService } from "../../services/containerService";
import { declarationBookingSummary } from "../../utils/declarationBookingSummary";

const loadLabel = (value) =>
  ({ full: "Đầy hàng", empty: "Rỗng", unknown: "Chưa xác định" })[value] ||
  value;
const date = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "—");

export default function CargoDeclaration() {
  const navigate = useNavigate();
  const [declarations, setDeclarations] = useState([]);
  const [searchNumber, setSearchNumber] = useState("");
  const [containerTypeId, setContainerTypeId] = useState("");
  const [containerTypes, setContainerTypes] = useState([]);
  const [cargoTypes, setCargoTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const declarationRequest = useRef(0);

  useEffect(() => {
    Promise.all([containerService.getCargoTypes(), containerService.getContainerTypes()])
      .then(([cargo, types]) => { setCargoTypes(cargo); setContainerTypes(types); })
      .catch((e) => setError(e.message));
  }, []);

  async function loadDeclarations(event) {
    event.preventDefault();
    const number = searchNumber.toUpperCase().replace(/[\s-]+/g, "");
    if (!/^[A-Z0-9]{4,11}$/.test(number)) {
      setError("Nhập ít nhất 4 ký tự đầu của số container.");
      return;
    }
    const request = ++declarationRequest.current;
    setDeclarations([]);
    setError("");
    setSearched(true);
    setLoading(true);
    try {
      const rows = await containerService.getTransportDeclarations(number);
      if (request === declarationRequest.current)
        setDeclarations(rows.filter(row => !containerTypeId || row.containerTypeId === containerTypeId));
    } catch (error) {
      if (request === declarationRequest.current) setError(error.message);
    } finally {
      if (request === declarationRequest.current) setLoading(false);
    }
  }
  const cargoName = (item) =>
    item.cargoTypeName ||
    cargoTypes.find((t) => t.code === item.cargoType)?.name ||
    "Chưa xác định";
  const details = selected && [
    ["Số Container", selected.containerNumber],
    ["Số seal", selected.sealNumber || "Chưa cung cấp"],
    [
      "Loại Container",
      selected.containerTypeDescription || selected.containerTypeCode,
    ],
    ["Tình trạng hàng", loadLabel(selected.loadStatus)],
    ["Loại hàng", cargoName(selected)],
    [
      "Khối lượng",
      selected.grossWeightKg == null
        ? "Chưa khai báo"
        : `${Number(selected.grossWeightKg).toLocaleString("vi-VN")} kg`,
    ],
    ...(selected.cargoType === "reefer"
      ? [
          [
            "Công suất điện yêu cầu",
            selected.requiredPowerKw == null
              ? "Chưa khai báo"
              : `${selected.requiredPowerKw} kW`,
          ],
        ]
      : []),
    ["Khách hàng/chủ hàng", selected.customerName],
    ["Ngày khai báo", date(selected.createdAt)],
  ];
  return (
    <div className="flex min-h-screen flex-col gap-6 bg-slate-50 p-6 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-chalk bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-extrabold uppercase text-signal-orange">
            Công ty vận tải
          </p>
          <h1 className="font-heading text-3xl font-extrabold text-carbon">
            Bản khai hàng của công ty
          </h1>
          <p className="mt-1 text-sm text-slate">
            Tìm các bản khai hàng của công ty theo số container để tiếp tục đặt lịch.
          </p>
        </div>
        <Link to="/containers" className="rounded-xl border border-chalk px-4 py-2 text-sm font-bold">Tra cứu lượt bãi</Link>
      </header>
      <form onSubmit={loadDeclarations} className="flex flex-wrap items-end gap-4 rounded-2xl border border-chalk bg-white p-5">
        <label className="space-y-2 text-xs font-bold text-slate">
          <span>Số container</span>
          <input required maxLength={20} placeholder="Nhập ít nhất 4 ký tự" value={searchNumber}
            onChange={event => setSearchNumber(event.target.value)} className="block rounded-xl border border-chalk bg-fog px-3 py-2.5 text-sm" />
        </label>
        <label className="space-y-2 text-xs font-bold text-slate">
          <span>Loại trong danh mục</span>
          <select value={containerTypeId} onChange={event => setContainerTypeId(event.target.value)}
            className="block rounded-xl border border-chalk bg-fog px-3 py-2.5 text-sm">
            <option value="">Tất cả</option>
            {containerTypes.map(type => <option key={type.id} value={type.id}>{type.code} · {type.description}</option>)}
          </select>
        </label>
        <button disabled={loading} className="rounded-xl bg-signal-orange px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Tìm kiếm</button>
      </form>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <h2 className="text-lg font-bold text-carbon">
        Bản khai hàng đã có của công ty
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-chalk bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-fog text-slate">
            <tr>
              {[
                "Container",
                "Loại Container",
                "Hàng hóa",
                "Điện yêu cầu",
                "Khách hàng",
                "Loại booking",
                "Ngày khai báo",
                "Thao tác",
              ].map((h) => (
                <th key={h} className="px-5 py-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-chalk">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-10 text-center">
                  Đang tải khai báo...
                </td>
              </tr>
            ) : !declarations.length ? (
              <tr>
                <td colSpan={8} className="p-10 text-center">
                  {searched ? "Công ty chưa có bản khai hàng phù hợp." : "Nhập số Container để tìm khai báo hàng hóa."}
                </td>
              </tr>
            ) : (
              declarations.map((item) => {
                const { directBookings, pickupBooking } = declarationBookingSummary(item);
                return <tr key={item.id} className="hover:bg-fog">
                  <td className="px-5 py-4 font-mono font-bold">
                    {item.containerNumber}
                  </td>
                  <td className="px-5 py-4">
                    {item.containerTypeCode}
                    <p className="mt-1 text-slate">
                      {item.containerTypeDescription}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {cargoName(item)} · {loadLabel(item.loadStatus)}
                    <p className="mt-1 text-slate">
                      {item.grossWeightKg == null
                        ? "Chưa có khối lượng"
                        : `${Number(item.grossWeightKg).toLocaleString("vi-VN")} kg`}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {item.requiredPowerKw == null
                      ? "—"
                      : `${item.requiredPowerKw} kW`}
                  </td>
                  <td className="px-5 py-4">{item.customerName || "—"}</td>
                  <td className="px-5 py-4">
                    {directBookings.length ? (
                      <div className="flex flex-wrap gap-2">{directBookings.map(booking => {
                        const isPickup = booking.bookingType === 'pickup';
                        return <button key={booking.id} title={booking.bookingCode}
                          onClick={() => navigate(`/booking?bookingId=${encodeURIComponent(booking.id)}`)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${isPickup ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          <span className="material-symbols-outlined text-[14px]">{isPickup ? 'arrow_upward' : 'arrow_downward'}</span>
                          {isPickup ? 'Pickup' : 'Dropoff'}
                        </button>;
                      })}</div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {item.isBooked ? 'Đã đặt lịch' : 'Chưa đặt lịch'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">{date(item.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {!item.isBooked && !pickupBooking && (
                        <button
                          onClick={() =>
                            navigate("/booking", {
                              state: {
                                containerNumber: item.containerNumber,
                                declarationId: item.id,
                                containerId: item.containerId,
                                bookingType: "Dropoff",
                              },
                            })
                          }
                          className="rounded-full border border-signal-orange px-3 py-1.5 text-xs font-bold text-signal-orange hover:bg-signal-orange hover:text-white transition-colors"
                        >
                          Đặt Dropoff
                        </button>
                      )}
                      {!pickupBooking && <button
                        onClick={() => navigate('/booking', { state: { containerNumber: item.containerNumber, containerId: item.containerId, bookingType: 'Pickup' } })}
                        className="rounded-full border border-chalk px-3 py-1.5 text-xs font-bold hover:border-signal-orange">
                        Đặt Pickup
                      </button>}
                      <button
                        onClick={() => setSelected(item)}
                        className="rounded-full bg-carbon px-4 py-2 font-bold text-white"
                      >
                        Xem
                      </button>
                    </div>
                  </td>
                </tr>;
              })
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết khai báo"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6"
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-bold">Chi tiết khai báo</h2>
              <button
                aria-label="Đóng"
                onClick={() => setSelected(null)}
                className="material-symbols-outlined"
              >
                close
              </button>
            </div>
            <dl className="mt-5 grid gap-5 md:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-bold text-slate">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            {!!selected.bookings?.length && (
              <section className="mt-6 border-t border-chalk pt-5">
                <h3 className="text-sm font-bold">Booking của lần giao nhận này</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.bookings.map((booking) => (
                    <button
                      key={booking.id}
                      onClick={() => navigate(`/booking?bookingId=${encodeURIComponent(booking.id)}`)}
                      className="inline-flex items-center gap-2 rounded-xl border border-chalk px-4 py-2.5 text-xs font-bold hover:border-signal-orange hover:text-signal-orange"
                    >
                      <span className="material-symbols-outlined text-base">open_in_new</span>
                      Xem {booking.bookingType === 'dropoff' ? 'Dropoff' : 'Pickup'} · {booking.bookingCode}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
