# Merkl · Especificación del MVP

## Objetivo
Subir el plan mensual en Excel y ver el control de cada campaña sin capturar a mano gasto ni resultados.
Piloto: **Electroma · agosto 2026 · Meta y Google Ads**. Después: septiembre.

## Pantallas
1. **Login** con código de 6 dígitos por correo (mismo patrón que ROMAN: usuario en Supabase + correo en `MERKL_ALLOWED_EMAILS`).
2. **Cargar plan** (`/cargar`): se sube `Merkl_Plantilla_Carga_*.xlsx` → Merkl valida → muestra un resumen
   (empresas, meses, líneas, total por partida, errores) → el usuario confirma → se guarda.
   Si el mes ya existe, la carga reemplaza su plan e insights (pide confirmación).
3. **Plan** (`/plan/[empresa]/[mes]`): tabla de líneas con proyectado y nombre de campaña para copiar;
   resumen por actividad y por partida (disponible vs. planeado).
4. **Control** (`/control/[empresa]/[mes]`): por línea gastado Q/$, resultado, costo real, cumplimiento,
   pendiente, opt. costo, ritmo diario y estado (En línea · Bajo proyección · Costo alto · Gastó de más · Sin iniciar).
   Resumen por partida (disponible, planeado, gastado). Fecha del último dato.
5. **Sin código** (`/sin-codigo`): campañas con gasto en el mes cuyo nombre no empieza con un código,
   o cuyo código no existe en el plan del mes.

## Validaciones de la carga (errores bloquean, avisos no)
Errores: hoja o columna faltante · empresa, medio, objetivo, actividad o partida fuera de catálogo ·
código con formato inválido o repetido en el mismo mes · fecha_fin < fecha_inicio · fechas fuera del mes
(salvo plan arrastre) · inversión negativa · costo_estimado = 0 en objetivo con costo.
Permitido: códigos nacidos en meses anteriores (campañas que continúan).
Avisos: total planeado mayor al disponible · objetivo sin costo y sin proyectado_manual · KPI meta vacío.

## Datos de plataformas
- **Porter → BigQuery (producción).** Dos exportaciones programadas por cuenta:
  1. Diaria por campaña: fecha, cuenta, campaña (id y nombre), gasto, impresiones, clics, interacciones,
     mensajes, leads, compras.
  2. Alcance único por campaña para el periodo de cada línea activa (mes en curso y mes anterior), sin dimensión de fecha.
- **Sync** (cron diario 6:00 Guatemala): lee BigQuery → upsert en `campanas`, `metricas_diarias`, `alcance_periodo`.
- **Mientras se configura BigQuery:** se cargan CSV de prueba con el mismo formato (los genera Claude desde Porter).
- Campos confirmados en Porter: Meta `facebook_ads_campaign_name`, `facebook_ads_spend`, `facebook_ads_reach`;
  Google `google_ads_campaign_name`, `google_ads_cost_micros` (ya viene en moneda, no en micros), `google_ads_clicks`,
  `google_ads_unique_users`. Pendiente confirmar los de mensajes, leads, compras e interacciones de Meta.

## Fuera del MVP
Alertas por correo, PDF de rendición de cuentas, TikTok/LinkedIn, CSV de Basis/Claro/iSoft/Mailjet,
calendario visual, histórico 2023, distribución anual del presupuesto. (El esquema ya los soporta.)

## Criterios de aceptación
- `Merkl_Plantilla_Carga_Electroma_Ago2026.xlsx` carga sin errores: 26 líneas y plan de Q71,003.46.
- Con los datos de agosto de Meta y Google, el control cuadra con `Merkl_Plan_Electroma_Ago2026.xlsx`
  con diferencias menores a $0.10 por línea.
- ELE2608-003 suma sus dos campañas (Search · Marca + Search · Categorías = $664.92).
- Alcance único de referencia: ELE2608-015 YouTube 1,431,159 · ELE2608-017 Display 1,114,201 · ELE2608-014 Meta 3,053,405.
- El gasto de septiembre de ELE2608-003, -006 y -023 NO entra al control de agosto.
- "Jul26 - Promo CC - Ofertas" (sin código, $29.69 en agosto) aparece en "Sin código".
