import { redirect, type ActionFunctionArgs } from "@vercel/remix";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { jsonH } from "~/lib/sesion.server";
import { registrarse } from "~/controllers/auth.controller";
import { Aviso, AuthShell } from "~/components/ui";

export async function action({ request }: ActionFunctionArgs) {
  const r = await registrarse(request, await request.formData());
  if (r.tipo === "sesion") return redirect("/app", { headers: r.headers });
  if (r.tipo === "error") return jsonH({ error: r.mensaje }, r, { status: 400 });
  return jsonH({ ok: r.mensaje }, r);
}

export default function Registro() {
  const r = useActionData<typeof action>();
  const ocupado = useNavigation().state !== "idle";
  return (
    <AuthShell titulo="Crear cuenta" subtitulo="Tu cuenta tendrá el rol de solicitante." pie={<Link to="/login">← Volver a iniciar sesión</Link>}>
      <Aviso r={r as any} />
      <Form method="post">
        <div className="form-grid">
          <div className="campo"><label htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" required autoComplete="given-name" /></div>
          <div className="campo"><label htmlFor="apellido">Apellido</label><input id="apellido" name="apellido" required autoComplete="family-name" /></div>
        </div>
        <div className="campo"><label htmlFor="correo">Correo electrónico</label><input id="correo" name="correo" type="email" required autoComplete="email" inputMode="email" /></div>
        <div className="campo"><label htmlFor="password">Contraseña (mínimo 8 caracteres)</label><input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" /></div>
        <button className="btn verde" disabled={ocupado} style={{ width: "100%" }}>{ocupado ? "Creando cuenta…" : "Registrarme"}</button>
      </Form>
    </AuthShell>
  );
}