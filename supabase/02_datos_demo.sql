-- ============================================================
-- SGCGP: DATOS DE DEMOSTRACIÓN (opcional)
-- Genera 8 meses de gastos aprobados para que el módulo de Machine
-- Learning tenga historial, presupuestos y un gasto atípico.
-- REQUISITO: ya existe un usuario con rol 'administrador'.
-- Todos los registros demo llevan el comprobante 'DEMO-...' para borrarlos:
--   DELETE FROM public.gastos_SGCGP WHERE numero_comprobante LIKE 'DEMO-%';
-- ============================================================
DO $$
DECLARE
    v_admin INTEGER; v_p1 INTEGER; v_p2 INTEGER; v_cat INTEGER;
    m INTEGER; i INTEGER; c RECORD; f DATE; hoy DATE := (NOW() AT TIME ZONE 'America/La_Paz')::DATE;
BEGIN
    SELECT id_usuario INTO v_admin FROM public.usuarios_SGCGP WHERE rol = 'administrador' AND estado LIMIT 1;
    IF v_admin IS NULL THEN
        RAISE EXCEPTION 'Primero registra una cuenta y asígnale el rol administrador (ver README).';
    END IF;

    INSERT INTO public.proveedores_SGCGP (nombre, nit) VALUES
        ('Papelería Central', '1023456017'), ('Librería Cochabamba', '1098765012')
    ON CONFLICT (nit) DO NOTHING;
    SELECT id_proveedor INTO v_p1 FROM public.proveedores_SGCGP WHERE nit = '1023456017';
    SELECT id_proveedor INTO v_p2 FROM public.proveedores_SGCGP WHERE nit = '1098765012';

    FOR m IN 0..8 LOOP
        INSERT INTO public.presupuesto_SGCGP (mes, anio, monto_limite, creado_por)
        VALUES (EXTRACT(MONTH FROM (date_trunc('month', hoy) - make_interval(months => m)))::INT,
                EXTRACT(YEAR  FROM (date_trunc('month', hoy) - make_interval(months => m)))::INT, 1500, v_admin)
        ON CONFLICT (mes, anio) DO NOTHING;
    END LOOP;
    INSERT INTO public.presupuesto_SGCGP (mes, anio, monto_limite, creado_por)
    VALUES (EXTRACT(MONTH FROM (date_trunc('month', hoy) + INTERVAL '1 month'))::INT,
            EXTRACT(YEAR  FROM (date_trunc('month', hoy) + INTERVAL '1 month'))::INT, 1500, v_admin)
    ON CONFLICT (mes, anio) DO NOTHING;

    FOR m IN 1..8 LOOP
        FOR c IN SELECT id_categoria FROM public.categorias_SGCGP WHERE estado LOOP
            FOR i IN 1..4 LOOP
                f := (date_trunc('month', hoy) - make_interval(months => m))::DATE + (i * 6 - 3);
                INSERT INTO public.gastos_SGCGP
                    (concepto, categoria_id, proveedor_id, usuario_id, monto, fecha, estado, registrado_por,
                     justificacion, numero_comprobante, tipo_comprobante)
                VALUES ('Compra de demostración', c.id_categoria, CASE WHEN i % 2 = 0 THEN v_p1 ELSE v_p2 END, v_admin,
                        ROUND((35 + random() * 25 + (9 - m) * 2.5)::NUMERIC, 2), f, 'aprobado', v_admin,
                        'Dato de demostración para el análisis de Machine Learning',
                        'DEMO-' || m || '-' || c.id_categoria || '-' || i, 'Factura');
            END LOOP;
        END LOOP;
    END LOOP;

    -- Un gasto atípico reciente para que el detector de anomalías tenga algo que encontrar.
    SELECT id_categoria INTO v_cat FROM public.categorias_SGCGP WHERE estado ORDER BY id_categoria LIMIT 1;
    INSERT INTO public.gastos_SGCGP (concepto, categoria_id, proveedor_id, usuario_id, monto, fecha, estado, registrado_por, justificacion, numero_comprobante, tipo_comprobante)
    VALUES ('Compra inusual de demostración', v_cat, v_p1, v_admin, 1250.00, hoy, 'pendiente', v_admin, 'Gasto atípico de demostración', 'DEMO-ATIPICO', 'Factura');
END $$;
