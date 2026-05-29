# Web Học Tiếng Anh

Ứng dụng web học tiếng Anh tập trung vào **luyện dịch câu/đoạn** (đọc + viết + gõ nhanh), kèm flashcard, quiz và quản lý từ vựng. Giao diện React (Vite + Tailwind), backend Node tối giản làm cầu nối tới API dịch của AI.

Mô hình triển khai: **web công khai, mỗi người tự dùng API key của mình (BYOK)**.

- **Dữ liệu học của mỗi người** (bài dịch, từ vựng, tiến độ, thống kê) lưu trong **trình duyệt của họ** (localStorage). Không đăng nhập, không database.
- **API key** do mỗi người tự nhập trong tab **CẤU HÌNH**, cũng lưu trong trình duyệt của họ. Key chỉ rời máy người dùng khi gọi dịch/phân tích, và **backend không lưu key**.
- **Backend** chỉ là proxy không trạng thái: nhận key kèm từng request để gọi nhà cung cấp AI rồi trả kết quả.

> Vì mỗi người dùng key riêng, **bạn (người deploy) không phải trả phí AI cho bạn bè** — ai xài key nấy. Có thể dùng app không cần AI nếu chỉ học bằng bài song ngữ, flashcard, quiz và từ vựng.

---

## 1. Tính năng

### Luyện dịch và gõ (chính)
- Chọn bài có sẵn hoặc tự tạo bài mới; chọn chiều dịch Anh→Việt hoặc Việt→Anh.
- Gõ bản dịch cả đoạn, nhấn `Enter` để phân tích.
- Bật `GỢI Ý` để hiện văn bản tham chiếu mờ ngay trong khung gõ; từ gõ sai được tô màu.
- Chấm "mềm": điểm tương đồng cục bộ + (nếu bật AI) phân tích lỗi theo loại, kèm thống kê WPM.

### Tạo bài mới
- `NHẬP SONG NGỮ`: dán tiếng Anh và tiếng Việt theo từng dòng cùng thứ tự.
- `TẠO BẰNG AI`: dán hoặc tải tài liệu nguồn để AI tách câu và tạo bản dịch tham chiếu.
- Nút `TẢI TỆP BÀI/DỮ LIỆU` hỗ trợ:
  - `.json` dạng mảng `{ "en", "vi" }`: nạp thẳng vào chế độ song ngữ.
  - `.txt`, `.md`, `.json` dạng tài liệu: đưa vào chế độ tạo bằng AI.

File mẫu trong [data/documents](data/documents): `Mau-song-ngu-en-vi.json`, `Mau-tai-lieu-nguon.txt`, `Mau-tai-lieu-nguon.md`, `Mau-tai-lieu-nguon.json`.

Khi tạo bài, app tự rã từ vựng tiếng Anh trong bài và thêm vào kho từ để dùng cho Flashcard, Quiz và gợi ý.

### Flashcard / Quiz / Kho từ vựng
- Flashcard: lật thẻ, đánh dấu `ĐÃ THUỘC`/`CHƯA THUỘC`, lọc theo chủ đề hoặc từ chưa thuộc.
- Quiz: sinh câu hỏi từ kho từ (chọn nghĩa, điền từ, ghép cặp), xem lại câu sai.
- Kho từ vựng: thêm/sửa/xóa, tìm theo từ/nghĩa/ví dụ.

### Sao lưu và khôi phục
Trên thanh điều hướng: `XUẤT` tải toàn bộ dữ liệu ra file JSON; `NHẬP` khôi phục từ file đó. Dùng để sao lưu, chuyển máy, hoặc chia sẻ bộ bài/từ vựng cho bạn bè.

---

## 2. Chạy thử trên máy (local)

Yêu cầu: **Node.js >= 20.6** (dùng `process.loadEnvFile` sẵn có). Không cần Docker, không cần database.

```bash
npm install

# Cách 1 — dùng thật, một cổng:
npm run build      # tạo dist/
npm start          # mở http://localhost:8000

# Cách 2 — phát triển, có hot reload:
npm run server     # backend ở cổng 8000
npm run dev        # Vite ở cổng 5173 (proxy /api sang 8000)
```

Mở app → tab **CẤU HÌNH** → nhập API key của bạn (ví dụ DeepSeek) → Lưu → qua tab **DỊCH** để luyện.

`.env` là **tùy chọn** khi chạy local: nếu điền key vào `.env` (xem `.env.example`), server dùng nó làm dự phòng khi request không kèm key. Khi deploy công khai thì **không nên** điền key vào `.env`.

---

## 3. Deploy để bạn bè dùng

Nên có **HTTPS** để API key người dùng không bị lộ khi truyền đi. Cả hai cách dưới đây đều cho HTTPS.

### Cách A — Render.com (khuyến nghị, miễn phí, có sẵn HTTPS)

Repo đã có sẵn `render.yaml` (Blueprint).

