// Tính mới A: tay mẫu 3D đã kiểm chứng trong bài học. Trả mô hình GLB + âm thanh + kết quả kiểm chứng
// (T1 trên cảnh 3D, T2-det trên video). Gói Free chỉ xem bài demo công khai; Plus/Studio xem mọi bài có mô hình.
import { errors } from "../../core/http.mjs";
import { planOf } from "../billing/plans.mjs";
import { v, validate } from "../../core/validate.mjs";

export const PUBLIC_DEMO_LESSONS = new Set(["PN01"]);

export function hand3dService({ lessons, resolveHand3d, track }) {
  return {
    /** Danh sách bài có tay mẫu 3D (để giao diện hiện nút). */
    async available(user) {
      const out = [];
      for (const l of lessons) {
        const asset = await resolveHand3d(l.id);
        if (!asset) continue;
        out.push({
          lessonId: l.id,
          title: l.title,
          locked:
            !PUBLIC_DEMO_LESSONS.has(l.id) &&
            !planOf(user).features.verifiedHand3d,
          verified: asset.verification?.t1Passed ?? null,
        });
      }
      return out;
    },
    async get(user, lessonId) {
      const lesson = lessons.find((l) => l.id === lessonId);
      if (!lesson) throw errors.notFound("Không tìm thấy bài học.");
      const asset = await resolveHand3d(lessonId);
      if (!asset) throw errors.notFound("Bài này chưa có tay mẫu 3D.");
      if (
        !PUBLIC_DEMO_LESSONS.has(lessonId) &&
        !planOf(user).features.verifiedHand3d
      )
        throw errors.planRequired("Tay mẫu 3D cho bài này dành cho gói Plus.");
      track(user?.id, "hand3d.open", { lessonId });
      return { lessonId, title: lesson.title, ...asset };
    },
  };
}

export function hand3dRoutes(router, service) {
  const id = v.string({
    min: 4,
    max: 20,
    pattern: /^[A-Z]{2}\d{2}[A-Za-z0-9-]*$/,
    message: "mã bài không hợp lệ",
  });
  router.add({
    method: "GET",
    path: "/hand3d",
    auth: "optional",
    doc: "Các bài có tay mẫu 3D kèm cờ khoá theo gói",
    handler: async (ctx) => ({ data: await service.available(ctx.user) }),
  });
  router.add({
    method: "GET",
    path: "/lessons/:lessonId/hand3d",
    auth: "optional",
    doc: "Tay mẫu 3D đã kiểm chứng của một bài (GLB, âm thanh, kết quả T1/T2)",
    handler: async (ctx) => ({
      data: await service.get(
        ctx.user,
        validate({ lessonId: id }, ctx.params).lessonId,
      ),
    }),
  });
}
