import type { DB } from "~/lib/supabase.server";
import { T } from "~/lib/tablas";

export async function listarCategorias(db: DB, soloActivas = false) {
  let q = db.from(T.categorias).select("*").order("nombre");
  if (soloActivas) q = q.eq("estado", true);
  return (await q).data ?? [];
}
export async function obtenerCategoria(db: DB, id: number) {
  return (await db.from(T.categorias).select("*").eq("id_categoria", id).maybeSingle()).data as any;
}
export async function guardarCategoria(db: DB, id: number | null, fila: Record<string, unknown>) {
  return (id ? await db.from(T.categorias).update(fila).eq("id_categoria", id) : await db.from(T.categorias).insert(fila)).error;
}
export async function listarProveedores(db: DB, soloActivos = false) {
  let q = db.from(T.proveedores).select("*").order("nombre");
  if (soloActivos) q = q.eq("estado", true);
  return (await q).data ?? [];
}
export async function guardarProveedor(db: DB, id: number | null, fila: Record<string, unknown>) {
  return (id ? await db.from(T.proveedores).update(fila).eq("id_proveedor", id) : await db.from(T.proveedores).insert(fila)).error;
}
export async function nombreProveedor(db: DB, id: number): Promise<string | null> {
  return ((await db.from(T.proveedores).select("nombre").eq("id_proveedor", id).maybeSingle()).data as any)?.nombre ?? null;
}
