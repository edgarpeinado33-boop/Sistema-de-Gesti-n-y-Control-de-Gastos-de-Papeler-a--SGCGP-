import type { LoaderFunctionArgs } from "@vercel/remix";
import { Form, NavLink, Outlet, useLoaderData, useLocation, useNavigation } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { esAdmin, esGestor, jsonH, requerirUsuario } from "~/lib/sesion.server";
import { ROL_ETIQUETA } from "~/lib/formato";
import { registrarManejadores } from "~/events/manejadores.server";
import { contarNoLeidas } from "~/controllers/notificacion.controller";
import { Icono, type NombreIcono } from "~/components/Icono";
import { Esqueleto, useTablasResponsivas } from "~/components/Carga";

export async function loader({ request }: LoaderFunctionArgs) {
  registrarManejadores();
  const ctx = await requerirUsuario(request);
  const { perfil } = ctx;
  return jsonH({ nombre: `${perfil.nombre} ${perfil.apellido}`, rol: perfil.rol, gestor: esGestor(perfil), admin: esAdmin(perfil), sinLeer: await contarNoLeidas(ctx) }, ctx);
}

interface Opcion { to: string; texto: string; icono: NombreIcono; fin?: boolean; solo?: "gestor" | "admin" }
const PRINCIPAL: Opcion[] = [
  { to: "/app", texto: "Panel de control", icono: "panel", fin: true },
  { to: "/app/solicitudes", texto: "Solicitudes", icono: "solicitudes" },
  { to: "/app/gastos", texto: "Gastos", icono: "gastos" },
  { to: "/app/notificaciones", texto: "Notificaciones", icono: "campana" },
];
const CONTROL: Opcion[] = [
  { to: "/app/presupuestos", texto: "Presupuestos", icono: "presupuesto", solo: "gestor" },
  { to: "/app/informes", texto: "Informes", icono: "informes", solo: "gestor" },
  { to: "/app/importar", texto: "Importar datos", icono: "importar", solo: "gestor" },
  { to: "/app/ml", texto: "Análisis inteligente", icono: "ml", solo: "gestor" },
  { to: "/app/auditoria", texto: "Auditoría", icono: "auditoria", solo: "gestor" },
];
const CATALOGOS: Opcion[] = [
  { to: "/app/categorias", texto: "Categorías", icono: "categorias", solo: "gestor" },
  { to: "/app/proveedores", texto: "Proveedores", icono: "proveedores", solo: "gestor" },
  { to: "/app/usuarios", texto: "Usuarios", icono: "usuarios", solo: "admin" },
];
const INFERIOR: Opcion[] = [PRINCIPAL[0], PRINCIPAL[1], PRINCIPAL[2]];

export default function LayoutApp() {
  const d = useLoaderData<typeof loader>();
  const nav = useNavigation(), loc = useLocation();
  const [abierto, setAbierto] = useState(false);
  const contenido = useRef<HTMLElement>(null);
  useTablasResponsivas(contenido);

  useEffect(() => setAbierto(false), [loc.pathname]); // cierra el menú al navegar
  useEffect(() => {
    document.body.style.overflow = abierto ? "hidden" : "";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [abierto]);

  // Mientras llega una página distinta se muestra un esqueleto (no al filtrar ni al enviar formularios en la misma página).
  const cambiandoDePagina = nav.state === "loading" && !!nav.location && nav.location.pathname !== loc.pathname;
  const visible = (o: Opcion) => !o.solo || (o.solo === "gestor" ? d.gestor : d.admin);
  const Enlace = ({ o }: { o: Opcion }) => (
    <NavLink to={o.to} end={o.fin} className={({ isActive }) => (isActive ? "activo" : "")}>
      <Icono n={o.icono} />{o.texto}
      {o.to === "/app/notificaciones" && d.sinLeer > 0 && <span className="insignia i-pendiente">{d.sinLeer}</span>}
    </NavLink>
  );
  const iniciales = d.nombre.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
  const control = CONTROL.filter(visible), catalogos = CATALOGOS.filter(visible);

  return (
    <div className="shell">
      <header className="barra-movil">
        <a className="marca" href="/app"><i aria-hidden="true" />SGCGP</a>
        <NavLink to="/app/notificaciones" className="icono-btn" aria-label={`Notificaciones${d.sinLeer ? `, ${d.sinLeer} sin leer` : ""}`}>
          <Icono n="campana" />{d.sinLeer > 0 && <span className="punto">{d.sinLeer > 9 ? "9+" : d.sinLeer}</span>}
        </NavLink>
      </header>
      <div className={`velo${abierto ? " abierto" : ""}`} onClick={() => setAbierto(false)} aria-hidden="true" />

      <aside id="menu-lateral" className={`lateral${abierto ? " abierto" : ""}`} aria-label="Menú principal">
        <div className="lateral-cab">
          <a className="marca" href="/app"><i aria-hidden="true" />SGCGP</a>
          <button className="btn-cerrar-menu" onClick={() => setAbierto(false)} aria-label="Cerrar menú"><Icono n="cerrar" /></button>
        </div>
        <nav>
          {PRINCIPAL.map((o) => <Enlace key={o.to} o={o} />)}
          {control.length > 0 && <div className="grupo">Control</div>}
          {control.map((o) => <Enlace key={o.to} o={o} />)}
          {catalogos.length > 0 && <div className="grupo">Administración</div>}
          {catalogos.map((o) => <Enlace key={o.to} o={o} />)}
        </nav>
        <div className="usuario">
          <div className="fila"><span className="avatar" aria-hidden="true">{iniciales}</span><div style={{ minWidth: 0 }}><strong>{d.nombre}</strong>{ROL_ETIQUETA[d.rol]}</div></div>
          <Form method="post" action="/logout"><button className="btn-salir"><Icono n="salir" tam={16} />Cerrar sesión</button></Form>
        </div>
      </aside>

      <main className="principal" id="contenido" ref={contenido} aria-busy={cambiandoDePagina}>
        {cambiandoDePagina ? <Esqueleto /> : <div className="contenido" key={loc.pathname}><Outlet /></div>}
      </main>

      <nav className="nav-inferior" aria-label="Acceso rápido">
        {INFERIOR.map((o) => (
          <NavLink key={o.to} to={o.to} end={o.fin} className={({ isActive }) => (isActive ? "activo" : "")}><Icono n={o.icono} />{o.texto.replace("Panel de control", "Panel")}</NavLink>
        ))}
        <button onClick={() => setAbierto(true)} aria-expanded={abierto} aria-controls="menu-lateral"><Icono n="menu" />Menú</button>
      </nav>
    </div>
  );
}