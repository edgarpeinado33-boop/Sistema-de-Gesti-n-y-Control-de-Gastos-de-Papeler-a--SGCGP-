import { fallo, mensajeError, type Resultado } from "~/lib/errores";
import { monto, str } from "~/lib/formato";
import type { Contexto } from "~/lib/sesion.server";
import * as Catalogo from "~/models/catalogo.server";

export const listarCategorias = (ctx: Contexto, soloActivas = false) => Catalogo.listarCategorias(ctx.supabase, soloActivas);
export const listarProveedores = (ctx: Contexto, soloActivos = false) => Catalogo.listarProveedores(ctx.supabase, soloActivos);

// ---- Categorías (RF-04) ----
export async function guardarCategoria(ctx: Contexto, f: FormData): Promise<Resultado> {
  const id = str(f.get("id")), nombre = str(f.get("nombre"));
  if (nombre.length < 3) return fallo("El nombre debe tener al menos 3 caracteres.", { nombre: "Muy corto." });
  const lim = str(f.get("limite_diario")) ? monto(f.get("limite_diario")) : null;
  if (lim !== null && lim < 0) return fallo("El límite diario no puede ser negativo.");
  const fila = {
    nombre, descripcion: str(f.get("descripcion")) || null, limite_diario: lim,
    requiere_comprobante: f.get("requiere_comprobante") === "on", requiere_justificacion: f.get("requiere_justificacion") === "on",
    estado: id ? f.get("estado") === "on" : true,
  };
  const error = await Catalogo.guardarCategoria(ctx.supabase, id ? Number(id) : null, fila);
  return error ? fallo(mensajeError(error)) : { ok: id ? "Categoría actualizada." : "Categoría creada." };
}

// ---- Proveedores (RF-05) ----
export async function guardarProveedor(ctx: Contexto, f: FormData): Promise<Resultado> {
  const id = str(f.get("id")), nombre = str(f.get("nombre")), correo = str(f.get("correo"));
  if (nombre.length < 3) return fallo("El nombre debe tener al menos 3 caracteres.");
  if (correo && !/^\S+@\S+\.\S+$/.test(correo)) return fallo("Correo inválido.");
  const fila = {
    nombre, nit: str(f.get("nit")) || null, telefono: str(f.get("telefono")) || null, correo: correo || null,
    direccion: str(f.get("direccion")) || null, estado: id ? f.get("estado") === "on" : true,
  };
  const error = await Catalogo.guardarProveedor(ctx.supabase, id ? Number(id) : null, fila);
  return error ? fallo(mensajeError(error)) : { ok: id ? "Proveedor actualizado." : "Proveedor creado." };
}
