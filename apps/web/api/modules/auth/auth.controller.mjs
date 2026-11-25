// Tầng controller: đọc/kiểm dữ liệu vào, gọi service, đặt cookie refresh.
import { ApiError, cookie } from "../../core/http.mjs";
import { v, validate } from "../../core/validate.mjs";

const REFRESH = "vv_refresh";

export function authController({ authService, config }) {
  const session = (ctx, s) => {
    ctx.setCookie(
      cookie(REFRESH, s.refreshToken, {
        maxAge: config.refreshTtl,
        secure: config.secureCookies,
      }),
    );
    return {
      data: {
        user: s.user,
        accessToken: s.accessToken,
        expiresIn: s.expiresIn,
      },
    };
  };
  const clear = (ctx) =>
    ctx.setCookie(
      cookie(REFRESH, "", { maxAge: 0, secure: config.secureCookies }),
    );

  return {
    async register(ctx) {
      if (ctx.body.isOver16 !== true)
        throw new ApiError(
          400,
          "AGE_RESTRICTION",
          "Cần xác nhận đủ 16 tuổi để tạo tài khoản.",
        );
      const body = validate(
        {
          email: v.email(),
          password: v.password(),
          displayName: v.string({ min: 1, max: 60 }),
        },
        ctx.body,
      );
      return { ...session(ctx, await authService.register(body)), status: 201 };
    },
    async login(ctx) {
      const body = validate(
        {
          email: v.email(),
          password: v.string({ min: 1, max: 128, trim: false }),
        },
        ctx.body,
      );
      return session(ctx, await authService.login(body));
    },
    refresh(ctx) {
      try {
        return session(ctx, authService.refresh(ctx.cookies[REFRESH]));
      } catch (err) {
        clear(ctx);
        throw err;
      }
    },
    logout(ctx) {
      authService.logout(ctx.cookies[REFRESH]);
      clear(ctx);
      return { data: { loggedOut: true } };
    },
    me(ctx) {
      return { data: { user: ctx.user } };
    },
    verifyEmail(ctx) {
      const { token } = validate(
        { token: v.string({ min: 10, max: 200 }) },
        ctx.body,
      );
      return { data: { user: authService.verifyEmail(token) } };
    },
    resendVerify(ctx) {
      authService.resendVerify(ctx.user.id);
      return { data: { sent: true } };
    },
    forgot(ctx) {
      const { email } = validate({ email: v.email() }, ctx.body);
      authService.forgotPassword(email);
      return { data: { sent: true } };
    },
    async reset(ctx) {
      const body = validate(
        { token: v.string({ min: 10, max: 200 }), password: v.password() },
        ctx.body,
      );
      await authService.resetPassword(body.token, body.password);
      clear(ctx);
      return { data: { reset: true } };
    },
    async changePassword(ctx) {
      const body = validate(
        {
          currentPassword: v.string({ min: 1, max: 128, trim: false }),
          newPassword: v.password(),
        },
        ctx.body,
      );
      return session(
        ctx,
        await authService.changePassword(
          ctx.user.id,
          body.currentPassword,
          body.newPassword,
        ),
      );
    },
    mailbox() {
      return { data: authService.mailbox() };
    },
  };
}

export function authRoutes(router, c, { devMailbox }) {
  const strict = "auth"; // nhóm giới hạn tần suất chặt cho thao tác nhạy cảm
  router.add({
    method: "POST",
    path: "/auth/register",
    rate: strict,
    handler: c.register,
    doc: "Đăng ký tài khoản",
  });
  router.add({
    method: "POST",
    path: "/auth/login",
    rate: strict,
    handler: c.login,
    doc: "Đăng nhập",
  });
  router.add({
    method: "POST",
    path: "/auth/refresh",
    handler: c.refresh,
    doc: "Lấy access token mới từ cookie refresh",
  });
  router.add({
    method: "POST",
    path: "/auth/logout",
    handler: c.logout,
    doc: "Đăng xuất",
  });
  router.add({
    method: "GET",
    path: "/auth/me",
    auth: "user",
    handler: c.me,
    doc: "Người dùng hiện tại",
  });
  router.add({
    method: "POST",
    path: "/auth/verify-email",
    rate: strict,
    handler: c.verifyEmail,
    doc: "Xác minh email bằng token",
  });
  router.add({
    method: "POST",
    path: "/auth/resend-verification",
    auth: "user",
    rate: strict,
    handler: c.resendVerify,
    doc: "Gửi lại email xác minh",
  });
  router.add({
    method: "POST",
    path: "/auth/forgot-password",
    rate: strict,
    handler: c.forgot,
    doc: "Gửi email đặt lại mật khẩu",
  });
  router.add({
    method: "POST",
    path: "/auth/reset-password",
    rate: strict,
    handler: c.reset,
    doc: "Đặt mật khẩu mới bằng token",
  });
  router.add({
    method: "POST",
    path: "/auth/change-password",
    auth: "user",
    rate: strict,
    handler: c.changePassword,
    doc: "Đổi mật khẩu",
  });
  if (devMailbox)
    router.add({
      method: "GET",
      path: "/dev/mailbox",
      handler: c.mailbox,
      doc: "Hộp thư giả lập (chỉ môi trường dev)",
    });
}
