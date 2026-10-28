import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { GESTORES, jsonH, requerirUsuario } from "~/lib/sesion.server";
import { guardarProveedor, listarProveedores } from "~/controllers/catalogo.controller";
import { Aviso, Insignia, Pagina } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  const editar = Number(new URL(request.url).searchParams.get("editar")) || null;
  const lista: any[] = await listarProveedores(ctx);
  return jsonH({ lista, actual: lista.find((p) => p.id_proveedor === editar) ?? null }, ctx);
}
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  return jsonH(await guardarProveedor(ctx, await request.formData()), ctx);
}

export default function Proveedores() {
  const { lista, actual: p } = useLoaderData<typeof loader>() as any; const r = useActionData<typeof action>() as any;
  const F = ({ n, l, d, t = "text" }: { n: string; l: string; d?: string; t?: string }) => <div className="campo"><label htmlFor={n}>{l}</label><input id={n} name={n} type={t} defaultValue={d ?? ""} /></div>;
  return (
    <Pagina titulo="Proveedores" subtitulo="Proveedores de productos de papelería.">
      <Aviso r={r} />
      <Form method="post" className="panel" key={p?.id_proveedor ?? "nuevo"}>
        <h2>{p ? `Editar: ${p.nombre}` : "Nuevo proveedor"}</h2>
        {p && <input type="hidden" name="id" value={p.id_proveedor} />}
        <div className="form-grid"><F n="nombre" l="Nombre" d={p?.nombre} /><F n="nit" l="NIT" d={p?.nit} /><F n="telefono" l="Teléfono" d={p?.telefono} /><F n="correo" l="Correo" d={p?.correo} t="email" /></div>
        <F n="direccion" l="Dirección" d={p?.direccion} />
        {p && <label><input type="checkbox" name="estado" defaultChecked={p.estado} />Activo</label>}
        <div className="acciones" style={{ marginTop: 12 }}><button className="btn verde">{p ? "Guardar cambios" : "Crear proveedor"}</button>{p && <Link className="btn suave" to="/app/proveedores">Cancelar</Link>}</div>
      </Form>
      <div className="panel tabla-caja"><table>
        <thead><tr><th>Nombre</th><th>NIT</th><th>Contacto</th><th>Estado</th><th /></tr></thead>
        <tbody>{lista.map((x: any) => <tr key={x.id_proveedor}><td><b>{x.nombre}</b><div className="muted">{x.direccion}</div></td><td>{x.nit ?? "—"}</td><td>{[x.telefono, x.correo].filter(Boolean).join(" · ") || "—"}</td><td><Insignia valor={x.estado ? "activo" : "anulado"} /></td><td><Link className="btn mini suave" to={`?editar=${x.id_proveedor}`}>Editar</Link></td></tr>)}</tbody>
      </table></div>
    </Pagina>
  );
}
