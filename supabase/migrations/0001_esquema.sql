-- Merkl · esquema inicial (MVP control de campañas)
-- Convención: montos en numeric; fechas en date (hora de Guatemala); textos de catálogo en español.

create extension if not exists pgcrypto;

-- ============ Catálogos ============
create table empresas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[A-Z]{3}$'),
  nombre text not null,
  moneda text not null check (moneda in ('GTQ','USD'))
);

create table medios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  plataforma text not null,
  fuente text not null check (fuente in ('porter','csv')),
  moneda_gasto text not null check (moneda_gasto in ('GTQ','USD'))
);

-- columna_resultado: qué columna de metricas_diarias es el resultado del objetivo.
-- 'alcance_unico' se lee de alcance_periodo (no se suma por día). null = el resultado llega por CSV.
create table objetivos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo_costo text not null check (tipo_costo in ('por_mil','por_unidad','sin_costo')),
  resultado text not null,
  columna_resultado text check (columna_resultado in
    ('alcance_unico','impresiones','clics','interacciones','mensajes','leads','compras'))
);

create table actividades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null default 'Oferta'
);

create table partidas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

-- ============ Carga mensual (Excel) ============
create table cargas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('plan','csv_medio')),
  archivo text not null,
  subido_por text not null,
  estado text not null default 'validando' check (estado in ('validando','con_errores','aplicada')),
  errores jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now()
);

create table meses (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  mes date not null check (extract(day from mes) = 1),
  tipo_cambio numeric(8,4) not null check (tipo_cambio > 0),
  unique (empresa_id, mes)
);

create table presupuestos (
  id uuid primary key default gen_random_uuid(),
  mes_id uuid not null references meses(id) on delete cascade,
  partida_id uuid not null references partidas(id),
  saldo_anterior numeric(14,2) not null default 0,
  presupuesto_mes numeric(14,2) not null default 0,
  moneda text not null check (moneda in ('GTQ','USD')),
  unique (mes_id, partida_id)
);

create table calendario (
  id uuid primary key default gen_random_uuid(),
  mes_id uuid not null references meses(id) on delete cascade,
  actividad text not null,
  fecha_inicio date not null,
  fecha_fin date not null check (fecha_fin >= fecha_inicio),
  notas text
);

create table kpis (
  id uuid primary key default gen_random_uuid(),
  mes_id uuid not null references meses(id) on delete cascade,
  kpi text not null,
  anio int not null,
  valor numeric,
  tipo text not null check (tipo in ('real','meta')),
  unique (mes_id, kpi, anio, tipo)
);

-- Una fila por línea del plan. Una línea se identifica por código + mes:
-- una campaña que cruza meses repite su código en el plan del mes siguiente.
create table plan_lineas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null check (codigo ~ '^[A-Z]{3}[0-9]{4}-[0-9]{3}$'),
  mes_id uuid not null references meses(id) on delete cascade,
  plan text not null default 'principal' check (plan in ('principal','extra','arrastre')),
  nombre_plan_extra text,
  actividad_id uuid not null references actividades(id),
  fecha_inicio date not null,
  fecha_fin date not null check (fecha_fin >= fecha_inicio),
  fechas_envio text,
  medio_id uuid not null references medios(id),
  objetivo_id uuid not null references objetivos(id),
  partida_id uuid not null references partidas(id),
  inversion numeric(14,2) not null check (inversion >= 0),
  moneda text not null check (moneda in ('GTQ','USD')),
  costo_estimado numeric(14,4) not null default 0,
  proyectado_manual numeric,
  carga_id uuid references cargas(id),
  unique (codigo, mes_id)
);

-- ============ Datos de plataformas ============
-- El código se extrae del nombre: "ELE2609-007 | Electro Independencia | Meta | Alcance geolocalizado".
-- Una línea puede tener varias campañas con el mismo código.
create table campanas (
  id uuid primary key default gen_random_uuid(),
  plataforma text not null check (plataforma in ('meta','google_ads','tiktok','linkedin')),
  cuenta_id text not null,
  campana_id text not null,
  nombre text not null,
  codigo text generated always as (substring(nombre from '^([A-Z]{3}[0-9]{4}-[0-9]{3})')) stored,
  actualizado_en timestamptz not null default now(),
  unique (plataforma, campana_id)
);
create index campanas_codigo_idx on campanas (codigo);

-- Métricas que sí se pueden sumar por día. El gasto se guarda en la moneda de la plataforma.
create table metricas_diarias (
  fecha date not null,
  plataforma text not null,
  campana_id text not null,
  gasto numeric(14,4) not null default 0,
  moneda text not null check (moneda in ('GTQ','USD')),
  impresiones bigint default 0,
  clics bigint default 0,
  interacciones bigint default 0,
  mensajes bigint default 0,
  leads bigint default 0,
  compras bigint default 0,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, plataforma, campana_id)
);

-- El alcance único NO se suma: se pide a la plataforma para un periodo completo.
create table alcance_periodo (
  plataforma text not null,
  campana_id text not null,
  desde date not null,
  hasta date not null,
  alcance_unico bigint not null,
  actualizado_en timestamptz not null default now(),
  primary key (plataforma, campana_id, desde, hasta)
);

-- Medios sin conexión (Basis, Claro, iSoft, Mailjet): acumulado al corte, por código.
create table metricas_csv (
  id uuid primary key default gen_random_uuid(),
  codigo text not null check (codigo ~ '^[A-Z]{3}[0-9]{4}-[0-9]{3}$'),
  mes date not null check (extract(day from mes) = 1),
  fecha_corte date not null,
  gasto numeric(14,4) not null default 0,
  moneda text not null check (moneda in ('GTQ','USD')),
  resultado numeric not null default 0,
  carga_id uuid references cargas(id),
  unique (codigo, mes, fecha_corte)
);

-- ============ Vista de control ============
create or replace view v_control as
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

-- ============ Seguridad ============
-- Lectura para usuarios autenticados; toda escritura pasa por el backend con la llave secreta.
do $$
declare t text;
begin
  foreach t in array array['empresas','medios','objetivos','actividades','partidas','cargas','meses','presupuestos',
                           'calendario','kpis','plan_lineas','campanas','metricas_diarias','alcance_periodo','metricas_csv']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t || '_lectura', t);
  end loop;
end $$;
alter view v_control set (security_invoker = true);
