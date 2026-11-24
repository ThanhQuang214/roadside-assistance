# KẾ HOẠCH TRIỂN KHAI & QUY CHUẨN KỸ THUẬT DỰ ÁN
**Đề tài:** Hệ thống hỗ trợ sự cố xe trên đường (Roadside Assistance System)  
**Môn học:** Thiết kế và Xây dựng Phần mềm  
**Quy mô nhóm:** 4 thành viên (M1, M2, M3, M4)  
**Lộ trình:** 3 ngày chạy nước rút (Báo cáo tiến độ lần 1) + 4 tuần triển khai chính + 1 tuần dự phòng  

---

## I. NGUYÊN TẮC VẬN HÀNH & CHỐNG XUNG ĐỘT (TEAM RULES)

1. **Chia việc theo lát cắt dọc (Vertical Slicing):** Mỗi thành viên chịu trách nhiệm trọn vẹn một cụm Use Case từ **Thiết kế (Sequence, UI, Class) → Backend API → Frontend UI**. Tuyệt đối không chia ngang kiểu 2 người làm FE, 2 người làm BE để tránh tình trạng chờ đợi API của nhau.
2. **Đóng băng Hợp đồng giao tiếp (Single Source of Truth):** M1 khóa cứng 3 file gốc trong `/docs/contracts/` từ đầu Tuần 1 (`schema.sql`, `api-contract.md`, `design-tokens.css`). Thành viên không tự ý sửa 3 file này mà không báo trước.
3. **Cô lập thư mục theo Module:** Mỗi thành viên chỉ code trong thư mục module được phân công (`auth`, `rescue-request`, `company-management`, `matching-ai`, `feedback-chat`), không sửa chéo file của nhau.
4. **Họp chốt tuần:** Tối Chủ Nhật hàng tuần họp 30 phút để kiểm tra 2 đầu ra: *(1) Sơ đồ thiết kế tuần đó đã vẽ xong chưa?* và *(2) Tính năng tuần đó đã chạy được trên nhánh `dev` chưa?*

---

## II. KẾ HOẠCH CHI TIẾT THEO GIAI ĐOẠN

### GIAI ĐOẠN 0: 3 NGÀY NƯỚC RÚT (Báo cáo tiến độ lần 1)
**Mục tiêu:** Chưa code. Hoàn thiện **Bản thiết kế khung (Architectural Blueprint)** đúng chuẩn phương pháp luận môn học (Use Case chuẩn nghĩa nghiệp vụ → Phân tích lớp Boundary-Control-Entity → Chuẩn hóa UI).

| Thành viên | Nhiệm vụ cụ thể trong 3 ngày | Đầu ra (Deliverable) kiểm tra cuối Ngày 3 |
| :--- | :--- | :--- |
| **M1** | • Xác định đầy đủ Actor (Con người + Hệ thống ngoài: Bản đồ/GPS, Dịch vụ AI).<br>• Lập bảng mô tả Actor & quan hệ kế thừa giữa các Actor.<br>• Vẽ **Biểu đồ Use Case tổng quan** (gom đúng mục tiêu nghiệp vụ hoàn chỉnh, không chia vụn thành steps).<br>• Chốt danh sách **6 Use Case cốt lõi**. | • Bảng mô tả Actor.<br>• File sơ đồ Use Case tổng quan (Astah/Draw.io).<br>• Danh mục phân rã Use Case theo từng nhóm Actor. |
| **M2** | • Viết **Đặc tả chi tiết (Use Case Specification)** cho cụm Use Case phía Người gặp sự cố: *Yêu cầu cứu hộ khẩn cấp* (gồm luồng gợi ý AI & ghép nối) và *Hủy yêu cầu cứu hộ*.<br>• Xác định các lớp **Boundary - Control - Entity (BCE)** cho 2 Use Case này. | • Tài liệu đặc tả kịch bản (Luồng chính, rẽ nhánh, ngoại lệ).<br>• Danh sách lớp BCE của cụm Yêu cầu/Hủy cứu hộ. |
| **M3** | • Viết **Đặc tả chi tiết** cho cụm Use Case phía Công ty cứu hộ & Admin: *Tiếp nhận và điều phối cứu hộ*, *Quản lý thông tin & dịch vụ cứu hộ*, *Thẩm định đơn vị cứu hộ*.<br>• Xác định các lớp **BCE** cho cụm Use Case này. | • Tài liệu đặc tả kịch bản phía Công ty & Admin.<br>• Danh sách lớp BCE tương ứng. |
| **M4** | • Xây dựng **Chuẩn hóa cấu hình giao diện (UI Guidelines)** theo mẫu môn học (độ phân giải, bảng màu, font chữ, vị trí nút/thông báo, quy tắc validate input).<br>• Vẽ **Sơ đồ chuyển màn hình (Screen Transition Diagram)**.<br>• Phác thảo Wireframe trên Figma cho 4 màn hình chính. | • Tài liệu chuẩn hóa cấu hình màn hình.<br>• Sơ đồ chuyển màn hình tổng thể.<br>• Link Figma bản nháp (Low-fidelity). |