1. Đưa code lên GitHub (một repo, **không kèm `.env`** — đã được `.gitignore`).
2. Vào <https://dashboard.render.com> → **New** → **Blueprint** → chọn repo này.
3. Render tự đọc `render.yaml`: build `npm install && npm run build`, start `npm start`, đặt sẵn `HOST=0.0.0.0`; biến `PORT` do Render cấp.
4. Bấm **Apply/Deploy**. Vài phút sau có địa chỉ dạng `https://learn-english-xxxx.onrender.com`.
5. Gửi link cho bạn bè. Mỗi người mở lên, vào tab **CẤU HÌNH** nhập API key của riêng họ là dùng được.

Lưu ý gói Free của Render: dịch vụ **ngủ khi không có ai truy cập**, lần mở đầu sau khi ngủ chậm ~30 giây rồi chạy bình thường. Dữ liệu người dùng không mất vì nằm trong trình duyệt của họ, không phải trên server.

### Cách B — Cloudflare Tunnel (chạy ngay từ máy bạn)

Phù hợp khi muốn host tạm từ máy cá nhân mà vẫn có HTTPS và link công khai.

```bash
npm install && npm run build
# Mở ra cho tunnel thấy (chỉ trong phiên này):
#   Windows PowerShell:  $env:HOST="0.0.0.0"; npm start
#   macOS/Linux:         HOST=0.0.0.0 npm start

# Cài cloudflared rồi tạo tunnel nhanh tới cổng 8000:
cloudflared tunnel --url http://localhost:8000
```

Cloudflared in ra link `https://...trycloudflare.com`. Gửi link đó cho bạn bè. Tắt máy/tắt lệnh thì link ngừng hoạt động.

---

## 4. Cấu hình AI (BYOK)

AI là tùy chọn. Để dùng AI:

1. Mở app → tab **CẤU HÌNH**.
2. Chọn nhà cung cấp mặc định: `deepseek`, `openai`, `gemini` hoặc `anthropic`.
3. Nhập API key của bạn (có thể chỉnh tên model nếu muốn).
4. Bấm **LƯU CẤU HÌNH**.

Lưu ý:
- API key lưu **trong trình duyệt của bạn** (localStorage), không lưu ở server, không hiển thị lại sau khi lưu.
- Để giữ key cũ, để trống ô API key khi bấm lưu.
- Xóa lịch sử/dữ liệu trình duyệt sẽ xóa luôn key đã lưu.
- Địa chỉ API của nhà cung cấp do backend tự suy ra theo tên (client không gửi URL tùy ý) để tránh bị lợi dụng.

---

## 5. Dữ liệu nằm ở đâu?

Tất cả nằm trong **trình duyệt mỗi người** (localStorage), với tiền tố khóa `le:` — ví dụ `le:data:exercises`, `le:data:vocabulary`, `le:data:translate-stats`, `le:settings`. Lần đầu mở app sẽ có sẵn vài bài và ít từ vựng mẫu.

Để sao lưu/chuyển máy, dùng nút `XUẤT` / `NHẬP` trên thanh điều hướng. Thư mục `data/` trong repo chỉ còn chứa **tài liệu mẫu** trong `data/documents/`.

---

## 6. Riêng tư và an toàn

- **API key không bao giờ lưu trên server**; chỉ gửi kèm request khi gọi AI và không bị ghi log.
- Chỉ nội dung bạn chủ động bấm dịch/phân tích mới được gửi tới nhà cung cấp AI; mọi thứ khác ở local.
- **Không commit `.env`** hay API key thật lên Git — chỉ commit `.env.example`.
- Chạy local mặc định bind `127.0.0.1`; chỉ mở `HOST=0.0.0.0` khi deploy.

---

## 7. Cấu trúc thư mục (rút gọn)

```text
LearnEnglish/
├── render.yaml           # Blueprint deploy Render
├── .env.example          # Mẫu cấu hình (key tùy chọn, chỉ cho local)
├── server/               # Backend proxy không trạng thái
│   ├── server.js         # Phục vụ dist/ + /api/translate + /api/analyze
│   ├── translate.js      # Parse tài liệu + tách câu + gộp request
│   ├── config.js         # Danh mục provider + baseURL/model mặc định
│   └── providers/        # Adapter: openai (dùng cả DeepSeek), anthropic, gemini
├── src/                  # Frontend React
│   ├── api/client.js     # Lưu localStorage + gửi key theo request
│   ├── lib/seed.js       # Dữ liệu mẫu lần đầu
│   └── features/         # translate (chính), flashcards, quiz, vocabulary, settings
└── data/documents/       # Tài liệu mẫu để thử tạo bài bằng AI
```

---

## 8. Xử lý sự cố nhanh

- **Không mở được trang:** kiểm tra backend đã chạy (`npm start`) rồi mở lại địa chỉ.
- **Cổng 8000 bị chiếm:** đóng terminal đang chạy app cũ, hoặc đặt `PORT` khác trong `.env` rồi chạy lại.
- **AI báo thiếu API key:** vào tab `CẤU HÌNH`, nhập key cho provider đã chọn, bấm `LƯU CẤU HÌNH`.
- **Mất dữ liệu khi đổi máy/trình duyệt:** dữ liệu theo từng trình duyệt — dùng `XUẤT` để backup, `NHẬP` để khôi phục.
