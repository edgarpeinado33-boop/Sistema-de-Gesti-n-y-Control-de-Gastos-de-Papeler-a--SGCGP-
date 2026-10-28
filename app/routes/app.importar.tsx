import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { GESTORES, jsonH, requerirUsuario } from "~/lib/sesion.server";
import { historialImportaciones, importarGastos } from "~/controllers/reporte.controller";
import { formatoFechaHora } from "~/lib/fechas";
import { Aviso, Insignia, Pagina } from "~/components/ui";

export const config = { maxDuration: 60 };

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  return jsonH({ historial: await historialImportaciones(ctx) }, ctx);
}
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  return jsonH(await importarGastos(ctx, await request.formData()), ctx);
}

export default function Importar() {
  const { historial } = useLoaderData<typeof loader>() as any; const r = useActionData<typeof action>();
  const ocupado = useNavigation().state !== "idle";
  return (
    <Pagina titulo="Importar gastos" subtitulo="Carga registros desde un archivo CSV o Excel (.xlsx). Se validan antes de guardarse.">
      <Aviso r={r as any} />
      <Form method="post" encType="multipart/form-data" className="panel">
        <p>Columnas requeridas en la primera fila: <code>concepto, categoria, proveedor, monto, fecha, justificacion</code>. La fecha puede ser <code>AAAA-MM-DD</code> o <code>DD/MM/AAAA</code>. La categoría y el proveedor deben existir con el mismo nombre. Máximo 500 filas y 4 MB.</p>
        <div className="form-grid">
          <div className="campo"><label htmlFor="archivo">Archivo</label><input id="archivo" type="file" name="archivo" accept=".csv,.xlsx" required /></div>
          <div className="campo"><label htmlFor="estado">Estado de los registros importados</label><select id="estado" name="estado"><option value="pendiente">Pendiente (requiere aprobación)</option><option value="aprobado">Aprobado (datos históricos)</option></select></div>
        </div>
        <button className="btn verde" disabled={ocupado}>{ocupado ? "Procesando…" : "Importar"}</button>
      </Form>
      <section className="panel tabla-caja"><h2>Importaciones recientes</h2>
        {historial.length ? <table><thead><tr><th>Fecha</th><th>Archivo</th><th className="der">Total</th><th className="der">Correctos</th><th className="der">Con error</th><th>Estado</th></tr></thead>
          <tbody>{historial.map((h: any) => <tr key={h.id_importacion}><td>{formatoFechaHora(h.created_at)}</td><td>{h.nombre_archivo}</td><td className="der">{h.total_registros}</td><td className="der">{h.registros_correctos}</td><td className="der">{h.registros_erroneos}</td><td><Insignia valor={h.estado === "completada" ? "aprobado" : h.estado === "fallida" ? "rechazado" : "pendiente"} /></td></tr>)}</tbody></table> : <p className="muted">Sin importaciones.</p>}</section>
    </Pagina>
  );
}
