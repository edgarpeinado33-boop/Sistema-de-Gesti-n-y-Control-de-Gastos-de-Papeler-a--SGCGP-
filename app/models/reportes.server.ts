import type { DB } from "~/lib/supabase.server";
import { T } from "~/lib/tablas";

export async function resumenPorCategoria(db: DB) {
  return ((await db.from(T.vistaResumen).select("*").order("total_aprobado", { ascending: false })).data ?? []) as any[];
}
export async function registrarExportacion(db: DB, fila: Record<string, unknown>) {
  await db.from(T.exportaciones).insert(fila);
}
export async function crearImportacion(db: DB, fila: Record<string, unknown>): Promise<number | null> {
  const { data } = await db.from(T.importaciones).insert(fila).select("id_importacion").single();
  return (data as any)?.id_importacion ?? null;
}
export async function cerrarImportacion(db: DB, id: number, cambio: Record<string, unknown>) {
  await db.from(T.importaciones).update(cambio).eq("id_importacion", id);
}
export async function importaciones(db: DB, n = 15) {
  return ((await db.from(T.importaciones).select("*").order("created_at", { ascending: false }).limit(n)).data ?? []) as any[];
}
