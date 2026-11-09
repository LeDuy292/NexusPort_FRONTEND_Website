import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { containerService } from "../../services/containerService";
import { declarationBookingSummary } from "../../utils/declarationBookingSummary";

const loadLabel = (value) =>
  ({ full: "Đầy hàng", empty: "Rỗng", unknown: "Chưa xác định" })[value] ||
  value;
const date = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
const inputClass =
  "w-full rounded-xl border border-chalk bg-fog px-3.5 py-2.5 text-xs font-semibold text-carbon outline-none focus:border-signal-orange focus:bg-white focus:ring-0";

export default function CargoDeclaration() {
  const navigate = useNavigate();
  const [sharedIdentities, setSharedIdentities] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [types, setTypes] = useState([]);
  const [cargoTypes, setCargoTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const load = useCallback(async () => {
    const number = search.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,11}$/.test(number)) {
      setError("Nhập số Container từ 4 đến 11 ký tự để tìm kiếm.");
      return;
    }
    setLoading(true);
    setError("");
    setSharedIdentities([]);
    setDeclarations([]);
    try {
      const [rows, shared] = await Promise.all([
        containerService.getTransportDeclarations(number),
        containerService.searchIdentities({ containerNumber: number, limit: 50 }),
      ]);
      setDeclarations(rows);
      setSharedIdentities(shared.items);
      setSearched(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search]);
  useEffect(() => {
    Promise.all([
      containerService.getContainerTypes(),
      containerService.getCargoTypes(),
    ])
      .then(([equipment, cargo]) => {
        setTypes(equipment);
        setCargoTypes(cargo);
      })
      .catch((e) => setError(e.message));
  }, []);
  const filtered = useMemo(
    () =>
      declarations.filter(
        (item) => !typeFilter || item.containerTypeCode === typeFilter,
      ),
    [declarations, typeFilter],
  );
  const filteredIdentities = sharedIdentities.filter(
    (item) => !typeFilter || item.containerTypeCode === typeFilter,
  );
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
            Tra cứu Container
          </h1>
          <p className="mt-1 text-sm text-slate">
            Tìm theo số container để đặt lịch nhận hàng hoặc dùng bản khai hàng
            đã có của công ty để tiếp tục đặt lịch.
          </p>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
          <button onClick={load} disabled={loading} className="ml-4 underline">
            Thử lại
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="flex flex-wrap gap-4 rounded-xl border border-chalk bg-white p-4"
      >
        <input
          aria-label="Số Container"
          placeholder="Nhập ít nhất 4 ký tự của số Container"
          className={`${inputClass} max-w-sm`}
          value={search}
          maxLength={11}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Lọc loại Container"
          className={`${inputClass} max-w-xs`}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">Tất cả loại Container</option>
          {types.map((t) => (
            <option key={t.id} value={t.code}>
              {t.code} · {t.description}
            </option>
          ))}
        </select>
        <button disabled={loading} className="rounded-xl bg-carbon px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {loading ? "Đang tìm…" : "Tìm Container"}
        </button>
      </form>
      {filteredIdentities.map((sharedIdentity) => (
        <div key={sharedIdentity.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-chalk bg-white p-5">
          <div>
            <p className="text-xs font-bold text-slate">
              Container dùng chung · Chỉ hiển thị số và loại
            </p>
            <b className="mt-1 block font-mono">
              {sharedIdentity.containerNumber} ·{" "}
              {sharedIdentity.containerTypeCode}
            </b>
          </div>
          <button
            onClick={() =>
              navigate("/booking", {
                state: {
                  containerNumber: sharedIdentity.containerNumber,
                  containerId: sharedIdentity.id,
                  bookingType: "Pickup",
                },
              })
            }
            className="rounded-xl bg-signal-orange px-4 py-2.5 text-sm font-bold text-white"
          >
            Đặt Pickup bằng mã lượt bãi
          </button>
        </div>
      ))}
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
            ) : !filtered.length ? (
              <tr>
                <td colSpan={8} className="p-10 text-center">
                  {searched ? "Công ty chưa có bản khai hàng phù hợp." : "Nhập số Container để tìm khai báo hàng hóa."}
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
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
