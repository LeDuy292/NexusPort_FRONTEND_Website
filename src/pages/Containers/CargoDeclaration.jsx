import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { containerService } from "../../services/containerService";
import { declarationBookingSummary } from "../../utils/declarationBookingSummary";
import ContainerImportPanel from "../../components/Containers/ContainerImportPanel";

const emptyForm = {
  containerNumber: "",
  containerTypeCode: "",
  sealNumber: "",
  loadStatus: "unknown",
  cargoType: "general",
  grossWeightKg: "",
  requiredPowerKw: "",
  customerName: "",
};
const loadLabel = (value) =>
  ({ full: "Đầy hàng", empty: "Rỗng", unknown: "Chưa xác định" })[value] ||
  value;
const date = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
const inputClass =
  "w-full rounded-xl border border-chalk bg-fog px-3.5 py-2.5 text-xs font-semibold text-carbon outline-none focus:border-signal-orange focus:bg-white";

export default function CargoDeclaration() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState(null);
  const [sharedIdentity, setSharedIdentity] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [declarations, setDeclarations] = useState([]);
  const [types, setTypes] = useState([]);
  const [cargoTypes, setCargoTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const load = useCallback(async () => {
    if (!search.trim() || search.trim().length < 4) return;
    setLoading(true);
    setError("");
    try {
      const number = search.trim().toUpperCase();
      const [rows, shared] = await Promise.all([
        containerService.getTransportDeclarations(number),
        /^[A-Z]{4}\d{7}$/.test(number)
          ? containerService.lookup(number)
          : Promise.resolve(null),
      ]);
      setDeclarations(rows);
      setSharedIdentity(shared);
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
  useEffect(() => {
    const number = form.containerNumber.trim().toUpperCase();
    setIdentity(null);
    if (!/^[A-Z]{4}\d{7}$/.test(number)) {
      setLookupLoading(false);
      return undefined;
    }
    let current = true;
    setLookupLoading(true);
    const timer = setTimeout(
      () =>
        containerService
          .lookup(number)
          .then((item) => {
            if (!current) return;
            setIdentity(item);
            if (item)
              setForm((previous) => ({
                ...previous,
                containerTypeCode: item.containerTypeCode,
              }));
          })
          .catch((e) => {
            if (current) setError(e.message);
          })
          .finally(() => {
            if (current) setLookupLoading(false);
          }),
      250,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [form.containerNumber]);
  const filtered = useMemo(
    () =>
      declarations.filter(
        (item) =>
          (!typeFilter || item.containerTypeCode === typeFilter) &&
          [item.containerNumber, item.customerName].some((v) =>
            String(v || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
          ),
      ),
    [declarations, typeFilter, search],
  );
  const needsPower = cargoTypes.find(
    (t) => t.code === form.cargoType,
  )?.requiresPower;
  const cargoName = (item) =>
    item.cargoTypeName ||
    cargoTypes.find((t) => t.code === item.cargoType)?.name ||
    "Chưa xác định";
  const update = (key, value) =>
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "cargoType" &&
      !cargoTypes.find((t) => t.code === value)?.requiresPower
        ? { requiredPowerKw: "" }
        : {}),
    }));
  const field = (label, key, props = {}) => (
    <label className="space-y-1.5 text-xs font-bold text-slate">
      <span>
        {label}
        {props.required && <b className="text-red-600"> *</b>}
      </span>
      <input
        className={inputClass}
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
        {...props}
      />
    </label>
  );
  const open = (kind) => {
    setError("");
    setImportResult(null);
    setFile(null);
    setForm(emptyForm);
    setIdentity(null);
    setModal(kind);
  };
  const save = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await containerService.createTransportIntake({
        ...form,
        grossWeightKg:
          form.grossWeightKg === "" ? null : Number(form.grossWeightKg),
        requiredPowerKw: needsPower ? Number(form.requiredPowerKw) : null,
      });
      setNotice(
        result.status === "duplicate"
          ? "Khai báo đã tồn tại, không tạo trùng."
          : "Đã lưu khai báo Container. Bạn có thể đặt lịch vào hoặc ra bãi tại Booking.",
      );
      setModal(null);
      const direction = event.nativeEvent.submitter?.value;
      if (["Pickup", "Dropoff"].includes(direction))
        navigate("/booking", {
          state: {
            declarationId: result.declarationId,
            containerId: result.containerId,
            containerNumber: form.containerNumber,
            bookingType: direction,
          },
        });
      else await load();
    } catch (e) {
      setError(
        e.details ? Object.values(e.details).flat().join(" ") : e.message,
      );
    } finally {
      setSubmitting(false);
    }
  };
  const importExcel = async () => {
    if (!file) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await containerService.importTransportContainers(file);
      setImportResult(result);
      setNotice(
        `Đã xử lý ${result.totalRows} dòng: ${result.successRows} thành công, ${result.duplicateRows} trùng, ${result.failedRows} lỗi.`,
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };
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
            Khai báo Container
          </h1>
          <p className="mt-1 text-sm text-slate">
            Khai báo thông tin hàng trước khi đặt lịch. Nhu cầu, xe và thời gian
            vào/ra kho bãi được chọn tại Booking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/booking"
            className="rounded-xl border border-chalk px-4 py-3 text-xs font-bold"
          >
            Đặt lịch vào / ra bãi
          </Link>
          <button
            onClick={() => open("import")}
            className="rounded-xl border border-carbon px-4 py-3 text-xs font-bold"
          >
            Import Excel
          </button>
          <button
            onClick={() => open("create")}
            className="rounded-xl bg-signal-orange px-4 py-3 text-xs font-extrabold text-white"
          >
            Tạo khai báo mới
          </button>
        </div>
      </header>
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </div>
      )}
      {error && !modal && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
          <button onClick={load} className="ml-4 underline">
            Thử lại
          </button>
        </div>
      )}
      <h2 className="text-lg font-bold text-carbon">
        Danh sách khai báo hàng hóa
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="flex flex-wrap gap-4 rounded-xl border border-chalk bg-white p-4"
      >
        <input
          aria-label="Tìm khai báo"
          placeholder="Nhập số Container để tìm khai báo hàng hóa"
          className={`${inputClass} max-w-sm`}
          value={search}
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
        <button className="rounded-xl bg-carbon px-4 py-2 text-sm font-bold text-white">
          Tìm khai báo
        </button>
      </form>
      {sharedIdentity && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-chalk bg-white p-5">
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
      )}
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
                  Nhập số Container để tìm khai báo hàng hóa.
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
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="declaration-title"
            className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${modal === "create" ? "max-w-4xl" : "max-w-2xl"}`}
          >
            <header className="flex items-center justify-between border-b border-chalk p-5">
              <div>
                <p className="text-xs font-bold text-signal-orange">
                  Công ty vận tải
                </p>
                <h2
                  id="declaration-title"
                  className="font-heading text-2xl font-extrabold"
                >
                  {modal === "create"
                    ? "Tạo khai báo Container"
                    : "Khai báo nhiều Container"}
                </h2>
              </div>
              <button
                disabled={submitting}
                type="button"
                aria-label="Đóng"
                onClick={() => setModal(null)}
                className="material-symbols-outlined p-2"
              >
                close
              </button>
            </header>
            {error && (
              <div
                role="alert"
                className="m-5 rounded-xl bg-red-50 p-3 text-sm text-red-800"
              >
                {error}
              </div>
            )}
            {modal === "create" ? (
              <form onSubmit={save}>
                <div className="space-y-6 p-6">
                  <section>
                    <h3 className="mb-4 border-b border-chalk pb-2 text-xs font-extrabold uppercase">
                      Thông tin nhận diện
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {field("Số Container", "containerNumber", {
                        required: true,
                        placeholder: "EMCU8361795",
                      })}
                      <label className="space-y-1.5 text-xs font-bold text-slate">
                        <span>Loại Container *</span>
                        <select
                          disabled={Boolean(identity) || lookupLoading}
                          required
                          className={inputClass}
                          value={form.containerTypeCode}
                          onChange={(e) =>
                            update("containerTypeCode", e.target.value)
                          }
                        >
                          <option value="">Chọn loại Container</option>
                          {types.map((t) => (
                            <option key={t.id} value={t.code}>
                              {t.code} · {t.description}
                            </option>
                          ))}
                        </select>
                      </label>
                      {identity && (
                        <p className="text-xs text-emerald-700 md:col-span-2">
                          Đã nhận diện Container. Loại được lấy từ hồ sơ dùng
                          chung.
                        </p>
                      )}
                      {lookupLoading && (
                        <p className="text-xs text-slate">
                          Đang kiểm tra hồ sơ Container…
                        </p>
                      )}
                      {field("Số seal (nếu có)", "sealNumber", {
                        maxLength: 100,
                      })}
                      {field("Tên khách hàng/chủ hàng", "customerName")}
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-4 border-b border-chalk pb-2 text-xs font-extrabold uppercase">
                      Thông tin hàng trong Container
                    </h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-1.5 text-xs font-bold text-slate">
                        <span>Tình trạng hàng</span>
                        <select
                          className={inputClass}
                          value={form.loadStatus}
                          onChange={(e) => update("loadStatus", e.target.value)}
                        >
                          {["unknown", "full", "empty"].map((v) => (
                            <option key={v} value={v}>
                              {loadLabel(v)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1.5 text-xs font-bold text-slate">
                        <span>Loại hàng *</span>
                        <select
                          required
                          className={inputClass}
                          value={form.cargoType}
                          onChange={(e) => update("cargoType", e.target.value)}
                        >
                          {cargoTypes.map((t) => (
                            <option key={t.code} value={t.code}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {field("Khối lượng (kg)", "grossWeightKg", {
                        type: "number",
                        min: 0,
                        step: "0.01",
                      })}
                    </div>
                  </section>
                  {needsPower && (
                    <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <h3 className="mb-3 text-xs font-extrabold uppercase text-blue-900">
                        Nhu cầu điện cho hàng đông lạnh
                      </h3>
                      <div className="max-w-sm">
                        {field(
                          "Công suất điện yêu cầu (kW)",
                          "requiredPowerKw",
                          {
                            type: "number",
                            min: "0.01",
                            max: "99999999.99",
                            step: "0.01",
                            required: true,
                          },
                        )}
                      </div>
                    </section>
                  )}
                </div>
                <footer className="flex flex-wrap justify-end gap-3 border-t border-chalk p-5">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setModal(null)}
                    className="rounded-xl border border-chalk px-5 py-3 text-xs font-bold"
                  >
                    Hủy
                  </button>
                  <button
                    disabled={
                      submitting ||
                      lookupLoading ||
                      !types.length ||
                      !cargoTypes.length
                    }
                    className="rounded-xl bg-signal-orange px-5 py-3 text-xs font-extrabold text-white disabled:opacity-50"
                  >
                    {submitting ? "Đang lưu..." : "Lưu khai báo"}
                  </button>
                  <button
                    type="submit"
                    value="Dropoff"
                    disabled={submitting || lookupLoading}
                    className="rounded-xl bg-carbon px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Lưu và đặt lịch đưa vào bãi
                  </button>
                  <button
                    type="submit"
                    value="Pickup"
                    disabled={submitting || lookupLoading}
                    className="rounded-xl border border-carbon px-4 py-3 text-xs font-bold disabled:opacity-50"
                  >
                    Lưu và đặt lịch lấy ra
                  </button>
                </footer>
              </form>
            ) : (
              <ContainerImportPanel
                file={file}
                onFileChange={(nextFile) => {
                  setFile(nextFile);
                  setImportResult(null);
                  setError("");
                }}
                onImport={importExcel}
                onDownload={containerService.downloadTransportTemplate}
                onError={setError}
                submitting={submitting}
                result={importResult}
              />
            )}
          </div>
        </div>
      )}
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
