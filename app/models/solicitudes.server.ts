import type { DB } from "~/lib/supabase.server";
import { T } from "~/lib/tablas";

export async function listar(db: DB, estado?: string, limite = 200) {
  let q = db.from(T.solicitudes).select("*, categoria:categorias_sgcgp(nombre)").order("fecha_solicitud", { ascending: false }).limit(limite);
  if (estado) q = q.eq("estado", estado);
  return ((await q).data ?? []) as any[];
}
export async function obtener(db: DB, id: number) {
  return (await db.from(T.solicitudes).select("*").eq("id_solicitud", id).maybeSingle()).data as any;
}
export async function obtenerAprobada(db: DB, id: number) {
  return (await db.from(T.solicitudes).select("*").eq("id_solicitud", id).eq("estado", "aprobada").maybeSingle()).data as any;
}
export async function insertar(db: DB, fila: Record<string, unknown>) {
  const { data, error } = await db.from(T.solicitudes).insert(fila).select("id_solicitud").single();
  return { id: (data as any)?.id_solicitud as number | undefined, error };
}
/** Solo cambia solicitudes aún pendientes (evita doble revisión). */
export async function resolver(db: DB, id: number, cambio: Record<string, unknown>) {
  return (await db.from(T.solicitudes).update(cambio).eq("id_solicitud", id).eq("estado", "pendiente")).error;
}
export async function marcarEjecutada(db: DB, id: number) {
  return (await db.from(T.solicitudes).update({ estado: "ejecutada" }).eq("id_solicitud", id)).error;
}
export async function estados(db: DB): Promise<string[]> {
  return ((await db.from(T.solicitudes).select("estado")).data ?? []).map((s: any) => s.estado);
}
