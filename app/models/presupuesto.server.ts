import type { DB } from "~/lib/supabase.server";
import { T } from "~/lib/tablas";

/** Lee de vista_control_presupuesto_sgcgp: monto utilizado, saldo y % (solo gasto aprobado). */
export async function listar(db: DB) {
  return (await db.from(T.vistaPresupuesto).select("*").order("anio", { ascending: false }).order("mes", { ascending: false })).data ?? [];
}
export async function ultimos(db: DB, n: number) {
  return (await db.from(T.vistaPresupuesto).select("*").order("anio", { ascending: false }).order("mes", { ascending: false }).limit(n)).data ?? [];
}
export async function delMes(db: DB, mes: number, anio: number) {
  return (await db.from(T.vistaPresupuesto).select("*").eq("mes", mes).eq("anio", anio).maybeSingle()).data as any;
}
export async function guardar(db: DB, fila: { mes: number; anio: number; monto_limite: number; creado_por: number }) {
  return (await db.from(T.presupuesto).upsert(fila, { onConflict: "mes,anio" })).error;
}
