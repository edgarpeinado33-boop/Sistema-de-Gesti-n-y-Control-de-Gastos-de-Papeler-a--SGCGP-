import Papa from "papaparse";
import ExcelJS from "exceljs";
import { fallo, mensajeError, type Resultado } from "~/lib/errores";
import { monto, str } from "~/lib/formato";
import { hoyLaPaz, nombrePeriodo } from "~/lib/fechas";
import { emitir } from "~/events/bus.server";
import { registrarManejadores } from "~/events/manejadores.server";
import { aCSV, aPDF, aXLSX, type Tabla } from "~/services/exportar.server";
import { listarGastos, type FiltrosGasto } from "./gasto.controller";
import * as Reportes from "~/models/reportes.server";
import * as Presupuestos from "~/models/presupuesto.server";
import * as Catalogo from "~/models/catalogo.server";
import * as Gastos from "~/models/gastos.server";
import type { Contexto } from "~/lib/sesion.server";

/** RF-15 */
export async function datosInformes(ctx: Contexto) {
  const [resumen, ejec, gastos] = await Promise.all([Reportes.resumenPorCategoria(ctx.supabase), Presupuestos.ultimos(ctx.supabase, 12), listarGastos(ctx, { estado: "aprobado" }, 2000)]);
  const prov = new Map<string, { total: number; n: number }>();
  const mensual = new Map<string, number>();
  for (const g of gastos) {
    const p = g.proveedor?.nombre ?? "Sin proveedor";
    prov.set(p, { total: (prov.get(p)?.total ?? 0) + Number(g.monto), n: (prov.get(p)?.n ?? 0) + 1 });
    const k = g.fecha.slice(0, 7); mensual.set(k, (mensual.get(k) ?? 0) + Number(g.monto));
  }
  return {
    porCategoria: resumen, ejecucion: ejec,
    porProveedor: [...prov.entries()].map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.total - a.total),
    mensual: [...mensual.entries()].sort().map(([periodo, total]) => ({ periodo, total })),
  };
}

/** RF-17: arma la tabla solicitada y la exporta; deja constancia en exportaciones_SGCGP. */
export async function exportar(ctx: Contexto, url: URL): Promise<Response> {
  const formato = (url.searchParams.get("formato") ?? "csv").toLowerCase();
  const tipo = url.searchParams.get("tipo") ?? "gastos";
  if (!["csv", "xlsx", "pdf"].includes(formato)) return new Response("Formato inválido", { status: 400 });
  let tabla: Tabla;
  const filtros: FiltrosGasto = Object.fromEntries(["q", "desde", "hasta", "categoria", "proveedor", "estado", "responsable"].map((k) => [k, url.searchParams.get(k) ?? undefined]).filter(([, v]) => v));
  if (tipo === "resumen") {
    const data = await Reportes.resumenPorCategoria(ctx.supabase);
    tabla = { titulo: "Resumen por categoria", columnas: ["Categoría", "Gastos aprobados", "Total aprobado", "Total pendiente", "Total rechazado"], filas: data.map((r: any) => [r.categoria, r.cantidad_gastos_aprobados, Number(r.total_aprobado), Number(r.total_pendiente), Number(r.total_rechazado)]) };
  } else if (tipo === "presupuesto") {
    const data = await Presupuestos.listar(ctx.supabase);
    tabla = { titulo: "Ejecucion presupuestaria", columnas: ["Periodo", "Límite", "Utilizado", "Saldo", "% ejecución"], filas: data.map((r: any) => [nombrePeriodo(r.mes, r.anio), Number(r.monto_limite), Number(r.monto_utilizado), Number(r.saldo_disponible), Number(r.porcentaje_utilizado)]) };
  } else {
    const g = await listarGastos(ctx, filtros, 5000);
    tabla = { titulo: "Gastos de papeleria", columnas: ["ID", "Fecha", "Concepto", "Categoría", "Proveedor", "Responsable", "Monto (Bs)", "Estado"], filas: g.map((x: any) => [x.id_gasto, x.fecha, x.concepto, x.categoria?.nombre ?? "", x.proveedor?.nombre ?? "", x.responsable, Number(x.monto), x.estado]) };
  }
  const nombre = `sgcgp_${tipo}_${hoyLaPaz()}.${formato}`;
  await Reportes.registrarExportacion(ctx.supabase, { usuario_id: ctx.perfil.id_usuario, nombre_archivo: nombre, formato, filtros, estado: "completada", finalizada_en: new Date().toISOString() });
  const tipos: Record<string, string> = { csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" };
  const cuerpo: BodyInit = formato === "csv" ? aCSV(tabla) : new Blob([(formato === "xlsx" ? await aXLSX(tabla) : await aPDF(tabla)) as BlobPart], { type: tipos[formato] });
  const h = new Headers({ "Content-Type": tipos[formato], "Content-Disposition": `attachment; filename="${nombre}"` });
  ctx.headers.forEach((v, k) => h.append(k, v));
  return new Response(cuerpo, { headers: h });
}

// ---------------- RF-16: importación ----------------
const MAX_FILAS = 500;
function normaliza(s: unknown) { return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }
function fechaISO(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v)) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

