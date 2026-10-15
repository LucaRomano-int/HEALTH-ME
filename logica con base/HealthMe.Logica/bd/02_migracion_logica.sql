-- =====================================================================
-- HEALTH ME - Migración de la base `health_me_db` para la lógica
-- Se corre UNA sola vez, DESPUÉS de importar health_me_db.sql (el volcado original).
-- Importar con juego de caracteres UTF-8 (hay valores con "ñ").
--
-- Respeta la convención del equipo: PK `id` BIGINT, FK `id_usuario` BIGINT,
-- `tipo_medicion.id` INT, FK con ON UPDATE CASCADE. Por eso las tablas nuevas usan
-- BIGINT con signo: si una FK no tiene EXACTAMENTE el mismo tipo que la columna a la
-- que apunta, MySQL la rechaza.
--
-- Si ya cargaron filas en recordatorio o config_alarma, avisen: el cambio de tipo de
-- repeticion y dias_anticipacion falla si hay textos que no sean valores válidos.
-- Para volver atrás: reimportar health_me_db.sql sobre una base vacía.
-- =====================================================================

USE health_me_db;
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. USUARIO: tres niveles, baja lógica y registro en dos pasos
-- ---------------------------------------------------------------------
-- * apellido y dni pasan a admitir NULL: el registro público pide solo nombre,
--   correo y clave; el resto se completa después (si no, el INSERT del registro falla).
-- * rol admite NULL y sin valor por defecto: el administrador no tiene rol, y un usuario
--   recién registrado todavía no eligió entre acompañante y afectado.
--   (Antes el DEFAULT 'afectado' lo asignaba en silencio.)
-- * nivel: permisos en el sistema (administrador / general). Es independiente del rol.
-- * activo: baja lógica (el login debe rechazar activo = 0).

ALTER TABLE usuario
  MODIFY apellido VARCHAR(100) NULL,
  MODIFY dni      VARCHAR(20)  NULL,
  MODIFY rol      ENUM('acompañante','afectado') NULL DEFAULT NULL,
  ADD COLUMN nivel ENUM('administrador','general') NOT NULL DEFAULT 'general' AFTER rol,
  ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1 AFTER nivel,
  ADD COLUMN fecha_inicio_seguimiento DATE NULL AFTER activo,
  ADD KEY idx_usuario_apellido_nombre (apellido, nombre),
  ADD CONSTRAINT chk_usuario_nivel_rol CHECK (nivel = 'general' OR rol IS NULL);

-- ---------------------------------------------------------------------
-- 2. GRUPOS: PIN de acceso y aprobación de ingresos
-- ---------------------------------------------------------------------
-- El alcance del proyecto dice que el grupo se identifica con un código/PIN, pero la
-- tabla grupo no lo tenía. Es UNIQUE; admite NULL para no romper grupos sin PIN.
-- aprobado: PROPUESTA pendiente de confirmar con el equipo. Con DEFAULT 1 no cambia nada
-- hasta que el código de "unirse con PIN" empiece a insertar aprobado = 0.

ALTER TABLE grupo
  ADD COLUMN pin VARCHAR(10) NULL AFTER nombre,
  ADD COLUMN id_creador BIGINT(20) NULL AFTER pin,
  ADD UNIQUE KEY uq_grupo_pin (pin),
  ADD KEY idx_grupo_creador (id_creador),
  ADD CONSTRAINT fk_grupo_creador FOREIGN KEY (id_creador) REFERENCES usuario (id)
      ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE miembro_grupo
  ADD COLUMN aprobado TINYINT(1) NOT NULL DEFAULT 1 AFTER rol_dentro_grupo;

-- ---------------------------------------------------------------------
-- 3. TIPOS DE MEDICIÓN: rangos normales (necesarios para el dashboard)
-- ---------------------------------------------------------------------
-- Sin rango no se puede calcular el % de mediciones "en rango". Los rangos de los datos
-- de ejemplo son supuestos: hay que validarlos con alguien del área de salud.

