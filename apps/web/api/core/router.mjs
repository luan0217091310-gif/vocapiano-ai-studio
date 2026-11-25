// Router tối giản: khai báo { method, path, auth, rate, handler }; tham số dạng :id.
// auth: "public" | "optional" | "user" | "admin". Handler trả { data, meta?, status? }.
import { ApiError, errors } from "./http.mjs";

export function createRouter() {
  const routes = [];
  return {
    routes,
    add(def) {
      const keys = [];
      const pattern = new RegExp(
        "^" +
          def.path.replace(/:([a-zA-Z]+)/g, (_, k) => {
            keys.push(k);
            return "([^/]+)";
          }) +
          "$",
      );
      routes.push({ auth: "public", ...def, keys, pattern });
    },
    match(method, pathname) {
      let pathFound = false;
      for (const r of routes) {
        const m = r.pattern.exec(pathname);
        if (!m) continue;
        pathFound = true;
        if (r.method !== method) continue;
        const params = Object.fromEntries(
          r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]),
        );
        return { route: r, params };
      }
      if (pathFound)
        throw new ApiError(
          405,
          "METHOD_NOT_ALLOWED",
          "Phương thức không được hỗ trợ.",
        );
      throw errors.notFound("API không tồn tại.");
    },
  };
}
