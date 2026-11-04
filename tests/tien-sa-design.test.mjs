import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  mapFrame,
  rotatePoint,
  STRAIGHT_ANGLE,
  pointInArea,
  cleanDesign,
} from "../src/features/yard-design/geometry.js";
const plan = JSON.parse(
  fs.readFileSync(
    new URL("../src/features/yard-design/tienSaLayout.json", import.meta.url),
  ),
);
function inside(point, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
// Separating-axis check for the convex block/building footprints, not bounding boxes.
function overlaps(a, b) {
  for (const polygon of [a, b])
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i],
        q = polygon[(i + 1) % polygon.length],
        axis = [p[1] - q[1], q[0] - p[0]];
      const project = (shape) =>
        shape.map((v) => v[0] * axis[0] + v[1] * axis[1]);
      const x = project(a),
        y = project(b);
      if (
        Math.min(Math.max(...x), Math.max(...y)) <=
        Math.max(Math.min(...x), Math.min(...y)) + 0.001
      )
        return false;
    }
  return true;
}
test("32 numbered blocks in seven sectors preserve the source geometry", () => {
  assert.deepEqual(
    plan.areas.map((a) => a.code),
    plan.sectors.flatMap((sector) =>
      Array.from(
        { length: sector.count },
        (_, i) => sector.code + String(i + 1).padStart(2, "0"),
      ),
    ),
  );
  assert.equal(
    plan.areas.filter((a) => ["SOUTH", "RTG"].includes(a.zone)).length,
    10,
  );
  assert.equal(
    plan.areas.filter((a) => a.geometryStatus === "reference").length,
    20,
  );
  assert.equal(
    plan.areas.filter((a) => a.geometryStatus === "proposed").length,
    12,
  );
  assert.deepEqual(plan.facilities.find((f) => f.code === "CFS-02").polygon, [
    [1350, 509],
    [1388, 479],
    [1442, 546],
    [1404, 576],
  ]);
  assert.equal(plan.mixedYards.length, 3);
  assert.equal(plan.areas.filter((a) => a.sourceGroup === "mixed-3").length, 4);
  assert.equal(plan.coordinateBasis.rotation, 0);
  assert.equal(
    plan.references.some((r) => r.id === "satellite"),
    false,
  );
  assert.equal(plan.accessPoints.length, 1);
  assert.deepEqual(
    plan.gates.map((g) => g.direction),
    ["in", "out"],
  );
});
test("blocks do not overlap CFS 2, other buildings or one another", () => {
  for (const [index, area] of plan.areas.entries()) {
    for (const facility of plan.facilities.filter((f) => !f.external))
      assert.equal(
        overlaps(area.polygon, facility.polygon),
        false,
        `${area.code} overlaps ${facility.code}`,
      );
    for (const other of plan.areas.slice(index + 1))
      assert.equal(
        overlaps(area.polygon, other.polygon),
        false,
        `${area.code} overlaps ${other.code}`,
      );
  }
});
test("new blocks remain inside mixed yards and have no inventory bindings", () => {
  for (const area of plan.areas) {
    assert.equal(area.operationalBinding, null);
    if (area.geometryStatus === "proposed")
      for (const point of area.polygon)
        assert.ok(
          inside(
            point,
            plan.mixedYards.find((y) => y.code === area.sourceGroup).polygon,
          ),
          area.code,
        );
  }
});
test("one rigid rotation makes waterfront strips vertical without altering source geometry", () => {
  const frame = mapFrame(plan, STRAIGHT_ANGLE);
  for (const area of plan.areas) {
    const start = rotatePoint(pointInArea(area, 0, 0.5), STRAIGHT_ANGLE),
      end = rotatePoint(pointInArea(area, 1, 0.5), STRAIGHT_ANGLE);
    assert.ok(
      Math.abs(end[0] - start[0]) < 5,
      `${area.code} axis is not vertical`,
    );
    for (const p of area.polygon) {
      const q = rotatePoint(p, STRAIGHT_ANGLE);
      assert.ok(
        q[0] > frame.x &&
          q[0] < frame.x + frame.width &&
          q[1] > frame.y &&
          q[1] < frame.y + frame.height,
      );
    }
  }
  assert.deepEqual(mapFrame(plan, 0), {
    x: 0,
    y: 0,
    width: 1854,
    height: 1370,
  });
});
test("source road centerlines remain outside container footprints", () => {
  for (const road of plan.roads)
    for (let i = 1; i < road.points.length; i++)
      for (let n = 0; n <= 200; n++) {
        const a = road.points[i - 1],
          b = road.points[i],
          p = [
            a[0] + ((b[0] - a[0]) * n) / 200,
            a[1] + ((b[1] - a[1]) * n) / 200,
          ];
        for (const area of plan.areas)
          assert.equal(
            inside(p, area.polygon),
            false,
            `${road.id} crosses ${area.code}`,
          );
      }
});

