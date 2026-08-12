# 🌐 NexusPort - Container Terminal Management System (Frontend Portal)

NexusPort là hệ thống quản lý và vận hành cảng container (Container Terminal Management System) hiện đại, đóng vai trò số hóa toàn bộ luồng nghiệp vụ logistics tại cảng biển từ cầu tàu, kho bãi đến các cổng kiểm soát xe container ra vào cảng.

Tài liệu này tập trung hướng dẫn phát triển và quản lý mã nguồn **Frontend** của dự án dành riêng cho đội ngũ phát triển sản phẩm.

---

## 📌 1. NexusPort Frontend Overview

Frontend của NexusPort được xây dựng dưới dạng một cổng điện tử tập trung (Central Portal), hỗ trợ phân quyền người dùng chặt chẽ để phục vụ 6 nhóm đối tượng tham gia trực tiếp vào chuỗi cung ứng tại cảng:

*   **👑 Admin**: Quản trị viên quản lý danh mục đối tác, cấu hình bến bãi, thiết bị và kiểm soát biểu phí dịch vụ cảng.
*   **📡 Dispatcher / Operator**: Điều độ viên trung tâm kiểm soát toàn bộ hoạt động của tàu, phân bổ cầu bến, điều xe bãi và phê duyệt đặt lịch cổng.
*   **⚓ Berth Staff**: Nhân viên kỹ thuật hiện trường tại cầu tàu kiểm soát tiến độ làm hàng dưới tàu (bốc/dỡ container).
*   **🏗️ Yard Staff**: Nhân viên hiện trường tại kho bãi quản lý vị trí container, kiểm kê bãi và điều động thiết bị cẩu bãi RTG/RMG.
*   **👮 Gate Officer**: Nhân viên kiểm soát cổng phụ trách xác minh xe, tài xế, container và kiểm soát Barrier tự động tại Gate In/Gate Out.
*   **🚛 Transport Company**: Đơn vị vận tải ngoại cảng kiêm hãng tàu đối tác (đã gộp vai trò Carrier) quản lý đội xe kéo, tài xế riêng, lập hồ sơ hàng hóa và đặt lịch hẹn giao/nhận container (Gate Booking).

---

## ⚙️ 2. Main Modules

Mã nguồn Frontend được chia nhỏ thành các module chức năng độc lập theo từng vai trò nghiệp vụ thực tế:

### 👑 Admin
Quản lý dữ liệu danh mục Master Data và cấu hình vận hành của cảng:
*   **Partners**: Phê duyệt và quản lý tài khoản của Hãng tàu (Carrier) và Đơn vị vận tải (Transport Company).
*   **Port Configuration**: Định cấu hình thông số kỹ thuật hạ tầng bao gồm Cầu tàu (Berth), Khối bãi (Yard Blocks), Cổng cảng (Gate) và Thiết bị cơ giới nâng hạ (Equipment).
*   **System Configuration**: Cấu hình các quy tắc nghiệp vụ cảng (Operational Rules), thiết lập mức độ cảnh báo (Alerts) và hệ thống thông báo (Notifications).
*   **Billing**: Quản lý biểu phí nâng hạ, c cắm reefer, lưu bãi quá hạn, xuất hóa đơn cước phí và đối chiếu công nợ.

### 📡 Dispatcher / Operator
Hệ thống điều phối trung tâm hoạt động 24/7 của cảng:
*   **Vessel Schedule**: Giám sát và sắp xếp lịch trình tàu đến và đi.
*   **Berth Assignment**: Phân bổ vị trí neo đậu tối ưu cho tàu trên cầu cảng.
*   **Operation Planning**: Lập kế hoạch bốc dỡ container chi tiết cho từng cẩu bờ (STS Crane).
*   **Carrier Booking Approval**: Duyệt yêu cầu đặt chỗ và lịch giao nhận từ các hãng vận tải.
*   **Equipment / Resource Assignment**: Điều phối cơ giới cẩu giàn RTG/RMG và xe nâng bãi Reach Stacker.
*   **Container Movement**: Theo dõi luồng di chuyển của container trong cảng.
*   **Realtime Dashboard & Alerts**: Bảng điều khiển giám sát trực quan các chỉ số KPIs và cảnh báo sự cố bãi cảng tức thì.