ALTER TABLE tipo_medicion
  ADD COLUMN rango_normal_min DECIMAL(8,2) NULL,
  ADD COLUMN rango_normal_max DECIMAL(8,2) NULL,
  ADD UNIQUE KEY uq_tipo_medicion_nombre (nombre),
  ADD CONSTRAINT chk_tipo_rango CHECK (rango_normal_min <= rango_normal_max);

-- ---------------------------------------------------------------------
-- 4. MEDICIÓN: sin duplicados e índice para el dashboard
-- ---------------------------------------------------------------------
-- La presión arterial se carga como DOS tipos (sistólica y diastólica) con la misma
-- fecha_hora. La columna valor2 queda sin uso por la lógica; cuando el equipo lo confirme
-- se puede eliminar:  ALTER TABLE medicion DROP COLUMN valor2;

ALTER TABLE medicion
  ADD UNIQUE KEY uq_medicion_usuario_tipo_fecha (id_usuario, id_tipo, fecha_hora);

-- ---------------------------------------------------------------------
-- 5. BORRADOS PELIGROSOS: los catálogos no se borran si están en uso
-- ---------------------------------------------------------------------
-- Antes, borrar un tipo de medición (o un padecimiento) desde el ABM del admin eliminaba
-- en cascada TODAS las mediciones (o asociaciones) que lo usaban. Con RESTRICT, el ABM
-- tiene que mostrar "no se puede eliminar, está en uso".

ALTER TABLE medicion DROP FOREIGN KEY medicion_ibfk_2;
ALTER TABLE medicion
  ADD CONSTRAINT medicion_ibfk_2 FOREIGN KEY (id_tipo) REFERENCES tipo_medicion (id)
      ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE usuario_padecimiento DROP FOREIGN KEY usuario_padecimiento_ibfk_2;
ALTER TABLE usuario_padecimiento
  ADD CONSTRAINT usuario_padecimiento_ibfk_2 FOREIGN KEY (id_padecimiento) REFERENCES padecimiento (id)
      ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 6. RECORDATORIOS: valores controlados
-- ---------------------------------------------------------------------
-- repeticion era VARCHAR(100) libre (cada pantalla podía escribir algo distinto).
-- dosis_unidades: cuántas unidades se descuentan del stock al marcar la toma.
-- dias_anticipacion era VARCHAR(50): ahora es un número (2 = avisa 2 días antes,
-- 1 día antes y el mismo día).

UPDATE recordatorio SET repeticion = 'ninguna' WHERE repeticion IS NULL OR repeticion = '';

ALTER TABLE recordatorio
  MODIFY repeticion ENUM('ninguna','diaria','semanal') NOT NULL DEFAULT 'ninguna',
  ADD COLUMN dosis_unidades TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER repeticion;

ALTER TABLE config_alarma
  MODIFY dias_anticipacion TINYINT UNSIGNED NULL;

-- ---------------------------------------------------------------------
-- 7. DASHBOARD POR PERÍODO (mensual): reemplaza a dashboard_semanal
-- ---------------------------------------------------------------------
-- El período arranca en usuario.fecha_inicio_seguimiento y dura un mes. Se guarda como
-- snapshot (cabecera + detalle por tipo) para comparar contra el período anterior sin
-- recalcular. dashboard_semanal queda sin uso (no se borra por si tiene datos).
-- resultado: 'Mejoró' | 'Empeoró' | 'Sin cambios' | 'Sin datos previos'
--            | 'Sin datos en el período' | 'Sin rango definido'

