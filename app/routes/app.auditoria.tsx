import type { LoaderFunctionArgs } from "@vercel/remix";
import { Link, useLoaderData } from "@remix-run/react";
import { GESTORES, jsonH, requerirUsuario } from "~/lib/sesion.server";
import { listarHistorial } from "~/controllers/auditoria.controller";
import { formatoFechaHora } from "~/lib/fechas";
import { Pagina, Vacio } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  return jsonH({ lista: await listarHistorial(ctx, { limite: 200 }) }, ctx);
}

export default function Auditoria() {
  const { lista } = useLoaderData<typeof loader>() as any;
  return (
    <Pagina titulo="Historial de auditoría" subtitulo="Altas, modificaciones y eliminaciones de gastos con sus datos anteriores y nuevos (registrado por la base de datos).">
      {lista.length === 0 ? <Vacio texto="Sin movimientos registrados." /> : (
        <div className="panel tabla-caja"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Gasto</th><th>Usuario</th><th>Cambio</th></tr></thead>
          <tbody>{lista.map((x: any) => (
            <tr key={x.id_historial}><td>{formatoFechaHora(x.created_at)}</td><td>{x.accion}</td><td>{x.gasto_id ? <Link to={`/app/gastos/${x.gasto_id}`}>#{x.gasto_id}</Link> : `#${x.datos_anteriores?.id_gasto ?? "—"} (eliminado)`}</td><td>{x.autor}</td>
              <td><details><summary>{x.descripcion}</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: ".78rem" }}>{x.datos_anteriores ? "Antes: " + JSON.stringify(x.datos_anteriores) : ""}{"\n"}{x.datos_nuevos ? "Después: " + JSON.stringify(x.datos_nuevos) : ""}</pre></details></td></tr>))}</tbody></table></div>)}
    </Pagina>
  );
}