### ⚓ Berth Staff
Giao diện di động/máy tính bảng cho nhân viên tại cầu bến:
*   **Vessel Arrival Confirmation**: Xác nhận tàu đã cập bến an toàn vào vị trí neo đậu.
*   **Start Unloading**: Bắt đầu lệnh tác nghiệp bốc dỡ tàu.
*   **Container Unloading Progress**: Cập nhật tiến độ dỡ từng container lên rơ-moóc theo kế hoạch.
*   **Berth Incident Reporting**: Báo cáo sự cố phát sinh tại cầu bến (hỏng cẩu, lệch cáp).
*   **Complete Vessel Operation**: Đóng lệnh làm hàng, xác nhận giải phóng tàu rời cảng.

### 🏗️ Yard Staff
Module tác nghiệp hiện trường bãi container:
*   **Container Receiving**: Tiếp nhận container từ Gate-In hoặc cầu tàu vào bãi.
*   **2D Yard Map**: Bản đồ trực quan hóa vị trí container theo Block, Row, Tier và Slot.
*   **Yard Inventory & Position Assignment**: Kiểm kê vỏ container, chỉ định vị trí đặt container tối ưu.
*   **Container Relocation**: Thực hiện và ghi nhận lệnh đảo chuyển container trong nội bộ bãi.
*   **Export Container Preparation**: Sắp xếp container xuất khẩu sẵn sàng ra cầu bến.
*   **Container Damage Reporting**: Ghi nhận hư hại, chụp ảnh hiện trạng container lỗi vỏ.

### 👮 Gate Officer
Giao diện kiểm soát tại các luồng Gate tự động:
*   **Vehicle & Driver Verification**: Đối chiếu biển số xe đầu kéo, rơ-moóc và thông tin tài xế.
*   **Container Verification**: Kiểm tra mã container, kẹp chì (Seal) và trạng thái tờ khai hải quan.
*   **Gate In / Gate Out**: Thực hiện đóng mở barrier tự động cho xe qua cổng khi dữ liệu hợp lệ.
*   **Integration OCR / ANPR**: Hệ thống tự động đọc biển số xe (ANPR) và mã container bằng camera AI.
*   **Manual Verification**: Cho phép nhân viên cổng ghi đè mở Barrier thủ công khi có sự cố hệ thống.

### 🚛 Transport Company (Đơn vị vận tải & Đối tác hãng tàu)
Cổng thông tin tự phục vụ dành cho đơn vị vận tải ngoài cảng kiêm hãng tàu đối tác:
*   **Vehicle & Driver Management**: Quản lý thông tin đội xe đầu kéo, rơ-moóc và hồ sơ cấp phép tài xế vận chuyển.
*   **Gate Booking**: Đăng ký và quản lý lịch hẹn thông quan giao nhận container tại Gate In/Gate Out.
*   **Container Management**: Giám sát vị trí định vị bãi cảng và lịch sử di chuyển của container.
*   **Vessel Schedule & Manifest**: Cập nhật hành trình cập bến của các chuyến tàu biển liên kết và gửi khai báo hải quan.
*   **Booking Schedule & Notifications**: Giám sát lịch hẹn được phê duyệt và nhận cảnh báo điều độ.

---

## 🔄 3. Business Flow

Hành trình nghiệp vụ được Frontend thể hiện qua sơ đồ phối hợp tác nghiệp sau:

```
[Transport Company] (Đăng ký xe, tài xế, khai báo tàu & đặt lịch Gate Booking trước)
             │
             ▼
      [Gate Booking] (Yêu cầu hẹn giờ gửi đến hệ thống cảng)
             │
             ▼
        [Dispatcher] (Phê duyệt lịch hẹn, chuẩn bị bãi và phân bổ tài nguyên)
             │
             ▼
   [Berth / Yard Operation] (Tàu cập bến -> Berth Staff xác nhận dỡ container lên bãi)
             │
             ▼
     [Container Storage] (Yard Staff chỉ định vị trí đỗ cont, cẩu bãi RTG xếp hạ bãi)
             │
             ▼
       [Gate Officer] (Tài xế đến cổng -> ANPR OCR đọc biển số & mã cont đối chiếu Pass)
             │
             ▼
     [Gate In / Gate Out] (Hệ thống mở Barrier cho phép giao nhận cont và rời cảng)
```

