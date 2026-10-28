import type { LinksFunction, MetaFunction } from "@vercel/remix";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from "@remix-run/react";
import estilos from "~/styles.css?url";
import { BarraProgreso, OcultarSplash, Splash } from "~/components/Carga";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" },
  { rel: "stylesheet", href: estilos },
];
export const meta: MetaFunction = () => [
  { title: "SGCGP · Gastos de papelería" },
  { name: "description", content: "Sistema de Gestión y Control de Gastos de Papelería" },
  { name: "theme-color", content: "#14213d" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <Meta /><Links />
      </head>
      <body>
        <Splash />
        {children}
        <ScrollRestoration /><Scripts />
      </body>
    </html>
  );
}
export default function App() {
  return (<><BarraProgreso /><OcultarSplash /><Outlet /></>);
}

export function ErrorBoundary() {
  const e = useRouteError();
  let titulo = "Ocurrió un problema", detalle = "Inténtalo nuevamente en unos instantes.";
  if (isRouteErrorResponse(e)) {
    titulo = e.status === 403 ? "Acceso restringido" : e.status === 404 ? "No encontrado" : `Error ${e.status}`;
    detalle = (e.data as any)?.mensaje ?? e.statusText ?? detalle;
  }
  return (
    <main className="auth"><section className="auth-form" style={{ gridColumn: "1 / -1" }}><OcultarSplash />
      <div className="panel auth-caja"><h1>{titulo}</h1><p className="muted">{detalle}</p><a className="btn verde" href="/app">Volver al inicio</a></div>
    </section></main>
  );
}