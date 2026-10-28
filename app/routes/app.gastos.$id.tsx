import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@vercel/remix";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { jsonH, requerirUsuario } from "~/lib/sesion.server";
import { adjuntarComprobante, cambiarGasto, detalleGasto, eliminarComprobante } from "~/controllers/gasto.controller";
import { formatoFecha, formatoFechaHora } from "~/lib/fechas";
import { bs, str } from "~/lib/formato";
import { Aviso, Insignia, Pagina } from "~/components/ui";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request);
  const detalle = await detalleGasto(ctx, Number(params.id));
  if (!detalle) throw new Response("No encontrado", { status: 404 });
  return jsonH(detalle, ctx);
}
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requerirUsuario(request);
  const f = await request.formData();
  const intent = str(f.get("intent"));
  const r = intent === "comprobante" ? await adjuntarComprobante(ctx, f) : intent === "quitar" ? await eliminarComprobante(ctx, f) : await cambiarGasto(ctx, f);
  if (r.ok && str(f.get("accion")) === "eliminar") throw redirect("/app/gastos", { headers: ctx.headers });
  return jsonH(r, ctx, { status: r.error ? 400 : 200 });
}

export default function DetalleGasto() {
  const { gasto: g, gestor, admin, historial } = useLoaderData<typeof loader>() as any;
  const r = useActionData<typeof action>();
  const ocupado = useNavigation().state !== "idle";
  return (
    <Pagina titulo={`Gasto #${g.id_gasto}`} subtitulo={g.concepto} acciones={<Link className="btn suave" to="/app/gastos">Volver</Link>}>
      <Aviso r={r as any} />
      <section className="panel">
        <div className="rejilla rej-4">
          <div className="dato"><small>Monto</small><b>{bs(g.monto)}</b></div>
          <div className="dato"><small>Fecha</small><b style={{ fontSize: "1.1rem" }}>{formatoFecha(g.fecha)}</b></div>
          <div className="dato"><small>Estado</small><Insignia valor={g.estado} /></div>
        </div>
        <p><b>Categoría:</b> {g.categoria?.nombre} · <b>Proveedor:</b> {g.proveedor?.nombre ?? "—"} · <b>Responsable:</b> {g.responsable} · <b>Registrado por:</b> {g.registrador}</p>
        {g.numero_comprobante && <p><b>Comprobante:</b> {g.tipo_comprobante} {g.numero_comprobante}</p>}
        {g.justificacion && <p className="cuaderno">{g.justificacion}</p>}
        {gestor && <div className="acciones">
          {g.estado !== "aprobado" && <Form method="post"><input type="hidden" name="id" value={g.id_gasto} /><button name="accion" value="aprobar" className="btn verde mini" disabled={ocupado}>Aprobar</button></Form>}
          {g.estado === "pendiente" && <Form method="post"><input type="hidden" name="id" value={g.id_gasto} /><button name="accion" value="rechazar" className="btn peligro mini" disabled={ocupado}>Rechazar</button></Form>}
          {g.estado !== "anulado" && <Form method="post"><input type="hidden" name="id" value={g.id_gasto} /><button name="accion" value="anular" className="btn suave mini" disabled={ocupado}>Anular</button></Form>}
          {admin && <Form method="post" onSubmit={(e) => { if (!confirm("¿Eliminar definitivamente este gasto?")) e.preventDefault(); }}><input type="hidden" name="id" value={g.id_gasto} /><button name="accion" value="eliminar" className="btn peligro mini">Eliminar</button></Form>}
        </div>}
      </section>
      <section className="panel">
        <h2>Comprobantes</h2>
        {g.comprobantes.length ? <ul>{g.comprobantes.map((c: any) => (
          <li key={c.id_comprobante}>{c.url ? <a href={c.url} target="_blank" rel="noreferrer">{c.nombre_archivo}</a> : c.nombre_archivo} <span className="muted">({Math.round((c.tamano_bytes ?? 0) / 1024)} KB)</span>
            {gestor && <Form method="post" style={{ display: "inline", marginLeft: 8 }}><input type="hidden" name="intent" value="quitar" /><input type="hidden" name="comprobante_id" value={c.id_comprobante} /><button className="btn mini suave">Quitar</button></Form>}</li>))}</ul> : <p className="muted">Sin comprobantes adjuntos.</p>}
        <Form method="post" encType="multipart/form-data" className="acciones">
          <input type="hidden" name="intent" value="comprobante" /><input type="hidden" name="id" value={g.id_gasto} />
          <input type="file" name="archivo" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Archivo del comprobante" style={{ maxWidth: 320 }} />
          <button className="btn mini" disabled={ocupado}>Adjuntar</button>
        </Form>
      </section>
      {gestor && <section className="panel tabla-caja"><h2>Historial de cambios</h2>
        {historial.length ? <table><thead><tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>Detalle</th></tr></thead><tbody>{historial.map((h: any) => <tr key={h.id_historial}><td>{formatoFechaHora(h.created_at)}</td><td>{h.accion}</td><td>{h.autor}</td><td>{h.descripcion}</td></tr>)}</tbody></table> : <p className="muted">Sin movimientos.</p>}</section>}
    </Pagina>
  );
}
