import { fallo, mensajeError, type Resultado } from "~/lib/errores";
import { str } from "~/lib/formato";
import type { Contexto } from "~/lib/sesion.server";
import * as Usuarios from "~/models/usuarios.server";

const ROLES = ["administrador", "encargado_gastos", "solicitante"];

export const listarUsuarios = (ctx: Contexto) => Usuarios.listarTodos(ctx.supabase);
export const usuariosActivos = () => Usuarios.usuariosActivos();

/** RF-02: el administrador registra usuarios (Supabase Auth + perfil por trigger). */
export async function crearUsuario(ctx: Contexto, f: FormData): Promise<Resultado> {
  const nombre = str(f.get("nombre")), apellido = str(f.get("apellido")), correo = str(f.get("correo")).toLowerCase();
  const password = str(f.get("password")), rol = str(f.get("rol"));
  const campos: Record<string, string> = {};
  if (nombre.length < 2) campos.nombre = "Ingresa el nombre.";
  if (apellido.length < 2) campos.apellido = "Ingresa el apellido.";
  if (!/^\S+@\S+\.\S+$/.test(correo)) campos.correo = "Correo inválido.";
  if (password.length < 8) campos.password = "Mínimo 8 caracteres.";
  if (!ROLES.includes(rol)) campos.rol = "Rol inválido.";
  if (Object.keys(campos).length) return fallo("Revisa los datos del formulario.", campos);
  const { authId, error } = await Usuarios.crearCuentaAuth(correo, password, nombre, apellido);
  if (error || !authId) return fallo(error?.message.includes("already") ? "Ya existe un usuario con ese correo." : "No se pudo crear el usuario.");
  const e2 = await Usuarios.asignarRolPorAuthId(ctx.supabase, authId, rol);
  return e2 ? fallo(mensajeError(e2)) : { ok: `Usuario ${correo} creado.` };
}

export async function actualizarUsuario(ctx: Contexto, f: FormData): Promise<Resultado> {
  const id = Number(str(f.get("id"))), rol = str(f.get("rol")), estado = str(f.get("estado")) === "true";
  if (!ROLES.includes(rol)) return fallo("Rol inválido.");
  if (id === ctx.perfil.id_usuario && (rol !== "administrador" || !estado)) return fallo("No puedes quitarte el rol de administrador ni desactivar tu propia cuenta.");
  const error = await Usuarios.actualizarRolEstado(ctx.supabase, id, rol, estado);
  return error ? fallo(mensajeError(error)) : { ok: "Usuario actualizado." };
}
