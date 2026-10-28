import { clienteAdmin, type DB } from "~/lib/supabase.server";
import { T } from "~/lib/tablas";

export async function perfilPorAuthId(db: DB, authId: string) {
  return (await db.from(T.usuarios).select("*").eq("auth_user_id", authId).maybeSingle()).data;
}
export async function listarTodos(db: DB) {
  return (await db.from(T.usuarios).select("*").order("created_at", { ascending: false })).data ?? [];
}
export async function actualizarRolEstado(db: DB, id: number, rol: string, estado: boolean) {
  return (await db.from(T.usuarios).update({ rol, estado }).eq("id_usuario", id)).error;
}
export async function asignarRolPorAuthId(db: DB, authId: string, rol: string) {
  return (await db.from(T.usuarios).update({ rol }).eq("auth_user_id", authId)).error;
}
/** Crea la cuenta en Supabase Auth (service role). El perfil lo crea el trigger de la BD. */
export async function crearCuentaAuth(correo: string, password: string, nombre: string, apellido: string) {
  const { data, error } = await clienteAdmin().auth.admin.createUser({ email: correo, password, email_confirm: true, user_metadata: { nombre, apellido } });
  return { authId: data?.user?.id, error };
}

/**
 * Las políticas RLS solo muestran a cada usuario su propio perfil (el administrador ve todos).
 * Para mostrar el NOMBRE de responsables/solicitantes en listados que el usuario ya puede ver,
 * se consulta un directorio mínimo (id → nombre) con el cliente de servidor.
 */
export async function directorio(ids: (number | null | undefined)[]): Promise<Record<number, string>> {
  const unicos = [...new Set(ids.filter((x): x is number => typeof x === "number"))];
  if (!unicos.length) return {};
  const { data } = await clienteAdmin().from(T.usuarios).select("id_usuario,nombre,apellido").in("id_usuario", unicos);
  return Object.fromEntries((data ?? []).map((u: any) => [u.id_usuario, `${u.nombre} ${u.apellido}`]));
}
export async function usuariosActivos(): Promise<{ id_usuario: number; nombre: string }[]> {
  const { data } = await clienteAdmin().from(T.usuarios).select("id_usuario,nombre,apellido").eq("estado", true).order("nombre");
  return (data ?? []).map((u: any) => ({ id_usuario: u.id_usuario, nombre: `${u.nombre} ${u.apellido}` }));
}
export async function idsGestores(): Promise<number[]> {
  const { data } = await clienteAdmin().from(T.usuarios).select("id_usuario").in("rol", ["administrador", "encargado_gastos"]).eq("estado", true);
  return (data ?? []).map((u: any) => u.id_usuario);
}
