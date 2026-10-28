import { describe, expect, it } from "vitest";
import { detectarAnomalias, evaluarModelo, nivelDe, predecirSiguiente, serieMensual, zRobusto } from "./ml.core";

describe("predicción", () => {
  it("extrapola una tendencia lineal", () => {
    const p = predecirSiguiente([100, 110, 120, 130, 140, 150]);
    expect(p.metodo).toBe("tendencia_lineal");
    expect(p.estimado).toBeCloseTo(160, 0);
    expect(p.inferior).toBeLessThanOrEqual(p.estimado);
    expect(p.superior).toBeGreaterThanOrEqual(p.estimado);
  });
  it("usa el promedio con pocos datos y nunca es negativa", () => {
    expect(predecirSiguiente([100, 200]).metodo).toBe("promedio");
    expect(predecirSiguiente([50, 10, 0, 0, 0]).estimado).toBeGreaterThanOrEqual(0);
    expect(predecirSiguiente([]).metodo).toBe("sin_datos");
  });
  it("evalúa con MAE y RMSE", () => {
    const m = evaluarModelo([100, 110, 120, 130, 140, 150, 160]);
    expect(m).not.toBeNull();
    expect(m!.mae).toBeLessThan(1);
    expect(evaluarModelo([1, 2, 3])).toBeNull();
  });
});

describe("anomalías", () => {
  const hist = Array.from({ length: 10 }, (_, i) => ({ id_gasto: i + 1, fecha: `2026-0${(i % 9) + 1}-10`, monto: 50 + (i % 3) * 5, categoria_id: 1, proveedor_id: null }));
  it("detecta un monto atípico", () => {
    const raro = { id_gasto: 99, fecha: "2026-10-01", monto: 900, categoria_id: 1, proveedor_id: null };
    const r = detectarAnomalias([raro], [...hist, raro], {});
    expect(r).toHaveLength(1);
    expect(["alto", "critico"]).toContain(r[0].nivel);
  });
  it("no marca montos normales", () => {
    const normal = { id_gasto: 98, fecha: "2026-10-01", monto: 55, categoria_id: 1, proveedor_id: null };
    expect(detectarAnomalias([normal], [...hist, normal], {})).toHaveLength(0);
    expect(zRobusto([1, 2], 100)).toBe(0);
  });
  it("detecta duplicados y límite diario", () => {
    const a = { id_gasto: 1, fecha: "2026-10-02", monto: 30, categoria_id: 2, proveedor_id: 5 };
    const b = { id_gasto: 2, fecha: "2026-10-02", monto: 30, categoria_id: 2, proveedor_id: 5 };
    expect(detectarAnomalias([b], [a, b], {})[0].motivo).toContain("duplicado");
    expect(detectarAnomalias([b], [a, b], { 2: 40 })[0].puntuacion).toBeGreaterThanOrEqual(0.85);
  });
  it("asigna niveles", () => { expect(nivelDe(0.3)).toBeNull(); expect(nivelDe(0.95)).toBe("critico"); });
});

describe("serie mensual", () => {
  it("rellena meses sin gastos", () => {
    const s = serieMensual([{ fecha: "2026-01-05", monto: 10 }, { fecha: "2026-03-05", monto: 20 }], "2026-03");
    expect(s.valores).toEqual([10, 0, 20]);
  });
});