const design = cleanDesign(plan);
test("clean footprints are orthogonal and clear of CFS, other buildings and berths", () => {
  for (const [index, area] of design.areas.entries()) {
    const [a, b, c, d] = area.polygon;
    assert.equal(a[1], b[1]);
    assert.equal(b[0], c[0]);
    assert.equal(c[1], d[1]);
    assert.equal(d[0], a[0]);
    for (const other of [
      ...design.areas.slice(index + 1),
      ...design.facilities,
      ...design.aprons.flatMap((item) =>
        (item.convexParts || [item.polygon]).map((polygon) => ({
          ...item,
          polygon,
        })),
      ),
    ])
      assert.equal(
        overlaps(area.polygon, other.polygon),
        false,
        `${area.code} overlaps ${other.code}`,
      );
    const yard =
      area.geometryStatus === "proposed"
        ? design.mixedYards.find((y) => y.code === area.sourceGroup)
        : design.yardEnclosures.find(
            (y) =>
              y.code ===
              (area.zone === "CY45"
                ? "cy45"
                : area.zone === "CENTRAL"
                  ? "central"
                  : ["SOUTH", "RTG"].includes(area.zone)
                    ? "south"
                    : "warehouse-yard"),
          );
    for (const point of area.polygon)
      assert.ok(inside(point, yard.polygon), area.code + " outside clean yard");
  }
});
test("yard boundaries do not cross each other, and perimeter road clears blocks and buildings", () => {
  const yards = [
    ...design.mixedYards,
    ...design.yardEnclosures.filter((y) => y.code !== "central"),
  ];
  for (const [i, yard] of yards.entries())
    for (const other of yards.slice(i + 1))
      assert.equal(
        overlaps(yard.polygon, other.polygon),
        false,
        `${yard.code} crosses ${other.code}`,
      );
  for (const road of design.roads)
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1],
        b = road.points[i],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        offset = [
          (-(b[1] - a[1]) / length) * (road.width / 2),
          ((b[0] - a[0]) / length) * (road.width / 2),
        ];
      const footprint = [
        [a[0] + offset[0], a[1] + offset[1]],
        [b[0] + offset[0], b[1] + offset[1]],
        [b[0] - offset[0], b[1] - offset[1]],
        [a[0] - offset[0], a[1] - offset[1]],
      ];
      for (const item of [...design.areas, ...design.facilities])
        assert.equal(
          overlaps(footprint, item.polygon),
          false,
          "road overlaps " + item.code,
        );
    }
});

test("office waiting area and gate approach remain clear of container and building footprints", () => {
  assert.equal(
    design.roads.some((road) => road.kind === "external"),
    false,
  );
  for (const item of [...design.areas, ...design.facilities])
    assert.equal(
      overlaps(design.waitingArea.polygon, item.polygon),
      false,
      "Waiting area overlaps " + item.code,
    );
  const customs = design.facilities.find(
      (f) => f.code === "CUSTOMS",
    ).labelPosition,
    gate = design.accessPoints[0];
  assert.ok(
    Math.hypot(customs[0] - gate.x, customs[1] - gate.y) < 110,
    "Gate must remain at the customs/office entrance compound",
  );
  assert.equal(design.waitingArea.status, "proposed");
});

test("two-lane gate flares to five lanes only at office and narrows again", () => {
  const road = design.roads.find((r) => r.id === "gate-to-yard"),
    gate = design.accessPoints[0];
  assert.equal(road.lanes, 2);
  assert.equal(road.queue.lanes, 5);
  assert.equal(road.points.length, 2);
  assert.equal(road.points[0][1], road.points[1][1]);
  assert.equal(road.points[0][1], gate.y);
  assert.equal(road.width, gate.width);
  assert.ok(
    road.queue.start > road.queue.taperStart &&
      road.queue.end < road.queue.taperEnd,
  );
  assert.equal(road.queue.width / 5, road.width / 2);
  assert.equal(design.waitingArea.integrated, true);
  assert.equal(design.waitingArea.stalls, undefined);
  // The queue footprint clears buildings, and the relocated office clears CFS 1.
  for (const item of [...design.areas, ...design.facilities])
    assert.equal(
      overlaps(design.waitingArea.polygon, item.polygon),
      false,
      "Queue overlaps " + item.code,
    );
  for (const [i, item] of design.facilities.entries())
    for (const other of design.facilities.slice(i + 1))
      assert.equal(
        overlaps(item.polygon, other.polygon),
        false,
        item.code + " overlaps " + other.code,
      );
  const office = design.facilities.find((f) => f.code === "OFFICE"),
    customs = design.facilities.find((f) => f.code === "CUSTOMS");
  assert.ok(
    office.y > gate.y + road.queue.width / 2 &&
      office.y - (gate.y + road.queue.width / 2) < 10,
  );
  assert.ok(customs.y < 1250);
  const baseline = design.areas.find((a) => a.referenceCode === "E")
    .polygon[2][1];
  for (const code of [
    "E",
    "F",
    "G",
    "H",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    "AA",
    "AB",
  ])
    assert.equal(
      design.areas.find((a) => a.referenceCode === code).polygon[2][1],
      baseline,
      code + " head must align with E–H",
    );
});

