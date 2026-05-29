# Mẫu tệp để thêm bài mới

Các tệp trong thư mục này có thể dùng để thử nút `TẢI TỆP BÀI/DỮ LIỆU` trong màn tạo bài.

- `Mau-song-ngu-en-vi.json`: mảng cặp câu `{ "en", "vi" }`. App sẽ nạp thẳng vào chế độ `NHẬP SONG NGỮ`.
- `Mau-tai-lieu-nguon.txt`: tài liệu nguồn dạng văn bản thuần. App sẽ đưa vào chế độ `TẠO BẰNG AI` để dịch và tạo bài.
- `Mau-tai-lieu-nguon.md`: tài liệu Markdown. App sẽ đưa vào chế độ `TẠO BẰNG AI`; code block nên được giữ nguyên khi backend xử lý.
- `Mau-tai-lieu-nguon.json`: tài liệu JSON không phải mảng cặp câu. App sẽ đưa vào chế độ `TẠO BẰNG AI`.

Lưu ý: chỉ JSON dạng mảng cặp `{ "en", "vi" }` mới được nạp thẳng thành bài song ngữ. Các JSON khác được xem là tài liệu nguồn cần AI tạo bản dịch tham chiếu.
