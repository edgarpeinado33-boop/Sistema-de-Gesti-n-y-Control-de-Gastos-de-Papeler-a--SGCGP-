import { crearClienteServidor } from "~/lib/supabase.server";
import { str } from "~/lib/formato";

/** Autenticación con Supabase Auth (RF-01). Devuelve siempre los headers con las cookies de sesión. */
export async function haySesion(request: Request) {
  const { supabase, headers } = crearClienteServidor(request);
  const { data: { user } } = await supabase.auth.getUser();
  return { autenticado: !!user, headers };
}

export async function iniciarSesion(request: Request, f: FormData) {
  const { supabase, headers } = crearClienteServidor(request);
  const { error } = await supabase.auth.signInWithPassword({ email: str(f.get("correo")), password: str(f.get("password")) });
  return { ok: !error, error: error ? "Correo o contraseña incorrectos." : undefined, headers };
}

/** Autorregistro: el trigger de la BD crea el perfil con rol "solicitante". El rol solo lo cambia un administrador. */
export async function registrarse(request: Request, f: FormData) {
  const nombre = str(f.get("nombre")), apellido = str(f.get("apellido")), correo = str(f.get("correo")), password = str(f.get("password"));
  const { supabase, headers } = crearClienteServidor(request);
  if (nombre.length < 2 || apellido.length < 2) return { tipo: "error" as const, mensaje: "Ingresa nombre y apellido.", headers };
  if (password.length < 8) return { tipo: "error" as const, mensaje: "La contraseña debe tener al menos 8 caracteres.", headers };
  const { data, error } = await supabase.auth.signUp({ email: correo, password, options: { data: { nombre, apellido } } });
  if (error) return { tipo: "error" as const, mensaje: "No se pudo crear la cuenta. Verifica el correo o intenta con otro.", headers };
  if (data.session) return { tipo: "sesion" as const, headers };
  return { tipo: "confirmar" as const, mensaje: "Cuenta creada. Revisa tu correo para confirmar tu cuenta y luego inicia sesión.", headers };
}

export async function cerrarSesion(request: Request) {
  const { supabase, headers } = crearClienteServidor(request);
  await supabase.auth.signOut();
  return { headers };
}