CREATE TABLE dashboard (
  id                      BIGINT(20) NOT NULL AUTO_INCREMENT,
  id_usuario              BIGINT(20) NOT NULL,
  periodo_inicio          DATE NOT NULL,
  periodo_fin             DATE NOT NULL,
  fecha_generacion        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_dashboard_anterior   BIGINT(20) NULL,
  estado_animo_cantidad   SMALLINT NOT NULL DEFAULT 0,
  estado_animo_promedio   DECIMAL(3,2) NULL,
  estado_animo_variacion  DECIMAL(3,2) NULL,
  estado_animo_resultado  VARCHAR(30) NOT NULL DEFAULT 'Sin datos previos',
  PRIMARY KEY (id),
  UNIQUE KEY uq_dashboard_periodo (id_usuario, periodo_inicio),
  KEY idx_dashboard_anterior (id_dashboard_anterior),
  CONSTRAINT dashboard_ibfk_1 FOREIGN KEY (id_usuario) REFERENCES usuario (id)
      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT dashboard_ibfk_2 FOREIGN KEY (id_dashboard_anterior) REFERENCES dashboard (id)
      ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_dashboard_periodo CHECK (periodo_fin >= periodo_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dashboard_detalle (
  id                    BIGINT(20) NOT NULL AUTO_INCREMENT,
  id_dashboard          BIGINT(20) NOT NULL,
  id_tipo               INT(11) NOT NULL,
  cantidad_mediciones   INT NOT NULL DEFAULT 0,
  promedio              DECIMAL(8,2) NULL,
  minimo                DECIMAL(8,2) NULL,
  maximo                DECIMAL(8,2) NULL,
  porcentaje_en_rango   DECIMAL(5,2) NULL,
  variacion_promedio    DECIMAL(8,2) NULL,
  variacion_en_rango    DECIMAL(5,2) NULL,
  resultado             VARCHAR(30) NOT NULL DEFAULT 'Sin datos previos',
  PRIMARY KEY (id),
  UNIQUE KEY uq_detalle (id_dashboard, id_tipo),
  KEY idx_detalle_tipo (id_tipo),
  CONSTRAINT dashboard_detalle_ibfk_1 FOREIGN KEY (id_dashboard) REFERENCES dashboard (id)
      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT dashboard_detalle_ibfk_2 FOREIGN KEY (id_tipo) REFERENCES tipo_medicion (id)
      ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. CONSULTAS DE CONTACTO: la "tabla de contactos" que pide el parcial (punto 5)
--    Guarda lo que llega por el formulario de la página de contacto, junto con mail().
--    No confundir con contacto_sos.
-- ---------------------------------------------------------------------

CREATE TABLE consulta_contacto (
  id            BIGINT(20) NOT NULL AUTO_INCREMENT,
  id_usuario    BIGINT(20) NULL,
  nombre        VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  asunto        VARCHAR(150) NOT NULL,
  mensaje       TEXT NOT NULL,
  fecha_envio   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  mail_enviado  TINYINT(1) NOT NULL DEFAULT 0,
  estado        ENUM('nueva','leida','respondida') NOT NULL DEFAULT 'nueva',
  PRIMARY KEY (id),
  KEY idx_consulta_estado (estado, fecha_envio),
  KEY idx_consulta_usuario (id_usuario),
  CONSTRAINT consulta_contacto_ibfk_1 FOREIGN KEY (id_usuario) REFERENCES usuario (id)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. VISTA: qué afectados puede ver cada acompañante
--    Mismos criterios que Permisos.PuedeVerDatosDeSalud de la lógica en C#:
--    ambos activos, nivel general, ingreso aprobado y al menos un grupo en común.
--    Uso:  SELECT id_afectado FROM v_acompanante_afectado WHERE id_acompanante = ?
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW v_acompanante_afectado AS
SELECT DISTINCT
       mg_a.id_usuario AS id_acompanante,
       mg_f.id_usuario AS id_afectado
FROM miembro_grupo mg_a
JOIN usuario ua         ON ua.id = mg_a.id_usuario AND ua.rol = 'acompañante' AND ua.nivel = 'general' AND ua.activo = 1
JOIN miembro_grupo mg_f ON mg_f.id_grupo = mg_a.id_grupo
JOIN usuario uf         ON uf.id = mg_f.id_usuario AND uf.rol = 'afectado'    AND uf.nivel = 'general' AND uf.activo = 1
WHERE mg_a.aprobado = 1 AND mg_f.aprobado = 1;
