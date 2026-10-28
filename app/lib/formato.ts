/** Monto en bolivianos con formato fijo ("Bs 1.315,83"): idéntico en servidor y navegador (evita errores de hidratación). */
export function bs(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  const [entero, dec] = Math.abs(Number.isFinite(v) ? v : 0).toFixed(2).split(".");
  return `${v < 0 ? "-" : ""}Bs ${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}
export function num(n: unknown): number { const v = Number(n); return Number.isFinite(v) ? v : 0; }
export function str(v: FormDataEntryValue | null | undefined): string { return typeof v === "string" ? v.trim() : ""; }
export function int(v: FormDataEntryValue | null | undefined): number | null {
  const n = parseInt(str(v), 10); return Number.isFinite(n) ? n : null;
}
export function monto(v: FormDataEntryValue | null | undefined): number | null {
  const n = Number(str(v).replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
export const ROL_ETIQUETA: Record<string, string> = {
  administrador: "Administrador", encargado_gastos: "Encargado de gastos", solicitante: "Solicitante",
};