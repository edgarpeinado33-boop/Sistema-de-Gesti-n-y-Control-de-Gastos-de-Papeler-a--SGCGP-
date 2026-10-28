import { clienteAdmin } from "~/lib/supabase.server";
import { bs } from "~/lib/formato";
import { nombrePeriodo } from "~/lib/fechas";
import { emitir, suscribir } from "./bus.server";
import { notificar } from "~/services/notificaciones.server";
import { idsGestores } from "~/models/usuarios.server";
import * as Presupuestos from "~/models/presupuesto.server";

let registrado = false;
/** Registra los manejadores una sola vez por instancia del servidor. */
export function registrarManejadores() {
  if (registrado) return;
  registrado = true;

  // Solicitud registrada → notificar a los gestores.
  suscribir("SolicitudRegistrada", async (e) => {
    await notificar({
      usuarioIds: (await idsGestores()).filter((id) => id !== e.solicitanteId),
      titulo: "Nueva solicitud de gasto",
      mensaje: `Solicitud #${e.solicitudId} de ${e.solicitante}: ${e.concepto} por ${bs(e.monto)}.`,
      tipo: "informativa",
    });
  });

  // Solicitud aprobada/rechazada → notificar al solicitante.
  suscribir("SolicitudResuelta", async (e) => {
    await notificar({
      usuarioIds: [e.solicitanteId],
      titulo: e.aprobada ? "Solicitud aprobada" : "Solicitud rechazada",
      mensaje: `Tu solicitud #${e.solicitudId} (${e.concepto}) fue ${e.aprobada ? "aprobada" : "rechazada"}.${e.observaciones ? " Observaciones: " + e.observaciones : ""}`,
      tipo: e.aprobada ? "aprobacion" : "rechazo",
    });
  });

  // Gasto registrado/modificado → recalcular ejecución y alertar al 80 % y 100 %.
  suscribir("GastoRegistrado", async (e) => {
    const [anio, mes] = e.fecha.split("-").map(Number);
    const p = await Presupuestos.delMes(clienteAdmin(), mes, anio); // cliente de servidor: ve el total real, no solo lo del usuario
    if (!p) return;
    const pct = Number(p.porcentaje_utilizado);
    for (const umbral of [100, 80]) {
      if (pct >= umbral) { await emitir({ tipo: "PresupuestoEnAlerta", mes, anio, porcentaje: pct, umbral }); break; }
    }
  });

  // Presupuesto próximo al límite → alerta a los gestores (un solo aviso por umbral y periodo).
  suscribir("PresupuestoEnAlerta", async (e) => {
    await notificar({
      usuarioIds: await idsGestores(),
      titulo: e.umbral >= 100 ? "Presupuesto agotado" : "Presupuesto próximo al límite",
      mensaje: `El presupuesto de ${nombrePeriodo(e.mes, e.anio)} alcanzó el ${e.umbral}% (ejecución actual: ${e.porcentaje}%).`,
      tipo: "presupuesto",
    });
  });

  // Anomalía detectada por ML → alerta para revisión humana.
  suscribir("AnomaliaDetectada", async (e) => {
    await notificar({
      usuarioIds: await idsGestores(),
      titulo: `Anomalía ${e.nivel} detectada`,
      mensaje: `El gasto #${e.gastoId} requiere revisión. ${e.motivo}`,
      tipo: "anomalia",
    });
  });
}
