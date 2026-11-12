-- Merk1 · verificación de la migración 0003_carga_plan.sql
-- Correr en el SQL Editor de Supabase. Solo lectura: no cambia nada.

-- ============ 1. Migración ============

-- Bucket privado: public = false, file_size_limit = 5242880, solo .xlsx
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'cargas';

-- La función existe: aplicar_carga_plan(p_carga_id uuid, p_datos jsonb)
select proname, pg_get_function_identity_arguments(oid) as argumentos
from pg_proc
where proname = 'aplicar_carga_plan';

-- Permisos: service_role = true; anon y authenticated = false
select r as rol, has_function_privilege(r, 'aplicar_carga_plan(uuid, jsonb)', 'execute') as puede_ejecutar
from unnest(array['service_role', 'anon', 'authenticated']) r;

-- ============ 2. Piloto: Electroma agosto 2026 ============
-- Después de cargar Merk1_Plantilla_Carga_Electroma_Ago2026.xlsx desde /cargar.
-- Esperado: 26 líneas, inversion_q = 71003.46
select count(*) as lineas,
       round(sum(case when pl.moneda = 'USD' then pl.inversion * m.tipo_cambio else pl.inversion end), 2) as inversion_q
from plan_lineas pl
join meses m on m.id = pl.mes_id
join empresas e on e.id = m.empresa_id
where e.codigo = 'ELE' and m.mes = '2026-08-01';

-- Última carga: estado = 'aplicada', archivo en plan/<id>/...
select id, estado, archivo, subido_por, creado_en
from cargas
order by creado_en desc
limit 1;

-- El Excel original quedó en Storage
select name, created_at
from storage.objects
where bucket_id = 'cargas'
order by created_at desc
limit 5;

-- ============ 3. Recarga del mismo archivo ============
-- Correr antes y después de volver a subirlo: los id deben ser los mismos
-- y carga_id debe apuntar a la carga nueva.
select pl.codigo, pl.id, pl.carga_id
from plan_lineas pl
join meses m on m.id = pl.mes_id
join empresas e on e.id = m.empresa_id
where e.codigo = 'ELE' and m.mes = '2026-08-01'
order by pl.codigo;
