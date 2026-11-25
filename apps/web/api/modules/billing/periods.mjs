// Reconcile the active entitlement after a prepaid period boundary.
export function syncPlan(db, id) {
  const now = Date.now();
  const row = db
    .prepare(
      "SELECT plan,instrument,ends_at FROM plan_periods WHERE user_id=? AND starts_at<=? AND ends_at>? ORDER BY starts_at DESC LIMIT 1",
    )
    .get(id, now, now);
  if (row)
    db.prepare(
      "UPDATE users SET plan=?,starter_instrument=?,plan_expires_at=? WHERE id=? AND (plan_expires_at IS NOT ? OR plan!=?)",
    ).run(
      row.plan,
      row.instrument,
      new Date(row.ends_at).toISOString(),
      id,
      new Date(row.ends_at).toISOString(),
      row.plan,
    );
}
