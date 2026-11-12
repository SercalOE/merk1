-- Merk1 · montos con 4 decimales y orden de partidas.
-- 1) plan_lineas.inversion y presupuestos (saldo_anterior, presupuesto_mes) pasan de 2 a 4 decimales,
--    como el Excel (ej. 4,229.9725). Se redondea solo al mostrar.
-- 2) partidas.orden: el orden del Excel, que es el orden en que se cargaron en 0002_catalogos.sql.
--
-- v_control lee plan_lineas.*: Postgres no deja cambiar el tipo de una columna que usa una vista,
-- así que se borra y se vuelve a crear con la misma definición de 0001_esquema.sql.
-- Los montos que ya están guardados no recuperan decimales: hay que volver a subir la plantilla.

begin;

-- ============ 4 decimales ============
drop view v_control;

alter table plan_lineas
  alter column inversion type numeric(14,4);

alter table presupuestos
  alter column saldo_anterior type numeric(14,4),
  alter column presupuesto_mes type numeric(14,4);

-- Misma definición que 0001_esquema.sql.
create view v_control as
with base as (
  select pl.*, m.mes, m.tipo_cambio, e.codigo as empresa_codigo,
         (m.mes + interval '1 month' - interval '1 day')::date as fin_mes,
         o.tipo_costo, o.columna_resultado, md.fuente
  from plan_lineas pl
  join meses m on m.id = pl.mes_id
  join empresas e on e.id = m.empresa_id
  join objetivos o on o.id = pl.objetivo_id
  join medios md on md.id = pl.medio_id
),
porter as (
  -- gasto del MES (no solo de las fechas de la línea): así se detecta gasto fuera de fechas
  select b.id,
    sum(case when d.moneda = 'USD' then d.gasto * b.tipo_cambio else d.gasto end) as gastado_q,
    sum(case b.columna_resultado
          when 'impresiones' then d.impresiones when 'clics' then d.clics
          when 'interacciones' then d.interacciones when 'mensajes' then d.mensajes
          when 'leads' then d.leads when 'compras' then d.compras end) as resultado_diario,
    max(d.fecha) as ultimo_dia_con_datos
  from base b
  join campanas c on c.codigo = b.codigo
  join metricas_diarias d on d.plataforma = c.plataforma and d.campana_id = c.campana_id
                         and d.fecha between b.mes and b.fin_mes
  where b.fuente = 'porter'
  group by b.id
),
alcance as (
  -- último alcance pedido para el periodo de la línea dentro del mes.
  -- Si una línea tiene varias campañas se suman (aproximación: puede contar personas dos veces).
  select b.id, sum(a.alcance_unico) as alcance
  from base b
  join campanas c on c.codigo = b.codigo
  join lateral (
    select ap.alcance_unico from alcance_periodo ap
    where ap.plataforma = c.plataforma and ap.campana_id = c.campana_id
      and ap.desde = greatest(b.fecha_inicio, b.mes) and ap.hasta <= least(b.fecha_fin, b.fin_mes)
    order by ap.hasta desc limit 1
  ) a on true
  where b.columna_resultado = 'alcance_unico'
  group by b.id
),
csv as (
  select b.id,
    (array_agg(case when x.moneda = 'USD' then x.gasto * b.tipo_cambio else x.gasto end order by x.fecha_corte desc))[1] as gastado_q,
    (array_agg(x.resultado order by x.fecha_corte desc))[1] as resultado,
    max(x.fecha_corte) as fecha_corte
  from base b join metricas_csv x on x.codigo = b.codigo and x.mes = b.mes
  where b.fuente = 'csv'
  group by b.id
),
calc as (
  select b.*,
    case when b.moneda = 'USD' then b.inversion * b.tipo_cambio else b.inversion end as inversion_q,
    coalesce(p.gastado_q, c.gastado_q, 0) as gastado_q,
    coalesce(case when b.columna_resultado = 'alcance_unico' then a.alcance else p.resultado_diario end, c.resultado, 0) as resultado,
    case when b.tipo_costo = 'sin_costo' or b.costo_estimado = 0 then coalesce(b.proyectado_manual, 0)
         else (case when b.moneda = 'USD' then b.inversion * b.tipo_cambio else b.inversion end)
              / b.costo_estimado * (case when b.tipo_costo = 'por_mil' then 1000 else 1 end) end as proyectado,
    (b.fecha_fin - b.fecha_inicio + 1) as dias,
    greatest(0, least(current_date, b.fecha_fin) - b.fecha_inicio + 1) as dias_transcurridos,
    coalesce(p.ultimo_dia_con_datos, c.fecha_corte) as ultimo_dato
  from base b
  left join porter p on p.id = b.id
  left join alcance a on a.id = b.id
  left join csv c on c.id = b.id
)
select calc.*,
  calc.gastado_q / calc.tipo_cambio as gastado_usd,
  calc.inversion_q - calc.gastado_q as pendiente_q,
  (calc.inversion_q - calc.gastado_q) / calc.tipo_cambio as pendiente_usd,
  case when calc.resultado > 0 and calc.tipo_costo <> 'sin_costo'
       then calc.gastado_q / calc.resultado * (case when calc.tipo_costo = 'por_mil' then 1000 else 1 end) end as costo_real,
  case when calc.proyectado > 0 then calc.resultado / calc.proyectado end as cumplimiento,
  case when calc.resultado > 0 and calc.costo_estimado > 0 and calc.tipo_costo <> 'sin_costo'
       then (calc.gastado_q / calc.resultado * (case when calc.tipo_costo = 'por_mil' then 1000 else 1 end)) / calc.costo_estimado end as opt_costo,
  calc.inversion_q / calc.dias as gasto_diario_plan,
  calc.proyectado / calc.dias as resultado_diario_plan,
  case when calc.dias_transcurridos > 0 then calc.gastado_q / calc.dias_transcurridos end as gasto_diario_real,
  case when calc.dias_transcurridos > 0 then calc.resultado / calc.dias_transcurridos end as resultado_diario_real
from calc;

alter view v_control set (security_invoker = true);

-- ============ Orden de partidas ============
-- Una partida nueva sin orden se muestra al final, por nombre.
alter table partidas add column orden int unique;

update partidas p
   set orden = x.orden
  from (values
    ('Meta FB e IG', 1), ('Google', 2), ('YouTube', 3), ('LinkedIn', 4), ('Programatic', 5),
    ('Claro SMS', 6), ('Whatsapp Isoft', 7), ('Tik Tok', 8), ('Leads B2B', 9),
    ('Tráfico a tiendas Geolocalizado', 10), ('Mundial', 11), ('Extras', 12), ('Sin costo', 13)
  ) as x(nombre, orden)
 where p.nombre = x.nombre;

commit;
