export interface Resultado { ok?: string; error?: string; campos?: Record<string, string>; aviso?: string }

/** Traduce errores de PostgreSQL/Supabase a mensajes comprensibles (RNF-06, RNF-18). */
export function mensajeError(e: any): string {
  const code = e?.code as string | undefined;
  const msg = (e?.message as string | undefined) ?? "";
  if (code === "23505") return "Ya existe un registro con ese valor único (nombre, NIT, periodo, etc.).";
  if (code === "23503") return "El registro está relacionado con otros datos y no se puede completar la operación.";
  if (code === "23514") return "Algún valor no cumple las restricciones permitidas.";
  if (code === "42501" || /row-level security/i.test(msg)) return "No tienes permisos para realizar esta operación.";
  if (/No tienes permisos|Solo puedes|No puedes/.test(msg)) return msg;
  console.error("[error]", e);
  return "Ocurrió un error inesperado. Inténtalo nuevamente.";
}
export const fallo = (error: string, campos?: Record<string, string>): Resultado => ({ error, campos });
