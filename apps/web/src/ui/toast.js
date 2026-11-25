// Bus thông báo nhanh (không phụ thuộc React) — gọi được cả từ controller chạy trong Node test.
const bus = new Set();
let seq = 0;

function push(kind, message) {
  const t = { id: ++seq, kind, message };
  for (const fn of bus) fn(t);
}

export const toast = {
  info: (m) => push("info", m),
  success: (m) => push("success", m),
  error: (m) => push("error", m),
};

export const subscribeToasts = (fn) => {
  bus.add(fn);
  return () => bus.delete(fn);
};
