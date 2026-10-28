import { clienteAdmin } from "~/lib/supabase.server";
import { hoyLaPaz, mesAnioActual, primerDia, sumarMeses, ultimoDia, nombrePeriodo } from "~/lib/fechas";
import { bs } from "~/lib/formato";
import { emitir } from "~/events/bus.server";
import * as Gastos from "~/models/gastos.server";
import * as Analitica from "~/models/analitica.server";
import * as Presupuestos from "~/models/presupuesto.server";
import * as Catalogo from "~/models/catalogo.server";
import { registrarManejadores } from "~/events/manejadores.server";
import { detectarAnomalias, evaluarModelo, mediana, predecirSiguiente, serieMensual, type GastoML } from "./ml.core";

const MODELO = {
  nombre: "SGCGP-Tendencia-Anomalias", version: "v1.0",
  algoritmo: "Regresión lineal OLS + z-score robusto (MAD) + reglas de negocio",
  descripcion: "Predice el gasto mensual por categoría, detecta gastos atípicos y propone recomendaciones de ahorro. Solo usa monto, fecha, categoría y proveedor.",
};

async function asegurarModelo(metricas: Record<string, unknown>, creadoPor: number) {
  return Analitica.upsertModelo(clienteAdmin(), { ...MODELO, metricas, estado: "activo", fecha_entrenamiento: new Date().toISOString(), creado_por: creadoPor });
}

export interface ResumenAnalisis {
  periodo: string; predicciones: number; anomalias: number; recomendaciones: number;
  metricas: { mae: number; rmse: number; n: number } | null; mesesHistorial: number;
}

