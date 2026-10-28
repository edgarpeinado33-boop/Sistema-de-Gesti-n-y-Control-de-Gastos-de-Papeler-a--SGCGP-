import { fallo, mensajeError, type Resultado } from "~/lib/errores";
import { bs, int, monto, str } from "~/lib/formato";
import { emitir } from "~/events/bus.server";
import { registrarManejadores } from "~/events/manejadores.server";
import { esGestor, type Contexto } from "~/lib/sesion.server";
import { mesAnioActual } from "~/lib/fechas";
import * as Solicitudes from "~/models/solicitudes.server";
import * as Catalogo from "~/models/catalogo.server";
import { directorio } from "~/models/usuarios.server";
import { presupuestoDelMes } from "./presupuesto.controller";

export async function listarSolicitudes(ctx: Contexto, estado?: string) {
  const filas = await Solicitudes.listar(ctx.supabase, estado); // RLS: el solicitante solo ve las suyas
  const nombres = await directorio(filas.flatMap((s) => [s.usuario_id, s.revisado_por]));
  return filas.map((s) => ({ ...s, solicitante: nombres[s.usuario_id] ?? "—", revisor: nombres[s.revisado_por] ?? null }));
}
export const solicitudAprobada = (ctx: Contexto, id: number) => Solicitudes.obtenerAprobada(ctx.supabase, id);
export const estadosSolicitudes = (ctx: Contexto) => Solicitudes.estados(ctx.supabase);

/** RF-07 */
export async function crearSolicitud(ctx: Contexto, f: FormData): Promise<Resultado> {
  registrarManejadores();
  const concepto = str(f.get("concepto")), justificacion = str(f.get("justificacion"));
  const categoria_id = int(f.get("categoria_id")), m = monto(f.get("monto"));
  const campos: Record<string, string> = {};
  if (concepto.length < 3) campos.concepto = "Describe el concepto (mínimo 3 caracteres).";
  if (!categoria_id) campos.categoria_id = "Selecciona una categoría.";
  if (m === null || m <= 0) campos.monto = "El monto debe ser mayor a 0.";
  if (Object.keys(campos).length) return fallo("Revisa los datos del formulario.", campos);
  const cat = await Catalogo.obtenerCategoria(ctx.supabase, categoria_id!);
  if (!cat || !cat.estado) return fallo("La categoría no está disponible.", { categoria_id: "Categoría inválida." });
  if (cat.requiere_justificacion && justificacion.length < 10) return fallo("Esta categoría exige una justificación.", { justificacion: "Escribe una justificación (mínimo 10 caracteres)." });
  const { id, error } = await Solicitudes.insertar(ctx.supabase, { usuario_id: ctx.perfil.id_usuario, categoria_id, concepto, monto: m, justificacion: justificacion || null });
  if (error || !id) return fallo(mensajeError(error));
  await emitir({ tipo: "SolicitudRegistrada", solicitudId: id, solicitanteId: ctx.perfil.id_usuario, solicitante: `${ctx.perfil.nombre} ${ctx.perfil.apellido}`, concepto, monto: m! });
  return { ok: "Solicitud registrada. Se notificó a los encargados." };
}

/** RF-08: solo gestores; nadie aprueba su propia solicitud. */
export async function revisarSolicitud(ctx: Contexto, f: FormData): Promise<Resultado> {
  registrarManejadores();
  if (!esGestor(ctx.perfil)) return fallo("No tienes permisos para revisar solicitudes.");
  const id = int(f.get("id")), decision = str(f.get("decision")), obs = str(f.get("observaciones"));
  if (!id || !["aprobada", "rechazada"].includes(decision)) return fallo("Datos inválidos.");
  if (decision === "rechazada" && obs.length < 3) return fallo("Indica el motivo del rechazo en las observaciones.");
  const s = await Solicitudes.obtener(ctx.supabase, id);
  if (!s) return fallo("La solicitud no existe.");
  if (s.estado !== "pendiente") return fallo("La solicitud ya fue revisada.");
  if (s.usuario_id === ctx.perfil.id_usuario) return fallo("No puedes revisar tu propia solicitud.");
  const error = await Solicitudes.resolver(ctx.supabase, id, { estado: decision, revisado_por: ctx.perfil.id_usuario, fecha_revision: new Date().toISOString(), observaciones: obs || null });
  if (error) return fallo(mensajeError(error));
  await emitir({ tipo: "SolicitudResuelta", solicitudId: id, solicitanteId: s.usuario_id, aprobada: decision === "aprobada", concepto: s.concepto, observaciones: obs });
  let aviso: string | undefined;
  if (decision === "aprobada") {
    const { mes, anio } = mesAnioActual();
    const p = await presupuestoDelMes(ctx, mes, anio);
    if (p && Number(p.saldo_disponible) < Number(s.monto)) aviso = `Atención: el saldo disponible del mes (${bs(p.saldo_disponible)}) es menor al monto aprobado (${bs(s.monto)}).`;
  }
  return { ok: decision === "aprobada" ? "Solicitud aprobada." : "Solicitud rechazada.", aviso };
}
