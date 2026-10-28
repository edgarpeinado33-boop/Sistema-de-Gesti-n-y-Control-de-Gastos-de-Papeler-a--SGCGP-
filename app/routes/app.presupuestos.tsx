import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { GESTORES, jsonH, requerirUsuario } from "~/lib/sesion.server";
import { guardarPresupuesto, listarPresupuestos } from "~/controllers/presupuesto.controller";
import { mesAnioActual, MESES, nombrePeriodo } from "~/lib/fechas";
import { bs } from "~/lib/formato";
import { Aviso, Pagina, Regla, Vacio } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  const sp = new URL(request.url).searchParams, ahora = mesAnioActual();
  return jsonH({ lista: await listarPresupuestos(ctx), mes: Number(sp.get("mes")) || ahora.mes, anio: Number(sp.get("anio")) || ahora.anio, limite: sp.get("limite") ?? "" }, ctx);
}
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  return jsonH(await guardarPresupuesto(ctx, await request.formData()), ctx);
}

export default function Presupuestos() {
  const d = useLoaderData<typeof loader>(); const r = useActionData<typeof action>();
  return (
    <Pagina titulo="Presupuestos mensuales" subtitulo="Define el límite de cada mes y controla su ejecución (solo cuenta el gasto aprobado).">
      <Aviso r={r as any} />
      <Form method="post" className="panel filtros" key={`${d.mes}-${d.anio}`}>
        <div><label htmlFor="mes">Mes</label><select id="mes" name="mes" defaultValue={d.mes}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
        <div><label htmlFor="anio">Año</label><input id="anio" name="anio" type="number" min={2000} max={2200} defaultValue={d.anio} /></div>
        <div><label htmlFor="monto_limite">Límite (Bs)</label><input id="monto_limite" name="monto_limite" inputMode="decimal" defaultValue={d.limite} required /></div>
        <div style={{ flex: "0 0 auto" }}><button className="btn verde">Guardar presupuesto</button></div>
      </Form>
      {d.lista.length === 0 ? <Vacio texto="Aún no hay presupuestos registrados." /> : (
        <div className="panel tabla-caja"><table>
          <thead><tr><th>Periodo</th><th className="der">Límite</th><th className="der">Utilizado</th><th className="der">Saldo</th><th style={{ minWidth: 200 }}>Ejecución</th><th /></tr></thead>
          <tbody>{d.lista.map((p: any) => (
            <tr key={p.id_presupuesto}><td>{nombrePeriodo(p.mes, p.anio)}</td><td className="der num">{bs(p.monto_limite)}</td><td className="der num">{bs(p.monto_utilizado)}</td>
              <td className="der num" style={{ color: Number(p.saldo_disponible) < 0 ? "var(--margen)" : undefined }}>{bs(p.saldo_disponible)}</td>
              <td><Regla pct={Number(p.porcentaje_utilizado)} /></td>
              <td><Link className="btn mini suave" to={`?mes=${p.mes}&anio=${p.anio}&limite=${p.monto_limite}`}>Editar</Link></td></tr>))}</tbody>
        </table></div>)}
    </Pagina>
  );
}
