/**
 * Núcleo de Machine Learning del SGCGP (funciones puras, sin acceso a datos).
 *  - Predicción: regresión lineal por mínimos cuadrados (OLS) sobre totales mensuales.
 *  - Anomalías: z-score robusto (mediana + MAD, Iglewicz-Hoaglin) + reglas de negocio.
 *  - Evaluación: backtesting de origen móvil con MAE y RMSE (RNF-15).
 * Solo usa monto, fecha y categoría (RNF-17: nada de datos personales).
 */

export interface Prediccion {
  estimado: number; inferior: number; superior: number; confianza: number;
  metodo: "tendencia_lineal" | "promedio" | "sin_datos"; n: number;
}

const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const r2 = (x: number) => Math.round(x * 100) / 100;
const r4 = (x: number) => Math.round(x * 10000) / 10000;

export function mediana(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Ajuste y = a + b·x con x = 0..n-1. */
export function regresionOLS(y: number[]) {
  const n = y.length;
  const xm = (n - 1) / 2, ym = media(y);
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (i - xm) ** 2; sxy += (i - xm) * (y[i] - ym); }
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = ym - b * xm;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (y[i] - (a + b * i)) ** 2;
  const sigma = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
  return { a, b, sigma, xm, sxx };
}

/** Estima el siguiente valor de una serie mensual. */
export function predecirSiguiente(y: number[]): Prediccion {
  const n = y.length;
  if (n === 0) return { estimado: 0, inferior: 0, superior: 0, confianza: 0, metodo: "sin_datos", n };
  const m = media(y);
  let estimado: number, sigma: number, metodo: Prediccion["metodo"], factor = 1;
  if (n < 4) {
    estimado = m;
    sigma = Math.sqrt(y.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1));
    metodo = "promedio";
  } else {
    const { a, b, sigma: s, xm, sxx } = regresionOLS(y);
    estimado = a + b * n;
    sigma = s;
    factor = Math.sqrt(1 + 1 / n + (n - xm) ** 2 / (sxx || 1));
    metodo = "tendencia_lineal";
  }
  estimado = Math.max(0, estimado);
  const k = n < 10 ? 2.5 : 1.96; // aproximación a la t de Student con pocos datos
  const margen = k * sigma * factor;
  const cv = m > 0 ? sigma / m : 1;
  const confianza = Math.max(0, Math.min(1, (1 - Math.min(1, cv)) * (0.5 + 0.5 * Math.min(1, n / 12))));
  return {
    estimado: r2(estimado), inferior: r2(Math.max(0, estimado - margen)), superior: r2(estimado + margen),
    confianza: r4(confianza), metodo, n,
  };
}

/** Backtesting de origen móvil: entrena con y[0..i-1] y predice y[i]. */
export function evaluarModelo(y: number[]): { mae: number; rmse: number; n: number } | null {
  if (y.length < 6) return null; // se evalúa el modelo de tendencia (requiere ≥4 datos de entrenamiento)
  const errores: number[] = [];
  for (let i = 4; i < y.length; i++) errores.push(predecirSiguiente(y.slice(0, i)).estimado - y[i]);
  const mae = media(errores.map(Math.abs));
  const rmse = Math.sqrt(media(errores.map((e) => e * e)));
  return { mae: r2(mae), rmse: r2(rmse), n: errores.length };
}

/** z-score robusto unilateral (solo montos por encima de lo habitual). */
export function zRobusto(base: number[], x: number): number {
  if (base.length < 6) return 0;
  const med = mediana(base);
  if (x <= med) return 0;
  const mad = mediana(base.map((v) => Math.abs(v - med)));
  if (mad > 0) return (0.6745 * (x - med)) / mad;
  const dm = media(base.map((v) => Math.abs(v - med)));
  if (dm > 0) return (x - med) / (1.253314 * dm);
  return x > med ? 10 : 0; // todos iguales y este es mayor
}
/** Umbral clásico 3.5 → puntuación 0.5. */
export const puntuacionDeZ = (z: number) => r4(1 / (1 + Math.exp(-(z - 3.5))));

export type Nivel = "bajo" | "medio" | "alto" | "critico";
export function nivelDe(p: number): Nivel | null {
  if (p < 0.5) return null;
  if (p < 0.65) return "bajo";
  if (p < 0.8) return "medio";
  if (p < 0.92) return "alto";
  return "critico";
}

export interface GastoML { id_gasto: number; fecha: string; monto: number; categoria_id: number; proveedor_id: number | null; }
export interface Hallazgo { id_gasto: number; puntuacion: number; nivel: Nivel; motivo: string; }

/** Detecta gastos atípicos entre los candidatos usando el historial como base. */
export function detectarAnomalias(
  candidatos: GastoML[], historial: GastoML[], limitesDiarios: Record<number, number | null>
): Hallazgo[] {
  const porCat = new Map<number, number[]>();
  historial.forEach((g) => porCat.set(g.categoria_id, [...(porCat.get(g.categoria_id) ?? []), Number(g.monto)]));
  const out: Hallazgo[] = [];
  for (const g of candidatos) {
    const motivos: string[] = []; let mejor = 0;
    const base = porCat.get(g.categoria_id) ?? [];
    const z = zRobusto(base, Number(g.monto));
    if (z >= 3.5) {
      const p = puntuacionDeZ(z);
      mejor = Math.max(mejor, p);
      motivos.push(`Monto de Bs ${r2(Number(g.monto))} muy superior a lo habitual en su categoría (mediana Bs ${r2(mediana(base))}; z robusto ${r2(z)}).`);
    }
    const dup = historial.some((h) => h.id_gasto !== g.id_gasto && h.fecha === g.fecha && Number(h.monto) === Number(g.monto) && g.proveedor_id != null && h.proveedor_id === g.proveedor_id);
    if (dup) { mejor = Math.max(mejor, 0.7); motivos.push("Posible duplicado: mismo proveedor, monto y fecha que otro gasto."); }
    const lim = limitesDiarios[g.categoria_id];
    if (lim != null && lim > 0) {
      const dia = historial.filter((h) => h.categoria_id === g.categoria_id && h.fecha === g.fecha).reduce((s, h) => s + Number(h.monto), 0);
      if (dia > lim) { mejor = Math.max(mejor, 0.85); motivos.push(`El total diario de la categoría (Bs ${r2(dia)}) supera su límite diario (Bs ${r2(lim)}).`); }
    }
    const nivel = nivelDe(mejor);
    if (nivel) out.push({ id_gasto: g.id_gasto, puntuacion: r4(mejor), nivel, motivo: motivos.join(" ") });
  }
  return out;
}

/** Totales mensuales continuos (rellena meses vacíos con 0). Claves "YYYY-MM". */
export function serieMensual(gastos: { fecha: string; monto: number }[], hasta: string): { periodos: string[]; valores: number[] } {
  if (!gastos.length) return { periodos: [], valores: [] };
  const mapa = new Map<string, number>();
  for (const g of gastos) { const k = g.fecha.slice(0, 7); if (k <= hasta) mapa.set(k, (mapa.get(k) ?? 0) + Number(g.monto)); }
  if (!mapa.size) return { periodos: [], valores: [] };
  const claves = [...mapa.keys()].sort();
  let [a, m] = claves[0].split("-").map(Number);
  const periodos: string[] = [], valores: number[] = [];
  for (;;) {
    const k = `${a}-${String(m).padStart(2, "0")}`;
    if (k > hasta) break;
    periodos.push(k); valores.push(r2(mapa.get(k) ?? 0));
    m++; if (m > 12) { m = 1; a++; }
  }
  return { periodos, valores };
}