**Các nguyên tắc phân định vai trò quan trọng:**
*   **Transport Company** là đối tác vận tải ngoại cảng. Họ tự quản lý danh sách xe, tài xế và chủ động tạo các lệnh Gate Booking. Họ không có quyền truy cập vào các phân hệ nội bộ cảng.
*   **Dispatcher** là bộ phận điều phối trung tâm của cảng. Họ tiếp nhận, duyệt lịch Gate Booking và ra lệnh điều động cơ giới nội cảng.
*   **Gate Officer** chỉ kiểm tra tính hợp lệ của phương tiện và container khi xe tải đến bốt kiểm soát cổng.
*   **Yard Staff** và **Berth Staff** tác nghiệp trực tiếp tại hiện trường bãi và cầu tàu theo các lệnh điều phối được đẩy xuống thiết bị cầm tay.

---

## 📂 4. Frontend Project Structure

Cấu trúc thư mục của mã nguồn frontend được thiết kế module hóa như sau:

```
nexusport-frontend/
│
├── public/                     # Thư mục chứa các tài nguyên tĩnh công khai (logo, favicon...)
│
├── src/
│   ├── assets/                 # Các tài nguyên tĩnh được đóng gói kèm bundle (images, styles...)
│   │
│   ├── components/             # Thư mục chứa các UI Components tái sử dụng
│   │   ├── common/             # Các component cơ bản (Button, Badge, Input...)
│   │   ├── layout/             # Các component cấu trúc khung giao diện (Sidebar, Header...)
│   │   ├── navigation/         # Component thanh menu, tab điều hướng
│   │   ├── tables/             # Các component hiển thị bảng dữ liệu (DataTable, Row...)
│   │   ├── modals/             # Hộp thoại popup, thông báo
│   │   └── charts/             # Biểu đồ phân tích số liệu khai thác
│   │
│   ├── layouts/                # Các Layout bọc trang theo từng Role nghiệp vụ cụ thể
│   │   ├── AdminLayout/        # Khung giao diện Quản trị viên
│   │   ├── DispatcherLayout/   # Khung giao diện Điều độ viên
│   │   ├── BerthLayout/        # Khung giao diện di động của Nhân viên Cầu bến
│   │   ├── YardLayout/         # Khung giao diện tác nghiệp hiện trường Bãi
│   │   ├── GateLayout/         # Khung giao diện bốt kiểm soát Cổng
│   │   └── TransportLayout/    # Khung giao diện đơn vị vận tải & hãng tàu đối tác
│   │
│   ├── pages/                  # Các Page chứa logic chính, phân chia rõ theo thư mục Role
│   │   ├── admin/              # Trang cấu hình, phân quyền, billing
│   │   ├── dispatcher/         # Trang kế hoạch bến bãi, giám sát real-time
│   │   ├── berth/              # Trang cập nhật tiến độ bốc dỡ tàu
│   │   ├── yard/               # Trang bản đồ bãi 2D, kiểm kê container
│   │   ├── gate/               # Trang đối chiếu cổng, camera ANPR
│   │   └── transport/          # Trang đăng ký xe rơ-moóc, tài xế, khai báo tàu & Gate Booking
│   │
│   ├── routes/                 # Định cấu hình phân quyền Router của hệ thống
│   ├── services/               # Quản lý các cuộc gọi API giao tiếp với Gateway
│   ├── hooks/                  # Các Custom React Hooks phục vụ logic dùng chung
│   ├── utils/                  # Các hàm tiện ích (Format ngày tháng, đổi số tiền...)
│   ├── constants/              # Thư mục lưu trữ hằng số hệ thống, enum phân quyền
│   ├── types/                  # Định nghĩa kiểu dữ liệu (TypeScript Interfaces / Type)
│   ├── App.jsx                 # Component gốc cấu hình Router & Context Providers
│   └── main.jsx                # Điểm khởi chạy chính của ứng dụng React
│
├── .gitignore                  # Cấu hình bỏ qua các tệp tin khi Git push (node_modules, .env...)
├── package.json                # Quản lý thư viện phụ thuộc và các câu lệnh script dự án
├── vite.config.js              # Cấu hình đóng gói mã nguồn của Vite Bundler
└── README.md                   # Hướng dẫn dự án này
```

---

## 🏛️ 5. UI Architecture

Ứng dụng triển khai cấu trúc định tuyến dựa trên vai trò (**Role-Based Routing**):

