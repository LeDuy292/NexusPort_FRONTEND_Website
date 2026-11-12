import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  cleanDesign,
  MODULE_PITCH,
} from "../src/features/yard-design/geometry.js";
const root = path.resolve(import.meta.dirname, ".."),
  raw = JSON.parse(
    fs.readFileSync(
      path.join(root, "src/features/yard-design/tienSaLayout.json"),
    ),
  ),
  plan = cleanDesign(raw);
const key = (p) => p.map((n) => Number(n.toFixed(4))).join(",");
const lines = [];
const add = (a, b, forward = false) => {
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.001)
    lines.push({ a, b, forward, marks: [a, b] });
};
for (const road of plan.roads)
  for (let i = 1; i < road.points.length; i++)
    add(road.points[i - 1], road.points[i], road.id === "waterfront-aisle");
for (const lane of plan.transferLanes) {
  let [a, b] = lane.points;
  if (lane.axis === "bay" && !lane.serves.some((c) => c.startsWith("C")))
    [a, b] = [b, a];
  add(a, b, lane.axis === "bay" && !lane.bidirectional);
}
const on = (p, l) =>
  Math.abs(
    (p[0] - l.a[0]) * (l.b[1] - l.a[1]) - (p[1] - l.a[1]) * (l.b[0] - l.a[0]),
  ) < 0.02 &&
  p[0] >= Math.min(l.a[0], l.b[0]) - 0.001 &&
  p[0] <= Math.max(l.a[0], l.b[0]) + 0.001 &&
  p[1] >= Math.min(l.a[1], l.b[1]) - 0.001 &&
  p[1] <= Math.max(l.a[1], l.b[1]) + 0.001;
for (const l of lines)
  for (const m of lines) {
    for (const p of [m.a, m.b]) if (on(p, l)) l.marks.push(p);
    const rx = l.b[0] - l.a[0],
      ry = l.b[1] - l.a[1],
      sx = m.b[0] - m.a[0],
      sy = m.b[1] - m.a[1],
      d = rx * sy - ry * sx;
    if (Math.abs(d) < 0.00001) continue;
    const t = ((m.a[0] - l.a[0]) * sy - (m.a[1] - l.a[1]) * sx) / d,
      u = ((m.a[0] - l.a[0]) * ry - (m.a[1] - l.a[1]) * rx) / d;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1)
      l.marks.push([l.a[0] + t * rx, l.a[1] + t * ry]);
  }
const stops = {};
for (const area of plan.areas) {
  const candidates = lines
    .filter(
      (l) =>
        Math.abs(l.a[0] - l.b[0]) < 0.01 &&
        Math.min(l.a[1], l.b[1]) <= area.y + 1 &&
        Math.max(l.a[1], l.b[1]) >= area.y + area.height - 1 &&
        Math.abs(l.a[0] - (area.x + area.width / 2)) < 36,
    )
    .sort(
      (a, b) =>
        Number(b.forward) - Number(a.forward) ||
        Math.abs(a.a[0] - (area.x + area.width / 2)) -
          Math.abs(b.a[0] - (area.x + area.width / 2)) ||
        a.a[0] - b.a[0],
    );
  const lane = candidates[0];
  if (!lane) continue;
  for (let bay = 1; bay < area.planning.bayModules * 2; bay++) {
    const p = [lane.a[0], area.y + (bay / 2) * MODULE_PITCH];
    lane.marks.push(p);
    stops[`${area.code}:${bay}`] = `tsa:${key(p)}`;
  }
}
const gate = [1032, 1210];
for (const l of lines) if (on(gate, l)) l.marks.push(gate);
const nodes = new Map(),
  edges = [],
  edgeKeys = new Set();
