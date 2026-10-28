import type { LoaderFunctionArgs } from "@vercel/remix";
import { GESTORES, requerirUsuario } from "~/lib/sesion.server";
import { exportar } from "~/controllers/reporte.controller";

export const config = { maxDuration: 30 };

/** Ruta de recurso (sin interfaz): devuelve el archivo CSV, Excel o PDF. */
export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requerirUsuario(request, GESTORES);
  return exportar(ctx, new URL(request.url));
}