> **Checklist họp tối Ngày 3:** Ghép danh sách lớp BCE của M2 và M3 thành **Biểu đồ lớp phân tích sơ bộ**; rà soát tên Use Case tránh lỗi chia nhỏ thành step; tổng hợp slide báo cáo tiến độ.

---

### GIAI ĐOẠN 1: LỘ TRÌNH 4 TUẦN THIẾT KẾ & XÂY DỰNG SONG SONG

Nguyên tắc: **30% thời gian hoàn thiện bản vẽ thiết kế chi tiết của tuần đó + 70% thời gian code Full-stack (API + Giao diện) cho đúng module được giao.**

#### TUẦN 1: Chốt Tech Stack, Khóa Hợp đồng Dữ liệu & Xây dựng Nền tảng
*Mục tiêu: Dựng xong khung dự án, khóa file Contract, cài đặt 2 Design Patterns cốt lõi và hoàn thiện các chức năng quản lý danh mục.*

* **M1 (Kiến trúc & Core Patterns):**
  * *Thiết kế:* Chốt Tech Stack; thiết kế **Class Diagram** cho `State Pattern` (vòng đời `RescueRequest`) và `Strategy Pattern` (thuật toán ghép nối/ETA); vẽ gói lớp `Entity`.
  * *Code:* Khởi tạo Git Repo, chốt 3 file `/docs/contracts/`, cài đặt khung code `State` và `Strategy` trong `/src/shared/`.
* **M2 (Module Xác thực & Hồ sơ người dùng):**
  * *Thiết kế:* Vẽ Sequence Diagram + UI Spec + Design Class cho Use Case *Đăng ký / Đăng nhập / Quản lý tài khoản*.
  * *Code:* Hoàn thiện Full-stack (API + UI) Đăng ký, Đăng nhập và phân quyền 3 vai trò (User, Rescue Company, Admin).
* **M3 (Module Quản lý Năng lực Cứu hộ & Duyệt đối tác):**
  * *Thiết kế:* Vẽ Sequence Diagram + UI Spec + Design Class cho Use Case *Quản lý dịch vụ & phương tiện cứu hộ* và *Thẩm định đơn vị cứu hộ*.
  * *Code:* Hoàn thiện Full-stack CRUD gói dịch vụ, phương tiện cứu hộ và chức năng Admin duyệt giấy phép kinh doanh.
* **M4 (UI Kit & Tích hợp Bản đồ nền):**
  * *Thiết kế:* Hoàn thiện High-fidelity Mockup (Figma) cho toàn bộ hệ thống theo đúng quy chuẩn đã đặt ra.
  * *Code:* Dựng bộ UI Components dùng chung trong `/src/shared/ui/` và đóng gói sẵn Component Bản đồ (chọn tọa độ GPS / hiển thị marker) để các thành viên khác tái sử dụng.

---

#### TUẦN 2: Hoàn thiện Luồng Nghiệp vụ Lõi (Yêu cầu & Điều phối Cứu hộ)
*Mục tiêu: Chạy thông suốt luồng End-to-End từ lúc người dùng gửi yêu cầu cứu hộ đến khi công ty tiếp nhận và hoàn tất xử lý.*

* **M1 (Matching Engine & Maps Subsystem):**
  * *Thiết kế:* Chuyển đổi `MapsBoundary` thành **MapsSubsystem** (System Interface Design); thiết kế chi tiết các lớp chiến lược ghép nối (Ưu tiên gần nhất / Ưu tiên đánh giá cao) và công thức tính ETA.
  * *Code:* Hoàn thiện API tìm kiếm, xếp hạng công ty cứu hộ theo bán kính/loại dịch vụ và ước tính thời gian đến (ETA).
* **M2 (Luồng phía Người gặp sự cố):**
  * *Thiết kế:* Hoàn thiện Sequence Diagram & Design Class cho Use Case *Yêu cầu cứu hộ khẩn cấp* và *Hủy yêu cầu cứu hộ*.
  * *Code:* Hoàn thiện Full-stack màn hình Tạo yêu cầu (chọn vị trí bản đồ, nhập mô tả, chọn công ty từ danh sách gợi ý), màn hình theo dõi trạng thái (polling định kỳ) và nút Hủy đơn (kiểm tra hợp lệ qua State Pattern).
* **M3 (Luồng phía Công ty cứu hộ):**
  * *Thiết kế:* Hoàn thiện Sequence Diagram & Design Class cho Use Case *Tiếp nhận và điều phối cứu hộ*.
  * *Code:* Hoàn thiện Full-stack bảng điều khiển nhận đơn của Công ty: xem chi tiết sự cố, gửi ETA phản hồi, cập nhật trạng thái xử lý (`Đã nhận` → `Đang xử lý` → `Hoàn tất`).
