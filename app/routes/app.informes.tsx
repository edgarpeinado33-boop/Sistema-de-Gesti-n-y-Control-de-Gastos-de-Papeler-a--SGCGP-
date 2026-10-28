import type { LoaderFunctionArgs } from "@vercel/remix";
import { useLoaderData } from "@remix-run/react";
import { GESTORES, jsonH, requerirUsuario } from "~/lib/sesion.server";
import { datosInformes } from "~/controllers/reporte.controller";
import { nombrePeriodo } from "~/lib/fechas";
import { bs } from "~/lib/formato";
import { Barras, Pagina, Regla, Vacio } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  return jsonH(await datosInformes(ctx), ctx);
}

export default function Informes() {
  const d = useLoaderData<typeof loader>() as any;
  const Exp = ({ tipo }: { tipo: string }) => <span className="acciones">{["csv", "xlsx", "pdf"].map((f) => <a key={f} className="btn mini suave" href={`/app/exportar?tipo=${tipo}&formato=${f}`} download>{f.toUpperCase()}</a>)}</span>;
  return (
    <Pagina titulo="Informes" subtitulo="Gastos por categoría, proveedor, mes y ejecución presupuestaria.">
      <section className="panel tabla-caja">
        <div className="acciones" style={{ justifyContent: "space-between" }}><h2>Resumen por categoría</h2><Exp tipo="resumen" /></div>
        {d.porCategoria.length ? <table><thead><tr><th>Categoría</th><th className="der">N.º aprobados</th><th className="der">Aprobado</th><th className="der">Pendiente</th><th className="der">Rechazado</th></tr></thead>
          <tbody>{d.porCategoria.map((c: any) => <tr key={c.id_categoria}><td>{c.categoria}</td><td className="der">{c.cantidad_gastos_aprobados}</td><td className="der num">{bs(c.total_aprobado)}</td><td className="der num">{bs(c.total_pendiente)}</td><td className="der num">{bs(c.total_rechazado)}</td></tr>)}</tbody></table> : <Vacio texto="Sin datos." />}
      </section>
      <div className="rejilla rej-2" style={{ marginTop: 16 }}>
        <section className="panel"><h2>Gasto aprobado por proveedor</h2>{d.porProveedor.length ? <Barras datos={d.porProveedor.slice(0, 10).map((p: any) => ({ nombre: p.nombre, valor: p.total }))} /> : <Vacio texto="Sin datos." />}</section>
        <section className="panel"><h2>Evolución mensual</h2>{d.mensual.length ? <Barras datos={d.mensual.slice(-12).map((m: any) => ({ nombre: m.periodo, valor: m.total }))} /> : <Vacio texto="Sin datos." />}</section>
      </div>
      <section className="panel tabla-caja" style={{ marginTop: 16 }}>
        <div className="acciones" style={{ justifyContent: "space-between" }}><h2>Ejecución presupuestaria</h2><Exp tipo="presupuesto" /></div>
        {d.ejecucion.length ? <table><thead><tr><th>Periodo</th><th className="der">Límite</th><th className="der">Utilizado</th><th className="der">Saldo</th><th style={{ minWidth: 180 }}>Ejecución</th></tr></thead>
          <tbody>{d.ejecucion.map((p: any) => <tr key={p.id_presupuesto}><td>{nombrePeriodo(p.mes, p.anio)}</td><td className="der num">{bs(p.monto_limite)}</td><td className="der num">{bs(p.monto_utilizado)}</td><td className="der num">{bs(p.saldo_disponible)}</td><td><Regla pct={Number(p.porcentaje_utilizado)} /></td></tr>)}</tbody></table> : <Vacio texto="Sin presupuestos." />}
      </section>
    </Pagina>
  );
}