test("Bay-axis access lanes occupy reserved gaps and avoid stacks and buildings", () => {
  assert.ok(design.transferLanes.length > 15);
  for (const lane of design.transferLanes) {
    assert.ok(lane.width > 0);
    const [a, b] = lane.points;
    if (lane.axis === "bay") assert.equal(a[0], b[0]);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      offset = [
        ((-(b[1] - a[1]) / length) * lane.width) / 2,
        (((b[0] - a[0]) / length) * lane.width) / 2,
      ];
    const footprint = [
      [a[0] + offset[0], a[1] + offset[1]],
      [b[0] + offset[0], b[1] + offset[1]],
      [b[0] - offset[0], b[1] - offset[1]],
      [a[0] - offset[0], a[1] - offset[1]],
    ];
    for (const item of [...design.areas, ...design.facilities])
      assert.equal(
        overlaps(footprint, item.polygon),
        false,
        lane.id + " crosses " + item.code,
      );
  }
});

test("opposing strip columns align and every strip group has the same clear spacing", () => {
  for (const [top, bottom] of [
    ["E", "I"],
    ["F", "J"],
    ["G", "K"],
    ["H", "L"],
    ["U", "M"],
    ["V", "N"],
    ["W", "O"],
    ["X", "P"],
    ["Y", "Q"],
    ["Z", "R"],
    ["AA", "S"],
    ["AB", "T"],
  ]) {
    const a = design.areas.find((a) => a.referenceCode === top),
      b = design.areas.find((a) => a.referenceCode === bottom);
    assert.equal(a.x, b.x, top + " / " + bottom + " left edges");
    assert.equal(a.width, b.width, top + " / " + bottom + " widths");
  }
  for (const codes of [
    ["A", "B", "C", "D"],
    ["E", "F", "G", "H", "U", "V", "W", "X", "Y", "Z", "AA", "AB"],
    ["I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"],
    ["AC", "AD", "AE", "AF"],
  ]) {
    const items = codes.map((code) =>
      design.areas.find((a) => a.referenceCode === code),
    );
    for (let i = 1; i < items.length; i++)
      assert.equal(
        items[i].x - items[i - 1].x - items[i - 1].width,
        20,
        codes[i] + " spacing",
      );
  }
});

test("G01–G04 form a separate sector aligned exactly with B01–B04", () => {
  assert.equal(plan.areas.length, 32);
  assert.equal(plan.sectors.length, 7);
  assert.equal(new Set(plan.areas.map((a) => a.code)).size, 32);
  for (const area of plan.areas) assert.match(area.code, /^[A-G]\d{2}$/);
  for (let i = 1; i <= 4; i++) {
    const suffix = String(i).padStart(2, "0"),
      g = design.areas.find((a) => a.code === "G" + suffix),
      b = design.areas.find((a) => a.code === "B" + suffix);
    assert.equal(g.x, b.x);
    assert.equal(g.width, b.width);
    assert.equal(g.sector, "G");
    assert.equal(g.sourceGroup, "mixed-3");
  }
});

test("outer A aisles connect to the cross aisle, and E/F have no rear road", () => {
  for (const code of ["A01", "A04"]) {
    const area = design.areas.find((a) => a.code === code),
      lane = design.transferLanes.find((l) => l.id === `outer-${code}`);
    assert.ok(lane);
    assert.equal(lane.bidirectional, true);
    assert.ok(
      code === "A01"
        ? lane.points[0][0] < area.x
        : lane.points[0][0] > area.x + area.width,
    );
    assert.equal(lane.points[1][1], 832);
  }
  assert.equal(
    design.roads.some((r) => ["e-rear", "f-rear"].includes(r.id)),
    false,
  );
  for (const lane of design.transferLanes.filter((l) =>
    l.serves.some((code) => /^[EF]/.test(code)),
  )) {
    assert.equal(lane.bidirectional, true, lane.id);
    assert.equal(lane.points[1][1], 1210);
  }
  // Both mixed-yard outlines must sit within the white terminal footprint.
  for (const yard of design.mixedYards.filter((y) =>
    ["mixed-1", "mixed-2"].includes(y.code),
  ))
    for (const point of yard.polygon)
      assert.ok(
        inside(point, design.terminal),
        yard.code + " outside terminal",
      );
});
