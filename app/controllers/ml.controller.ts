import { fallo, mensajeError, type Resultado } from "~/lib/errores";
import { int, str } from "~/lib/formato";
import { mesAnioActual, nombrePeriodo, primerDia, sumarMeses } from "~/lib/fechas";
import { ejecutarAnalisis } from "~/services/ml.server";
import { serieMensual } from "~/services/ml.core";
import type { Contexto } from "~/lib/sesion.server";
import * as Analitica from "~/models/analitica.server";
import * as Gastos from "~/models/gastos.server";

/** RF-19 a RF-23: datos para el panel de análisis inteligente. */
export async function cargarAnalisis(ctx: Contexto) {
  const { mes, anio } = mesAnioActual(), sig = sumarMeses(mes, anio, 1), prev = sumarMeses(mes, anio, -1);
  const hasta = `${prev.anio}-${String(prev.mes).padStart(2, "0")}`;
  const db = ctx.supabase;
  const [modelo, predicciones, anomalias, recomendaciones, gastos, cats] = await Promise.all([
    Analitica.modeloActivo(db), Analitica.prediccionesDelPeriodo(db, primerDia(sig.mes, sig.anio)), Analitica.anomalias(db),
    Analitica.recomendaciones(db), Gastos.aprobadosRecientes(db), Analitica.nombresCategorias(db),
  ]);
  // RF-21: patrones de consumo (últimos meses cerrados)
  const patrones = cats.map((c) => {
    const s = serieMensual(gastos.filter((x) => x.categoria_id === c.id_categoria), hasta).valores.slice(-6);
    const total = s.reduce((a, b) => a + b, 0), ult = s[s.length - 1] ?? 0, ant = s.length > 1 ? s.slice(0, -1).reduce((a, b) => a + b, 0) / (s.length - 1) : 0;
    return { nombre: c.nombre, total, meses: s.length, variacion: ant > 0 ? Math.round((ult / ant - 1) * 100) : null };
  }).filter((p) => p.total > 0).sort((a, b) => b.total - a.total);
  return { modelo, predicciones, anomalias, recomendaciones, patrones, periodo: nombrePeriodo(sig.mes, sig.anio) };
}

export async function ejecutarYResumir(ctx: Contexto): Promise<Resultado> {
  try {
    const s = await ejecutarAnalisis(ctx.perfil.id_usuario);
    return { ok: `Análisis de ${s.periodo} completado: ${s.predicciones} predicciones, ${s.anomalias} anomalías nuevas y ${s.recomendaciones} recomendaciones nuevas.`, aviso: s.mesesHistorial < 4 ? `Solo hay ${s.mesesHistorial} meses de historial aprobado: las predicciones usan el promedio y son poco fiables.` : undefined };
  } catch (e) { console.error(e); return fallo("No se pudo completar el análisis. Revisa la configuración del servidor."); }
}

/** RF-24: registra la revisión humana de una anomalía o recomendación. */
export async function revisarResultado(ctx: Contexto, f: FormData): Promise<Resultado> {
  const intent = str(f.get("intent")), id = int(f.get("id")), estado = str(f.get("estado")), anom = intent === "anomalia";
  const validos = anom ? ["confirmada", "descartada", "revisada"] : ["aceptada", "rechazada", "aplicada"];
  if (!id || !validos.includes(estado)) return fallo("Datos inválidos.");
  const error = anom
    ? await Analitica.revisarAnomalia(ctx.supabase, id, { estado_revision: estado, revisado_por: ctx.perfil.id_usuario, revisado_en: new Date().toISOString() })
    : await Analitica.revisarRecomendacion(ctx.supabase, id, { estado, revisada_por: ctx.perfil.id_usuario, revisada_en: new Date().toISOString() });
  return error ? fallo(mensajeError(error)) : { ok: "Revisión registrada." };
}
