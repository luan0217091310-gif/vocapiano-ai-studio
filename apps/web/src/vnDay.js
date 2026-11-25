/** Ngày theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD — khớp cách máy chủ ghi `day` của lượt tập. */
export const vnDay = (date = new Date()) =>
  new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
