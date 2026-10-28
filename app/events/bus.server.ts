/**
 * Arquitectura dirigida por eventos (complementa MVC).
 * Los controladores emiten eventos; los manejadores reaccionan (notificaciones, alertas).
 * Un fallo en un manejador nunca rompe la operación principal (RNF-18).
 */
export type Evento =
  | { tipo: "SolicitudRegistrada"; solicitudId: number; solicitanteId: number; solicitante: string; concepto: string; monto: number }
  | { tipo: "SolicitudResuelta"; solicitudId: number; solicitanteId: number; aprobada: boolean; concepto: string; observaciones: string }
  | { tipo: "GastoRegistrado"; gastoId: number; fecha: string }
  | { tipo: "PresupuestoEnAlerta"; mes: number; anio: number; porcentaje: number; umbral: number }
  | { tipo: "AnomaliaDetectada"; gastoId: number; nivel: string; motivo: string };

type Manejador<E extends Evento = Evento> = (e: E) => Promise<void>;
const manejadores = new Map<Evento["tipo"], Manejador[]>();

export function suscribir<K extends Evento["tipo"]>(tipo: K, fn: Manejador<Extract<Evento, { tipo: K }>>) {
  manejadores.set(tipo, [...(manejadores.get(tipo) ?? []), fn as Manejador]);
}

export async function emitir(evento: Evento): Promise<void> {
  const lista = manejadores.get(evento.tipo) ?? [];
  await Promise.all(lista.map(async (fn) => {
    try { await fn(evento); } catch (e) { console.error(`[evento ${evento.tipo}]`, e); }
  }));
}
