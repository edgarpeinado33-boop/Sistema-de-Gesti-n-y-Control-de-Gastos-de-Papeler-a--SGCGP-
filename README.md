# SGCGP · Sistema de Gestión y Control de Gastos de Papelería

Aplicación web con **Remix.js + TypeScript**, **Supabase** (PostgreSQL, Auth, Storage) y un componente de **Machine Learning**, lista para desplegarse en **Vercel** desde **GitHub**. Sigue la arquitectura **MVC + dirigida por eventos** del informe y la base de datos `SGCGP_base_datos_completa.sql`.

## 1. Arquitectura

| Capa (informe) | Carpeta | Responsabilidad |
|---|---|---|
| Vista | `app/routes/*`, `app/components/*`, `app/styles.css` | Pantallas por rol, formularios, tablas. Los `loader/action` solo llaman a controladores; **no importan Supabase ni modelos** |
| Controlador | `app/controllers/*.controller.ts` | Validan, aplican reglas de negocio y emiten eventos: Auth, Usuario, Solicitud, Gasto, Presupuesto, Catálogo, Reporte, Notificación, Auditoría, Panel, ML. **No contienen consultas** |
| Modelo | `app/models/*.server.ts` | **Único lugar con acceso a datos**: consultas a PostgreSQL, vistas y Supabase Storage (usuarios, catálogo, presupuesto, solicitudes, gastos, notificaciones, historial, reportes, analítica) |
| Servicios | `app/services/*` | `ml.core.ts` (algoritmos puros), `ml.server.ts` (orquesta el análisis), `notificaciones.server.ts` (envío sin duplicados), `exportar.server.ts` |
| Eventos | `app/events/*` | Bus (`bus.server.ts`) y manejadores: `SolicitudRegistrada`, `SolicitudResuelta`, `GastoRegistrado`, `PresupuestoEnAlerta`, `AnomaliaDetectada` |
| Persistencia | Supabase | PostgreSQL (RLS, triggers, vistas) + bucket privado `sgcgp-comprobantes` |

Flujo: `Ruta → Controlador → Modelo → Supabase`, y el controlador emite un evento que atienden los manejadores (que usan servicios y modelos). Comprobación rápida de la separación (ambos comandos deben salir vacíos):
```bash
grep -rnE "\.from\(|\.storage\b" app | grep -vE "^app/(models|lib/supabase)"
grep -rnE "~/models|supabase.server" app/routes
```

> **Nota sobre nombres:** PostgreSQL pasa a minúsculas los identificadores sin comillas, así que `usuarios_SGCGP` existe como `usuarios_sgcgp`. El código ya usa los nombres reales (`app/lib/tablas.ts`).

### Seguridad
- Autenticación con Supabase Auth (cookies de sesión en el servidor; el navegador nunca recibe claves).
- Cada petición usa el JWT del usuario, por lo que **las políticas RLS de tu SQL siguen aplicando**. Además cada ruta verifica el rol (`requerirUsuario(request, roles)`).
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor para: notificar a otros usuarios, escribir tablas de ML (el esquema no da INSERT a usuarios) y crear cuentas desde el panel de administrador.
- Reglas extra: nadie revisa su propia solicitud; no se aprueba un gasto sin comprobante si la categoría lo exige; se respeta el límite diario de la categoría; los archivos se validan por tipo, extensión y tamaño.

## 2. Puesta en marcha

### 2.1 Supabase
1. Crea un proyecto en <https://supabase.com>.
2. En **SQL Editor** ejecuta `supabase/01_SGCGP_base_datos_completa.sql`. Es tu script con **una corrección**: se añadió `SET LOCAL check_function_bodies = off;` después de `BEGIN;`. Sin esa línea falla con `ERROR 42P01: relation "public.usuarios_sgcgp" does not exist`, porque las funciones de la sección 1 (`LANGUAGE SQL`) consultan una tabla que se crea más abajo.
3. **Authentication → Providers → Email**: para pruebas puedes desactivar *Confirm email*; en producción déjalo activo.
4. Regístrate desde la app (`/registro`) y vuelve al SQL Editor para convertirte en administrador:
   ```sql
   UPDATE public.usuarios_SGCGP SET rol = 'administrador', estado = TRUE WHERE correo = 'tu-correo@ejemplo.com';
   ```