```
                       [ Authentication ] (Xác thực đăng nhập thành công)
                               │
                               ▼
                     [ Role-Based Routing ] (Phân luồng dựa trên vai trò người dùng)
                               │
       ┌───────────┬───────────┼───────────┬───────────┬───────────┐
       ▼           ▼           ▼           ▼           ▼           ▼
    [Admin]  [Dispatcher]   [Berth]     [Yard]      [Gate]     [Transport]
```

**Nguyên tắc hoạt động:**
*   Mỗi Role có một **Layout** riêng để tối ưu hóa không gian hiển thị (VD: Giao diện Mobile/Tablet cho Berth/Yard Staff để tiện mang theo hiện trường, giao diện Data-dense đa màn hình cho Dispatcher).
*   Thanh Menu điều hướng (**Navigation Menu**) sẽ lọc tự động dựa trên mảng phân quyền được đính kèm trong token người dùng đăng nhập.

---

## 🧱 6. Reusable Components

Để đảm bảo tính nhất quán của giao diện (Consistent UI), giảm thiểu mã nguồn trùng lặp và tăng khả năng bảo trì, toàn bộ các thành phần giao diện dùng chung được lưu trữ tại `src/components/`:

*   `components/common/`: Chứa các Component nguyên tử như `Button`, `Badge` (nhãn trạng thái), `StatusBadge` (nhãn trạng thái giao dịch), `SearchInput` (ô tìm kiếm).
*   `components/tables/`: Component `DataTable` đa năng hỗ trợ sắp xếp dữ liệu, hiển thị tiến trình, và component `Pagination` phân trang.
*   `components/modals/`: Component `Modal` làm việc cơ bản và `ConfirmDialog` xác nhận các hành động nguy hiểm (như hủy hóa đơn, đổi vị trí tàu).
*   `components/layout/`: Component `Sidebar`, `Header` của cổng thông tin và các trạng thái phản hồi như `EmptyState`, `LoadingState`.

---

## 🧭 7. Routing

Hệ thống định tuyến được cấu trúc phân cấp tường minh theo vai trò nghiệp vụ:

### Các phân hệ Route chính:
*   👑 **Admin Pages**:
    *   `/admin/carriers`: Quản lý danh mục hãng tàu liên kết.
    *   `/admin/port-config/berths`: Cấu hình độ sâu mớn nước cầu bến.
    *   `/admin/billing`: Cổng biểu phí dịch vụ và thanh toán hóa đơn.
*   📡 **Dispatcher Pages**:
    *   `/dispatcher/vessels`: Quản lý danh sách tàu và lịch hải trình.
    *   `/dispatcher/bookings`: Phê duyệt yêu cầu hẹn giờ cổng của các Transport Company.
    *   `/dispatcher/container-movements`: Phân bổ cẩu bãi xếp dỡ container.
*   ⚓ **Berth Staff Pages**:
    *   `/berth/vessel-arrival`: Xác nhận tàu đã cập bến neo đậu thành công.
    *   `/berth/unloading`: Giám sát tốc độ bốc dỡ container dưới tàu.
    *   `/berth/incidents`: Gửi báo cáo sự cố tại bến tàu.
*   🏗️ **Yard Staff Pages**:
    *   `/yard/containers`: Tra cứu vị trí container trong bãi.
    *   `/yard/map`: Sơ đồ bãi 2D hiển thị mật độ tải trọng bãi container.
    *   `/yard/movements`: Chỉ định lệnh xe nâng chuyển cont.
*   👮 **Gate Officer Pages**:
    *   `/gate/vehicle-verification`: Kiểm tra camera AI nhận diện biển số xe kéo.
    *   `/gate/container-verification`: Quét mã số container đối chiếu tờ khai hải quan.
    *   `/gate/gate-in` & `/gate/gate-out`: Xác nhận Barrier mở cho xe di chuyển qua bốt cổng.

---

## 🌲 8. Role-Based Access Control (RBAC)

*   Chỉ các tài khoản được gán đúng vai trò (Role) tương ứng mới có thể truy cập vào các tuyến đường được chỉ định bảo vệ.
*   Khi tài khoản cố tình thay đổi địa chỉ URL sang trang không thuộc thẩm quyền của mình, hệ thống sẽ thực hiện một trong hai hành động sau:
    1.  Tự động chuyển hướng (**Redirect**) về trang chủ mặc định của vai trò đó.
    2.  Hiển thị màn hình báo lỗi **Access Denied (403 - Unauthorized)** với nút quay lại trang hợp lệ gần nhất.

