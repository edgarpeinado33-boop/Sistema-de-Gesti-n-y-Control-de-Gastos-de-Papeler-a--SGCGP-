import type { DB } from "~/lib/supabase.server";
import { T } from "~/lib/tablas";

export async function contarNoLeidas(db: DB): Promise<number> {
  return (await db.from(T.notificaciones).select("id_notificacion", { count: "exact", head: true }).eq("leida", false)).count ?? 0;
}
export async function recientes(db: DB, n: number) {
  return ((await db.from(T.notificaciones).select("*").order("created_at", { ascending: false }).limit(n)).data ?? []) as any[];
}
/** RLS: solo afecta a las notificaciones del propio usuario. */
export async function marcarLeidas(db: DB, id: number | null) {
  const q = db.from(T.notificaciones).update({ leida: true, leida_en: new Date().toISOString() }).eq("leida", false);
  await (id === null ? q : q.eq("id_notificacion", id));
}
export async function usuariosConNotificacion(db: DB, ids: number[], titulo: string, mensaje: string): Promise<Set<number>> {
  const { data } = await db.from(T.notificaciones).select("usuario_id").in("usuario_id", ids).eq("titulo", titulo).eq("mensaje", mensaje);
  return new Set((data ?? []).map((e: any) => e.usuario_id));
}
export async function insertar(db: DB, filas: Record<string, unknown>[]) {
  return (await db.from(T.notificaciones).insert(filas)).error;
}
