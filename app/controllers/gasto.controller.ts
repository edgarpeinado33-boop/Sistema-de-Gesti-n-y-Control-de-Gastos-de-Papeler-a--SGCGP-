import { MAX_ARCHIVO_BYTES, MIMES_PERMITIDOS } from "~/lib/tablas";
import { fallo, mensajeError, type Resultado } from "~/lib/errores";
import { int, monto, str } from "~/lib/formato";
import { hoyLaPaz } from "~/lib/fechas";
import { emitir } from "~/events/bus.server";
import { registrarManejadores } from "~/events/manejadores.server";
import { esAdmin, esGestor, type Contexto } from "~/lib/sesion.server";
import * as Gastos from "~/models/gastos.server";
import * as Catalogo from "~/models/catalogo.server";
import * as Solicitudes from "~/models/solicitudes.server";
import { directorio } from "~/models/usuarios.server";
import { listarHistorial } from "./auditoria.controller";

export type { FiltrosGasto } from "~/models/gastos.server";
import type { FiltrosGasto } from "~/models/gastos.server";

/** RF-14: búsqueda y filtrado. RLS limita al solicitante a sus propios gastos. */
export async function listarGastos(ctx: Contexto, f: FiltrosGasto, limite = 300) {
  const filas = await Gastos.consultar(ctx.supabase, f, limite);
  const nombres = await directorio(filas.map((g) => g.usuario_id));
  return filas.map((g) => ({ ...g, responsable: nombres[g.usuario_id] ?? "—" }));
}

export async function obtenerGasto(ctx: Contexto, id: number) {
  const g = await Gastos.obtener(ctx.supabase, id);
  if (!g) return null;
  const nombres = await directorio([g.usuario_id, g.registrado_por]);
  const lista = await Gastos.comprobantesDe(ctx.supabase, id);
  const firmadas = await Gastos.urlsFirmadas(ctx.supabase, lista.map((c) => c.ruta_storage));
  return { ...g, responsable: nombres[g.usuario_id] ?? "—", registrador: nombres[g.registrado_por] ?? "—", comprobantes: lista.map((c) => ({ ...c, url: firmadas[c.ruta_storage] ?? null })) };
}

/** Detalle + historial (el historial solo lo ven los gestores). */
export async function detalleGasto(ctx: Contexto, id: number) {
  const gasto = await obtenerGasto(ctx, id);
  if (!gasto) return null;
  const gestor = esGestor(ctx.perfil);
  return { gasto, gestor, admin: esAdmin(ctx.perfil), historial: gestor ? await listarHistorial(ctx, { gastoId: id }) : [] };
}

/** RNF-12: valida tipo MIME, tamaño y extensión antes de almacenar. */
export function validarArchivo(file: FormDataEntryValue | null): { archivo?: File; error?: string } {
  if (!(file instanceof File) || file.size === 0) return {};
  if (!MIMES_PERMITIDOS.includes(file.type)) return { error: "Formato no permitido. Usa PDF, JPG, PNG o WEBP." };
  if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) return { error: "La extensión del archivo no es válida." };
  if (file.size > MAX_ARCHIVO_BYTES) return { error: "El archivo supera el máximo de 4 MB." };
  return { archivo: file };
}

async function subirArchivo(ctx: Contexto, archivo: File) {
  const limpio = archivo.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const ruta = `${ctx.perfil.auth_user_id}/${Date.now()}-${limpio}`; // la política exige la carpeta <auth.uid()>
  const error = await Gastos.subirArchivo(ctx.supabase, ruta, await archivo.arrayBuffer(), archivo.type);
  return { ruta, error };
}
const registrarComprobante = (ctx: Contexto, gastoId: number, archivo: File, ruta: string) =>
  Gastos.insertarComprobante(ctx.supabase, { gasto_id: gastoId, nombre_archivo: archivo.name.slice(0, 255), tipo_archivo: archivo.type, tamano_bytes: archivo.size, ruta_storage: ruta, subido_por: ctx.perfil.id_usuario });

