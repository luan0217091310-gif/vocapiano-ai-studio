// Lớp an toàn người học (D-40, AP-6) và minh bạch AI (D-29, AP-1/AP-2) dùng trong Studio.
// Nội dung bám thẻ an toàn trong knowledge/ (bản nháp, chờ chuyên gia phục hồi chức năng ký duyệt).

export const AI_NOTICE =
  "Gia sư AI VocaVerse · Điểm số chỉ dùng để tham khảo luyện tập";

export const POSTURE_MS = 3000;
export const REST_MS = 10 * 60 * 1000;

export const POSTURE = {
  piano: {
    title: "Thả lỏng trước khi chơi",
    tips: [
      "Hạ vai, thả lỏng cổ",
      "Cổ tay ngang phím, không gập",
      "Buông tay xuôi bên người, giữ dáng tự nhiên đặt lên phím",
    ],
  },
  sao_truc: {
    title: "Thở bụng, giữ hơi đều",
    tips: [
      "Thở bụng đều, không cố nín hơi",
      "Vai và cánh tay thả lỏng",
      "Hết hơi thì dừng nốt, hít lại rồi chơi tiếp",
    ],
  },
};

// Lời khuyên nghỉ theo hướng dẫn chung của BAPAM (British Association for Performing Arts Medicine)
// cho người chơi nhạc: dừng ngay khi đau/mỏi, nghỉ và vận động nhẹ, đi khám nếu triệu chứng kéo dài.
export const REST_ADVICE = {
  common: [
    "Dừng chơi ngay. Đau hoặc mỏi là tín hiệu cơ thể cần nghỉ.",
    "Đứng dậy, đi lại nhẹ nhàng và uống một ngụm nước.",
    "Nếu đau, tê hoặc chóng mặt kéo dài, hãy nói với người lớn hoặc đi khám.",
  ],
  piano: [
    "Thả hai tay xuôi, lắc nhẹ cổ tay trong 10 giây.",
    "Xoay vai ra sau chậm rãi 5 lần.",
  ],
  sao_truc: [
    "Ngồi xuống, thở chậm bằng mũi: hít 4 nhịp, thở ra 6 nhịp.",
    "Không thổi tiếp khi còn chóng mặt hoặc hoa mắt.",
  ],
};
