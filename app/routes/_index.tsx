import { redirect, type LoaderFunctionArgs } from "@vercel/remix";
import { haySesion } from "~/controllers/auth.controller";

export async function loader({ request }: LoaderFunctionArgs) {
  const { autenticado, headers } = await haySesion(request);
  return redirect(autenticado ? "/app" : "/login", { headers });
}
