// Bộ kiểm dữ liệu vào tối giản (thay cho zod để không thêm phụ thuộc).
// Mỗi luật trả về giá trị đã làm sạch hoặc ném chuỗi lỗi tiếng Việt.
import { errors } from "./http.mjs";

const fail = (msg) => {
  throw new TypeError(msg);
};

export const v = {
  string({ min = 0, max = 200, trim = true, pattern, message } = {}) {
    return (value) => {
      if (typeof value !== "string") fail("phải là chuỗi");
      const s = trim ? value.trim() : value;
      if (s.length < min)
        fail(min === 1 ? "không được để trống" : `cần ít nhất ${min} ký tự`);
      if (s.length > max) fail(`tối đa ${max} ký tự`);
      if (pattern && !pattern.test(s)) fail(message ?? "không đúng định dạng");
      // Bỏ ký tự điều khiển để tránh chèn dữ liệu lạ vào log/giao diện.
      return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
    };
  },
  email() {
    return (value) =>
      v
        .string({
          max: 254,
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
          message: "email không hợp lệ",
        })(value)
        .toLowerCase();
  },
  password() {
    return (value) => {
      const s = v.string({ min: 8, max: 128, trim: false })(value);
      if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) fail("cần có cả chữ và số");
      return s;
    };
  },
  int({ min = -Infinity, max = Infinity } = {}) {
    return (value) => {
      if (!Number.isInteger(value)) fail("phải là số nguyên");
      if (value < min || value > max) fail(`phải trong khoảng ${min}–${max}`);
      return value;
    };
  },
  number({ min = -Infinity, max = Infinity } = {}) {
    return (value) => {
      if (typeof value !== "number" || !Number.isFinite(value))
        fail("phải là số");
      if (value < min || value > max) fail(`phải trong khoảng ${min}–${max}`);
      return value;
    };
  },
  oneOf(values) {
    return (value) => {
      if (!values.includes(value))
        fail(`phải là một trong: ${values.join(", ")}`);
      return value;
    };
  },
  bool() {
    return (value) => {
      if (typeof value !== "boolean") fail("phải là true/false");
      return value;
    };
  },
  object(shape) {
    return (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        fail("phải là object");
      return parse(shape, value);
    };
  },
  optional(rule) {
    rule.optional = true;
    return rule;
  },
};

function parse(shape, input) {
  const out = {};
  const details = {};
  for (const [key, rule] of Object.entries(shape)) {
    if (input[key] === undefined || input[key] === null) {
      if (!rule.optional) details[key] = "không được để trống";
      continue;
    }
    try {
      out[key] = rule(input[key]);
    } catch (err) {
      if (err?.code === "VALIDATION_ERROR") Object.assign(details, err.details);
      else details[key] = err.message;
    }
  }
  if (Object.keys(details).length)
    throw errors.badRequest("Dữ liệu không hợp lệ.", details);
  return out;
}

export const validate = (shape, input) => parse(shape, input);