const node = (p) => {
  const id = `tsa:${key(p)}`;
  nodes.set(id, {
    id,
    x: +p[0].toFixed(4),
    y: +p[1].toFixed(4),
    label: "Đường nội bộ",
    restricted: false,
  });
  return id;
};
for (const l of lines) {
  const sorted = [...new Map(l.marks.map((p) => [key(p), p])).values()].sort(
    (p, q) =>
      Math.hypot(p[0] - l.a[0], p[1] - l.a[1]) -
      Math.hypot(q[0] - l.a[0], q[1] - l.a[1]),
  );
  for (let i = 1; i < sorted.length; i++) {
    const from = node(sorted[i - 1]),
      to = node(sorted[i]),
      id = `${from}>${to}`;
    if (from === to || edgeKeys.has(id)) continue;
    edgeKeys.add(id);
    edges.push({
      id,
      from,
      to,
      bidirectional: !l.forward,
      distanceMeters: 1,
      travelSeconds: 1,
      routingCost: Math.hypot(
        sorted[i][0] - sorted[i - 1][0],
        sorted[i][1] - sorted[i - 1][1],
      ),
      restricted: false,
      congestion: 0,
    });
  }
}
for (const code of ["GATE-01", "GATE-02"]) {
  const id = `gate:${code}`;
  nodes.set(id, {
    id,
    x: gate[0],
    y: gate[1],
    label: code === "GATE-01" ? "Cổng vào" : "Cổng ra",
    gateCode: code,
    restricted: false,
  });
  edges.push({
    id: `link:${code}`,
    from: code === "GATE-01" ? id : `tsa:${key(gate)}`,
    to: code === "GATE-01" ? `tsa:${key(gate)}` : id,
    bidirectional: false,
    distanceMeters: 1,
    travelSeconds: 1,
    restricted: false,
    congestion: 0,
  });
}
// A lane can serve two neighbouring blocks. Keep the waypoint label neutral;
// the assigned block/bay is carried by the destination, not inferred from a lane.
for (const id of Object.values(stops)) {
  const n = nodes.get(id);
  if (n) n.label = "Điểm dừng trên làn giao nhận";
}
const version =
  "tien-sa-simple-" +
  crypto
    .createHash("sha256")
    .update(JSON.stringify({ plan, nodes: [...nodes.values()], edges }))
    .digest("hex")
    .slice(0, 12);
const pts = (p) => p.map((v) => v.join(",")).join(" ");
let svg = '<g transform="rotate(-37.674)">';
svg += `<polygon points="${pts(plan.terminal)}" fill="white" stroke="#bac7ca"/>`;
for (const a of plan.aprons)
  svg += `<polygon points="${pts(a.polygon)}" fill="#eef0e9" stroke="#a4b1ad"/>`;
for (const r of [...plan.roads, ...plan.transferLanes])
  svg += r.polygon
    ? `<polygon points="${pts(r.polygon)}" fill="#e1e7e9"/>`
    : `<polyline points="${pts(r.points)}" fill="none" stroke="#e1e7e9" stroke-width="${r.width}"/>`;
for (const a of plan.areas)
  svg += `<polygon points="${pts(a.polygon)}" fill="${a.geometryStatus === "proposed" ? "#f1e5cc" : "#dcebe3"}" stroke="#6e9e8a"/><text transform="rotate(37.674 ${a.label.join(" ")})" x="${a.label[0]}" y="${a.label[1]}" text-anchor="middle" font-size="16" fill="#234753">${a.code}</text>`;
const names = {
  "CFS-01": "Kho CFS",
  "CFS-02": "CFS 2",
  OFFICE: "Văn phòng",
  CUSTOMS: "Hải quan",
  WAREHOUSE: "Kho",
  WORKSHOP: "Xưởng",
};
for (const a of plan.facilities.filter((a) => !a.external)) {
  const center = a.polygon.reduce(
    (s, p) => [s[0] + p[0] / a.polygon.length, s[1] + p[1] / a.polygon.length],
    [0, 0],
  );
  svg += `<polygon points="${pts(a.polygon)}" fill="${["OFFICE", "CUSTOMS", "BUILDING-02"].includes(a.code) ? "#edce91" : a.kind === "power" ? "#9fabb6" : "#d5e5ee"}" stroke="#91a8b2"/>`;
  if (names[a.code])
    svg += `<text transform="rotate(90 ${center.join(" ")})" x="${center[0]}" y="${center[1] + 4}" text-anchor="middle" font-size="13" fill="#234753">${names[a.code]}</text>`;
}
for (const g of plan.accessPoints)
  svg += `<path d="M${g.x} ${g.y - g.width / 2}V${g.y + g.width / 2}" stroke="#876c2c" stroke-width="4"/>`;
svg += "</g>";
const data = {
  version,
  policy: "simple-corridors",
  sourceVersion: raw.version,
  areas: plan.areas,
  sectors: plan.sectors,
  nodes: [...nodes.values()],
  edges,
  stops,
  svg,
};
for (const [target, payload] of [
  ["src/features/yard-design/operationalPlan.json", { version }],
  [
    "../NexusPort-App/src/features/driver/data/tienSaPlan.json",
    { version, svg },
  ],
  [
    "../NexusPort-Backend-Website/node-core/src/shared/yard/tien-sa-plan.json",
    data,
  ],
]) {
  const file = path.resolve(root, target);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload) + "\n");
}
console.log({
  version,
  nodes: nodes.size,
  edges: edges.length,
  stops: Object.keys(stops).length,
});