---

## 🌲 9. Git Branch Strategy

Hệ thống áp dụng mô hình Git Workflow tiêu chuẩn cho dự án làm việc nhóm:

```
    main      ────────────────────────────────────────── (Stable, Production)
               ▲
               │ (Release PR)
    develop   ─┴──────────────────────────────────────── (Integration branch)
               ▲             ▲             ▲             ▲
               │ (PR/Review) │ (PR/Review) │ (PR/Review) │ (PR/Review)
    feature/  ─┴─────────────┼─────────────┼─────────────┼────────── (Tính năng mới)
    UI/       ───────────────┼─────────────┼─────────────┼────────── (Giao diện / Front-end)
    bugfix/   ───────────────┴─────────────┼─────────────┼────────── (Sửa lỗi thường)
    hotfix/   ─────────────────────────────┴─────────────┴────────── (Sửa lỗi sản xuất khẩn)
```

### Chi tiết các nhánh phát triển:
*   `main`: Nhánh chứa mã nguồn ổn định nhất đang chạy thực tế trên máy chủ. Không viết code trực tiếp lên nhánh này.
*   `develop`: Nhánh tích hợp chính. Mọi nhánh chức năng (feature) sau khi được duyệt sẽ được merge vào đây để kiểm thử tổng thể.
*   `feature/*`: Nhánh phát triển một chức năng nghiệp vụ cụ thể. Tách ra từ `develop`.
*   `UI/*`: Nhánh phát triển và tối ưu hóa giao diện người dùng (Frontend UI/UX tasks). Tách ra từ `develop`.
*   `bugfix/*`: Nhánh sửa các lỗi thông thường phát hiện trong quá trình thử nghiệm.
*   `hotfix/*`: Nhánh sửa lỗi khẩn cấp trực tiếp trên production, được tách từ `main` và sau khi sửa xong sẽ được merge ngược lại vào cả `main` và `develop`.

---

## 🏷️ 10. Branch Naming Convention

Quy tắc đặt tên nhánh bắt buộc tuân theo định dạng:

*   **Tính năng mới**: `feature/<module>-<function>`
    *   *Ví dụ*: `feature/admin-partners`, `feature/dispatcher-container-movement`, `feature/gate-vehicle-verification`, `feature/transport-booking`.
*   **Giao diện / Front-end Tasks**: `UI/<module>-<task>`
    *   *Ví dụ*: `UI/admin-billing`, `UI/dispatcher-dashboard`, `UI/gate-verification`.
*   **Sửa lỗi**: `bugfix/<module>-<description>`
    *   *Ví dụ*: `bugfix/gate-ocr`, `bugfix/yard-map`, `bugfix/dispatcher-booking`.
*   **Sửa lỗi khẩn**: `hotfix/<description>`
    *   *Ví dụ*: `hotfix/billing-calculation-error`.

---

## 💬 11. Commit Convention

Dự án áp dụng bộ quy tắc **Conventional Commits** để tự động hóa nhật ký thay đổi và kiểm soát chất lượng mã nguồn:

*   `feat`: Thêm trang hoặc chức năng mới.
    *   *Ví dụ*: `feat: add container verification page`
*   `fix`: Sửa lỗi logic hoặc giao diện.
    *   *Ví dụ*: `fix: fix gate booking validation`
*   `style`: Thay đổi căn chỉnh CSS, layout mà không ảnh hưởng logic.
    *   *Ví dụ*: `style: update yard map layout`
*   `refactor`: Cải tiến cấu trúc mã nguồn để tối ưu hiệu năng hoặc dễ đọc.
    *   *Ví dụ*: `refactor: simplify container movement component`
*   `docs`: Cập nhật tài liệu hướng dẫn kỹ thuật.
    *   *Ví dụ*: `docs: update frontend README`
*   `test`: Viết thêm các bộ kiểm thử tự động (Unit Test / Integration Test).
    *   *Ví dụ*: `test: add gate verification tests`
*   `chore`: Cập nhật thư viện package.json hoặc cấu hình bundler.
    *   *Ví dụ*: `chore: update frontend dependencies`

> ❌ **Nghiêm cấm** ghi các commit message không có ý nghĩa như: `update`, `fix`, `final`, `test`, `abc`, `final2`.

