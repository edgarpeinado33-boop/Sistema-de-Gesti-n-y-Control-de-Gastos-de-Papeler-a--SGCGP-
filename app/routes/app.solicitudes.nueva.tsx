import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@vercel/remix";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { jsonH, requerirUsuario } from "~/lib/sesion.server";
import { crearSolicitud } from "~/controllers/solicitud.controller";
import { listarCategorias } from "~/controllers/catalogo.controller";
import { Aviso, Campo, Pagina } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request);
  return jsonH({ categorias: await listarCategorias(ctx, true) }, ctx);
}
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requerirUsuario(request);
  const r = await crearSolicitud(ctx, await request.formData());
  if (r.ok) throw redirect("/app/solicitudes", { headers: ctx.headers });
  return jsonH(r, ctx, { status: 400 });
}

export default function NuevaSolicitud() {
  const { categorias } = useLoaderData<typeof loader>();
  const r = useActionData<typeof action>() as any;
  const ocupado = useNavigation().state !== "idle";
  const e = r?.campos ?? {};
  return (
    <Pagina titulo="Nueva solicitud de gasto" subtitulo="Indica qué necesitas comprar y por qué.">
      <Aviso r={r} />
      <Form method="post" className="panel" noValidate>
        <div className="form-grid">
          <Campo label="Concepto" nombre="concepto" error={e.concepto}><input id="concepto" name="concepto" maxLength={250} required /></Campo>
          <Campo label="Categoría" nombre="categoria_id" error={e.categoria_id}>
            <select id="categoria_id" name="categoria_id" defaultValue="" required><option value="" disabled>Selecciona…</option>
              {categorias.map((c: any) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}{c.requiere_justificacion ? " (requiere justificación)" : ""}</option>)}</select>
          </Campo>
          <Campo label="Monto (Bs)" nombre="monto" error={e.monto}><input id="monto" name="monto" inputMode="decimal" placeholder="0.00" required /></Campo>
        </div>
        <Campo label="Justificación" nombre="justificacion" error={e.justificacion}><textarea id="justificacion" name="justificacion" /></Campo>
        <button className="btn verde" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar solicitud"}</button>
      </Form>
    </Pagina>
  );
}
