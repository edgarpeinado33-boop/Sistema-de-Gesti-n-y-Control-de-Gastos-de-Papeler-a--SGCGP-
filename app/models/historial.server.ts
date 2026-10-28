import type { DB } from "~/lib/supabase.server";
import { T } from "~/lib/tablas";

/** El registro lo crea el trigger de PostgreSQL (RF-12); aquí solo se consulta. */
export async function listar(db: DB, opts: { gastoId?: number; limite?: number } = {}) {
  let q = db.from(T.historial).select("*").order("created_at", { ascending: false }).limit(opts.limite ?? 100);
  if (opts.gastoId) q = q.eq("gasto_id", opts.gastoId);
  return ((await q).data ?? []) as any[];
}
