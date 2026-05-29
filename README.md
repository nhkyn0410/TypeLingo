# LearnEnglish Local

LearnEnglish Local là một ứng dụng web học tiếng Anh chạy trên chính máy của bạn. App tập trung vào luyện dịch đoạn văn, ghi nhớ từ vựng, flashcard và quiz. Dữ liệu được lưu bằng file JSON trong thư mục `data/`, không cần cơ sở dữ liệu, không cần tài khoản, không cần đưa dữ liệu cá nhân lên server.

App phù hợp cho:

- Người học tiếng Anh muốn luyện đọc, dịch và gõ lại câu.
- Người muốn tự quản lý kho từ vựng của mình.
- Người muốn dùng AI để tạo bài luyện từ tài liệu tiếng Anh, nhưng vẫn giữ dữ liệu học tập ở máy cá nhân.
- Nhóm nhỏ hoặc bạn bè chia sẻ file bài học và từ vựng với nhau.

## Điểm Chính

- Chạy local tại `http://127.0.0.1:8000`.
- Không dùng database. Dữ liệu nằm trong `data/`.
- API key AI chỉ lưu ở backend local, không hiện lại trên giao diện.
- Có giao diện nhập API key trong tab `CẤU HÌNH`, không cần mở file `.env` để sửa thủ công.
- Có thể dùng app không cần AI nếu chỉ học bằng bài song ngữ, flashcard, quiz và từ vựng.

## Tính Năng

### Luyện Dịch Và Gõ

- Chọn bài luyện có sẵn hoặc tự tạo bài mới.
- Gõ bản dịch cả đoạn, nhấn `Enter` để phân tích.
- Bật `GỢI Ý` để hiện văn bản tham chiếu mờ trong khung gõ.
- Khi gõ sai so với gợi ý, từ sai được tô đỏ.
- Phần phân tích chỉ ra các chỗ khiến câu chưa đạt 100%.
- Có thống kê WPM, số câu đã gửi và điểm tương đồng.

### Tạo Bài Mới

Bạn có thể tạo bài bằng hai cách:

- `NHẬP SONG NGỮ`: dán tiếng Anh và tiếng Việt theo từng dòng cùng thứ tự.
- `TẠO BẰNG AI`: dán hoặc tải tài liệu nguồn để AI tách câu và tạo bản dịch tham chiếu.

Nút `TẢI TỆP BÀI/DỮ LIỆU` hỗ trợ:

- `.json` dạng mảng `{ "en", "vi" }`: nạp thẳng vào chế độ song ngữ.
- `.txt`, `.md`, `.json` dạng tài liệu: đưa vào chế độ tạo bằng AI.

Các file mẫu nằm trong [data/documents](data/documents):

- [Mau-song-ngu-en-vi.json](data/documents/Mau-song-ngu-en-vi.json)
- [Mau-tai-lieu-nguon.txt](data/documents/Mau-tai-lieu-nguon.txt)
- [Mau-tai-lieu-nguon.md](data/documents/Mau-tai-lieu-nguon.md)
- [Mau-tai-lieu-nguon.json](data/documents/Mau-tai-lieu-nguon.json)
- [README-mau-tep.md](data/documents/README-mau-tep.md)

Khi tạo bài mới, app tự rã từ vựng tiếng Anh trong bài và thêm vào kho từ để dùng cho Flashcard, Quiz và gợi ý.

### Flashcard

- Lật thẻ để xem nghĩa, ví dụ và bản dịch ví dụ.
- Đánh dấu `ĐÃ THUỘC` hoặc `CHƯA THUỘC`.
- Lọc theo chủ đề hoặc chỉ ôn từ chưa thuộc.

### Quiz

- Sinh câu hỏi từ kho từ vựng.
- Có dạng chọn nghĩa đúng, điền từ và ghép cặp từ với nghĩa.
- Sau khi làm xong có phần xem lại câu sai.

### Kho Từ Vựng

- Thêm, sửa, xóa từ.
- Tìm theo từ, nghĩa, ví dụ hoặc bản dịch ví dụ.
- Từ tự sinh từ bài luyện có thể được chỉnh lại thủ công sau.

### Sao Lưu Và Khôi Phục

Trên thanh điều hướng có nút:

- `XUẤT`: tải toàn bộ dữ liệu học tập ra một file backup JSON.
- `NHẬP`: khôi phục dữ liệu từ file backup.

## Cách Chạy Cho Người Dùng Thông Thường

Nếu bạn nhận được bản đóng gói portable từ người chia sẻ:

1. Giải nén thư mục app.
2. Chạy file khởi động được cung cấp, ví dụ `start-windows.bat`.
3. Mở trình duyệt và vào `http://127.0.0.1:8000`.
4. Vào tab `CẤU HÌNH` nếu muốn nhập API key AI.

