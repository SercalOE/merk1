# Merk1 · mejoras pendientes

Cosas detectadas que no bloquean el MVP. Al resolver una, se borra de aquí.

## /plan: carga sin datos en caché al navegar
- **Qué pasa:** en dev, Next.js muestra el Insight "uncached data during a navigation" al entrar a
  `/plan/[empresa]/[mes]`. La página lee Supabase en cada petición (`leerPlan()` llama a `connection()`)
  y no hay un estado de carga propio, así que la navegación espera los datos sin mostrar nada de la pantalla nueva.
- **Qué hacer:** agregar `src/app/(app)/plan/[empresa]/[mes]/loading.tsx`, o envolver en `<Suspense>` las
  secciones que leen datos, con un esqueleto de Insights, Resumen y Plan.
- **Detectado:** 2026-11-12, al probar la pantalla del plan con agosto 2026.
