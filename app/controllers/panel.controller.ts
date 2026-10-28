import { esGestor, type Contexto } from "~/lib/sesion.server";
import { mesAnioActual, nombrePeriodo, primerDia, sumarMeses, ultimoDia } from "~/lib/fechas";
import { listarGastos } from "./gasto.controller";
import { presupuestoDelMes } from "./presupuesto.controller";
import { estadosSolicitudes } from "./solicitud.controller";
import { listarNotificaciones } from "./notificacion.controller";
import * as Analitica from "~/models/analitica.server";

/** RF-18: datos del panel de control; el contenido depende del rol. */
export async function datosPanel(ctx: Contexto) {
  const { mes, anio } = mesAnioActual(), gestor = esGestor(ctx.perfil), sig = sumarMeses(mes, anio, 1);
  const [gastos, presupuesto, estados, notifs] = await Promise.all([
    listarGastos(ctx, { desde: primerDia(mes, anio), hasta: ultimoDia(mes, anio) }, 2000),
    gestor ? presupuestoDelMes(ctx, mes, anio) : Promise.resolve(null),
    estadosSolicitudes(ctx), listarNotificaciones(ctx, 5),
  ]);
  const porCat = new Map<string, number>();
  gastos.filter((g: any) => g.estado === "aprobado").forEach((g: any) => { const n = g.categoria?.nombre ?? "—"; porCat.set(n, (porCat.get(n) ?? 0) + Number(g.monto)); });
  const cuenta = (e: string) => estados.filter((x) => x === e).length;
  const anomalias = gestor ? await Analitica.contarAnomaliasPendientes(ctx.supabase) : 0;
  const prediccion = gestor ? await Analitica.prediccionGlobal(ctx.supabase, primerDia(sig.mes, sig.anio)) : null;
  return {
    periodo: nombrePeriodo(mes, anio), siguiente: nombrePeriodo(sig.mes, sig.anio), gestor, presupuesto, anomalias, prediccion,
    pendientes: cuenta("pendiente"), aprobadas: cuenta("aprobada"), rechazadas: cuenta("rechazada"),
    totalMes: gastos.filter((g: any) => g.estado === "aprobado").reduce((s: number, g: any) => s + Number(g.monto), 0),
    gastosPendientes: gastos.filter((g: any) => g.estado === "pendiente").length,
    categorias: [...porCat.entries()].map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor),
    notifs, nombre: ctx.perfil.nombre,
  };
}
