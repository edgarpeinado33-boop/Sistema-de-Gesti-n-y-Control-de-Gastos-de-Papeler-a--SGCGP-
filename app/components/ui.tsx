import type { ReactNode } from "react";
import type { Resultado } from "~/lib/errores";
import { bs } from "~/lib/formato";
import { Icono, type NombreIcono } from "./Icono";

export function Pagina({ titulo, subtitulo, acciones, children }: { titulo: string; subtitulo?: string; acciones?: ReactNode; children: ReactNode }) {
  return (
    <>
      <header className="cabecera"><div><h1>{titulo}</h1>{subtitulo && <p>{subtitulo}</p>}</div>{acciones && <div className="acciones">{acciones}</div>}</header>
      {children}
    </>
  );
}
export function Aviso({ r }: { r?: Resultado | null }) {
  if (!r) return null;
  return (
    <div role="status">
      {r.ok && <div className="aviso ok">{r.ok}</div>}
      {r.error && <div className="aviso error" role="alert">{r.error}</div>}
      {r.aviso && <div className="aviso ambar">{r.aviso}</div>}
    </div>
  );
}
export function Campo({ label, nombre, error, children }: { label: string; nombre: string; error?: string; children: ReactNode }) {
  return <div className="campo"><label htmlFor={nombre}>{label}</label>{children}{error && <div className="error-campo" id={`${nombre}-err`}>{error}</div>}</div>;
}
export const Insignia = ({ valor }: { valor: string }) => <span className={`insignia i-${valor}`}>{valor.replace("_", " ")}</span>;
export const Vacio = ({ texto }: { texto: string }) => <div className="vacio">{texto}</div>;

/** Indicador de ejecución presupuestaria con forma de regla de medir. */
export function Regla({ pct, etiqueta }: { pct: number; etiqueta?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className={`regla ${pct >= 80 ? "alto" : ""}`} role="img" aria-label={`Ejecución del presupuesto: ${pct}%`}>
      <div className="relleno" style={{ width: `${p}%` }} /><span>{etiqueta ?? `${pct}%`}</span>
    </div>
  );
}
export function Barras({ datos }: { datos: { nombre: string; valor: number }[] }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  return <>{datos.map((d) => <div className="barra" key={d.nombre}><span>{d.nombre}</span><div><i style={{ width: `${(d.valor / max) * 100}%` }} /></div><b className="num der">{bs(d.valor)}</b></div>)}</>;
}

/** Tarjeta de indicador con icono. */
export function Kpi({ icono, etiqueta, valor, tono = "" }: { icono: NombreIcono; etiqueta: string; valor: ReactNode; tono?: "" | "ambar" | "alerta" }) {
  return (
    <div className={`dato con-icono ${tono}`}>
      <span className="ico"><Icono n={icono} /></span>
      <div><small>{etiqueta}</small><b>{valor}</b></div>
    </div>
  );
}

/** Estructura de las pantallas de acceso: panel de marca (solo en pantallas grandes) + formulario. */
export function AuthShell({ titulo, subtitulo, children, pie }: { titulo: string; subtitulo?: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <main className="auth">
      <aside className="auth-marca" aria-hidden="true">
        <div className="logo"><i />SGCGP</div>
        <h2>Los gastos de papelería, bajo control.</h2>
        <p>Solicita, aprueba y registra compras con presupuesto, comprobantes y alertas inteligentes.</p>
        <ul>
          <li><Icono n="solicitudes" tam={18} />Solicitudes y aprobaciones</li>
          <li><Icono n="presupuesto" tam={18} />Control presupuestario mensual</li>
          <li><Icono n="ml" tam={18} />Predicciones y detección de anomalías</li>
        </ul>
      </aside>
      <section className="auth-form">
        <div className="panel auth-caja">
          <div className="logo logo-movil"><i />SGCGP</div>
          <h1>{titulo}</h1>
          {subtitulo && <p className="muted" style={{ marginTop: 4 }}>{subtitulo}</p>}
          {children}
          {pie && <p className="muted auth-pie">{pie}</p>}
        </div>
      </section>
    </main>
  );
}