import { json, redirect } from "@vercel/remix";
import { crearClienteServidor, type Cliente } from "./supabase.server";
import { perfilPorAuthId } from "~/models/usuarios.server";

export type Rol = "administrador" | "encargado_gastos" | "solicitante";
export interface Perfil {
  id_usuario: number; auth_user_id: string; nombre: string; apellido: string;
  correo: string | null; rol: Rol; estado: boolean;
}
export interface Contexto { supabase: Cliente; headers: Headers; perfil: Perfil; }

/** Exige sesión válida y perfil activo. Redirige a /login si no existe. */
export async function requerirUsuario(request: Request, roles?: Rol[]): Promise<Contexto> {
  const { supabase, headers } = crearClienteServidor(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw redirect("/login", { headers });
  const perfil = await perfilPorAuthId(supabase, user.id);
  if (!perfil || !perfil.estado) {
    await supabase.auth.signOut();
    throw redirect("/login?error=inactivo", { headers });
  }
  if (roles && !roles.includes(perfil.rol)) {
    throw json({ mensaje: "No tienes permisos para acceder a esta sección." }, { status: 403, headers });
  }
  return { supabase, headers, perfil: perfil as Perfil };
}
export const GESTORES: Rol[] = ["administrador", "encargado_gastos"];
export const esGestor = (p: Perfil) => GESTORES.includes(p.rol);
export const esAdmin = (p: Perfil) => p.rol === "administrador";

/** json() que conserva las cookies de sesión renovadas por Supabase. */
export function jsonH<T>(data: T, ctx: { headers: Headers }, init: ResponseInit = {}) {
  const h = new Headers(init.headers);
  ctx.headers.forEach((v, k) => h.append(k, v));
  return json(data, { ...init, headers: h });
}
export function redirigir(url: string, ctx: { headers: Headers }) { return redirect(url, { headers: ctx.headers }); }
