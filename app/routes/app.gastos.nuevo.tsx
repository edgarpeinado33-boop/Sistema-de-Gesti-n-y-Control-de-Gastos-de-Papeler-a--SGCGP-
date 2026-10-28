import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@vercel/remix";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { GESTORES, jsonH, requerirUsuario } from "~/lib/sesion.server";
import { registrarGasto } from "~/controllers/gasto.controller";
import { listarCategorias, listarProveedores } from "~/controllers/catalogo.controller";
import { usuariosActivos } from "~/controllers/usuario.controller";
import { solicitudAprobada } from "~/controllers/solicitud.controller";
import { hoyLaPaz } from "~/lib/fechas";
import { Aviso, Campo, Pagina } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  const sid = new URL(request.url).searchParams.get("solicitud");
  const sol = sid ? await solicitudAprobada(ctx, Number(sid)) : null;
  return jsonH({ categorias: await listarCategorias(ctx, true), proveedores: await listarProveedores(ctx, true), usuarios: await usuariosActivos(), solicitud: sol, hoy: hoyLaPaz(), yo: ctx.perfil.id_usuario }, ctx);
}
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  const r = await registrarGasto(ctx, await request.formData());
  if (r.ok && r.campos?.id && !r.aviso) throw redirect(`/app/gastos/${r.campos.id}`, { headers: ctx.headers });
  return jsonH(r, ctx, { status: r.error ? 400 : 200 });
}

export default function NuevoGasto() {
  const { categorias, proveedores, usuarios, solicitud: s, hoy, yo } = useLoaderData<typeof loader>() as any;
  const r = useActionData<typeof action>() as any;
  const ocupado = useNavigation().state !== "idle";
  const e = r?.campos ?? {};
  return (
    <Pagina titulo="Registrar gasto" subtitulo={s ? `Desde la solicitud aprobada #${s.id_solicitud}` : "Registra una compra realizada."}>
      <Aviso r={r} />
      <Form method="post" encType="multipart/form-data" className="panel" noValidate>
        {s && <input type="hidden" name="solicitud_id" value={s.id_solicitud} />}
        <div className="form-grid">
          <Campo label="Concepto" nombre="concepto" error={e.concepto}><input id="concepto" name="concepto" defaultValue={s?.concepto} required /></Campo>
          <Campo label="Categoría" nombre="categoria_id" error={e.categoria_id}><select id="categoria_id" name="categoria_id" defaultValue={s?.categoria_id ?? ""} required><option value="" disabled>Selecciona…</option>{categorias.map((c: any) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}{c.requiere_comprobante ? " · comprobante obligatorio" : ""}</option>)}</select></Campo>
          <Campo label="Proveedor" nombre="proveedor_id"><select id="proveedor_id" name="proveedor_id" defaultValue=""><option value="">Sin proveedor</option>{proveedores.map((p: any) => <option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre}</option>)}</select></Campo>
          <Campo label="Monto (Bs)" nombre="monto" error={e.monto}><input id="monto" name="monto" inputMode="decimal" defaultValue={s?.monto} required /></Campo>
          <Campo label="Fecha" nombre="fecha" error={e.fecha}><input id="fecha" type="date" name="fecha" max={hoy} defaultValue={hoy} /></Campo>
          {!s && <Campo label="Responsable" nombre="usuario_id"><select id="usuario_id" name="usuario_id" defaultValue={yo}>{usuarios.map((u: any) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>)}</select></Campo>}
          <Campo label="Estado inicial" nombre="estado" error={e.estado}><select id="estado" name="estado" defaultValue="aprobado"><option value="aprobado">Aprobado</option><option value="pendiente">Pendiente</option></select></Campo>
          <Campo label="Tipo de comprobante" nombre="tipo_comprobante"><select id="tipo_comprobante" name="tipo_comprobante" defaultValue=""><option value="">—</option><option>Factura</option><option>Recibo</option><option>Nota de venta</option></select></Campo>
          <Campo label="N.º de comprobante" nombre="numero_comprobante"><input id="numero_comprobante" name="numero_comprobante" maxLength={100} /></Campo>
        </div>
        <Campo label="Justificación" nombre="justificacion" error={e.justificacion}><textarea id="justificacion" name="justificacion" defaultValue={s?.justificacion ?? ""} /></Campo>
        <Campo label="Archivo del comprobante (PDF, JPG, PNG o WEBP · máx. 4 MB)" nombre="archivo" error={e.archivo}><input id="archivo" type="file" name="archivo" accept="application/pdf,image/jpeg,image/png,image/webp" /></Campo>
        <button className="btn verde" disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar gasto"}</button>
      </Form>
    </Pagina>
  );
}
