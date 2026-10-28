import type { Cliente } from "~/lib/supabase.server";
import { T } from "~/lib/tablas";

/** El registro lo crea el trigger de PostgreSQL (RF-12); aquí solo se consulta. */
export async function listarHistorial(supabase: Cliente, opts: { gastoId?: number; limite?: number } = {}) {
  let q = supabase.from(T.historial).select("*, usuario:usuarios_sgcgp(nombre,apellido)").order("created_at", { ascending: false }).limit(opts.limite ?? 100);
  if (opts.gastoId) q = q.eq("gasto_id", opts.gastoId);
  const { data } = await q;
  return data ?? [];
}
