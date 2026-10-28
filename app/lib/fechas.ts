// RNF-14: las fechas de negocio usan America/La_Paz.
export const TZ = "America/La_Paz";

export function hoyLaPaz(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
}
export function mesAnioActual() {
  const [anio, mes] = hoyLaPaz().split("-").map(Number);
  return { mes, anio };
}
// Formato propio y determinista: Intl.DateTimeFormat("es-BO") produce espacios distintos en Node y en el
// navegador (p. ej. "a. m." vs "a.\u00a0m."), lo que rompe la hidratación de React.
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtPartes = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" });
function partes(d: Date) {
  const o: Record<string, string> = {};
  for (const p of fmtPartes.formatToParts(d)) o[p.type] = p.value;
  return { anio: +o.year, mes: +o.month, dia: +o.day, hora: +o.hour % 24, min: +o.minute };
}
const dos = (n: number) => String(n).padStart(2, "0");
export function formatoFecha(iso?: string | null): string {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) { const [a, m, d] = iso.split("-").map(Number); return `${dos(d)} ${MESES_CORTOS[m - 1]} ${a}`; }
  const p = partes(new Date(iso));
  return `${dos(p.dia)} ${MESES_CORTOS[p.mes - 1]} ${p.anio}`;
}
export function formatoFechaHora(iso?: string | null): string {
  if (!iso) return "—";
  const p = partes(new Date(iso));
  return `${dos(p.dia)} ${MESES_CORTOS[p.mes - 1]} ${p.anio}, ${dos(p.hora)}:${dos(p.min)}`;
}
export const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export function nombrePeriodo(mes: number, anio: number) { return `${MESES[mes - 1]} ${anio}`; }
export function sumarMeses(mes: number, anio: number, n: number) {
  const idx = anio * 12 + (mes - 1) + n;
  return { anio: Math.floor(idx / 12), mes: (idx % 12) + 1 };
}
export function primerDia(mes: number, anio: number) { return `${anio}-${String(mes).padStart(2, "0")}-01`; }
export function ultimoDia(mes: number, anio: number) {
  const d = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}