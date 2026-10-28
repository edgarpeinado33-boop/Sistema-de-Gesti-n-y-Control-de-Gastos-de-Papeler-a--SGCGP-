import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}. Revisa .env.example`);
  return v;
}

/** Cliente con la sesión del usuario (cookies). Respeta las políticas RLS. */
export function crearClienteServidor(request: Request) {
  const headers = new Headers();
  const supabase = createServerClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "").map((c) => ({ name: c.name, value: c.value ?? "" }));
      },
      setAll(lista: { name: string; value: string; options: any }[]) {
        lista.forEach(({ name, value, options }) => headers.append("Set-Cookie", serializeCookieHeader(name, value, options)));
      },
    },
  });
  return { supabase, headers };
}

/** Cliente privilegiado: SOLO servidor. Se usa para eventos y escrituras de ML (el esquema no da INSERT a usuarios). */
let admin: SupabaseClient<any, "public", any> | null = null;
export function clienteAdmin(): SupabaseClient<any, "public", any> {
  if (!admin) admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
export type DB = SupabaseClient<any, "public", any>;
export type Cliente = DB;
