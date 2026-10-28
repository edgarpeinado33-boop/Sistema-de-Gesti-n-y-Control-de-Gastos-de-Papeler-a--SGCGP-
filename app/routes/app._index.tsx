import type { LoaderFunctionArgs } from "@vercel/remix";
import { Link, useLoaderData } from "@remix-run/react";
import { jsonH, requerirUsuario } from "~/lib/sesion.server";
import { formatoFechaHora } from "~/lib/fechas";
import { bs } from "~/lib/formato";
import { datosPanel } from "~/controllers/panel.controller";
import { Barras, Insignia, Kpi, Pagina, Regla, Vacio } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request);
  return jsonH(await datosPanel(ctx), ctx);
}

export default function Panel() {
  const d = useLoaderData<typeof loader>();
  const p: any = d.presupuesto;
  return (
    <Pagina titulo={`Hola, ${d.nombre}`} subtitulo={`Resumen de ${d.periodo}`} acciones={<Link className="btn verde" to="/app/solicitudes/nueva">Nueva solicitud</Link>}>
      {d.gestor && (
        <section className="panel" aria-labelledby="h-pres">
          <h2 id="h-pres">Presupuesto de {d.periodo}</h2>
          {p ? <>
            <Regla pct={Number(p.porcentaje_utilizado)} etiqueta={`${p.porcentaje_utilizado}% ejecutado`} />
            <div className="rejilla rej-4" style={{ marginTop: 14 }}>
              <div className="dato"><small>Límite</small><b>{bs(p.monto_limite)}</b></div>
              <div className="dato ambar"><small>Utilizado (aprobado)</small><b>{bs(p.monto_utilizado)}</b></div>
              <div className={`dato ${Number(p.saldo_disponible) < 0 ? "alerta" : ""}`}><small>Saldo disponible</small><b>{bs(p.saldo_disponible)}</b></div>
            </div>
          </> : <Vacio texto="No hay presupuesto definido para este mes. Créalo en Presupuestos." />}
        </section>
      )}
      <div className="rejilla rej-4" style={{ margin: "16px 0" }}>
        <Kpi icono="reloj" tono="ambar" etiqueta="Solicitudes pendientes" valor={d.pendientes} />
        <Kpi icono="check" etiqueta="Solicitudes aprobadas" valor={d.aprobadas} />
        <Kpi icono="billete" etiqueta="Gasto aprobado del mes" valor={bs(d.totalMes)} />
        {d.gestor ? <Kpi icono="alerta" tono={d.anomalias ? "alerta" : ""} etiqueta="Anomalías por revisar" valor={d.anomalias} /> : <Kpi icono="equis" tono="alerta" etiqueta="Solicitudes rechazadas" valor={d.rechazadas} />}
      </div>
      <div className="rejilla rej-2">
        <section className="panel"><h2>Gasto aprobado por categoría</h2>{d.categorias.length ? <Barras datos={d.categorias} /> : <Vacio texto="Aún no hay gastos aprobados este mes." />}</section>
        <section className="panel">
          <h2>Notificaciones recientes</h2>
          {d.notifs.length ? d.notifs.map((n: any) => <div key={n.id_notificacion} className="cuaderno" style={{ marginBottom: 10 }}><b>{n.titulo}</b> {!n.leida && <Insignia valor="pendiente" />}<div className="muted">{n.mensaje}</div><small className="muted">{formatoFechaHora(n.created_at)}</small></div>) : <Vacio texto="Sin notificaciones." />}
          <Link to="/app/notificaciones">Ver todas</Link>
        </section>
      </div>
      {d.gestor && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>Estimación para {d.siguiente}</h2>
          {d.prediccion ? <p style={{ margin: 0 }}>Gasto estimado <b className="num">{bs(d.prediccion.monto_estimado)}</b> (rango {bs(d.prediccion.limite_inferior)} – {bs(d.prediccion.limite_superior)}, confianza {Math.round(Number(d.prediccion.confianza) * 100)}%). Es una estimación sujeta a revisión. <Link to="/app/ml">Ver análisis</Link></p> : <p className="muted" style={{ margin: 0 }}>Aún no hay predicción. Ejecuta el análisis en <Link to="/app/ml">Análisis inteligente</Link>.</p>}
        </section>
      )}
    </Pagina>
  );
}