5. (Opcional) Ejecuta `supabase/02_datos_demo.sql` para cargar 8 meses de historial y probar el ML.
6. **Project Settings → API**: copia `Project URL`, `anon key` y `service_role key`.

### 2.2 Local
```bash
cp .env.example .env        # completa las 3 variables
npm install
npm run dev                 # http://localhost:5173
npm test                    # pruebas del núcleo de ML
npm run typecheck && npm run build
```

### 2.3 GitHub → Vercel
```bash
git init && git add . && git commit -m "SGCGP: versión inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/sgcgp.git
git push -u origin main
```
1. En <https://vercel.com/new> importa el repositorio (detecta **Remix** automáticamente; no hace falta `vercel.json`).
2. En **Environment Variables** agrega `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.
3. *Deploy*. Cada `git push` a `main` redespliega.
4. En Supabase → **Authentication → URL Configuration** agrega la URL de Vercel como *Site URL*.

## 3. Machine Learning (RF-19 a RF-24)
Implementado en TypeScript dentro de la misma app (sin servicio aparte, así despliega en un solo paso). Se ejecuta con **Análisis inteligente → Ejecutar análisis** (solo administrador y encargado).

| Función | Técnica |
|---|---|
| Predicción mensual por categoría y total | Regresión lineal (mínimos cuadrados) sobre meses cerrados; con menos de 4 meses usa el promedio. Intervalo de predicción y confianza heurística |
| Evaluación (RNF-15) | Backtesting de origen móvil → **MAE** y **RMSE**, guardados en `modelos_ia_sgcgp.metricas` |
| Anomalías | z-score robusto (mediana + MAD, umbral 3.5) + reglas: duplicado y límite diario excedido. Niveles bajo/medio/alto/crítico |
| Patrones | Totales por categoría y variación del último mes |
| Recomendaciones | Consumo en alza, concentración en un proveedor, riesgo de exceder el presupuesto, oportunidad de ahorro |
| Alertas | Eventos → notificaciones a gestores (sin duplicados) |
| Revisión (RF-24) | Confirmar/descartar anomalías; aceptar/rechazar/aplicar recomendaciones |

Privacidad (RNF-17): solo se usan monto, fecha, categoría y proveedor. Transparencia (RNF-16): cada resultado muestra motivo, método, historial usado y limitaciones. Son **estimaciones de apoyo**, no sustituyen la decisión del encargado.

## 4. Cobertura de requerimientos

| RF | Dónde |
|---|---|
| 01 Inicio de sesión | `routes/login.tsx`, `registro.tsx`, `logout.tsx` |
| 02, 03 Usuarios y roles | `routes/app.usuarios.tsx`, `usuario.controller.ts`, RLS |
| 04, 05 Categorías y proveedores | `app.categorias.tsx`, `app.proveedores.tsx` |
| 06, 11 Presupuestos y control | `app.presupuestos.tsx` (vista `vista_control_presupuesto`) |
| 07, 08 Solicitudes | `app.solicitudes.*` |
| 09, 10 Gastos y comprobantes | `app.gastos.*`, Supabase Storage |
| 12 Auditoría | triggers de la BD + `app.auditoria.tsx` |
| 13 Notificaciones | `events/manejadores.server.ts`, `app.notificaciones.tsx` |
| 14 Búsqueda y filtros | `app.gastos._index.tsx` |
| 15, 17 Informes y exportación CSV/Excel/PDF | `app.informes.tsx`, `app.exportar.tsx` |
| 16 Importación CSV/Excel | `app.importar.tsx` |
| 18 Panel de control | `app._index.tsx` |
| 19–24 Machine Learning | `app.ml.tsx`, `services/ml.*` |

RNF-14 (zona horaria): `app/lib/fechas.ts` usa `America/La_Paz`.

## 5. Limitaciones conocidas
- **Archivos de hasta 4 MB**: Vercel limita el cuerpo de las peticiones (~4.5 MB) aunque el bucket permita 10 MB.
- Las tablas de ML solo se escriben con la service role; asegúrate de no exponerla.
- Las pruebas automatizadas cubren el núcleo de ML; el flujo completo contra Supabase debe validarse con tus propias cuentas de prueba (una por rol) antes de usar datos reales.
- Las políticas RLS impiden que un encargado vea perfiles ajenos; por eso los nombres se resuelven con un directorio mínimo de servidor (`models/usuarios.server.ts`).