/** RF-09 + RF-10: registra un gasto aplicando las reglas de la categoría. Solo gestores (política RLS). */
export async function registrarGasto(ctx: Contexto, f: FormData): Promise<Resultado> {
  registrarManejadores();
  if (!esGestor(ctx.perfil)) return fallo("No tienes permisos para registrar gastos.");
  const concepto = str(f.get("concepto")), justificacion = str(f.get("justificacion"));
  const categoria_id = int(f.get("categoria_id")), proveedor_id = int(f.get("proveedor_id")), m = monto(f.get("monto"));
  const fecha = str(f.get("fecha")) || hoyLaPaz(), estado = str(f.get("estado")) || "aprobado";
  const solicitud_id = int(f.get("solicitud_id"));
  const responsable = int(f.get("usuario_id")) ?? ctx.perfil.id_usuario;
  const campos: Record<string, string> = {};
  if (concepto.length < 3) campos.concepto = "Describe el concepto.";
  if (!categoria_id) campos.categoria_id = "Selecciona una categoría.";
  if (m === null || m <= 0) campos.monto = "El monto debe ser mayor a 0.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoyLaPaz()) campos.fecha = "Fecha inválida (no puede ser futura).";
  if (!["aprobado", "pendiente"].includes(estado)) campos.estado = "Estado inválido.";
  const { archivo, error: errArchivo } = validarArchivo(f.get("archivo"));
  if (errArchivo) campos.archivo = errArchivo;
  if (Object.keys(campos).length) return fallo("Revisa los datos del formulario.", campos);

  const c = await Catalogo.obtenerCategoria(ctx.supabase, categoria_id!);
  if (!c || !c.estado) return fallo("La categoría no está disponible.", { categoria_id: "Categoría inválida." });
  if (c.requiere_justificacion && justificacion.length < 10) return fallo("Esta categoría exige una justificación.", { justificacion: "Escribe una justificación (mínimo 10 caracteres)." });
  if (c.requiere_comprobante && estado === "aprobado" && !archivo) return fallo("Esta categoría exige comprobante para aprobar el gasto.", { archivo: "Adjunta el comprobante o registra el gasto como pendiente." });
  if (c.limite_diario != null) {
    const total = (await Gastos.sumaDelDia(ctx.supabase, categoria_id!, fecha)) + m!;
    if (total > Number(c.limite_diario)) return fallo(`Se excede el límite diario de la categoría (Bs ${Number(c.limite_diario).toFixed(2)}).`, { monto: "Supera el límite diario." });
  }
  let usuario_id = responsable;
  if (solicitud_id) {
    const sol = await Solicitudes.obtener(ctx.supabase, solicitud_id);
    if (!sol || sol.estado !== "aprobada") return fallo("La solicitud debe estar aprobada para convertirse en gasto.");
    usuario_id = sol.usuario_id;
  }

  let ruta: string | null = null;
  if (archivo) {
    const up = await subirArchivo(ctx, archivo);
    if (up.error) return fallo("No se pudo subir el comprobante. Inténtalo nuevamente.");
    ruta = up.ruta;
  }
  const { id, error } = await Gastos.insertar(ctx.supabase, {
    concepto, categoria_id, proveedor_id, usuario_id, solicitud_id, monto: m, fecha, justificacion: justificacion || null, estado,
    numero_comprobante: str(f.get("numero_comprobante")) || null, tipo_comprobante: str(f.get("tipo_comprobante")) || null,
    archivo_comprobante: ruta, registrado_por: ctx.perfil.id_usuario,
  });
  if (error || !id) {
    if (ruta) await Gastos.quitarArchivos(ctx.supabase, [ruta]); // no dejar archivos huérfanos (RNF-18)
    return fallo(mensajeError(error));
  }
  let aviso: string | undefined;
  if (archivo && ruta) { const e2 = await registrarComprobante(ctx, id, archivo, ruta); if (e2) aviso = "El gasto se guardó, pero no se pudo registrar el comprobante."; }
  if (solicitud_id) await Solicitudes.marcarEjecutada(ctx.supabase, solicitud_id);
  await emitir({ tipo: "GastoRegistrado", gastoId: id, fecha });
  return { ok: `Gasto #${id} registrado.`, aviso, campos: { id: String(id) } };
}

/** Cambia el estado (aprobar, rechazar, anular) o elimina (solo administrador). */
export async function cambiarGasto(ctx: Contexto, f: FormData): Promise<Resultado> {
  registrarManejadores();
  if (!esGestor(ctx.perfil)) return fallo("No tienes permisos.");
  const id = int(f.get("id")), accion = str(f.get("accion"));
  if (!id) return fallo("Gasto inválido.");
  const g = await obtenerGasto(ctx, id);
  if (!g) return fallo("El gasto no existe.");
  if (accion === "eliminar") {
    if (!esAdmin(ctx.perfil)) return fallo("Solo el administrador puede eliminar gastos.");
    await Gastos.quitarArchivos(ctx.supabase, g.comprobantes.map((c: any) => c.ruta_storage));
    const error = await Gastos.eliminar(ctx.supabase, id);
    return error ? fallo(mensajeError(error)) : { ok: "Gasto eliminado. La operación quedó en el historial." };
  }
  const estado = ({ aprobar: "aprobado", rechazar: "rechazado", anular: "anulado" } as Record<string, string>)[accion];
  if (!estado) return fallo("Acción inválida.");
  if (estado === "aprobado" && g.categoria?.requiere_comprobante && !g.comprobantes.length) return fallo("No se puede aprobar: la categoría exige comprobante y el gasto no tiene ninguno.");
  const error = await Gastos.cambiarEstado(ctx.supabase, id, estado);
  if (error) return fallo(mensajeError(error));
  await emitir({ tipo: "GastoRegistrado", gastoId: id, fecha: g.fecha });
  return { ok: `Gasto ${estado}.` };
}

/** RF-10: adjuntar comprobante a un gasto existente (propietario o gestor). */
export async function adjuntarComprobante(ctx: Contexto, f: FormData): Promise<Resultado> {
  const id = int(f.get("id"));
  const { archivo, error: e } = validarArchivo(f.get("archivo"));
  if (e) return fallo(e);
  if (!id || !archivo) return fallo("Selecciona un archivo.");
  const g = await obtenerGasto(ctx, id);
  if (!g) return fallo("El gasto no existe.");
  const up = await subirArchivo(ctx, archivo);
  if (up.error) return fallo("No se pudo subir el archivo.");
  const error = await registrarComprobante(ctx, id, archivo, up.ruta);
  if (error) { await Gastos.quitarArchivos(ctx.supabase, [up.ruta]); return fallo(mensajeError(error)); }
  if (!g.archivo_comprobante) await Gastos.fijarArchivo(ctx.supabase, id, up.ruta);
  return { ok: "Comprobante adjuntado." };
}

export async function eliminarComprobante(ctx: Contexto, f: FormData): Promise<Resultado> {
  if (!esGestor(ctx.perfil)) return fallo("No tienes permisos.");
  const id = int(f.get("comprobante_id"));
  const ruta = id ? await Gastos.rutaComprobante(ctx.supabase, id) : null;
  if (!id || !ruta) return fallo("El comprobante no existe.");
  const error = await Gastos.borrarComprobante(ctx.supabase, id);
  if (error) return fallo(mensajeError(error));
  await Gastos.quitarArchivos(ctx.supabase, [ruta]);
  return { ok: "Comprobante eliminado." };
}
