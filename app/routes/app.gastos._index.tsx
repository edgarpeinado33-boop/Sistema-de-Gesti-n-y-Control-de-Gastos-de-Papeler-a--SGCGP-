import type { LoaderFunctionArgs } from "@vercel/remix";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { esGestor, jsonH, requerirUsuario } from "~/lib/sesion.server";
import { listarGastos } from "~/controllers/gasto.controller";
import { listarCategorias, listarProveedores } from "~/controllers/catalogo.controller";
import { usuariosActivos } from "~/controllers/usuario.controller";
import { formatoFecha } from "~/lib/fechas";
import { bs } from "~/lib/formato";
import { Insignia, Pagina, Vacio } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request);
  const sp = new URL(request.url).searchParams;
  const filtros = Object.fromEntries(["q", "desde", "hasta", "categoria", "proveedor", "estado", "responsable"].map((k) => [k, sp.get(k) ?? ""]));
  const gestor = esGestor(ctx.perfil);
  const [gastos, categorias, proveedores, usuarios] = await Promise.all([listarGastos(ctx, filtros), listarCategorias(ctx), listarProveedores(ctx), gestor ? usuariosActivos() : Promise.resolve([])]);
  return jsonH({ gastos, categorias, proveedores, usuarios, filtros, gestor, qs: sp.toString() }, ctx);
}

export default function Gastos() {
  const { gastos, categorias, proveedores, usuarios, filtros, gestor, qs } = useLoaderData<typeof loader>();
  const total = gastos.filter((g: any) => g.estado === "aprobado").reduce((s: number, g: any) => s + Number(g.monto), 0);
  return (
    <Pagina titulo="Gastos" subtitulo={gestor ? "Todos los gastos registrados." : "Gastos registrados a tu nombre."}
      acciones={gestor && <><Link className="btn verde" to="nuevo">Registrar gasto</Link>
        {["csv", "xlsx", "pdf"].map((f) => <a key={f} className="btn suave" href={`/app/exportar?tipo=gastos&formato=${f}&${qs}`} download>{f.toUpperCase()}</a>)}</>}>
      <Form method="get" className="panel filtros">
        <div style={{ flex: "2 1 220px" }}><label htmlFor="q">Buscar concepto</label><input id="q" name="q" defaultValue={filtros.q} /></div>
        <div><label htmlFor="desde">Desde</label><input id="desde" type="date" name="desde" defaultValue={filtros.desde} /></div>
        <div><label htmlFor="hasta">Hasta</label><input id="hasta" type="date" name="hasta" defaultValue={filtros.hasta} /></div>
        <div><label htmlFor="categoria">Categoría</label><select id="categoria" name="categoria" defaultValue={filtros.categoria}><option value="">Todas</option>{categorias.map((c: any) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}</select></div>
        <div><label htmlFor="proveedor">Proveedor</label><select id="proveedor" name="proveedor" defaultValue={filtros.proveedor}><option value="">Todos</option>{proveedores.map((p: any) => <option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre}</option>)}</select></div>
        <div><label htmlFor="estado">Estado</label><select id="estado" name="estado" defaultValue={filtros.estado}><option value="">Todos</option>{["pendiente", "aprobado", "rechazado", "anulado"].map((e) => <option key={e}>{e}</option>)}</select></div>
        {gestor && <div><label htmlFor="responsable">Responsable</label><select id="responsable" name="responsable" defaultValue={filtros.responsable}><option value="">Todos</option>{usuarios.map((u: any) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>)}</select></div>}
        <div style={{ flex: "0 0 auto" }}><button className="btn">Filtrar</button> <Link className="btn suave" to="/app/gastos">Limpiar</Link></div>
      </Form>
      {gastos.length === 0 ? <Vacio texto="No se encontraron gastos con esos criterios." /> : (
        <div className="panel tabla-caja"><table>
          <thead><tr><th>N.º</th><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Proveedor</th><th>Responsable</th><th className="der">Monto</th><th>Estado</th></tr></thead>
          <tbody>{gastos.map((g: any) => (
            <tr key={g.id_gasto}><td><Link to={String(g.id_gasto)}>#{g.id_gasto}</Link></td><td>{formatoFecha(g.fecha)}</td><td>{g.concepto}</td><td>{g.categoria?.nombre}</td><td>{g.proveedor?.nombre ?? "—"}</td><td>{g.responsable}</td><td className="der num">{bs(g.monto)}</td><td><Insignia valor={g.estado} /></td></tr>))}
          </tbody>
          <tfoot><tr><td colSpan={6} className="der"><b>Total aprobado en la vista</b></td><td className="der num"><b>{bs(total)}</b></td><td /></tr></tfoot>
        </table></div>)}
    </Pagina>
  );
}
