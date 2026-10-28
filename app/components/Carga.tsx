import { useEffect } from "react";
import { useNavigation } from "@remix-run/react";

/** Barra superior que aparece mientras se navega, se envía un formulario o se cargan datos. */
export function BarraProgreso() {
  const activo = useNavigation().state !== "idle";
  return (
    <div className={`progreso${activo ? " activo" : ""}`} role="progressbar" aria-label="Cargando página" aria-hidden={!activo}>
      <i />
    </div>
  );
}

/** Pantalla inicial (primera carga). Se muestra en el HTML del servidor y se oculta al hidratarse la app. */
export function Splash() {
  return (
    <div id="splash" aria-hidden="true">
      <div className="splash-marca"><i />SGCGP</div>
      <div className="spinner" />
      <small>Cargando sistema…</small>
    </div>
  );
}
export function OcultarSplash() {
  useEffect(() => {
    const el = document.getElementById("splash");
    el?.classList.add("oculto");
    const t = setTimeout(() => el?.remove(), 600);
    return () => clearTimeout(t);
  }, []);
  return null;
}

/** Marcadores de posición que se muestran mientras llega la página siguiente. */
export function Esqueleto() {
  return (
    <div className="esqueleto" role="status" aria-live="polite">
      <span className="solo-lector">Cargando contenido…</span>
      <div className="esq" style={{ height: 34, width: "min(320px,70%)" }} />
      <div className="esq" style={{ height: 16, width: "min(460px,90%)", marginTop: 10 }} />
      <div className="rejilla rej-4" style={{ margin: "24px 0" }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="esq" style={{ height: 78, borderRadius: 14 }} />)}
      </div>
      <div className="panel">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="esq" style={{ height: 18, margin: "14px 0", width: `${96 - i * 9}%` }} />)}
      </div>
    </div>
  );
}

/**
 * En pantallas pequeñas convierte cada fila de tabla en una tarjeta: copia el texto de la
 * cabecera a cada celda (data-label). Observa cambios para cubrir filas nuevas tras filtrar o enviar formularios.
 */
export function useTablasResponsivas(raiz: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let pendiente = 0;
    const etiquetar = () => {
      el.querySelectorAll<HTMLTableElement>(".tabla-caja table").forEach((t) => {
        const cab = Array.from(t.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "");
        if (!cab.length) return;
        t.classList.add("tabla-movil");
        t.querySelectorAll("tbody tr").forEach((tr) => {
          let col = 0;
          Array.from(tr.children).forEach((td) => {
            if (!td.hasAttribute("data-label")) td.setAttribute("data-label", cab[col] ?? "");
            col += (td as HTMLTableCellElement).colSpan || 1;
          });
        });
      });
    };
    const programar = () => { cancelAnimationFrame(pendiente); pendiente = requestAnimationFrame(etiquetar); };
    etiquetar();
    const obs = new MutationObserver(programar);
    obs.observe(el, { childList: true, subtree: true });
    return () => { obs.disconnect(); cancelAnimationFrame(pendiente); };
  }, [raiz]);
}