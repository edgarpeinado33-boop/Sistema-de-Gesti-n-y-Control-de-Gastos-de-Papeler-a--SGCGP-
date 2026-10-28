import type { Contexto } from "~/lib/sesion.server";
import * as Historial from "~/models/historial.server";
import { directorio } from "~/models/usuarios.server";

/** RF-12: el registro lo crea la BD (trigger); aquí se consulta y se resuelve el nombre del autor. */
export async function listarHistorial(ctx: Contexto, opts: { gastoId?: number; limite?: number } = {}) {
  const filas = await Historial.listar(ctx.supabase, opts);
  const nombres = await directorio(filas.map((h) => h.usuario_id));
  return filas.map((h) => ({ ...h, autor: nombres[h.usuario_id] ?? "Sistema" }));
}
