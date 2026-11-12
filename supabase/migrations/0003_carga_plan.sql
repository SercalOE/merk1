-- Merk1 · carga del plan mensual desde la pantalla /cargar.
-- 1) Bucket privado para guardar el Excel original de cada carga.
-- 2) Función que aplica una carga validada en una sola transacción.

-- ============ Storage ============
-- Privado y sin políticas: solo el backend con la llave secreta puede leer y escribir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cargas', 'cargas', false, 5242880,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

-- ============ Aplicar carga ============
-- p_datos = { "meses": [ { empresa_codigo, mes: "AAAA-MM", tipo_cambio,
--             presupuestos: [...], calendario: [...], kpis: [...], lineas: [...] } ] }
-- Los nombres de catálogo ya vienen con su nombre oficial (los normaliza la app).
--
-- Por cada empresa + mes:
--   · meses: upsert (conserva el id, actualiza el tipo de cambio).
--   · presupuestos, calendario, kpis: se reemplazan completos.
--   · plan_lineas: upsert por (codigo, mes_id) para conservar el id de cada línea;
--     se borran solo las líneas que ya no vienen en el Excel.
-- Si algo falla, no se guarda nada.
create or replace function aplicar_carga_plan(p_carga_id uuid, p_datos jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  m jsonb;
  v_empresa_id uuid;
  v_mes date;
  v_mes_id uuid;
  v_esperadas int;
  v_n int;
  v_creadas int;
  v_actualizadas int;
  v_eliminadas int;
  v_meses jsonb := '[]'::jsonb;
begin
  -- La carga debe existir y estar pendiente. El bloqueo evita aplicarla dos veces.
  perform 1 from cargas
   where id = p_carga_id and tipo = 'plan' and estado = 'validando'
   for update;
  if not found then
    raise exception 'La carga % no existe o ya no está pendiente.', p_carga_id;
  end if;

  for m in select * from jsonb_array_elements(p_datos -> 'meses') loop
    select id into v_empresa_id from empresas where codigo = m ->> 'empresa_codigo';
    if v_empresa_id is null then
      raise exception 'Empresa % no existe.', m ->> 'empresa_codigo';
    end if;
    v_mes := ((m ->> 'mes') || '-01')::date;

    insert into meses (empresa_id, mes, tipo_cambio)
    values (v_empresa_id, v_mes, (m ->> 'tipo_cambio')::numeric)
    on conflict (empresa_id, mes) do update set tipo_cambio = excluded.tipo_cambio
    returning id into v_mes_id;

    -- ---- Presupuestos (reemplazo completo) ----
    delete from presupuestos where mes_id = v_mes_id;
    insert into presupuestos (mes_id, partida_id, saldo_anterior, presupuesto_mes, moneda)
    select v_mes_id, p.id, (x ->> 'saldo_anterior')::numeric, (x ->> 'presupuesto_mes')::numeric, x ->> 'moneda'
      from jsonb_array_elements(m -> 'presupuestos') x
      join partidas p on p.nombre = x ->> 'partida';
    get diagnostics v_n = row_count;
    v_esperadas := jsonb_array_length(m -> 'presupuestos');
    if v_n <> v_esperadas then
      raise exception 'Presupuesto de % %: % filas, % con partida válida.', m ->> 'empresa_codigo', m ->> 'mes', v_esperadas, v_n;
    end if;

    -- ---- Calendario (reemplazo completo) ----
    delete from calendario where mes_id = v_mes_id;
    insert into calendario (mes_id, actividad, fecha_inicio, fecha_fin, notas)
    select v_mes_id, x ->> 'actividad', (x ->> 'fecha_inicio')::date, (x ->> 'fecha_fin')::date, x ->> 'notas'
      from jsonb_array_elements(m -> 'calendario') x;

    -- ---- KPIs (reemplazo completo) ----
    delete from kpis where mes_id = v_mes_id;
    insert into kpis (mes_id, kpi, anio, valor, tipo)
    select v_mes_id, x ->> 'kpi', (x ->> 'anio')::int, (x ->> 'valor')::numeric, x ->> 'tipo'
      from jsonb_array_elements(m -> 'kpis') x;

    -- ---- Líneas del plan (upsert; borra solo las que ya no vienen) ----
    delete from plan_lineas
     where mes_id = v_mes_id
       and codigo not in (select x ->> 'codigo' from jsonb_array_elements(m -> 'lineas') x);
    get diagnostics v_eliminadas = row_count;

    with entrada as (
      select x ->> 'codigo' as codigo,
             x ->> 'plan' as plan,
             x ->> 'nombre_plan_extra' as nombre_plan_extra,
             a.id as actividad_id,
             (x ->> 'fecha_inicio')::date as fecha_inicio,
             (x ->> 'fecha_fin')::date as fecha_fin,
             x ->> 'fechas_envio' as fechas_envio,
             md.id as medio_id,
             o.id as objetivo_id,
             p.id as partida_id,
             (x ->> 'inversion')::numeric as inversion,
             x ->> 'moneda' as moneda,
             (x ->> 'costo_estimado')::numeric as costo_estimado,
             (x ->> 'proyectado_manual')::numeric as proyectado_manual
        from jsonb_array_elements(m -> 'lineas') x
        join actividades a on a.nombre = x ->> 'actividad'
        join medios md on md.nombre = x ->> 'medio'
        join objetivos o on o.nombre = x ->> 'objetivo'
        join partidas p on p.nombre = x ->> 'partida'
    ),
    guardadas as (
      insert into plan_lineas (codigo, mes_id, plan, nombre_plan_extra, actividad_id, fecha_inicio, fecha_fin,
                               fechas_envio, medio_id, objetivo_id, partida_id, inversion, moneda,
                               costo_estimado, proyectado_manual, carga_id)
      select codigo, v_mes_id, plan, nombre_plan_extra, actividad_id, fecha_inicio, fecha_fin,
             fechas_envio, medio_id, objetivo_id, partida_id, inversion, moneda,
             costo_estimado, proyectado_manual, p_carga_id
        from entrada
      on conflict (codigo, mes_id) do update set
        plan = excluded.plan,
        nombre_plan_extra = excluded.nombre_plan_extra,
        actividad_id = excluded.actividad_id,
        fecha_inicio = excluded.fecha_inicio,
        fecha_fin = excluded.fecha_fin,
        fechas_envio = excluded.fechas_envio,
        medio_id = excluded.medio_id,
        objetivo_id = excluded.objetivo_id,
        partida_id = excluded.partida_id,
        inversion = excluded.inversion,
        moneda = excluded.moneda,
        costo_estimado = excluded.costo_estimado,
        proyectado_manual = excluded.proyectado_manual,
        carga_id = excluded.carga_id
      returning (xmax = 0) as nueva -- xmax = 0: la fila se insertó; si no, se actualizó
    )
    select count(*) filter (where nueva), count(*) filter (where not nueva)
      into v_creadas, v_actualizadas
      from guardadas;

    v_esperadas := jsonb_array_length(m -> 'lineas');
    if v_creadas + v_actualizadas <> v_esperadas then
      raise exception 'Plan de % %: % líneas, % con catálogos válidos.',
        m ->> 'empresa_codigo', m ->> 'mes', v_esperadas, v_creadas + v_actualizadas;
    end if;

    v_meses := v_meses || jsonb_build_object(
      'empresa_codigo', m ->> 'empresa_codigo',
      'mes', m ->> 'mes',
      'creadas', v_creadas,
      'actualizadas', v_actualizadas,
      'eliminadas', v_eliminadas
    );
  end loop;

  update cargas set estado = 'aplicada' where id = p_carga_id;
  return jsonb_build_object('meses', v_meses);
end;
$$;

-- Solo el backend (llave secreta = service_role) puede aplicar cargas.
revoke all on function aplicar_carga_plan(uuid, jsonb) from public, anon, authenticated;
grant execute on function aplicar_carga_plan(uuid, jsonb) to service_role;
