# Merkl · primeros pasos

Mismo taller que ROMAN: Claude (claude.ai) diseña, Claude Code construye en Cursor, GitHub guarda, Vercel publica,
Supabase guarda los datos. Sergio aprueba cada cambio.

## 0. Preparar (una vez)
1. Crear el repo privado `merkl` en GitHub (idealmente ya en una organización de OE) y clonarlo en Cursor.
2. Copiar a la raíz los archivos de este kit: `CLAUDE.md`, `docs/`, `supabase/`.
3. Copiar a `docs/ejemplos/` las plantillas y controles de agosto (piloto) y septiembre (siguiente mes).
4. Crear un proyecto nuevo en Supabase (no reutilizar el de ROMAN) y correr en el SQL Editor,
   en orden, `0001_esquema.sql` y `0002_catalogos.sql`.
5. Crear el proyecto en Vercel conectado al repo. Variables solo en Production:
   `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (Secret), `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `MERKL_ALLOWED_EMAILS`.
6. Agosto ya está renombrado en Meta y Google (revisado con Porter). Septiembre se renombra después del piloto:
   11 campañas que aún dicen "Sep26 - …" (lista en la hoja Plan de la plantilla de septiembre).

## 1. Prompts para Claude Code (uno a la vez, revisando cada paso)

**Prompt 1 · Base**
> Lee CLAUDE.md y docs/SPEC-MVP.md. Crea el proyecto Next.js + TypeScript + Tailwind con login de Supabase por
> código de 6 dígitos (doble candado: usuario existente + correo en MERKL_ALLOWED_EMAILS), igual que ROMAN.
> Solo login y una página de inicio vacía. Muéstrame el plan antes de escribir código.

**Prompt 2 · Lector de la plantilla**
> Crea el lector de la plantilla Excel (hojas Mes, Presupuesto, Calendario, KPIs, Plan) con las validaciones de
> SPEC-MVP. Primero solo la lógica y tests con docs/ejemplos/Merkl_Plantilla_Carga_Electroma_Ago2026.xlsx:
> 26 líneas y total Q71,003.46. Sin guardar en Supabase todavía.

**Prompt 3 · Pantalla de carga**
> Crea /cargar: subir el Excel, mostrar el resumen de validación y, al confirmar, guardar en Supabase
> (meses, presupuestos, calendario, kpis, plan_lineas, cargas).

**Prompt 4 · Plan**
> Crea /plan/[empresa]/[mes] con la tabla de líneas, el nombre de campaña con botón copiar y los resúmenes
> por actividad y por partida.

**Prompt 5 · Datos de prueba y control**
> Crea un script que cargue CSV de métricas de prueba (formato de metricas_diarias y alcance_periodo) y la
> pantalla /control/[empresa]/[mes] leyendo la vista v_control. Tests de cálculo contra Electroma agosto
> (docs/ejemplos/Merkl_Plan_Electroma_Ago2026.xlsx).

**Prompt 6 · Sin código**
> Crea /sin-codigo con las campañas con gasto en el mes sin código válido o sin línea en el plan.

## 2. En paralelo: Porter → BigQuery
Configurar en Porter las dos exportaciones de SPEC-MVP hacia un dataset `merkl` en BigQuery.
Cuando estén listas, el prompt 7 conecta el sync diario.
