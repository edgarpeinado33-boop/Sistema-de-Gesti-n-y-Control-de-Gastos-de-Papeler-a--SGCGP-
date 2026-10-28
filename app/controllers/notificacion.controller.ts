import type { Contexto } from "~/lib/sesion.server";
import * as Notificaciones from "~/models/notificaciones.server";

export const contarNoLeidas = (ctx: Contexto) => Notificaciones.contarNoLeidas(ctx.supabase);
export const listarNotificaciones = (ctx: Contexto, n = 100) => Notificaciones.recientes(ctx.supabase, n);
export async function marcarLeidas(ctx: Contexto, id: number | null) { await Notificaciones.marcarLeidas(ctx.supabase, id); return { ok: "Actualizado." }; }
