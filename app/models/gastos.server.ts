import { BUCKET, T } from "~/lib/tablas";
import type { DB } from "~/lib/supabase.server";

export interface FiltrosGasto { q?: string; desde?: string; hasta?: string; categoria?: string; proveedor?: string; estado?: string; responsable?: string }
const SELECT = "*, categoria:categorias_sgcgp(nombre), proveedor:proveedores_sgcgp(nombre)";

/** Supabase limita cada respuesta a 1000 filas: se pagina para no recortar datos en silencio. */
export async function consultar(db: DB, f: FiltrosGasto, limite: number) {
  const construir = () => {
    let q = db.from(T.gastos).select(SELECT).order("fecha", { ascending: false }).order("id_gasto", { ascending: false });
    if (f.q) q = q.ilike("concepto", `%${f.q.replace(/[%,]/g, " ")}%`);
    if (f.desde) q = q.gte("fecha", f.desde);
    if (f.hasta) q = q.lte("fecha", f.hasta);
    if (f.categoria) q = q.eq("categoria_id", Number(f.categoria));
    if (f.proveedor) q = q.eq("proveedor_id", Number(f.proveedor));
    if (f.estado) q = q.eq("estado", f.estado);
    if (f.responsable) q = q.eq("usuario_id", Number(f.responsable));
    return q;
  };
  const filas: any[] = [];
  for (let desde = 0; desde < limite; desde += 1000) {
    const hasta = Math.min(desde + 999, limite - 1);
    const { data } = await construir().range(desde, hasta);
    filas.push(...(data ?? []));
    if ((data?.length ?? 0) < hasta - desde + 1) break;
  }
  return filas;
}
export async function obtener(db: DB, id: number) {
  return (await db.from(T.gastos).select("*, categoria:categorias_sgcgp(nombre,requiere_comprobante), proveedor:proveedores_sgcgp(nombre)").eq("id_gasto", id).maybeSingle()).data as any;
}
export async function sumaDelDia(db: DB, categoriaId: number, fecha: string): Promise<number> {
  const { data } = await db.from(T.gastos).select("monto").eq("categoria_id", categoriaId).eq("fecha", fecha).in("estado", ["aprobado", "pendiente"]);
  return (data ?? []).reduce((s: number, x: any) => s + Number(x.monto), 0);
}
export async function insertar(db: DB, fila: Record<string, unknown>) {
  const { data, error } = await db.from(T.gastos).insert(fila).select("id_gasto").single();
  return { id: (data as any)?.id_gasto as number | undefined, error };
}
export async function insertarLote(db: DB, filas: Record<string, unknown>[]) {
  return (await db.from(T.gastos).insert(filas)).error;
}
export async function cambiarEstado(db: DB, id: number, estado: string) {
  return (await db.from(T.gastos).update({ estado }).eq("id_gasto", id)).error;
}
export async function fijarArchivo(db: DB, id: number, ruta: string) {
  return (await db.from(T.gastos).update({ archivo_comprobante: ruta }).eq("id_gasto", id)).error;
}
export async function eliminar(db: DB, id: number) {
  return (await db.from(T.gastos).delete().eq("id_gasto", id)).error;
}
/** Gasto aprobado reciente (patrones de consumo). */
export async function aprobadosRecientes(db: DB, limite = 1000) {
  return ((await db.from(T.gastos).select("fecha,monto,categoria_id").eq("estado", "aprobado").order("fecha", { ascending: false }).limit(limite)).data ?? []) as any[];
}
/** Para ML: aprobados y pendientes, paginado. Usa el cliente de servidor. */
export async function todosParaML(db: DB) {
  const filas: any[] = [];
  for (let desde = 0; desde < 20000; desde += 1000) {
    const { data } = await db.from(T.gastos).select("id_gasto,fecha,monto,categoria_id,proveedor_id,estado").in("estado", ["aprobado", "pendiente"]).order("id_gasto").range(desde, desde + 999);
    filas.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return filas;
}

// ---- Comprobantes (metadatos en PostgreSQL, archivo en Storage) ----
export async function comprobantesDe(db: DB, gastoId: number) {
  return ((await db.from(T.comprobantes).select("*").eq("gasto_id", gastoId).order("created_at")).data ?? []) as any[];
}
export async function insertarComprobante(db: DB, fila: Record<string, unknown>) {
  return (await db.from(T.comprobantes).insert(fila)).error;
}
export async function rutaComprobante(db: DB, id: number): Promise<string | null> {
  return ((await db.from(T.comprobantes).select("ruta_storage").eq("id_comprobante", id).maybeSingle()).data as any)?.ruta_storage ?? null;
}
export async function borrarComprobante(db: DB, id: number) {
  return (await db.from(T.comprobantes).delete().eq("id_comprobante", id)).error;
}
export async function subirArchivo(db: DB, ruta: string, contenido: ArrayBuffer, mime: string) {
  return (await db.storage.from(BUCKET).upload(ruta, contenido, { contentType: mime, upsert: false })).error;
}
export async function urlsFirmadas(db: DB, rutas: string[], segundos = 300): Promise<Record<string, string>> {
  if (!rutas.length) return {};
  const { data } = await db.storage.from(BUCKET).createSignedUrls(rutas, segundos);
  return Object.fromEntries((data ?? []).map((u: any) => [u.path, u.signedUrl]));
}
export async function quitarArchivos(db: DB, rutas: string[]) {
  if (rutas.length) await db.storage.from(BUCKET).remove(rutas);
}