/** Ejecuta el análisis completo. Debe llamarse solo desde un controlador que ya verificó el rol de gestor. */
export async function ejecutarAnalisis(creadoPor: number): Promise<ResumenAnalisis> {
  registrarManejadores();
  const admin = clienteAdmin();
  const { mes: mesAct, anio: anioAct } = mesAnioActual();
  const hoy = hoyLaPaz();
  const prev = sumarMeses(mesAct, anioAct, -1);
  const hasta = `${prev.anio}-${String(prev.mes).padStart(2, "0")}`; // solo meses cerrados
  const sig = sumarMeses(mesAct, anioAct, 1);

  const gastosRaw = await Gastos.todosParaML(admin);
  const cats = await Analitica.categoriasActivas(admin);
  const gastos = (gastosRaw as any[]).map((g) => ({ ...g, monto: Number(g.monto) })) as (GastoML & { estado: string })[];
  const aprobados = gastos.filter((g) => g.estado === "aprobado");
  const categorias = cats;

  // ---- Predicción por categoría y global (RF-19) ----
  const global = serieMensual(aprobados, hasta);
  const metricas = evaluarModelo(global.valores);
  const idModelo = await asegurarModelo(
    { mae: metricas?.mae ?? null, rmse: metricas?.rmse ?? null, pruebas: metricas?.n ?? 0, meses_historial: global.valores.length, entrenado_hasta: hasta },
    creadoPor
  );
  const inicio = primerDia(sig.mes, sig.anio), fin = ultimoDia(sig.mes, sig.anio);
  const filas: any[] = [];
  const porCat: Record<number, ReturnType<typeof predecirSiguiente>> = {};
  for (const c of categorias) {
    const s = serieMensual(aprobados.filter((g) => g.categoria_id === c.id_categoria), hasta);
    if (s.valores.length < 2) continue;
    const p = predecirSiguiente(s.valores);
    porCat[c.id_categoria] = p;
    filas.push({ id_modelo: idModelo, id_categoria: c.id_categoria, periodo_inicio: inicio, periodo_fin: fin, monto_estimado: p.estimado, limite_inferior: p.inferior, limite_superior: p.superior, confianza: p.confianza, observaciones: `Método: ${p.metodo}; ${p.n} meses de historial.` });
  }
  const pg = predecirSiguiente(global.valores);
  if (pg.metodo !== "sin_datos") {
    filas.push({ id_modelo: idModelo, id_categoria: null, periodo_inicio: inicio, periodo_fin: fin, monto_estimado: pg.estimado, limite_inferior: pg.inferior, limite_superior: pg.superior, confianza: pg.confianza, observaciones: `Total general. Método: ${pg.metodo}; ${pg.n} meses de historial. Es una estimación, no un compromiso de gasto.` });
  }
  await Analitica.reemplazarPredicciones(admin, idModelo, inicio, filas);

  // ---- Alerta de posible exceso presupuestario (RF-22) ----
  const pres = await Presupuestos.delMes(admin, sig.mes, sig.anio);
  const limite = pres ? Number(pres.monto_limite) : null;
  if (limite && pg.estimado > limite) {
    await emitir({ tipo: "PresupuestoEnAlerta", mes: sig.mes, anio: sig.anio, porcentaje: Math.round((pg.estimado / limite) * 100), umbral: 100 });
  }

  // ---- Anomalías (RF-20) ----
  const desde = new Date(hoy + "T12:00:00"); desde.setDate(desde.getDate() - 90);
  const desdeISO = desde.toISOString().slice(0, 10);
  const marcadas = await Analitica.idsGastosMarcados(admin, idModelo);
  const candidatos = gastos.filter((g) => g.fecha >= desdeISO && !marcadas.has(g.id_gasto));
  const limites: Record<number, number | null> = {};
  categorias.forEach((c) => (limites[c.id_categoria] = c.limite_diario == null ? null : Number(c.limite_diario)));
  const hallazgos = detectarAnomalias(candidatos, gastos, limites);
  if (hallazgos.length) {
    await Analitica.insertarAnomalias(admin, hallazgos.map((h) => ({ id_gasto: h.id_gasto, id_modelo: idModelo, puntuacion: h.puntuacion, nivel: h.nivel, motivo: h.motivo })));
    for (const h of hallazgos.filter((x) => x.nivel === "alto" || x.nivel === "critico")) await emitir({ tipo: "AnomaliaDetectada", gastoId: h.id_gasto, nivel: h.nivel, motivo: h.motivo });
  }

  // ---- Recomendaciones (RF-23) ----
  const recs: any[] = [];
  const nombreCat = (id: number) => categorias.find((c) => c.id_categoria === id)?.nombre ?? "Categoría";
  for (const c of categorias) {
    const s = serieMensual(aprobados.filter((g) => g.categoria_id === c.id_categoria), hasta).valores;
    if (s.length >= 4) {
      const ultimo = s[s.length - 1], base = mediana(s.slice(0, -1));
      if (base > 0 && ultimo > base * 1.25) {
        recs.push({ id_categoria: c.id_categoria, tipo: "consumo", titulo: `Consumo en alza: ${c.nombre}`, descripcion: `El último mes cerrado (${bs(ultimo)}) superó en ${Math.round((ultimo / base - 1) * 100)}% la mediana histórica (${bs(base)}). Revisa si hay compras evitables o consolida pedidos.`, ahorro_estimado: Math.round((ultimo - base) * 100) / 100 });
      }
    }
  }
  const porProv = new Map<number, number>(); let totalProv = 0;
  aprobados.filter((g) => g.fecha >= desdeISO && g.proveedor_id).forEach((g) => { porProv.set(g.proveedor_id!, (porProv.get(g.proveedor_id!) ?? 0) + g.monto); totalProv += g.monto; });
  const [topProv, topMonto] = [...porProv.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (topProv && totalProv > 0 && topMonto / totalProv > 0.6 && porProv.size >= 1) {
    const nombreProv = await Catalogo.nombreProveedor(admin, topProv);
    recs.push({ id_categoria: null, tipo: "compra", titulo: "Alta concentración en un proveedor", descripcion: `${nombreProv ?? "Un proveedor"} concentra el ${Math.round((topMonto / totalProv) * 100)}% del gasto de los últimos 90 días. Cotiza con otros proveedores para negociar precios.`, ahorro_estimado: Math.round(topMonto * 0.05 * 100) / 100 });
  }
  if (limite && pg.estimado > limite) {
    recs.push({ id_categoria: null, tipo: "presupuesto", titulo: `Riesgo de exceder el presupuesto de ${nombrePeriodo(sig.mes, sig.anio)}`, descripcion: `La estimación (${bs(pg.estimado)}, rango ${bs(pg.inferior)}–${bs(pg.superior)}) supera el límite de ${bs(limite)}. Prioriza compras esenciales o solicita un ajuste del presupuesto.`, ahorro_estimado: Math.round((pg.estimado - limite) * 100) / 100 });
  }
  const mayor = Object.entries(porCat).sort((a, b) => b[1].estimado - a[1].estimado)[0];
  if (mayor && pg.estimado > 0 && mayor[1].estimado / pg.estimado > 0.5) {
    recs.push({ id_categoria: Number(mayor[0]), tipo: "ahorro", titulo: `Oportunidad de ahorro en ${nombreCat(Number(mayor[0]))}`, descripcion: `Esta categoría concentra más de la mitad del gasto estimado (${bs(mayor[1].estimado)}). Un 10% de optimización equivaldría a ${bs(mayor[1].estimado * 0.1)}.`, ahorro_estimado: Math.round(mayor[1].estimado * 10) / 100 });
  }
  let nuevasRecs = 0;
  for (const r of recs) {
    if (await Analitica.existePendiente(admin, r.titulo)) continue;
    const error = await Analitica.insertarRecomendacion(admin, { ...r, id_modelo: idModelo });
    if (!error) nuevasRecs++;
  }

  return { periodo: nombrePeriodo(sig.mes, sig.anio), predicciones: filas.length, anomalias: hallazgos.length, recomendaciones: nuevasRecs, metricas, mesesHistorial: global.valores.length };
}
