import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface Tabla { titulo: string; columnas: string[]; filas: (string | number)[][] }

export function aCSV(t: Tabla): string {
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "\uFEFF" + [t.columnas, ...t.filas].map((f) => f.map(esc).join(",")).join("\r\n");
}

export async function aXLSX(t: Tabla): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(t.titulo.slice(0, 30));
  ws.addRow(t.columnas).font = { bold: true };
  t.filas.forEach((f) => ws.addRow(f));
  ws.columns.forEach((c, i) => { c.width = Math.min(45, Math.max(12, ...[t.columnas[i], ...t.filas.map((f) => f[i])].map((v) => String(v ?? "").length + 2))); });
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

const limpio = (s: string | number) => String(s ?? "").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");

export async function aPDF(t: Tabla): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica), negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 36, ancho = (W - 2 * M) / t.columnas.length, fs = 8, alto = 16;
  let pagina = pdf.addPage([W, H]); let y = H - M;
  const cabecera = () => {
    pagina.drawText(limpio(t.titulo), { x: M, y, size: 14, font: negrita, color: rgb(0.08, 0.16, 0.25) }); y -= 22;
    t.columnas.forEach((c, i) => pagina.drawText(limpio(c).slice(0, Math.floor(ancho / 4.4)), { x: M + i * ancho, y, size: fs, font: negrita }));
    y -= 4; pagina.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8 }); y -= 12;
  };
  cabecera();
  for (const fila of t.filas) {
    if (y < M + 10) { pagina = pdf.addPage([W, H]); y = H - M; cabecera(); }
    fila.forEach((v, i) => pagina.drawText(limpio(v).slice(0, Math.floor(ancho / 4.2)), { x: M + i * ancho, y, size: fs, font: fuente }));
    y -= alto - 4;
  }
  return pdf.save();
}