---

## 🚀 12. Development Workflow

Quy trình phát triển một chức năng mới của lập trình viên:

1.  Di chuyển sang nhánh develop và lấy mã nguồn mới nhất:
    ```bash
    git checkout develop
    git pull origin develop
    ```
2.  Tạo và di chuyển sang nhánh feature mới từ develop:
    ```bash
    git checkout -b feature/admin-billing
    ```
3.  Thực hiện viết code và kiểm tra thay đổi cục bộ:
    ```bash
    git status
    ```
4.  Lưu các thay đổi và commit theo chuẩn conventional:
    ```bash
    git add .
    git commit -m "feat: add price configuration table for admin billing"
    ```
5.  Đẩy nhánh feature lên máy chủ từ xa:
    ```bash
    git push -u origin feature/admin-billing
    ```
6.  Tạo một **Pull Request (PR)** từ `feature/admin-billing` hướng vào nhánh `develop` trên GitHub.
7.  Đội ngũ kỹ thuật thực hiện **Code Review**, thảo luận sửa đổi nếu cần.
8.  Sau khi được phê duyệt và vượt qua bài test kiểm thử tự động, PR sẽ được **Merge** vào nhánh `develop`.

---

## 📜 13. Git Rules

Để đảm bảo an toàn mã nguồn cho cả nhóm phát triển:
1.  **Tuyệt đối không push code trực tiếp** lên nhánh `main` hoặc `develop`. Mọi thay đổi đều phải thông qua Pull Request.
2.  Mỗi chức năng/sửa lỗi phải được thực hiện trên một nhánh riêng biệt có vòng đời ngắn.
3.  Không bao giờ commit các tệp tin cấu hình nhạy cảm như `.env` hoặc API keys lên kho lưu trữ.
4.  Luôn khai báo thư mục `node_modules`, các tệp tin build (`dist/`) vào `.gitignore`.
5.  Bắt buộc thực hiện pull code mới nhất từ `develop` về trước khi tạo nhánh feature mới để tránh xung đột mã nguồn (merge conflict).
6.  Mỗi Pull Request cần viết mô tả rõ ràng các chức năng thay đổi và kèm theo ảnh chụp màn hình giao diện (UI Screenshot) nếu có chỉnh sửa frontend.

---

## ⚙️ 14. Installation & Build

### Công nghệ lõi của dự án:
*   **Framework**: React 19.x (Sử dụng kiến trúc Component hướng chức năng)
*   **Vite**: Vite 8.x làm bundler và máy chủ phát triển cục bộ tốc độ cao.
*   **Routing**: React Router DOM 7.x phục vụ điều phối và bảo vệ luồng trang.
*   **Linter**: Oxlint 1.x thực hiện quét và phát hiện lỗi cú pháp nhanh gấp nhiều lần ESLint thông thường.
*   **CSS / Styling**: Vanilla CSS kết hợp Tailwind CSS giúp thiết kế giao diện linh hoạt.

## 🎨 15. UI/UX Guidelines

Giao diện NexusPort được thiết kế phục vụ chuyên biệt cho ngành khai thác cảng và logistics công nghiệp:

*   **Aesthetics (Mỹ thuật)**: Giao diện tối giản, hiện đại, sử dụng bảng màu dịu mắt để vận hành thời gian dài. Tone nền xám nhạt (`bg-mist`), thẻ thông tin màu trắng nổi bật, và màu cam làm điểm nhấn thương hiệu (`text-signal-orange` / `#ff682c`).
*   **Data Density (Mật độ dữ liệu)**: Layout dày đặc thông tin nhưng ngăn nắp, tận dụng tối đa không gian màn hình lớn của phòng điều độ. Các bảng dữ liệu (Table) có bộ lọc tìm kiếm nhanh trực quan.
*   **Operational Priority (Ưu tiên vận hành)**: Các trạng thái thay đổi phải hiển thị nhấp nháy (pulsing indicators), màu sắc rõ ràng (Đỏ: Lỗi/Sự cố; Cam: Đang xử lý; Xanh lá: Hoàn tất).
*   **Realtime Indicators**: Luôn hiển thị chỉ báo thời gian đồng bộ thực tế (Live Clock) tại thanh Header và cập nhật các chỉ số hoạt động (KPI) trực quan.

---
