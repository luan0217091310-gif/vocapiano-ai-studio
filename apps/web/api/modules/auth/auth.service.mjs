// Nghiệp vụ xác thực: đăng ký, xác minh email, đăng nhập, xoay vòng refresh token, quên/đặt lại mật khẩu.
import { tx } from "../../db/index.mjs";
import { errors } from "../../core/http.mjs";
import {
  hashPassword,
  randomToken,
  sha256,
  signJwt,
  verifyPassword,
} from "../../core/security.mjs";

const VERIFY_TTL = 24 * 3600;
const RESET_TTL = 30 * 60;
// Hash giả để đăng nhập sai email cũng tốn thời gian như sai mật khẩu (tránh dò email qua thời gian phản hồi).
let dummyHash;

export function authService({
  db,
  config,
  users,
  auth,
  enqueue,
  notify,
  track,
}) {
  const issue = (userId) => {
    const user = users.findById(userId);
    const accessToken = signJwt(
      { sub: user.id, role: user.role, plan: user.plan },
      config.jwtSecret,
      config.accessTtl,
    );
    const refreshToken = randomToken();
    auth.saveRefresh(user.id, sha256(refreshToken), config.refreshTtl);
    return { user, accessToken, refreshToken, expiresIn: config.accessTtl };
  };

  const sendVerify = (user) => {
    const token = randomToken();
    auth.saveEmailToken(user.id, "verify", sha256(token), VERIFY_TTL);
    enqueue(
      user.email,
      "Xác minh email VocaVerse",
      `Chào ${user.displayName},\n\nMở liên kết sau để xác minh email (hết hạn sau 24 giờ):\n${config.appUrl}/verify-email?token=${token}\n`,
    );
    return token;
  };

  return {
    async register({ email, password, displayName }) {
      if (users.findAuthByEmail(email))
        throw errors.conflict("Email này đã được đăng ký.");
      const passwordHash = await hashPassword(password);
      const id = tx(db, () =>
        users.create({ email, passwordHash, displayName }),
      );
      const user = users.findById(id);
      sendVerify(user);
      notify(
        id,
        "welcome",
        "Chào mừng bạn đến VocaVerse!",
        "Hoàn tất khảo sát đầu vào để nhận lộ trình riêng.",
      );
      track(id, "auth.register", {});
      return issue(id);
    },

    async login({ email, password }) {
      const row = users.findAuthByEmail(email);
      dummyHash ??= await hashPassword("vocaverse-dummy-1");
      const okPass = await verifyPassword(
        password,
        row?.password_hash ?? dummyHash,
      );
      if (!row || !okPass || row.deleted_at)
        throw errors.unauthorized("Email hoặc mật khẩu không đúng.");
      track(row.id, "auth.login", {});
      return issue(row.id);
    },

    /** Đổi refresh token cũ lấy cặp mới; token cũ bị thu hồi. Dùng lại token đã thu hồi → thu hồi cả phiên. */
    refresh(refreshToken) {
      if (!refreshToken)
        throw errors.unauthorized("Phiên đăng nhập đã hết hạn.");
      const row = auth.findRefresh(sha256(refreshToken));
      if (!row) throw errors.unauthorized("Phiên đăng nhập đã hết hạn.");
      if (row.revoked_at) {
        // Trong vài chục giây sau khi xoay vòng, trình duyệt có thể gửi lại token cũ (chuyển trang nhanh,
        // phản hồi bị huỷ trước khi lưu cookie mới) → cấp phiên mới thay vì coi là bị đánh cắp.
        const ageS = row.rotated_at
          ? (Date.now() - Date.parse(row.rotated_at)) / 1000
          : Infinity;
        if (ageS <= config.refreshReuseGraceS && users.findById(row.user_id))
          return issue(row.user_id);
        auth.revokeAllRefresh(row.user_id);
        throw errors.unauthorized("Phiên đăng nhập đã hết hạn.");
      }
      if (
        row.expires_at < new Date().toISOString() ||
        !users.findById(row.user_id)
      )
        throw errors.unauthorized("Phiên đăng nhập đã hết hạn.");
      auth.rotateRefresh(row.id);
      return issue(row.user_id);
    },

    logout(refreshToken) {
      if (!refreshToken) return;
      const row = auth.findRefresh(sha256(refreshToken));
      if (row) auth.revokeRefresh(row.id);
    },

    resendVerify(userId) {
      const user = users.findById(userId);
      if (user.emailVerified) throw errors.conflict("Email đã được xác minh.");
      sendVerify(user);
    },

    verifyEmail(token) {
      const userId = auth.consumeEmailToken("verify", sha256(token));
      if (!userId)
        throw errors.badRequest(
          "Liên kết xác minh không hợp lệ hoặc đã hết hạn.",
        );
      users.update(userId, { emailVerifiedAt: new Date().toISOString() });
      track(userId, "auth.verify_email", {});
      return users.findById(userId);
    },

    /** Luôn trả thành công để không tiết lộ email nào đã đăng ký. */
    forgotPassword(email) {
      const row = users.findAuthByEmail(email);
      if (!row || row.deleted_at) return;
      const token = randomToken();
      auth.saveEmailToken(row.id, "reset", sha256(token), RESET_TTL);
      enqueue(
        email,
        "Đặt lại mật khẩu VocaVerse",
        `Mở liên kết sau để đặt mật khẩu mới (hết hạn sau 30 phút):\n${config.appUrl}/reset-password?token=${token}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      );
    },

    async resetPassword(token, password) {
      const userId = auth.consumeEmailToken("reset", sha256(token));
      if (!userId)
        throw errors.badRequest(
          "Liên kết đặt lại không hợp lệ hoặc đã hết hạn.",
        );
      users.update(userId, { passwordHash: await hashPassword(password) });
      auth.revokeAllRefresh(userId);
      notify(
        userId,
        "security",
        "Mật khẩu đã được đổi",
        "Nếu không phải bạn, hãy liên hệ hỗ trợ ngay.",
      );
    },

    async changePassword(userId, currentPassword, newPassword) {
      if (!(await verifyPassword(currentPassword, users.passwordHash(userId))))
        throw errors.badRequest("Mật khẩu hiện tại không đúng.", {
          currentPassword: "không đúng",
        });
      users.update(userId, { passwordHash: await hashPassword(newPassword) });
      auth.revokeAllRefresh(userId);
      notify(
        userId,
        "security",
        "Mật khẩu đã được đổi",
        "Các phiên đăng nhập khác đã bị đăng xuất.",
      );
      return issue(userId);
    },

    mailbox: () => auth.mailbox(),
  };
}
