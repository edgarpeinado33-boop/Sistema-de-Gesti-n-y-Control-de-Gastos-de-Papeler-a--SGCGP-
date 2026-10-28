import { clienteAdmin } from "~/lib/supabase.server";
import * as Notificaciones from "~/models/notificaciones.server";

export type TipoNotificacion = "informativa" | "aprobacion" | "rechazo" | "presupuesto" | "anomalia" | "sistema";

/**
 * Crea notificaciones evitando duplicados (RNF-19): si el mismo usuario ya tiene una
 * notificación idéntica (título + mensaje) no se vuelve a insertar, así un reintento es inocuo.
 */
export async function notificar(p: { usuarioIds: number[]; titulo: string; mensaje: string; tipo: TipoNotificacion }) {
  const db = clienteAdmin();
  const ids = [...new Set(p.usuarioIds)];
  if (!ids.length) return 0;
  const ya = await Notificaciones.usuariosConNotificacion(db, ids, p.titulo, p.mensaje);
  const nuevas = ids.filter((id) => !ya.has(id)).map((usuario_id) => ({ usuario_id, titulo: p.titulo, mensaje: p.mensaje, tipo: p.tipo }));
  if (!nuevas.length) return 0;
  const error = await Notificaciones.insertar(db, nuevas);
  if (error) throw error;
  return nuevas.length;
}
