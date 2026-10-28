import type { DB } from "~/lib/supabase.server";
import { T } from "~/lib/tablas";

// ---- Modelos ----
export async function modeloActivo(db: DB) {
  return ((await db.from(T.modelos).select("*").eq("estado", "activo").order("fecha_entrenamiento", { ascending: false }).limit(1)).data?.[0] ?? null) as any;
}
export async function upsertModelo(db: DB, fila: Record<string, unknown>): Promise<number> {
  const { data, error } = await db.from(T.modelos).upsert(fila, { onConflict: "nombre,version" }).select("id_modelo").single();
  if (error) throw error;
  return (data as any).id_modelo;
}
export async function categoriasActivas(db: DB) {
  return ((await db.from(T.categorias).select("id_categoria,nombre,limite_diario").eq("estado", true)).data ?? []) as any[];
}
export async function nombresCategorias(db: DB) {
  return ((await db.from(T.categorias).select("id_categoria,nombre")).data ?? []) as any[];
}

// ---- Predicciones ----
export async function prediccionesDelPeriodo(db: DB, inicio: string) {
  return ((await db.from(T.predicciones).select("*, categoria:categorias_sgcgp(nombre)").eq("periodo_inicio", inicio).order("monto_estimado", { ascending: false })).data ?? []) as any[];
}
export async function prediccionGlobal(db: DB, inicio: string) {
  return ((await db.from(T.predicciones).select("*").is("id_categoria", null).eq("periodo_inicio", inicio).order("generado_en", { ascending: false }).limit(1)).data?.[0] ?? null) as any;
}
export async function reemplazarPredicciones(db: DB, idModelo: number, inicio: string, filas: Record<string, unknown>[]) {
  await db.from(T.predicciones).delete().eq("id_modelo", idModelo).eq("periodo_inicio", inicio);
  if (!filas.length) return;
  const { error } = await db.from(T.predicciones).insert(filas);
  if (error) throw error;
}

// ---- Anomalías ----
export async function anomalias(db: DB, limite = 40) {
  return ((await db.from(T.anomalias).select("*, gasto:gastos_sgcgp(concepto,monto,fecha)").order("estado_revision").order("puntuacion", { ascending: false }).limit(limite)).data ?? []) as any[];
}
export async function contarAnomaliasPendientes(db: DB): Promise<number> {
  return (await db.from(T.anomalias).select("id_anomalia", { count: "exact", head: true }).eq("estado_revision", "pendiente")).count ?? 0;
}
export async function idsGastosMarcados(db: DB, idModelo: number): Promise<Set<number>> {
  const { data } = await db.from(T.anomalias).select("id_gasto").eq("id_modelo", idModelo);
  return new Set((data ?? []).map((a: any) => a.id_gasto));
}
export async function insertarAnomalias(db: DB, filas: Record<string, unknown>[]) {
  const { error } = await db.from(T.anomalias).insert(filas);
  if (error) throw error;
}
export async function revisarAnomalia(db: DB, id: number, cambio: Record<string, unknown>) {
  return (await db.from(T.anomalias).update(cambio).eq("id_anomalia", id)).error;
}

// ---- Recomendaciones ----
export async function recomendaciones(db: DB, limite = 30) {
  return ((await db.from(T.recomendaciones).select("*, categoria:categorias_sgcgp(nombre)").order("generada_en", { ascending: false }).limit(limite)).data ?? []) as any[];
}
export async function existePendiente(db: DB, titulo: string): Promise<boolean> {
  return !!(await db.from(T.recomendaciones).select("id_recomendacion").eq("titulo", titulo).eq("estado", "pendiente").maybeSingle()).data;
}
export async function insertarRecomendacion(db: DB, fila: Record<string, unknown>) {
  return (await db.from(T.recomendaciones).insert(fila)).error;
}
export async function revisarRecomendacion(db: DB, id: number, cambio: Record<string, unknown>) {
  return (await db.from(T.recomendaciones).update(cambio).eq("id_recomendacion", id)).error;
}
