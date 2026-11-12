-- Merk1 · verificación de la migración 0004_decimales_y_orden.sql
-- Correr en el SQL Editor de Supabase. Solo lectura: no cambia nada.

-- ============ 1. Migración ============

-- Tipos: las tres columnas deben decir numeric(14,4)
select table_name, column_name, format_type(a.atttypid, a.atttypmod) as tipo
from information_schema.columns c
join pg_attribute a on a.attrelid = (c.table_schema || '.' || c.table_name)::regclass and a.attname = c.column_name
where c.table_schema = 'public'
  and (c.table_name, c.column_name) in
      (('plan_lineas', 'inversion'), ('presupuestos', 'saldo_anterior'), ('presupuestos', 'presupuesto_mes'));

-- v_control existe otra vez y sigue con security_invoker
select relname, reloptions from pg_class where relname = 'v_control';

-- Orden de partidas: 1 a 13, en el orden del Excel; ninguna sin orden
select orden, nombre from partidas order by orden nulls last;

-- ============ 2. Después de volver a subir la plantilla de agosto ============
-- Esperado: 26 líneas, inversion_q = 71003.4570 (Excel: Q71,003.46)
select count(*) as lineas,
       sum(case when pl.moneda = 'USD' then pl.inversion * m.tipo_cambio else pl.inversion end) as inversion_q
from plan_lineas pl
join meses m on m.id = pl.mes_id
join empresas e on e.id = m.empresa_id
where e.codigo = 'ELE' and m.mes = '2026-08-01';

-- Las dos líneas con 4 decimales: ELE2608-016 = 4229.9725 y ELE2608-026 = 3000.0345
select pl.codigo, pl.inversion
from plan_lineas pl
join meses m on m.id = pl.mes_id
join empresas e on e.id = m.empresa_id
where e.codigo = 'ELE' and m.mes = '2026-08-01' and pl.codigo in ('ELE2608-016', 'ELE2608-026');

-- Disponible por partida, en el orden nuevo.
-- La plantilla trae el presupuesto con 2 decimales: el total da 76995.14 (Excel de referencia: 76995.12).
select pa.orden, pa.nombre, pr.saldo_anterior, pr.presupuesto_mes, pr.saldo_anterior + pr.presupuesto_mes as disponible
from presupuestos pr
join partidas pa on pa.id = pr.partida_id
join meses m on m.id = pr.mes_id
join empresas e on e.id = m.empresa_id
where e.codigo = 'ELE' and m.mes = '2026-08-01'
order by pa.orden;