export async function importarGastos(ctx: Contexto, f: FormData): Promise<Resultado> {
  registrarManejadores();
  const file = f.get("archivo"), estado = str(f.get("estado")) === "aprobado" ? "aprobado" : "pendiente";
  if (!(file instanceof File) || !file.size) return fallo("Selecciona un archivo CSV o Excel.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["csv", "xlsx"].includes(ext)) return fallo("Formato no permitido. Usa .csv o .xlsx.");
  if (file.size > 4 * 1024 * 1024) return fallo("El archivo supera el máximo de 4 MB.");

  let filas: Record<string, unknown>[] = [];
  try {
    if (ext === "csv") {
      const r = Papa.parse<Record<string, unknown>>(await file.text(), { header: true, skipEmptyLines: true, transformHeader: normaliza });
      filas = r.data;
    } else {
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0]; const cab: string[] = [];
      ws?.getRow(1).eachCell((c, i) => (cab[i] = normaliza(c.value)));
      ws?.eachRow((row, n) => { if (n === 1) return; const o: Record<string, unknown> = {}; cab.forEach((h, i) => { const v: any = row.getCell(i).value; o[h] = v && typeof v === "object" && !(v instanceof Date) && "text" in v ? v.text : v; }); filas.push(o); });
    }
  } catch { return fallo("No se pudo leer el archivo. Verifica que no esté dañado."); }
  if (!filas.length) return fallo("El archivo no contiene registros.");
  if (filas.length > MAX_FILAS) return fallo(`El archivo supera el máximo de ${MAX_FILAS} filas.`);

  const impId = await Reportes.crearImportacion(ctx.supabase, { usuario_id: ctx.perfil.id_usuario, nombre_archivo: file.name.slice(0, 255), formato: ext, total_registros: filas.length, estado: "procesando" });
  const [cats, provs] = await Promise.all([Catalogo.listarCategorias(ctx.supabase, true), Catalogo.listarProveedores(ctx.supabase)]);
  const mc = new Map(cats.map((c: any) => [normaliza(c.nombre), c.id_categoria]));
  const mp = new Map(provs.map((p: any) => [normaliza(p.nombre), p.id_proveedor]));

  const validas: any[] = []; const errores: { fila: number; error: string }[] = [];
  filas.forEach((r, i) => {
    const n = i + 2; const concepto = String(r.concepto ?? "").trim(); const m = monto(String(r.monto ?? "")); const fecha = fechaISO(r.fecha);
    const cat = mc.get(normaliza(r.categoria)); const provTxt = normaliza(r.proveedor); const prov = provTxt ? mp.get(provTxt) : null;
    if (concepto.length < 3) return errores.push({ fila: n, error: "Concepto vacío o muy corto." });
    if (m === null || m <= 0) return errores.push({ fila: n, error: "Monto inválido." });
    if (!fecha || fecha > hoyLaPaz()) return errores.push({ fila: n, error: "Fecha inválida o futura." });
    if (!cat) return errores.push({ fila: n, error: `Categoría no encontrada: "${r.categoria ?? ""}".` });
    if (provTxt && !prov) return errores.push({ fila: n, error: `Proveedor no encontrado: "${r.proveedor}".` });
    validas.push({ concepto: concepto.slice(0, 250), categoria_id: cat, proveedor_id: prov ?? null, usuario_id: ctx.perfil.id_usuario, monto: m, fecha, justificacion: String(r.justificacion ?? "").trim() || null, estado, registrado_por: ctx.perfil.id_usuario });
  });

  let insertados = 0;
  if (validas.length) {
    const error = await Gastos.insertarLote(ctx.supabase, validas);
    if (error) {
      if (impId) await Reportes.cerrarImportacion(ctx.supabase, impId, { estado: "fallida", errores: [{ fila: 0, error: mensajeError(error) }], finalizada_en: new Date().toISOString() });
      return fallo("No se pudo guardar la importación: " + mensajeError(error));
    }
    insertados = validas.length;
    await emitir({ tipo: "GastoRegistrado", gastoId: 0, fecha: validas[0].fecha });
  }
  if (impId) await Reportes.cerrarImportacion(ctx.supabase, impId, { estado: "completada", registros_correctos: insertados, registros_erroneos: errores.length, errores, finalizada_en: new Date().toISOString() });
  return { ok: `Importación finalizada: ${insertados} registros correctos y ${errores.length} con errores.`, aviso: errores.length ? errores.slice(0, 10).map((e) => `Fila ${e.fila}: ${e.error}`).join(" · ") : undefined };
}

export const historialImportaciones = (ctx: Contexto) => Reportes.importaciones(ctx.supabase);