* **M4 (Ghép nối luồng & Kiểm soát chất lượng UI):**
  * *Thiết kế:* Cập nhật Sơ đồ chuyển màn hình và Bảng đặc tả chi tiết từng màn hình theo giao diện thực tế.
  * *Code:* Hỗ trợ ghép nối giao diện giữa M2 và M3, bổ sung xử lý lỗi (Error Handling), kiểm tra tính hợp lệ đầu vào (Input Validation) theo đúng chuẩn UI đã cam kết.

---

#### TUẦN 3: Tích hợp AI Cơ bản, Đánh giá & Thống kê Quản trị
*Mục tiêu: Hoàn thiện tính năng AI phân loại sự cố mức cơ bản (đúng yêu cầu đề bài), hệ thống đánh giá và dashboard thống kê.*

* **M1 (Tính năng AI Cơ bản - Phân loại sự cố từ văn bản):**
  * *Thiết kế:* Thiết kế **AISubsystem** tách biệt qua Interface; đặc tả luồng xử lý mô tả văn bản → nhãn loại sự cố + mức độ khẩn cấp.
  * *Code:* Chuẩn bị tập dữ liệu mẫu (~300–500 mô tả sự cố xe tiếng Việt có gán nhãn), huấn luyện mô hình phân loại nhẹ (TF-IDF + Logistic Regression / SVM), xuất chỉ số đánh giá (Accuracy/F1-score) và tích hợp vào API gợi ý dịch vụ.
* **M2 (Hệ thống Đánh giá & Phản hồi):**
  * *Thiết kế:* Vẽ Sequence Diagram & Design Class cho Use Case *Đánh giá chất lượng dịch vụ*.
  * *Code:* Hoàn thiện Full-stack tính năng đánh giá sao + nhận xét sau khi đơn `Hoàn tất`, tự động cập nhật điểm trung bình của công ty cứu hộ.
* **M3 (Dashboard Báo cáo & Kiểm duyệt của Admin):**
  * *Thiết kế:* Vẽ Sequence Diagram & Design Class cho Use Case *Thống kê vận hành* và *Kiểm duyệt nội dung*.
  * *Code:* Hoàn thiện Full-stack trang thống kê cho Admin (số lượng đơn theo trạng thái, tỷ lệ hoàn thành, tần suất dịch vụ) và chức năng ẩn/xóa đánh giá vi phạm.
* **M4 (Trao đổi thông tin đơn giản & Cẩm nang sự cố):**
  * *Thiết kế:* Thiết kế lớp & giao diện cho chức năng nhắn tin trao đổi theo mã đơn cứu hộ và mục Hướng dẫn tự xử lý sự cố cơ bản.
  * *Code:* Hoàn thiện Full-stack khung chat đơn giản (polling theo mã đơn) giữa User và Công ty cứu hộ.

---

#### TUẦN 4: Đồng bộ Báo cáo Thiết kế UML & Kiểm thử Toàn diện
*Mục tiêu: Đảm bảo 100% sự nhất quán giữa Bản vẽ thiết kế trong báo cáo và Source Code thực tế.*

* **M1:** Tổng hợp **Biểu đồ lớp thiết kế tổng thể (Overall Design Class Diagram)** phân chia theo Package; viết mục trình bày thuật toán ghép nối và kết quả đánh giá độ chính xác mô hình AI vào báo cáo. *(Nếu dư thời gian: tích hợp thêm API LLM miễn phí làm trợ lý gợi ý tự sửa xe cơ bản).*
* **M2:** Chuẩn hóa toàn bộ chương **Phân tích yêu cầu (Use Case Diagram, Use Case Spec) & Biểu đồ lớp phân tích (Analysis Class Diagram)** trong báo cáo.
* **M3:** Chuẩn hóa toàn bộ **Biểu đồ trình tự (Sequence Diagram) & Thiết kế Subsystem** trong báo cáo; thực hiện kiểm thử chức năng (Test Cases) toàn hệ thống.
* **M4:** Hoàn thiện chương **Thiết kế giao diện (Interface Design)** (chụp ảnh màn hình thực tế đã chạy mượt kèm bảng đặc tả control/sự kiện) và biên tập định dạng toàn bộ cuốn báo cáo.

---

### GIAI ĐOẠN 2: TUẦN 5 (TUẦN DỰ PHÒNG & CHUẨN BỊ BẢO VỆ)
* **Mục tiêu:** Xử lý các đầu việc tồn đọng nếu có thành viên bận việc cá nhân ở tuần trước; tạo bộ dữ liệu mẫu (Seed Data) thực tế (tọa độ khu vực Hà Nội/TP.HCM, danh sách công ty cứu hộ, lịch sử đơn); làm Slide và tập duyệt demo kịch bản trước hội đồng.