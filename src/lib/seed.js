// Dữ liệu mẫu gieo vào localStorage lần đầu mở app (chỉ chạy một lần).
// Mục đích: người mới vào có sẵn vài bài luyện + ít từ vựng để dùng thử ngay.

export const SEED = {
  exercises: [
    {
      id: 'arch-minimal',
      title: 'Triết lý thiết kế tối giản',
      pairs: [
        {
          en: 'The architectural philosophy of minimal design relies heavily on the spatial relationship between structural elements and empty voids.',
          vi: 'Triết lý kiến trúc của thiết kế tối giản phụ thuộc rất nhiều vào mối quan hệ không gian giữa các yếu tố cấu trúc và những khoảng trống.',
        },
        {
          en: 'Every line and surface must serve a clear purpose, with nothing added for mere decoration.',
          vi: 'Mỗi đường nét và bề mặt đều phải phục vụ một mục đích rõ ràng, không thêm bất cứ thứ gì chỉ để trang trí.',
        },
        {
          en: 'In this approach, silence and emptiness become as important as the objects themselves.',
          vi: 'Theo cách tiếp cận này, sự tĩnh lặng và khoảng trống trở nên quan trọng ngang với chính các vật thể.',
        },
      ],
    },
    {
      id: 'morning-routine',
      title: 'Thói quen buổi sáng',
      pairs: [
        {
          en: 'She usually wakes up before sunrise to enjoy a few quiet moments alone.',
          vi: 'Cô ấy thường thức dậy trước bình minh để tận hưởng vài khoảnh khắc yên tĩnh một mình.',
        },
        {
          en: 'After a short walk, he prepares a simple breakfast and reads the news.',
          vi: 'Sau khi đi dạo một lát, anh ấy chuẩn bị một bữa sáng đơn giản và đọc tin tức.',
        },
        {
          en: 'They believe that a calm morning leads to a more productive day.',
          vi: 'Họ tin rằng một buổi sáng bình yên sẽ dẫn đến một ngày làm việc hiệu quả hơn.',
        },
      ],
    },
  ],
  vocabulary: [
    { id: 'comprehensive', term: 'comprehensive', meaning: 'toàn diện, đầy đủ', example: 'She gave a comprehensive overview of the project.', exampleVi: 'Cô ấy đã đưa ra một cái nhìn tổng quan toàn diện về dự án.', topic: 'Học thuật', learned: false },
    { id: 'significant', term: 'significant', meaning: 'đáng kể, quan trọng', example: 'There was a significant improvement in the results.', exampleVi: 'Đã có sự cải thiện đáng kể trong kết quả.', topic: 'Học thuật', learned: false },
    { id: 'analyze', term: 'analyze', meaning: 'phân tích', example: 'We need to analyze the data carefully before deciding.', exampleVi: 'Chúng ta cần phân tích dữ liệu cẩn thận trước khi quyết định.', topic: 'Học thuật', learned: false },
    { id: 'appreciate', term: 'appreciate', meaning: 'trân trọng, cảm kích', example: 'I really appreciate your help with this.', exampleVi: 'Tôi thật sự cảm kích sự giúp đỡ của bạn trong việc này.', topic: 'Giao tiếp', learned: false },
    { id: 'suggest', term: 'suggest', meaning: 'đề xuất, gợi ý', example: 'Can you suggest a good place to eat nearby?', exampleVi: 'Bạn có thể gợi ý một chỗ ăn ngon gần đây không?', topic: 'Giao tiếp', learned: false },
    { id: 'apologize', term: 'apologize', meaning: 'xin lỗi', example: 'He apologized for arriving late to the meeting.', exampleVi: 'Anh ấy đã xin lỗi vì đến buổi họp muộn.', topic: 'Giao tiếp', learned: false },
    { id: 'deadline', term: 'deadline', meaning: 'hạn chót', example: 'We must meet the deadline by Friday afternoon.', exampleVi: 'Chúng ta phải hoàn thành trước hạn chót vào chiều thứ Sáu.', topic: 'Công việc', learned: false },
    { id: 'schedule', term: 'schedule', meaning: 'lịch trình; lên lịch', example: "Let's schedule a meeting for next week.", exampleVi: 'Hãy lên lịch một cuộc họp vào tuần tới.', topic: 'Công việc', learned: false },
    { id: 'efficient', term: 'efficient', meaning: 'hiệu quả', example: 'This is a more efficient way to organize the files.', exampleVi: 'Đây là một cách hiệu quả hơn để sắp xếp các tệp.', topic: 'Công việc', learned: false },
    { id: 'confident', term: 'confident', meaning: 'tự tin', example: 'She felt confident before the interview.', exampleVi: 'Cô ấy cảm thấy tự tin trước buổi phỏng vấn.', topic: 'Cảm xúc', learned: false },
    { id: 'anxious', term: 'anxious', meaning: 'lo lắng, bồn chồn', example: "I'm a bit anxious about the final exam.", exampleVi: 'Tôi hơi lo lắng về kỳ thi cuối kỳ.', topic: 'Cảm xúc', learned: false },
    { id: 'grateful', term: 'grateful', meaning: 'biết ơn', example: 'We are grateful for everything you have done.', exampleVi: 'Chúng tôi biết ơn vì mọi điều bạn đã làm.', topic: 'Cảm xúc', learned: false },
  ],
}
