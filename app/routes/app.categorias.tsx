import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { GESTORES, jsonH, requerirUsuario } from "~/lib/sesion.server";
import { guardarCategoria, listarCategorias } from "~/controllers/catalogo.controller";
import { Aviso, Insignia, Pagina } from "~/components/ui";
import { bs } from "~/lib/formato";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  const editar = Number(new URL(request.url).searchParams.get("editar")) || null;
  const lista: any[] = await listarCategorias(ctx);
  return jsonH({ lista, actual: lista.find((c) => c.id_categoria === editar) ?? null }, ctx);
}
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  return jsonH(await guardarCategoria(ctx, await request.formData()), ctx);
}

export default function Categorias() {
  const { lista, actual: c } = useLoaderData<typeof loader>() as any; const r = useActionData<typeof action>() as any;
  return (
    <Pagina titulo="Categorías de gasto" subtitulo="Reglas por categoría: comprobante, justificación y límite diario.">
      <Aviso r={r} />
      <Form method="post" className="panel" key={c?.id_categoria ?? "nueva"}>
        <h2>{c ? `Editar: ${c.nombre}` : "Nueva categoría"}</h2>
        {c && <input type="hidden" name="id" value={c.id_categoria} />}
        <div className="form-grid">
          <div className="campo"><label htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" defaultValue={c?.nombre} required />{r?.campos?.nombre && <div className="error-campo">{r.campos.nombre}</div>}</div>
          <div className="campo"><label htmlFor="limite_diario">Límite diario (Bs, opcional)</label><input id="limite_diario" name="limite_diario" inputMode="decimal" defaultValue={c?.limite_diario ?? ""} /></div>
        </div>
        <div className="campo"><label htmlFor="descripcion">Descripción</label><input id="descripcion" name="descripcion" defaultValue={c?.descripcion ?? ""} /></div>
        <div className="acciones" style={{ marginBottom: 12 }}>
          <label><input type="checkbox" name="requiere_comprobante" defaultChecked={c?.requiere_comprobante ?? true} />Requiere comprobante</label>
          <label><input type="checkbox" name="requiere_justificacion" defaultChecked={c?.requiere_justificacion ?? false} />Requiere justificación</label>
          {c && <label><input type="checkbox" name="estado" defaultChecked={c.estado} />Activa</label>}
        </div>
        <div className="acciones"><button className="btn verde">{c ? "Guardar cambios" : "Crear categoría"}</button>{c && <Link className="btn suave" to="/app/categorias">Cancelar</Link>}</div>
      </Form>
      <div className="panel tabla-caja"><table>
        <thead><tr><th>Categoría</th><th>Comprobante</th><th>Justificación</th><th className="der">Límite diario</th><th>Estado</th><th /></tr></thead>
        <tbody>{lista.map((x: any) => <tr key={x.id_categoria}><td><b>{x.nombre}</b><div className="muted">{x.descripcion}</div></td><td>{x.requiere_comprobante ? "Sí" : "No"}</td><td>{x.requiere_justificacion ? "Sí" : "No"}</td><td className="der num">{x.limite_diario != null ? bs(x.limite_diario) : "—"}</td><td><Insignia valor={x.estado ? "activo" : "anulado"} /></td><td><Link className="btn mini suave" to={`?editar=${x.id_categoria}`}>Editar</Link></td></tr>)}</tbody>
      </table></div>
    </Pagina>
  );
}
