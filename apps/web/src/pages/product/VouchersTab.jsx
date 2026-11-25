// Tab quản trị: tạo lô mã Combo hộp nhạc cụ / Voucher quà tặng và tải CSV.
import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import {
  Badge,
  EmptyState,
  ErrorState,
  SkeletonRows,
  toast,
} from "../../ui/index.jsx";
import {
  createVoucherBatch,
  downloadCsv,
  listVoucherBatches,
  normalizeCode,
} from "./commerce.js";

const KIND = { combo: "Combo hộp nhạc cụ", gift: "Quà tặng", b2b: "Phòng đàn" };
const PLAN = { starter: "Khởi động", plus: "Plus", founder: "Sáng lập" };

export function VouchersTab() {
  const [list, setList] = useState({ loading: true });
  const [form, setForm] = useState({
    kind: "combo",
    plan: "plus",
    days: 90,
    quantity: 50,
    prefix: "VOCA",
  });
  const [busy, setBusy] = useState(false);
  const [lastCodes, setLastCodes] = useState(null);

  const load = () => {
    setList({ loading: true });
    listVoucherBatches()
      .then((r) => setList({ loading: false, ...r }))
      .catch((error) => setList({ loading: false, error }));
  };
  useEffect(load, []);

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value,
    }));

  async function create(e) {
    e.preventDefault();
    if (form.quantity < 1 || form.quantity > 5000) {
      toast.error("Số lượng từ 1 đến 5000 mã mỗi lô.");
      return;
    }
    setBusy(true);
    try {
      const r = await createVoucherBatch({
        ...form,
        prefix: form.prefix
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 6),
      });
      setLastCodes(r);
      toast.success(`Đã tạo lô ${r.id} với ${r.codes.length} mã.`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv(batch) {
    downloadCsv(`vocaverse-${batch.id}.csv`, [
      ["code", "kind", "plan", "days", "batch"],
      ...batch.codes.map((c) => [
        normalizeCode(c),
        form.kind,
        form.plan,
        form.days,
        batch.id,
      ]),
    ]);
  }

  return (
    <div className="gx-vouchers">
      {list.ready === false && (
        <p className="gx-sandbox" role="status">
          Máy chủ chưa có API voucher (<code>/admin/vouchers/batches</code>, Hợp
          đồng A · WT-1). Biểu mẫu đã sẵn sàng, sẽ hoạt động khi backend được
          merge.
        </p>
      )}
      <form className="gx-voucher-form" onSubmit={create}>
        <label className="vv-label">
          Loại mã
          <select value={form.kind} onChange={set("kind")}>
            {Object.entries(KIND).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="vv-label">
          Gói kích hoạt
          <select value={form.plan} onChange={set("plan")}>
            {Object.entries(PLAN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="vv-label">
          Số ngày
          <input
            type="number"
            min={7}
            max={730}
            value={form.days}
            onChange={set("days")}
          />
        </label>
        <label className="vv-label">
          Số lượng mã
          <input
            type="number"
            min={1}
            max={5000}
            value={form.quantity}
            onChange={set("quantity")}
          />
        </label>
        <label className="vv-label">
          Tiền tố
          <input maxLength={6} value={form.prefix} onChange={set("prefix")} />
        </label>
        <button
          type="submit"
          className="button button-primary"
          disabled={busy || list.ready === false}
        >
          <Plus size={15} /> {busy ? "Đang tạo…" : "Tạo lô mã"}
        </button>
      </form>

      {lastCodes && (
        <div className="gx-voucher-result">
          <strong>
            Lô {lastCodes.id}: {lastCodes.codes.length} mã
          </strong>
          <code>
            {lastCodes.codes.slice(0, 3).map(normalizeCode).join(" · ")}…
          </code>
          <button
            type="button"
            className="button button-quiet"
            onClick={() => exportCsv(lastCodes)}
          >
            <Download size={15} /> Tải CSV
          </button>
        </div>
      )}

      {list.loading && <SkeletonRows rows={4} />}
      {list.error && <ErrorState error={list.error} onRetry={load} />}
      {list.ready && list.rows.length === 0 && (
        <EmptyState title="Chưa có lô mã nào">
          Tạo lô đầu để in vào hộp nhạc cụ hoặc thiệp quà.
        </EmptyState>
      )}
      {list.ready && list.rows.length > 0 && (
        <div className="vv-table-wrap">
          <table className="vv-table">
            <thead>
              <tr>
                <th scope="col">Lô</th>
                <th scope="col">Loại</th>
                <th scope="col">Gói</th>
                <th scope="col">Số ngày</th>
                <th scope="col">Đã dùng</th>
                <th scope="col">Tạo lúc</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.id}</strong>
                  </td>
                  <td>{KIND[b.kind] ?? b.kind}</td>
                  <td>
                    <Badge tone="orange">{PLAN[b.plan] ?? b.plan}</Badge>
                  </td>
                  <td>{b.days}</td>
                  <td>
                    {b.redeemed}/{b.quantity}
                  </td>
                  <td>{new Date(b.createdAt).toLocaleDateString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-footnote">
        Mã chỉ hiển thị đầy đủ một lần ngay sau khi tạo; hãy tải CSV và lưu nơi
        an toàn.
      </p>
    </div>
  );
}
