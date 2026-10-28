import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@vercel/remix";
import { Form, Link, useActionData, useNavigation, useSearchParams } from "@remix-run/react";
import { jsonH } from "~/lib/sesion.server";
import { haySesion, iniciarSesion } from "~/controllers/auth.controller";
import { Aviso, AuthShell } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const { autenticado, headers } = await haySesion(request);
  if (autenticado) throw redirect("/app", { headers });
  return jsonH({}, { headers });
}

/** RF-01: inicio de sesión con Supabase Auth. */
export async function action({ request }: ActionFunctionArgs) {
  const r = await iniciarSesion(request, await request.formData());
  if (!r.ok) return jsonH({ error: r.error }, r, { status: 401 });
  return redirect("/app", { headers: r.headers });
}

export default function Login() {
  const r = useActionData<typeof action>();
  const [sp] = useSearchParams();
  const ocupado = useNavigation().state !== "idle";
  return (
    <AuthShell titulo="Bienvenido" subtitulo="Ingresa para gestionar los gastos de papelería." pie={<>¿No tienes cuenta? <Link to="/registro">Regístrate como solicitante</Link></>}>
      {sp.get("error") === "inactivo" && <div className="aviso error" style={{ marginTop: 14 }}>Tu cuenta está desactivada. Contacta al administrador.</div>}
      <Aviso r={r as any} />
      <Form method="post" noValidate>
        <div className="campo"><label htmlFor="correo">Correo electrónico</label><input id="correo" name="correo" type="email" autoComplete="email" inputMode="email" required /></div>
        <div className="campo"><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        <button className="btn verde" disabled={ocupado} style={{ width: "100%" }}>{ocupado ? "Ingresando…" : "Ingresar"}</button>
      </Form>
    </AuthShell>
  );
}