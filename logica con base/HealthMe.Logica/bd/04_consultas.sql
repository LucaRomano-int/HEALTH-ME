-- =====================================================================
-- HEALTH ME - Consultas que necesita la lógica (probadas sobre health_me_db migrada)
-- En PHP se usan con PDO y parámetros (?), NUNCA concatenando texto del usuario.
-- Acá los parámetros son variables (@u, @inicio...) para poder correrlas tal cual.
-- =====================================================================

USE health_me_db;
-- La collation de la sesión debe coincidir con la de las columnas (utf8mb4_unicode_ci); si no,
-- comparar contra una variable @x da "Illegal mix of collations". Con parámetros de PDO no ocurre.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Q1. LOGIN: buscar al usuario por correo (comparar la clave en PHP con password_verify)
--     Después del login, Permisos.DestinoTrasLogin decide a dónde va según nivel, rol y activo.
-- ---------------------------------------------------------------------
SET @email = 'marta.gomez@example.com';
SELECT id, nombre, password_hash, nivel, rol, activo
FROM usuario
WHERE email = @email;

-- ---------------------------------------------------------------------
-- Q2. ¿Qué afectados puede ver un acompañante?  (equivale a Permisos.PuedeVerDatosDeSalud)
-- ---------------------------------------------------------------------
SET @acompanante = 3;
SELECT id_afectado FROM v_acompanante_afectado WHERE id_acompanante = @acompanante;

-- ---------------------------------------------------------------------
-- Q3. ESTADÍSTICA POR TIPO EN UN PERÍODO  (equivale a Dashboard.EstadisticaDeTipo)
--     * El filtro de fechas es  >= inicio  AND  < fin + 1 día.  NO usar
--       BETWEEN '2026-09-01' AND '2026-09-30' sobre un DATETIME: '2026-09-30' significa
--       las 00:00, y se pierden todas las mediciones del último día.
--     * % en rango: NULL si el tipo no tiene rango válido (la lógica lo marca "Sin rango definido").
--     * Se llama una vez para el período actual y otra para el anterior; la comparación
--       (Mejoró / Empeoró...) la hace la lógica, no el SQL.
-- ---------------------------------------------------------------------
SET @u = 2, @inicio = '2026-09-01', @fin = '2026-09-30';
SELECT m.id_tipo,
       COUNT(*)                   AS cantidad,
       ROUND(AVG(m.valor), 2)     AS promedio,
       MIN(m.valor)               AS minimo,
       MAX(m.valor)               AS maximo,
       CASE
         WHEN t.rango_normal_min IS NULL OR t.rango_normal_max IS NULL
              OR t.rango_normal_min > t.rango_normal_max THEN NULL
         ELSE ROUND(100 * SUM(m.valor BETWEEN t.rango_normal_min AND t.rango_normal_max) / COUNT(*), 2)
       END                        AS porcentaje_en_rango
FROM medicion m
JOIN tipo_medicion t ON t.id = m.id_tipo
WHERE m.id_usuario = @u
  AND m.fecha_hora >= @inicio
  AND m.fecha_hora <  DATE_ADD(@fin, INTERVAL 1 DAY)
GROUP BY m.id_tipo, t.rango_normal_min, t.rango_normal_max
ORDER BY m.id_tipo;

-- ---------------------------------------------------------------------
-- Q4. ESTADO DE ÁNIMO EN UN PERÍODO  (estado_diario.fecha es DATE: BETWEEN sí sirve)
-- ---------------------------------------------------------------------
SELECT COUNT(*) AS cantidad, ROUND(AVG(valor), 2) AS promedio
FROM estado_diario
WHERE id_usuario = @u AND fecha BETWEEN @inicio AND @fin;

-- ---------------------------------------------------------------------
-- Q5. MEDICAMENTOS CON STOCK BAJO  (misma regla que Inventario.EstaBajoUmbral: <=)
-- ---------------------------------------------------------------------
SELECT id, nombre, cantidad_actual, umbral_alerta_stock_bajo
FROM medicamento
WHERE id_usuario = @u AND cantidad_actual <= umbral_alerta_stock_bajo;

-- ---------------------------------------------------------------------
-- Q6. DESCONTAR STOCK AL MARCAR UNA TOMA  (equivale a Inventario.Descontar)
--     En esta base cantidad_actual es INT CON signo: sin GREATEST el stock quedaría negativo
--     en silencio. El AND id_usuario evita tocar un medicamento ajeno.
-- ---------------------------------------------------------------------
SET @medicamento = 2, @dosis = 1;
UPDATE medicamento
SET cantidad_actual = GREATEST(cantidad_actual - @dosis, 0)
WHERE id = @medicamento AND id_usuario = @u;
SELECT id, nombre, cantidad_actual FROM medicamento WHERE id = @medicamento;   -- 7
UPDATE medicamento SET cantidad_actual = 8 WHERE id = @medicamento;            -- se restaura el dato de prueba

-- ---------------------------------------------------------------------
-- Q7. BUSCADOR DE MEDICAMENTOS del usuario (por nombre)
--     Ojo: si el texto trae % o _, hay que escaparlos en PHP antes de armar el patrón.
-- ---------------------------------------------------------------------
SET @texto = 'met';
SELECT id, nombre, presentacion, cantidad_actual
FROM medicamento
WHERE id_usuario = @u AND nombre LIKE CONCAT('%', @texto, '%')
ORDER BY nombre;

-- ---------------------------------------------------------------------
-- Q8. RECORDATORIOS ACTIVOS de un usuario (la próxima ocurrencia la calcula la lógica)
-- ---------------------------------------------------------------------
SELECT r.id, r.id_medicamento, r.tipo, r.titulo, r.fecha_hora, r.repeticion, r.dosis_unidades,
       c.dias_anticipacion
FROM recordatorio r
LEFT JOIN config_alarma c ON c.id_recordatorio = r.id
WHERE r.id_usuario = @u AND r.activo = 1
ORDER BY r.fecha_hora;

-- ---------------------------------------------------------------------
-- Q9. BUSCADOR DE USUARIOS PARA EL ADMIN (nombre, apellido, correo o DNI)
-- ---------------------------------------------------------------------
SET @q = 'pér';
SELECT id, nombre, apellido, email, dni, nivel, rol, activo
FROM usuario
WHERE nombre LIKE CONCAT('%', @q, '%') OR apellido LIKE CONCAT('%', @q, '%')
   OR email  LIKE CONCAT('%', @q, '%') OR dni      LIKE CONCAT('%', @q, '%')
ORDER BY apellido, nombre;
