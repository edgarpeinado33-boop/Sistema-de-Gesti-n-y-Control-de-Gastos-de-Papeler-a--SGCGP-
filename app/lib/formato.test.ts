import { expect, it } from "vitest";
import { bs } from "~/lib/formato";
import { formatoFecha, formatoFechaHora } from "~/lib/fechas";
it("formatos deterministas", () => {
  expect(bs(1315.83)).toBe("Bs 1.315,83"); expect(bs(0)).toBe("Bs 0,00"); expect(bs("185.5")).toBe("Bs 185,50"); expect(bs(-42)).toBe("-Bs 42,00"); expect(bs(null)).toBe("Bs 0,00");
  expect(formatoFecha("2026-10-26")).toBe("26 oct 2026");
  expect(formatoFechaHora("2026-10-26T12:00:00Z")).toBe("26 oct 2026, 08:00"); // UTC-4 (America/La_Paz)
  expect(formatoFechaHora("2026-10-27T03:30:00Z")).toBe("26 oct 2026, 23:30");
  expect(formatoFecha(null)).toBe("—");
});