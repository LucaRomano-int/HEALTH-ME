-- =====================================================================
-- HEALTH ME - Datos de prueba para health_me_db (correr DESPUÉS de 02_migracion_logica.sql)
-- Solo para desarrollo. Usa los nombres de columna de la base del equipo.
--
-- USUARIOS DE PRUEBA
--    admin@healthme.test     / Admin123!     -> administrador
--    el resto (ids 2 a 7)    / Usuario123!   -> generales
-- Las claves están hasheadas con bcrypt ($2y$): se verifican con password_verify() de PHP.
--
-- Casos que cubren a propósito:
--   id 6 "Nuevo"  -> general recién registrado, sin rol (debe ir a "elegir rol")
--   id 7 "Baja"   -> usuario con baja lógica (activo = 0; no debe poder entrar ni verse)
--   Lucía (5) figura en el grupo 1 con ingreso PENDIENTE: todavía no puede ver a Carlos
-- =====================================================================

USE health_me_db;
SET NAMES utf8mb4;

INSERT INTO padecimiento (id, nombre, descripcion) VALUES
  (1, 'Diabetes tipo 2',       'Control de glucosa y medicación oral'),
  (2, 'Hipertensión arterial', 'Control de presión sistólica y diastólica'),
  (3, 'Arritmia cardíaca',     'Seguimiento del ritmo cardíaco'),
  (4, 'Asma',                  'Enfermedad respiratoria crónica'),
  (5, 'Hipotiroidismo',        'Control hormonal con medicación diaria');

-- Rangos normales: valores de ejemplo, a validar con un profesional de la salud.
INSERT INTO tipo_medicion (id, nombre, unidad, rango_normal_min, rango_normal_max) VALUES
  (1, 'Glucosa',            'mg/dL', 70.00, 140.00),
  (2, 'Ritmo cardíaco',     'lpm',   60.00, 100.00),
  (3, 'Presión sistólica',  'mmHg',  90.00, 120.00),
  (4, 'Presión diastólica', 'mmHg',  60.00,  80.00),
  (5, 'Temperatura',        '°C',    36.00,  37.50);

INSERT INTO usuario
  (id, nombre, apellido, dni, email, password_hash, obra_social, rol, nivel, activo, fecha_inicio_seguimiento)
VALUES
  (1, 'Admin',  'HealthMe', NULL,       'admin@healthme.test',
      '$2y$10$uMEGMwaFd.QwZp/lA9yS7.ZBIfa59MlKb8JQexc7toJ.2gqLRUVzm', NULL,   NULL,          'administrador', 1, NULL),
  (2, 'Carlos', 'Gómez',    '12345678', 'carlos.gomez@example.com',
      '$2y$10$hXugwH.3UAs6Yq7PFhfTZOSWexCWO6kphTBenGaiJihK.WxfJp9Bi', 'PAMI', 'afectado',    'general',       1, '2026-09-01'),
  (3, 'Marta',  'Gómez',    '23456789', 'marta.gomez@example.com',
      '$2y$10$hXugwH.3UAs6Yq7PFhfTZOSWexCWO6kphTBenGaiJihK.WxfJp9Bi', 'OSDE', 'acompañante', 'general',       1, NULL),
  (4, 'Julia',  'Pérez',    '34567890', 'julia.perez@example.com',
      '$2y$10$hXugwH.3UAs6Yq7PFhfTZOSWexCWO6kphTBenGaiJihK.WxfJp9Bi', 'PAMI', 'afectado',    'general',       1, '2026-09-15'),
  (5, 'Lucía',  'Pérez',    '45678901', 'lucia.perez@example.com',
      '$2y$10$hXugwH.3UAs6Yq7PFhfTZOSWexCWO6kphTBenGaiJihK.WxfJp9Bi', 'OSDE', 'acompañante', 'general',       1, NULL),
  (6, 'Nuevo',  NULL,       NULL,       'nuevo@example.com',
      '$2y$10$hXugwH.3UAs6Yq7PFhfTZOSWexCWO6kphTBenGaiJihK.WxfJp9Bi', NULL,   NULL,          'general',       1, NULL),
  (7, 'Baja',   'Usuario',  '56789012', 'baja@example.com',
      '$2y$10$hXugwH.3UAs6Yq7PFhfTZOSWexCWO6kphTBenGaiJihK.WxfJp9Bi', NULL,   'afectado',    'general',       0, NULL);

