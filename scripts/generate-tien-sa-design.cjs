/* Read-only design geometry. Does not update backend, driver or inventory data. */
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const canonical = path.join(root, "src/features/yard-design/tienSaLayout.json");
const vector = [0.61, 0.79],
  length = Math.hypot(...vector),
  v = vector.map((n) => n / length),
  u = [v[1], -v[0]];
const dot = (p, axis) => p[0] * axis[0] + p[1] * axis[1];
const point = (s, t) => [
  +(u[0] * s + v[0] * t).toFixed(2),
  +(u[1] * s + v[1] * t).toFixed(2),
];
function bands(polygon, count) {
  const projected = polygon.map((p) => [dot(p, u), dot(p, v)]);
  const low = Math.min(...projected.map((p) => p[0])) + 8,
    high = Math.max(...projected.map((p) => p[0])) - 8;
  const interval = (high - low) / count;
  function extent(s) {
    const ts = [];
    for (let i = 0; i < projected.length; i++) {
      const a = projected[i],
        b = projected[(i + 1) % projected.length];
      if (
        s >= Math.min(a[0], b[0]) &&
        s <= Math.max(a[0], b[0]) &&
        a[0] !== b[0]
      )
        ts.push(a[1] + ((s - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
    }
    return [Math.min(...ts), Math.max(...ts)];
  }
  return Array.from({ length: count }, (_, i) => {
    const left = low + i * interval + 3,
      right = low + (i + 1) * interval - 3;
    const a = extent(left),
      b = extent(right),
      start = Math.max(a[0], b[0]) + 8,
      end = Math.min(a[1], b[1]) - 8;
    if (!(end > start))
      throw new Error("Proposed block does not fit inside its mixed yard.");
    return [
      point(left, start),
      point(right, start),
      point(right, end),
      point(left, end),
    ];
  });
}
// All coordinates below are traced in the original 1854 x 1370 investment image.
// The source is never reoriented or adjusted to accommodate a proposed road/block.
const mixed1 = [
  [986, 403],
  [1114, 403],
  [1244, 568],
  [1155, 638],
  [1135, 631],
  [972, 437],
];
const sourceAngle = Math.atan2(0.61, 0.79);
const unrotate = ([x, y]) => [
  +(x * Math.cos(sourceAngle) + y * Math.sin(sourceAngle)).toFixed(2),
  +(-x * Math.sin(sourceAngle) + y * Math.cos(sourceAngle)).toFixed(2),
];
const mixed3 = [
  [334, 894],
  [490, 894],
  [490, 964],
  [334, 964],
].map(unrotate);
const mixed2 = [
  [1170, 403],
  [1325, 403],
  [1376, 482],
  [1281, 547],
  [1255, 540],
  [1162, 434],
];
// Ten parallel strips, measured in the user's registered waterfront crop.
// Crop -> original image: scale .775, origin (1055.80645, 546.12903).
// Keep the CFS 2 footprint fixed; the former eight-strip approximation extended into it.
const waterfront = [
  -94.8, -66.2, -40.9, -9.5, 23.9, 54.3, 77.9, 109.3, 141.5, 171,
].map((s) => {
  const registeredPoint = (cross, along) => [
    +(1055.8064516 + (0.79 * cross + 0.61 * along) / 0.9962 / 0.775).toFixed(2),
    +(546.1290323 + (-0.61 * cross + 0.79 * along) / 0.9962 / 0.775).toFixed(2),
  ];
  return [
    registeredPoint(s - 8, 137),
    registeredPoint(s + 8, 137),
    registeredPoint(s + 8, 320),
    registeredPoint(s - 8, 320),
  ];
});
const quads = [
  [
    [443, 395],
    [462, 380],
    [615, 578],
    [596, 593],
  ],
  [
    [490, 379],
    [509, 364],
    [652, 550],
    [633, 565],
  ],
  [
    [535, 380],
    [554, 365],
    [678, 527],
    [659, 542],
  ],
  [
    [585, 378],
    [604, 363],
    [708, 498],
    [689, 513],
  ],
  [
    [866, 565],
    [884, 551],
    [1007, 715],
    [989, 729],
  ],
  [
    [895, 543],
    [913, 529],
    [1036, 693],
    [1018, 707],
  ],
  [
    [924, 521],
    [942, 507],
    [1065, 671],
    [1047, 685],
  ],
  [
    [953, 499],
    [971, 485],
    [1094, 649],
    [1076, 663],
  ],
  ...waterfront,
  [
    [1418, 574],
    [1428, 566],
    [1526, 694],
    [1516, 702],
  ],
  [
    [1434, 562],
    [1444, 554],
    [1542, 682],
    [1532, 690],
  ],
  ...bands(mixed1, 4),
  ...bands(mixed2, 4),
  ...[342, 382, 422, 462].map((x) =>
    [
      [x, 916],
      [x + 20, 916],
      [x + 20, 954],
      [x, 954],
    ].map(unrotate),
  ),
];
const zoneFor = (i) =>
  i < 4
    ? "CY45"
    : i < 8
      ? "CENTRAL"
      : i < 13
        ? "SOUTH"
        : i < 18
          ? "RTG"
          : i < 20
            ? "WAREHOUSE-YARD"
            : "MIXED";
function alphabeticCode(index) {
  let code = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    code = String.fromCharCode(65 + ((n - 1) % 26)) + code;
  return code;
}
const bounds = (points) => {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};
const sectors=[
  {code:'A',label:'Khu A · Sau cầu 4–5',count:4},
  {code:'B',label:'Khu B · Bãi container 1',count:4},
  {code:'C',label:'Khu C · Bãi container 2',count:10},
  {code:'D',label:'Khu D · Bãi container lạnh',count:2},
  {code:'E',label:'Khu E · Bãi tổng hợp 1',count:4},
  {code:'F',label:'Khu F · Bãi tổng hợp 2',count:4},
  {code:'G',label:'Khu G · Bãi tổng hợp 3',count:4},
];
function blockIdentity(index){
  let offset=0;
  for(const sector of sectors){if(index<offset+sector.count)return {sector:sector.code,code:sector.code+String(index-offset+1).padStart(2,'0')};offset+=sector.count;}
  throw new Error('Block outside sector definitions');
}
const areas = quads.map((polygon, i) => {
  const referenceCode = alphabeticCode(i),
    zone = zoneFor(i),
    proposed = i >= 20;
  return {
    ...blockIdentity(i),
    referenceCode,
    zone,
    ...bounds(polygon),
    polygon,
    orientation: "bay-axis",
    bay: 1,
    rows: [1, 2, 3, 4, 5, 6],
    sourceHighlight: false,
    geometryStatus: proposed ? "proposed" : "reference",
    sourceGroup: proposed
      ? i < 24
        ? "mixed-1"
        : i < 28
          ? "mixed-2"
          : "mixed-3"
      : zone,
    label: [
      (polygon[0][0] + polygon[2][0]) / 2,
      (polygon[0][1] + polygon[2][1]) / 2,
    ],
    operationalBinding: null,
    planning: {
      bayModules: i<4?[29,27,24,20][i]:i<8?28:i<18?29:i<20?16:null,
      rows:6,tiers:4,containerSize:20,
      lengthBasis:i<20?'user-count':'estimated',rowTierBasis:'design-assumption',
    },
    note: proposed
      ? "Block container bổ sung trong bãi tổng hợp; cần xác nhận chuyển đổi công năng, tải nền và thiết bị."
      : "Dải container dựng theo sơ đồ thiết bị; mã chữ cái là quy ước quản lý đề xuất của NexusPort.",
  };
});
const facility = (
  code,
  label,
  kind,
  polygon,
  labelPosition,
  note,
  status = "reference",
  external = false,
) => ({
  code,
  label,
  kind,
  polygon,
  ...bounds(polygon),
  labelPosition,
  note,
  status,
  external,
});
const layout = {
  version: "tien-sa-integrated-20261104-v5",
  schemaVersion: 3,
  status: "proposed",
  width: 1854,
  height: 1370,
  title: "Cảng Tiên Sa",
  source:
    "Sơ đồ bố trí các thiết bị chính khai thác cảng Tiên Sa — Cảng Đà Nẵng",
  units: "source-image-pixels",
  coordinateBasis: {
    source: "investment",
    width: 1854,
    height: 1370,
    rotation: 0,
    method: "manual-source-trace",
  },
  description:
    "Mặt bằng Tiên Sa với 7 khu A–G, 32 block đánh số trong từng khu; chưa ánh xạ tồn kho.",
  sectors,
  zones: [
    {
      code: "CY45",
      label: "Sau cầu 4–5 · A–D",
      color: "#3b776d",
      maxContainerRows: null,
    },
    {
      code: "CENTRAL",
      label: "Bãi trung tâm · E–H",
      color: "#3b776d",
      maxContainerRows: null,
    },
    {
      code: "SOUTH",
      label: "Bãi phía cầu 2–3 · I–M",
      color: "#3b776d",
      maxContainerRows: null,
    },
    {
      code: "RTG",
      label: "Cụm RTG · N–R",
      color: "#3b776d",
      maxContainerRows: null,
    },
    {
      code: "WAREHOUSE-YARD",
      label: "Bãi container cạnh kho · S–T",
      color: "#b38b65",
      maxContainerRows: null,
    },
    {
      code: "MIXED",
      label: "Bổ sung bãi tổng hợp · U–AE",
      color: "#a57335",
      maxContainerRows: null,
    },
  ],
  land: [
    {
      id: "mountain",
      polygon: [
        [741, 94],
        [1654, 94],
        [1654, 365],
        [1548, 338],
        [1431, 367],
        [1106, 373],
        [962, 373],
        [898, 402],
        [824, 448],
        [785, 476],
        [730, 414],
        [705, 331],
        [704, 245],
        [719, 177],
      ],
      fill: "#e9eddf",
    },
    {
      id: "terminal",
      polygon: [
        [366, 360],
        [407, 330],
        [649, 330],
        [686, 361],
        [706, 438],
        [765, 505],
        [797, 483],
        [822, 447],
        [898, 403],
        [963, 371],
        [1367, 373],
        [1457, 344],
        [1554, 338],
        [1582, 406],
        [1687, 601],
        [1518, 725],
        [1262, 948],
        [1237, 977],
        [1268, 1095],
        [1238, 1124],
        [1020, 896],
        [1006, 864],
        [904, 730],
        [882, 699],
        [786, 580],
        [768, 555],
        [743, 527],
        [625, 618],
        [592, 650],
        [528, 639],
        [366, 430],
      ],
      fill: "#fafbf6",
    },
  ],
  berths: [
    {
      code: "TS4",
      label: "CẦU 4",
      polygon: [
        [323, 371],
        [359, 344],
        [565, 612],
        [529, 640],
      ],
      labelPosition: [444, 491],
    },
    {
      code: "TS5",
      label: "CẦU 5",
      polygon: [
        [529, 640],
        [744, 474],
        [774, 513],
        [559, 679],
      ],
      labelPosition: [657, 581],
    },
    {
      code: "TS1",
      label: "CẦU 1",
      polygon: [
        [879, 639],
        [908, 676],
        [698, 817],
        [669, 781],
      ],
      labelPosition: [789, 731],
    },
    {
      code: "TS2",
      label: "CẦU 2",
      polygon: [
        [993, 760],
        [1021, 789],
        [826, 928],
        [798, 896],
      ],
      labelPosition: [909, 847],
    },
    {
      code: "TS3",
      label: "CẦU 3",
      polygon: [
        [1043, 866],
        [1239, 1093],
        [1204, 1121],
        [1017, 898],
      ],
      labelPosition: [1129, 996],
    },
    {
      code: "TS3-END",
      label: "",
      polygon: [
        [1239, 1093],
        [1273, 1130],
        [1241, 1154],
        [1204, 1121],
      ],
      labelPosition: [1241, 1125],
    },
  ],
  mixedYards: [
    {
      code: "mixed-1",
      label: "Bãi tổng hợp 1",
      polygon: mixed1,
      labelPosition: [1100, 392],
    },
    {
      code: "mixed-2",
      label: "Bãi tổng hợp 2",
      polygon: mixed2,
      labelPosition: [1283, 392],
    },
    {
      code: "mixed-3",
      label: "Bãi tổng hợp 3",
      polygon: mixed3,
      labelPosition: unrotate([409, 906]),
    },
  ],
  sourceYards: [],
  yardEnclosures: [
    {
      code: "cy45",
      polygon: [
        [419, 363],
        [638, 358],
        [713, 498],
        [584, 602],
        [559, 582],
        [429, 409],
      ],
    },
    {
      code: "central",
      polygon: [
        [826, 483],
        [965, 394],
        [1134, 671],
        [1015, 747],
        [980, 725],
      ],
    },
    {
      code: "south",
      polygon: [
        [1048, 763],
        [1379, 525],
        [1535, 742],
        [1235, 974],
      ],
    },
  ],
  roads: [
    {
      id: "external-access",
      points: [
        [1840, 347],
        [1734, 351],
        [1640, 378],
        [1583, 406],
      ],
      direction: "unconfirmed",
      kind: "approach",
    },
    {
      id: "source-yellow-road",
      points: [
        [1583, 406],
        [1687, 601],
        [1520, 725],
        [1263, 948],
        [1253, 997],
        [1278, 1104],
        [1311, 1176],
        [1268, 1204],
      ],
      direction: "unconfirmed",
      kind: "external",
    },
    {
      id: "source-bottom-extension",
      points: [
        [1268, 1204],
        [1301, 1232],
      ],
      direction: "unconfirmed",
      kind: "external",
    },
  ],
  accessPoints: [
    {
      code: "MAIN-GATE",
      label: "Cổng chính",
      x: 1583,
      y: 406,
      logicalGateCodes: ["GATE-01", "GATE-02"],
      note: "Theo vị trí cổng vàng trong ảnh đầu tư; mã vào/ra là hai đầu mối logic của hệ thống.",
    },
  ],
  gates: [
    {
      code: "GATE-01",
      label: "Cổng vào",
      direction: "in",
      x: 1575,
      y: 412,
      physicalGate: "MAIN-GATE",
    },
    {
      code: "GATE-02",
      label: "Cổng ra",
      direction: "out",
      x: 1591,
      y: 400,
      physicalGate: "MAIN-GATE",
    },
  ],
  facilities: [
    facility(
      "CFS-01",
      "Kho CFS",
      "warehouse",
      [
        [1509, 522],
        [1542, 500],
        [1585, 556],
        [1552, 580],
      ],
      [1538, 552],
      "Khối xanh dương lớn có nhãn Kho CFS trên sơ đồ. Giữ nguyên vị trí và hình dáng.",
    ),
    facility(
      "CFS-02",
      "CFS số 2",
      "warehouse",
      [
        [1350, 509],
        [1388, 479],
        [1442, 546],
        [1404, 576],
      ],
      [1395, 532],
      "Công trình trong khung dự án CFS số 2 của ảnh đầu tư.",
      "planned",
    ),
    facility(
      "CUSTOMS",
      "Nhà hải quan",
      "customs",
      [
        [1559, 408],
        [1579, 402],
        [1592, 434],
        [1574, 442],
      ],
      [1531, 389],
      "Ô vàng đầu dãy bên phải, vị trí được người dùng xác nhận theo ảnh đầu tư.",
    ),
    facility(
      "BUILDING-02",
      "Nhà chức năng",
      "unconfirmed",
      [
        [1582, 458],
        [1606, 440],
        [1624, 480],
        [1601, 496],
      ],
      [1636, 463],
      "Ô vàng dưới nhà hải quan; nhãn có thể là nhà ga nhưng chưa đọc chắc. Giữ nguyên khối nhà.",
      "unconfirmed",
    ),
    facility(
      "OFFICE",
      "Nhà văn phòng",
      "office",
      [
        [1477, 488],
        [1500, 470],
        [1520, 494],
        [1497, 510],
      ],
      [1452, 473],
      "Ô vàng phía trên hai nhà xanh lớn, được người dùng xác nhận theo ảnh đầu tư.",
    ),
    facility(
      "WORKSHOP-REF",
      "Trạm / xưởng",
      "unconfirmed",
      [
        [1609, 514],
        [1622, 505],
        [1632, 517],
        [1621, 527],
      ],
      [1693, 506],
      "Ô trắng viền xanh giữa nhà chức năng và kho; giữ nguyên hình, nhãn chính xác còn chờ đọc rõ.",
      "unconfirmed",
    ),
    facility(
      "WAREHOUSE",
      "Kho",
      "warehouse",
      [
        [1620, 540],
        [1635, 526],
        [1663, 557],
        [1649, 569],
      ],
      [1701, 548],
      "Ô xanh phía dưới khối trắng viền xanh, theo xác nhận của người dùng.",
    ),
    facility(
      "WORKSHOP",
      "Xưởng",
      "workshop",
      [
        [1588, 620],
        [1611, 602],
        [1638, 640],
        [1614, 656],
      ],
      [1596, 674],
      "Ô xanh lớn dưới Kho CFS; đọc được Xưởng, hậu tố TC/TO chưa chắc. Giữ nguyên vị trí.",
    ),
    facility(
      "POWER-02",
      "Trạm điện 2",
      "power",
      [
        [1642, 618],
        [1654, 607],
        [1667, 626],
        [1654, 635],
      ],
      [1718, 656],
      "Ô xanh nhỏ bên trái góc dưới, người dùng xác nhận là trạm điện.",
    ),
    facility(
      "POWER-01",
      "Trạm điện / kỹ thuật",
      "power",
      [
        [1676, 586],
        [1685, 581],
        [1691, 591],
        [1682, 597],
      ],
      [1752, 607],
      "Cụm ở góc dưới bên phải dưới kho, người dùng xác nhận là trạm điện/khu kỹ thuật.",
    ),
    facility(
      "EXTERNAL-NORTH",
      "Khu đất ngoài cảng",
      "external",
      [
        [1587, 404],
        [1655, 377],
        [1734, 367],
        [1840, 368],
        [1840, 691],
        [1687, 601],
      ],
      [1769, 466],
      "Vùng gạch chéo ngoài ranh trong ảnh; không gán là nhà hải quan và không thêm container.",
      "reference",
      true,
    ),
    facility(
      "EXTERNAL-SOUTH",
      "Khu vực Hải đội 111",
      "external",
      [
        [1687, 601],
        [1263, 948],
        [1249, 987],
        [1275, 1095],
        [1312, 1199],
        [1341, 1289],
        [1838, 865],
        [1838, 691],
      ],
      [1469, 972],
      "Khu vực Hải đội 111 ghi trên ảnh đầu tư; giữ ngoài phạm vi bố trí container.",
      "reference",
      true,
    ),
  ],
  sourceMarks: [
    {
      id: "office-forecourt",
      label: "Sân trước văn phòng",
      points: [
        [1452, 438],
        [1505, 398],
        [1539, 438],
        [1510, 459],
      ],
      note: "Giữ khoảng sân và ký hiệu tiếp cận, không tạo thêm cổng.",
    },
  ],
  areas,
  references: [
    {
      id: "investment",
      label: "Sơ đồ đầu tư",
      url: "https://danangport.com/ke-hoach-dau-tu-phat-trien/",
      asset: "/yard/tien-sa-investment-plan.jpg",
      width: 1854,
      height: 1370,
    },
  ],
};
for (const area of layout.areas) if (area.sector === 'D') area.operationalRole = 'reefer';
for (const file of [canonical]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(layout, null, 2) + "\n");
}
console.log(
  `Generated ${layout.version}: ${areas.length} alphabetic blocks, ${layout.facilities.length} facilities.`,
);
