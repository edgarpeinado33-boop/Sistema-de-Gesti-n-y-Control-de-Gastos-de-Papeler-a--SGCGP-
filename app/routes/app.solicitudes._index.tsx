import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { Form, Link, useActionData, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import { esGestor, jsonH, requerirUsuario } from "~/lib/sesion.server";
import { listarSolicitudes, revisarSolicitud } from "~/controllers/solicitud.controller";
import { formatoFecha } from "~/lib/fechas";
import { bs } from "~/lib/formato";
import { Aviso, Insignia, Pagina, Vacio } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request);
  const estado = new URL(request.url).searchParams.get("estado") ?? undefined;
  return jsonH({ solicitudes: await listarSolicitudes(ctx, estado), gestor: esGestor(ctx.perfil), yo: ctx.perfil.id_usuario }, ctx);
}
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requerirUsuario(request);
  return jsonH(await revisarSolicitud(ctx, await request.formData()), ctx);
}

export default function Solicitudes() {
  const { solicitudes, gestor, yo } = useLoaderData<typeof loader>();
  const r = useActionData<typeof action>();
  const [sp, setSp] = useSearchParams();
  const ocupado = useNavigation().state !== "idle";
  return (
    <Pagina titulo="Solicitudes de gasto" subtitulo={gestor ? "Revisa, aprueba o rechaza las solicitudes." : "Tus solicitudes y su estado."} acciones={<Link className="btn verde" to="nueva">Nueva solicitud</Link>}>
      <Aviso r={r as any} />
      <div className="filtros"><div><label htmlFor="estado">Estado</label>
        <select id="estado" value={sp.get("estado") ?? ""} onChange={(e) => setSp(e.target.value ? { estado: e.target.value } : {})}>
          <option value="">Todos</option>{["pendiente", "aprobada", "rechazada", "ejecutada", "cancelada"].map((e) => <option key={e}>{e}</option>)}
        </select></div></div>
      {solicitudes.length === 0 ? <Vacio texto="No hay solicitudes para mostrar." /> : (
        <div className="panel tabla-caja"><table>
          <thead><tr><th>N.º</th><th>Fecha</th><th>Solicitante</th><th>Concepto</th><th>Categoría</th><th className="der">Monto</th><th>Estado</th><th>Revisión</th></tr></thead>
          <tbody>{solicitudes.map((s: any) => (
            <tr key={s.id_solicitud}>
              <td>#{s.id_solicitud}</td><td>{formatoFecha(s.fecha_solicitud)}</td><td>{s.solicitante}</td>
              <td>{s.concepto}{s.justificacion && <div className="muted">{s.justificacion}</div>}</td>
              <td>{s.categoria?.nombre}</td><td className="der num">{bs(s.monto)}</td><td><Insignia valor={s.estado} /></td>
              <td style={{ minWidth: 230 }}>
                {s.estado === "pendiente" && gestor && s.usuario_id !== yo ? (
                  <Form method="post">
                    <input type="hidden" name="id" value={s.id_solicitud} />
                    <input name="observaciones" placeholder="Observaciones (obligatorio al rechazar)" aria-label="Observaciones" style={{ marginBottom: 6 }} />
                    <div className="acciones">
                      <button className="btn verde mini" name="decision" value="aprobada" disabled={ocupado}>Aprobar</button>
                      <button className="btn peligro mini" name="decision" value="rechazada" disabled={ocupado}>Rechazar</button>
                    </div>
                  </Form>
                ) : s.estado === "pendiente" && gestor ? <span className="muted">No puedes revisar tu propia solicitud</span>
                  : <>{s.revisor && <div className="muted">Por {s.revisor}</div>}{s.observaciones && <div>{s.observaciones}</div>}
                    {s.estado === "aprobada" && gestor && <Link className="btn mini suave" to={`/app/gastos/nuevo?solicitud=${s.id_solicitud}`}>Registrar gasto</Link>}</>}
              </td>
            </tr>))}
          </tbody></table></div>
      )}
    </Pagina>
  );
}
