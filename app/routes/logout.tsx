import { redirect, type ActionFunctionArgs } from "@vercel/remix";
import { cerrarSesion } from "~/controllers/auth.controller";

export async function action({ request }: ActionFunctionArgs) {
  const { headers } = await cerrarSesion(request);
  return redirect("/login", { headers });
}
export const loader = () => redirect("/login");