INSERT INTO usuario_padecimiento (id_usuario, id_padecimiento) VALUES
  (2, 1), (2, 2), (4, 2), (4, 4);

-- PIN de 6 caracteres sin O, I, L, 0 ni 1 (mismo formato que Pin.Generar en la lógica)
INSERT INTO grupo (id, nombre, pin, id_creador) VALUES
  (1, 'Familia Gómez', 'GM4X7K', 3),
  (2, 'Familia Pérez', 'PR9H2T', 5);

INSERT INTO miembro_grupo (id_grupo, id_usuario, rol_dentro_grupo, aprobado) VALUES
  (1, 3, 'creador', 1),
  (1, 2, 'miembro', 1),
  (1, 5, 'miembro', 0),    -- Lucía se unió al grupo 1 con el PIN y espera aprobación
  (1, 7, 'miembro', 1),    -- usuario dado de baja: no debe verse aunque esté en el grupo
  (2, 5, 'creador', 1),
  (2, 4, 'miembro', 1);

INSERT INTO medicamento (id, id_usuario, nombre, presentacion, cantidad_actual, umbral_alerta_stock_bajo) VALUES
  (1, 2, 'Metformina', '850 mg - comprimidos', 40, 10),
  (2, 2, 'Enalapril',  '10 mg - comprimidos',   8, 10),   -- por debajo del umbral: stock bajo
  (3, 4, 'Losartán',   '50 mg - comprimidos',  25,  7),
  (4, 4, 'Salbutamol', 'Aerosol 100 mcg',       2,  1);

INSERT INTO recordatorio (id, id_usuario, id_medicamento, tipo, titulo, fecha_hora, repeticion, dosis_unidades, activo) VALUES
  (1, 2, 1,    'horario', 'Tomar Metformina',        '2026-09-01 08:00:00', 'diaria',  1, 1),
  (2, 2, NULL, 'evento',  'Turno con el cardiólogo', '2026-10-15 10:30:00', 'ninguna', 1, 1),
  (3, 4, 3,    'horario', 'Tomar Losartán',          '2026-09-15 09:00:00', 'diaria',  1, 1);

INSERT INTO config_alarma (id_recordatorio, dias_anticipacion) VALUES
  (1, NULL),
  (2, 2),      -- turno médico: avisa 2 días antes, 1 día antes y el mismo día
  (3, NULL);

INSERT INTO cumplimiento (id_recordatorio, fecha_hora_programada, cumplido, fecha_hora_marcado) VALUES
  (1, '2026-10-04 08:00:00', 1, '2026-10-04 08:05:00'),
  (1, '2026-10-05 08:00:00', 1, '2026-10-05 08:12:00'),
  (1, '2026-10-06 08:00:00', 0, NULL);

INSERT INTO estado_diario (id_usuario, fecha, valor) VALUES
  (2, '2026-09-05', 3), (2, '2026-09-12', 2), (2, '2026-09-19', 3), (2, '2026-09-26', 4),
  (2, '2026-10-02', 3), (2, '2026-10-03', 2), (2, '2026-10-04', 3),
  (4, '2026-10-02', 3), (4, '2026-10-03', 3), (4, '2026-10-04', 4);

-- Presión arterial = dos tipos (3 sistólica, 4 diastólica) con la misma fecha_hora
INSERT INTO medicion (id_usuario, id_tipo, valor, fecha_hora) VALUES
  -- Carlos, septiembre
  (2, 1, 110.00, '2026-09-05 08:00:00'), (2, 1, 165.00, '2026-09-12 08:00:00'),
  (2, 1, 130.00, '2026-09-19 08:10:00'), (2, 1,  95.00, '2026-09-26 08:00:00'),
  (2, 2,  88.00, '2026-09-05 08:05:00'), (2, 2, 104.00, '2026-09-12 08:05:00'),
  (2, 2,  92.00, '2026-09-19 08:15:00'),
  (2, 3, 118.00, '2026-09-05 08:10:00'), (2, 4,  78.00, '2026-09-05 08:10:00'),
  (2, 3, 126.00, '2026-09-12 08:10:00'), (2, 4,  84.00, '2026-09-12 08:10:00'),
  (2, 3, 121.00, '2026-09-19 08:20:00'), (2, 4,  82.00, '2026-09-19 08:20:00'),
  (2, 5,  36.60, '2026-09-20 20:00:00'),
  -- Carlos, octubre (período en curso). Temperatura: sin datos este mes.
  (2, 1, 102.00, '2026-10-03 08:00:00'),
  (2, 2,  90.00, '2026-10-04 08:05:00'),
  (2, 3, 119.00, '2026-10-04 08:10:00'), (2, 4,  79.00, '2026-10-04 08:10:00'),
  -- Julia, octubre
  (4, 3, 135.00, '2026-10-02 09:00:00'), (4, 4,  85.00, '2026-10-02 09:00:00'),
  (4, 3, 128.00, '2026-10-04 09:00:00'), (4, 4,  82.00, '2026-10-04 09:00:00');

