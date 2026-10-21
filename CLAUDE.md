# Merkl · reglas del proyecto

Merkl es el software de mercadeo de OE (Celasa GT, Celasa SV, Electroma, American, Logistik).
El MVP reemplaza el control de campañas del Excel PRESUPUESTO 2026: se sube un plan mensual en Excel
y Merkl arma el control de cada campaña con datos de Meta y Google (vía Porter) y CSV de otros medios.

## Reglas que no se rompen
1. **Solo lectura hacia las plataformas.** Merkl nunca crea, pausa ni modifica campañas, presupuestos ni anuncios.
   Los agentes proponen, el humano decide.
2. **Sin datos personales.** Solo métricas de campañas. Nunca bases de leads, nombres, teléfonos ni correos de clientes,
   y nunca se envían a la API de Claude.
3. **Secretos fuera del código.** `.env` en local (en `.gitignore` y `.vercelignore`); en Vercel como Secret, solo en Production.
   Nunca una llave `sb_secret_` ni de Porter en una variable `NEXT_PUBLIC_`.
4. **El alcance único no se suma** entre días, campañas ni meses. Se pide a la plataforma para el periodo completo
   y se guarda en `alcance_periodo`.
5. **El dinero cuenta en el mes en que se gastó.** El control de una línea suma el gasto de su código dentro de su mes.
6. **No cambiar el contrato de la plantilla** (nombres de hojas y columnas) sin actualizar `docs/SPEC-MVP.md` y la plantilla.
7. Revisar cada comando antes de aprobarlo; no usar modo automático.

## Conceptos
- **Línea del plan:** una fila del plan. Se identifica por `codigo` + mes. Ej. `ELE2609-007`.
- **Código:** `EMP` + `AAMM` de nacimiento + consecutivo de 3 dígitos. Regex: `^[A-Z]{3}[0-9]{4}-[0-9]{3}$`.
- **Nombre de campaña en la plataforma:** `CÓDIGO | Actividad | Medio | Objetivo`. Merkl solo lee el código del inicio.
  Una línea puede tener varias campañas con el mismo código.
- **Tipo de costo** (lo define el objetivo): `por_mil` (alcance, bumper, display), `por_unidad` (clics, mensajes, leads,
  compras), `sin_costo` (mailing; usa `proyectado_manual`).
- **Partida de presupuesto:** bolsa de dinero de la que sale la línea. No siempre es igual al medio.
- **Plan:** `principal`, `extra` (lanzamientos como Altiva) o `arrastre` (gasto de una campaña del mes anterior sin plan).

## Fórmulas (deben tener tests)
- `inversion_q` = inversión × tipo de cambio si la moneda es USD.
- `proyectado` = inversión_q ÷ costo_estimado × (1000 si es por mil). Si es sin costo: proyectado_manual.
- `costo_real` = gastado_q ÷ resultado × (1000 si es por mil).
- `cumplimiento` = resultado ÷ proyectado.
- `pendiente_q` = inversión_q − gastado_q; `pendiente_usd` = pendiente_q ÷ tipo de cambio.
- `opt_costo` = costo_real ÷ costo_estimado (menor a 1 es mejor).
- Ritmo: gasto y resultado diario del plan (÷ días de la línea) contra el real (÷ días transcurridos).

## Stack
Next.js + TypeScript + Tailwind en Vercel · Supabase (Auth con código de 6 dígitos, Postgres, Storage) ·
datos de plataformas desde Porter → BigQuery → sync a Supabase · GitHub.
Interfaz en español. Montos en Q con su equivalente en $.

## Validación de referencia
Piloto: **Electroma agosto 2026, Meta y Google Ads.** Plan Q71,003.46 en 26 líneas; gastado Q77,818.61.
Las campañas de Meta y Google de agosto ya están renombradas con su código (ELE2608-001 a ELE2608-026).
ELE2608-003 (Search) tiene dos campañas: Search · Marca y Search · Categorías.
Siguiente mes a cargar: septiembre (plantilla lista; ahí ELE2608-003, -006 y -023 continúan).
Los tests de cálculo deben reproducir estos totales con los archivos de `docs/ejemplos/`.
