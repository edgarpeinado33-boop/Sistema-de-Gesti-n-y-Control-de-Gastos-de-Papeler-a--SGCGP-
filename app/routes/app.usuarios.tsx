import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { jsonH, requerirUsuario } from "~/lib/sesion.server";
import { actualizarUsuario, crearUsuario, listarUsuarios } from "~/controllers/usuario.controller";
import { str, ROL_ETIQUETA } from "~/lib/formato";
import { formatoFecha } from "~/lib/fechas";
import { Aviso, Insignia, Pagina } from "~/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request, ["administrador"]);
  return jsonH({ usuarios: await listarUsuarios(ctx), yo: ctx.perfil.id_usuario }, ctx);
}
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requerirUsuario(request, ["administrador"]);
  const f = await request.formData();
  return jsonH(str(f.get("intent")) === "crear" ? await crearUsuario(ctx, f) : await actualizarUsuario(ctx, f), ctx);
}

export default function Usuarios() {
  const { usuarios, yo } = useLoaderData<typeof loader>() as any; const r = useActionData<typeof action>() as any;
  const e = r?.campos ?? {};
  return (
    <Pagina titulo="Usuarios y roles" subtitulo="Solo el administrador gestiona cuentas y permisos.">
      <Aviso r={r} />
      <Form method="post" className="panel" key={r?.ok ?? "f"}>
        <h2>Registrar usuario</h2><input type="hidden" name="intent" value="crear" />
        <div className="form-grid">
          {[["nombre", "Nombre"], ["apellido", "Apellido"], ["correo", "Correo"], ["password", "Contraseña inicial"]].map(([n, l]) => <div className="campo" key={n}><label htmlFor={n}>{l}</label><input id={n} name={n} type={n === "password" ? "password" : n === "correo" ? "email" : "text"} required />{e[n] && <div className="error-campo">{e[n]}</div>}</div>)}
          <div className="campo"><label htmlFor="rol">Rol</label><select id="rol" name="rol" defaultValue="solicitante">{Object.entries(ROL_ETIQUETA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <button className="btn verde">Crear usuario</button>
      </Form>
      <div className="panel tabla-caja"><table>
        <thead><tr><th>Usuario</th><th>Correo</th><th>Alta</th><th>Rol</th><th>Estado</th><th /></tr></thead>
        <tbody>{usuarios.map((u: any) => (
          <tr key={u.id_usuario}><td>{u.nombre} {u.apellido}{u.id_usuario === yo && <span className="muted"> (tú)</span>}</td><td>{u.correo}</td><td>{formatoFecha(u.created_at)}</td>
            <td colSpan={3}><Form method="post" className="acciones">
              <input type="hidden" name="id" value={u.id_usuario} />
              <select name="rol" defaultValue={u.rol} aria-label="Rol" style={{ width: "auto" }}>{Object.entries(ROL_ETIQUETA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <select name="estado" defaultValue={String(u.estado)} aria-label="Estado" style={{ width: "auto" }}><option value="true">Activo</option><option value="false">Desactivado</option></select>
              <Insignia valor={u.estado ? "activo" : "anulado"} /><button className="btn mini">Guardar</button></Form></td></tr>))}</tbody>
      </table></div>
    </Pagina>
  );
}
