import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { Form, useLoaderData } from "@remix-run/react";
import { jsonH, requerirUsuario } from "~/lib/sesion.server";
import { formatoFechaHora } from "~/lib/fechas";
import { int, str } from "~/lib/formato";
import { listarNotificaciones, marcarLeidas } from "~/controllers/notificacion.controller";
import { Insignia, Pagina, Vacio } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request);
  return jsonH({ lista: await listarNotificaciones(ctx) }, ctx);
}
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requerirUsuario(request);
  const f = await request.formData();
  return jsonH(await marcarLeidas(ctx, str(f.get("todas")) ? null : (int(f.get("id")) ?? -1)), ctx); // RLS: solo las propias
}

export default function Notificaciones() {
  const { lista } = useLoaderData<typeof loader>() as any;
  return (
    <Pagina titulo="Notificaciones" acciones={<Form method="post"><input type="hidden" name="todas" value="1" /><button className="btn suave">Marcar todas como leídas</button></Form>}>
      {lista.length === 0 ? <Vacio texto="No tienes notificaciones." /> : lista.map((n: any) => (
        <div key={n.id_notificacion} className="panel cuaderno" style={{ opacity: n.leida ? 0.7 : 1 }}>
          <div className="acciones" style={{ justifyContent: "space-between" }}><b>{n.titulo} <Insignia valor={n.tipo === "informativa" ? "revisada" : n.tipo === "rechazo" || n.tipo === "anomalia" ? "alto" : n.tipo === "presupuesto" ? "medio" : "aprobado"} /></b>
            {!n.leida && <Form method="post"><input type="hidden" name="id" value={n.id_notificacion} /><button className="btn mini suave">Marcar leída</button></Form>}</div>
          <p style={{ margin: "6px 0" }}>{n.mensaje}</p><small className="muted">{formatoFechaHora(n.created_at)}</small>
        </div>))}
    </Pagina>
  );
}