INSERT INTO bitacora (id_usuario, fecha_hora, tipo, texto) VALUES
  (2, '2026-09-22 19:30:00', 'malestar', 'Mareo leve después de la cena. Se me pasó a los 20 minutos.'),
  (2, '2026-10-01 18:00:00', 'decaida',  'Cansancio todo el día, sin ganas de salir.');

INSERT INTO contacto_sos (id, id_usuario, nombre, telefono, prioridad) VALUES
  (1, 2, 'Marta Gómez', '+54 11 5555-0101', 1),
  (2, 4, 'Lucía Pérez', '+54 11 5555-0202', 1);

INSERT INTO evento_sos (id_usuario, fecha_hora, contacto_llamado) VALUES
  (2, '2026-09-22 19:40:00', 'Marta Gómez');

INSERT INTO notificacion (id_destinatario, tipo, mensaje, fecha_envio, leida) VALUES
  (2, 'stock_bajo', 'Te quedan 8 unidades de Enalapril.',                 '2026-10-06 09:00:00', 0),
  (3, 'stock_bajo', 'A Carlos le quedan 8 unidades de Enalapril.',        '2026-10-06 09:00:00', 0);

INSERT INTO consulta_contacto (id_usuario, nombre, email, asunto, mensaje, fecha_envio, mail_enviado, estado) VALUES
  (NULL, 'Ana Torres',  'ana.torres@example.com',  'Consulta sobre la app',
         'Hola, quisiera saber cuándo estará disponible en las tiendas.', '2026-10-04 15:20:00', 1, 'nueva'),
  (3,    'Marta Gómez', 'marta.gomez@example.com', 'Cómo unirme a un grupo',
         'No me queda claro dónde se ingresa el PIN del grupo.',          '2026-10-05 11:05:00', 1, 'leida');

-- ---------------------------------------------------------------------
-- Dashboard de septiembre 2026 de Carlos (primer período), calculado con SQL
-- a partir de los datos cargados. Es la referencia contra la que se contrasta
-- la lógica en C#.
-- ---------------------------------------------------------------------

INSERT INTO dashboard
  (id_usuario, periodo_inicio, periodo_fin, id_dashboard_anterior,
   estado_animo_cantidad, estado_animo_promedio, estado_animo_variacion, estado_animo_resultado)
SELECT 2, '2026-09-01', '2026-09-30', NULL, COUNT(*), ROUND(AVG(valor), 2), NULL, 'Sin datos previos'
FROM estado_diario
WHERE id_usuario = 2 AND fecha BETWEEN '2026-09-01' AND '2026-09-30';

INSERT INTO dashboard_detalle
  (id_dashboard, id_tipo, cantidad_mediciones, promedio, minimo, maximo,
   porcentaje_en_rango, variacion_promedio, variacion_en_rango, resultado)
SELECT d.id, m.id_tipo, COUNT(*), ROUND(AVG(m.valor), 2), MIN(m.valor), MAX(m.valor),
       ROUND(100 * SUM(m.valor BETWEEN t.rango_normal_min AND t.rango_normal_max) / COUNT(*), 2),
       NULL, NULL, 'Sin datos previos'
FROM medicion m
JOIN tipo_medicion t ON t.id = m.id_tipo
JOIN dashboard d     ON d.id_usuario = m.id_usuario AND d.periodo_inicio = '2026-09-01'
WHERE m.id_usuario = 2
  AND m.fecha_hora >= '2026-09-01' AND m.fecha_hora < '2026-10-01'
GROUP BY d.id, m.id_tipo;
