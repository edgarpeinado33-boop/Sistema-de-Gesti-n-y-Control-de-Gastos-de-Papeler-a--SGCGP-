import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { GESTORES, jsonH, requerirUsuario } from "~/lib/sesion.server";
import { fallo, type Resultado } from "~/lib/errores";
import { str, bs } from "~/lib/formato";
import { formatoFecha, formatoFechaHora } from "~/lib/fechas";
import { cargarAnalisis, ejecutarYResumir, revisarResultado } from "~/controllers/ml.controller";
import { Aviso, Insignia, Pagina, Vacio } from "~/components/ui";

export const config = { maxDuration: 60 };

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  return jsonH(await cargarAnalisis(ctx), ctx);
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  const f = await request.formData(); const intent = str(f.get("intent"));
  const r: Resultado = intent === "analizar" ? await ejecutarYResumir(ctx) : intent === "anomalia" || intent === "recomendacion" ? await revisarResultado(ctx, f) : fallo("Acción inválida.");
  return jsonH(r, ctx, { status: r.error ? 400 : 200 });
}

export default function ML() {
  const d = useLoaderData<typeof loader>() as any; const r = useActionData<typeof action>();
  const ocupado = useNavigation().state !== "idle";
  const m = d.modelo?.metricas ?? {};
  const Revisar = ({ intent, id, opciones }: { intent: string; id: number; opciones: [string, string][] }) => (
    <Form method="post" className="acciones"><input type="hidden" name="intent" value={intent} /><input type="hidden" name="id" value={id} />
      {opciones.map(([v, t]) => <button key={v} name="estado" value={v} className="btn mini suave">{t}</button>)}</Form>);
  return (
    <Pagina titulo="Análisis inteligente" subtitulo="Predicción de gastos, detección de anomalías, patrones y recomendaciones. Los resultados son apoyo a la decisión: requieren revisión humana."
      acciones={<Form method="post"><input type="hidden" name="intent" value="analizar" /><button className="btn verde" disabled={ocupado}>{ocupado ? "Analizando…" : "Ejecutar análisis"}</button></Form>}>
      <Aviso r={r as any} />
      <section className="panel">
        <h2>Modelo</h2>
        {d.modelo ? <p style={{ margin: 0 }}><b>{d.modelo.nombre}</b> {d.modelo.version} · {d.modelo.algoritmo}. Entrenado el {formatoFechaHora(d.modelo.fecha_entrenamiento)} con {m.meses_historial ?? 0} meses de historial (hasta {m.entrenado_hasta ?? "—"}). {m.mae != null ? <>Error de validación: <b>MAE {bs(m.mae)}</b>, <b>RMSE {bs(m.rmse)}</b> ({m.pruebas} pruebas de origen móvil).</> : "Aún no hay historial suficiente para calcular MAE/RMSE (se necesitan al menos 6 meses)."}</p> : <p className="muted" style={{ margin: 0 }}>Todavía no se ejecutó ningún análisis.</p>}
        <p className="muted" style={{ marginBottom: 0 }}>Limitaciones: usa solo meses cerrados con gasto aprobado; con pocos meses la estimación se apoya en el promedio; no considera eventos extraordinarios.</p>
      </section>
      <section className="panel tabla-caja"><h2>Predicción para {d.periodo}</h2>
        {d.predicciones.length ? <table><thead><tr><th>Categoría</th><th className="der">Estimado</th><th className="der">Rango</th><th className="der">Confianza</th><th>Detalle</th></tr></thead>
          <tbody>{d.predicciones.map((p: any) => <tr key={p.id_prediccion}><td>{p.categoria?.nombre ?? <b>Total general</b>}</td><td className="der num">{bs(p.monto_estimado)}</td><td className="der num">{bs(p.limite_inferior)} – {bs(p.limite_superior)}</td><td className="der">{Math.round(Number(p.confianza) * 100)}%</td><td className="muted">{p.observaciones}</td></tr>)}</tbody></table> : <Vacio texto="Sin predicciones para este periodo." />}</section>
      <section className="panel tabla-caja"><h2>Anomalías detectadas</h2>
        {d.anomalias.length ? <table><thead><tr><th>Gasto</th><th>Nivel</th><th>Motivo</th><th>Revisión</th></tr></thead>
          <tbody>{d.anomalias.map((a: any) => <tr key={a.id_anomalia}><td><a href={`/app/gastos/${a.id_gasto}`}>#{a.id_gasto}</a> {a.gasto?.concepto}<div className="muted">{bs(a.gasto?.monto)} · {formatoFecha(a.gasto?.fecha)}</div></td><td><Insignia valor={a.nivel} /><div className="muted">{a.puntuacion}</div></td><td style={{ maxWidth: 420 }}>{a.motivo}</td>
            <td>{a.estado_revision === "pendiente" ? <Revisar intent="anomalia" id={a.id_anomalia} opciones={[["confirmada", "Confirmar"], ["descartada", "Descartar"], ["revisada", "Revisada"]]} /> : <Insignia valor={a.estado_revision} />}</td></tr>)}</tbody></table> : <Vacio texto="No hay anomalías registradas." />}</section>
      <section className="panel tabla-caja"><h2>Recomendaciones</h2>
        {d.recomendaciones.length ? d.recomendaciones.map((x: any) => <div key={x.id_recomendacion} className="cuaderno" style={{ marginBottom: 14 }}><b>{x.titulo}</b> <Insignia valor={x.estado} /><p style={{ margin: "4px 0" }}>{x.descripcion}</p>{x.ahorro_estimado != null && <small className="muted">Ahorro potencial: {bs(x.ahorro_estimado)} · </small>}{x.estado === "pendiente" && <Revisar intent="recomendacion" id={x.id_recomendacion} opciones={[["aceptada", "Aceptar"], ["rechazada", "Rechazar"], ["aplicada", "Marcar aplicada"]]} />}</div>) : <Vacio texto="Sin recomendaciones." />}</section>
      <section className="panel tabla-caja"><h2>Patrones de consumo (últimos 6 meses cerrados)</h2>
        {d.patrones.length ? <table><thead><tr><th>Categoría</th><th className="der">Total</th><th className="der">Último mes vs. promedio previo</th></tr></thead><tbody>{d.patrones.map((p: any) => <tr key={p.nombre}><td>{p.nombre}</td><td className="der num">{bs(p.total)}</td><td className="der" style={{ color: p.variacion != null && p.variacion > 20 ? "var(--margen)" : undefined }}>{p.variacion == null ? "—" : `${p.variacion > 0 ? "+" : ""}${p.variacion}%`}</td></tr>)}</tbody></table> : <Vacio texto="Aún no hay historial suficiente." />}</section>
    </Pagina>
  );
}
