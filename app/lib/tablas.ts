// PostgreSQL convierte a minúsculas los identificadores sin comillas,
// por eso "usuarios_SGCGP" existe realmente como "usuarios_sgcgp".
export const T = {
  usuarios: "usuarios_sgcgp",
  categorias: "categorias_sgcgp",
  proveedores: "proveedores_sgcgp",
  presupuesto: "presupuesto_sgcgp",
  solicitudes: "solicitudes_gasto_sgcgp",
  gastos: "gastos_sgcgp",
  historial: "historial_gastos_sgcgp",
  comprobantes: "comprobantes_sgcgp",
  notificaciones: "notificaciones_sgcgp",
  importaciones: "importaciones_sgcgp",
  exportaciones: "exportaciones_sgcgp",
  modelos: "modelos_ia_sgcgp",
  predicciones: "predicciones_ia_sgcgp",
  anomalias: "anomalias_ia_sgcgp",
  recomendaciones: "recomendaciones_ia_sgcgp",
  vistaResumen: "vista_resumen_gastos_sgcgp",
  vistaPresupuesto: "vista_control_presupuesto_sgcgp",
} as const;

export const BUCKET = "sgcgp-comprobantes";
export const MAX_ARCHIVO_BYTES = 4 * 1024 * 1024; // Vercel limita el cuerpo de la petición a ~4.5 MB
export const MIMES_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
