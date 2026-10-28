import { fallo, mensajeError, type Resultado } from "~/lib/errores";
import { int, monto } from "~/lib/formato";
import { emitir } from "~/events/bus.server";
import { registrarManejadores } from "~/events/manejadores.server";
import { primerDia } from "~/lib/fechas";
import type { Contexto } from "~/lib/sesion.server";
import * as Presupuestos from "~/models/presupuesto.server";

/** RF-11: monto utilizado, saldo y % vienen de la vista de la BD (solo gasto aprobado). */
export const listarPresupuestos = (ctx: Contexto) => Presupuestos.listar(ctx.supabase);
export const presupuestoDelMes = (ctx: Contexto, mes: number, anio: number) => Presupuestos.delMes(ctx.supabase, mes, anio);

/** RF-06: crea o actualiza el límite de un periodo. */
export async function guardarPresupuesto(ctx: Contexto, f: FormData): Promise<Resultado> {
  registrarManejadores();
  const mes = int(f.get("mes")), anio = int(f.get("anio")), limite = monto(f.get("monto_limite"));
  if (!mes || mes < 1 || mes > 12) return fallo("Mes inválido.");
  if (!anio || anio < 2000 || anio > 2200) return fallo("Año inválido.");
  if (limite === null || limite < 0) return fallo("El monto límite debe ser un número mayor o igual a 0.");
  const error = await Presupuestos.guardar(ctx.supabase, { mes, anio, monto_limite: limite, creado_por: ctx.perfil.id_usuario });
  if (error) return fallo(mensajeError(error));
  await emitir({ tipo: "GastoRegistrado", gastoId: 0, fecha: primerDia(mes, anio) }); // recalcula alertas del periodo
  return { ok: "Presupuesto guardado." };
}