Nếu bản bạn nhận chưa có file khởi động portable, xem phần dành cho người biết kỹ thuật bên dưới.

## Cách Chạy Từ Source Code

Bạn cần cài Node.js trước. Không cần Docker, không cần database.

### Cài Phụ Thuộc

```bash
npm install
```

### Chạy Bản Dùng Thật

```bash
npm run build
npm start
```

Sau đó mở:

```text
http://127.0.0.1:8000
```

### Chạy Khi Phát Triển

Mở hai terminal:

```bash
npm run server
```

```bash
npm run dev
```

Sau đó mở:

```text
http://127.0.0.1:5173
```

## Cấu Hình AI

AI là tùy chọn. Không có API key thì bạn vẫn dùng được Flashcard, Quiz, Kho từ vựng và bài song ngữ.

Để dùng AI:

1. Mở app.
2. Vào tab `CẤU HÌNH`.
3. Chọn nhà cung cấp mặc định, ví dụ `deepseek`, `openai`, `gemini` hoặc `anthropic`.
4. Nhập API key.
5. Kiểm tra model và base URL nếu cần.
6. Bấm `LƯU CẤU HÌNH`.

Lưu ý:

- API key được ghi vào file `.env` trong máy bạn.
- API key không được hiển thị lại trên giao diện sau khi lưu.
- Để giữ key cũ, để trống ô API key khi bấm lưu.
- Chỉ nội dung bạn chủ động bấm dịch/tạo bài bằng AI mới được gửi tới nhà cung cấp AI.

## Dữ Liệu Nằm Ở Đâu?

Các dữ liệu chính nằm trong thư mục `data/`:

- `data/vocabulary.json`: kho từ vựng.
- `data/exercises.json`: bài luyện dịch.
- `data/translate-stats.json`: thống kê luyện dịch.
- `data/documents/`: tài liệu nguồn và file mẫu.

Bạn có thể sao lưu cả thư mục `data/`, hoặc dùng nút `XUẤT` trong app.

## Riêng Tư Và An Toàn

- Backend chỉ chạy local ở `127.0.0.1`.
- Dữ liệu học tập nằm trong thư mục dự án.
- Không có database ngoài.
- Không gửi dữ liệu đi đâu trừ khi bạn dùng tính năng AI.
- Không chia sẻ file `.env` vì file này có thể chứa API key.

## Cho Người Không Muốn Cài Node.js Hoặc Docker

Hiện tại source code cần Node.js để chạy. Để chia sẻ cho người không kỹ thuật, nên đóng gói một bản dễ chạy hơn.

Các hướng khả thi:

1. **Windows portable ZIP**
   - Đóng gói app kèm Node portable.
   - Có file `start-windows.bat`.
   - Người dùng chỉ giải nén và bấm chạy.
   - Đây là hướng nên làm trước vì đơn giản và hợp với app local.

2. **Ứng dụng desktop bằng Electron hoặc Tauri**
   - Người dùng cài như app bình thường.
   - Trải nghiệm thân thiện nhất.
   - Cần thêm cấu hình build desktop.

3. **Single executable**
   - Đóng backend thành một file `.exe` bằng Node SEA, `pkg` hoặc `nexe`.
   - Nhẹ hơn Electron.
   - Cần script build riêng cho từng hệ điều hành.

Khuyến nghị: bắt đầu bằng **Windows portable ZIP**, sau đó nếu nhiều người dùng hơn thì nâng lên Electron/Tauri.

## Cấu Trúc Thư Mục Chính

```text
LearnEnglish/
├── data/                 Dữ liệu học tập local
├── data/documents/       File mẫu và tài liệu nguồn
├── server/               Backend local
├── src/                  Frontend React
├── dist/                 Frontend đã build
├── .env.example          Mẫu cấu hình
└── README.md             Hướng dẫn này
```

## Xử Lý Sự Cố Nhanh

### Không mở được trang

Kiểm tra backend đã chạy chưa:

```bash
npm start
```

Sau đó mở lại `http://127.0.0.1:8000`.

### Cổng 8000 đang bị chiếm

Đóng cửa sổ terminal đang chạy app cũ, hoặc đổi `PORT` trong tab `CẤU HÌNH`/file `.env` rồi chạy lại.

### AI báo thiếu API key

Vào tab `CẤU HÌNH`, nhập API key cho provider bạn chọn, rồi bấm `LƯU CẤU HÌNH`.

### Muốn chuyển máy khác

Dùng nút `XUẤT` để tạo file backup, sang máy khác dùng nút `NHẬP` để khôi phục.
