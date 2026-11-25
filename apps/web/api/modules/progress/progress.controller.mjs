import { pagination } from "../../core/http.mjs";
import { v, validate } from "../../core/validate.mjs";

const lessonId = v.string({
  min: 4,
  max: 20,
  pattern: /^[A-Z]{2}\d{2}[A-Za-z0-9-]*$/,
  message: "mã bài không hợp lệ",
});

export function progressController({ progressService }) {
  return {
    summary: (ctx) => ({ data: progressService.summary(ctx.user) }),
    record(ctx) {
      const body = validate(
        {
          lessonId,
          mode: v.oneOf(["learn", "wait", "exam"]),
          accuracy: v.number({ min: 0, max: 1 }),
          durationS: v.int({ min: 1, max: 7200 }),
        },
        ctx.body,
      );
      return {
        data: progressService.recordSession(ctx.user, body),
        status: 201,
      };
    },
    history(ctx) {
      const { items, meta } = progressService.history(
        ctx.user,
        pagination(ctx.query),
      );
      return { data: items, meta };
    },
    favorites: (ctx) => ({ data: progressService.favorites(ctx.user) }),
    addFavorite(ctx) {
      const id = validate({ lessonId }, ctx.params).lessonId;
      return { data: progressService.addFavorite(ctx.user, id) };
    },
    removeFavorite(ctx) {
      const id = validate({ lessonId }, ctx.params).lessonId;
      return { data: progressService.removeFavorite(ctx.user, id) };
    },
    catalog: (ctx) => ({ data: progressService.catalog(ctx.user) }),
  };
}

export function progressRoutes(router, c) {
  router.add({
    method: "GET",
    path: "/lessons",
    auth: "optional",
    handler: c.catalog,
    doc: "Danh mục bài kèm cờ khoá theo gói",
  });
  router.add({
    method: "GET",
    path: "/me/progress",
    auth: "user",
    handler: c.summary,
    doc: "XP, chuỗi ngày, huy hiệu, cấp độ",
  });
  router.add({
    method: "POST",
    path: "/me/sessions",
    auth: "user",
    handler: c.record,
    doc: "Ghi một lượt luyện tập",
  });
  router.add({
    method: "GET",
    path: "/me/sessions",
    auth: "user",
    handler: c.history,
    doc: "Lịch sử luyện tập (phân trang)",
  });
  router.add({
    method: "GET",
    path: "/me/favorites",
    auth: "user",
    handler: c.favorites,
    doc: "Bài yêu thích",
  });
  router.add({
    method: "PUT",
    path: "/me/favorites/:lessonId",
    auth: "user",
    handler: c.addFavorite,
    doc: "Thêm bài yêu thích",
  });
  router.add({
    method: "DELETE",
    path: "/me/favorites/:lessonId",
    auth: "user",
    handler: c.removeFavorite,
    doc: "Bỏ bài yêu thích",
  });
}
