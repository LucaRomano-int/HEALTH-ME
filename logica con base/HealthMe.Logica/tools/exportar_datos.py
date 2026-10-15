"""
Exporta a JSON las filas de health_me_db (tal como las devuelve MySQL) y los resultados
que calcula el SQL (vista de acompañantes y estadísticas por período). Con ese archivo la
lógica en C# se contrasta contra la base:   dotnet run -- bd datos/datos_bd.json

Uso:  python exportar_datos.py [salida.json]
Necesita:  pip install pymysql
Por defecto se conecta como en XAMPP (127.0.0.1:3306, usuario root, sin clave). Se puede cambiar con
las variables de entorno HM_HOST, HM_PORT, HM_USER, HM_PASS (o HM_SOCKET para un socket unix).
"""
import json, os, sys, decimal, datetime
import pymysql

if os.environ.get("HM_SOCKET"):
    CONEXION = dict(unix_socket=os.environ["HM_SOCKET"], user=os.environ.get("HM_USER", "root"),
                    database="health_me_db", charset="utf8mb4")
else:
    CONEXION = dict(host=os.environ.get("HM_HOST", "127.0.0.1"), port=int(os.environ.get("HM_PORT", "3306")),
                    user=os.environ.get("HM_USER", "root"), password=os.environ.get("HM_PASS", ""),
                    database="health_me_db", charset="utf8mb4")
TABLAS = ["usuario", "miembro_grupo", "tipo_medicion", "medicion", "estado_diario",
          "medicamento", "recordatorio", "config_alarma"]

# Misma consulta que Q3 / Q4 de bd/04_consultas.sql
Q_ESTADISTICA = """
SELECT m.id_tipo, COUNT(*) AS cantidad, ROUND(AVG(m.valor), 2) AS promedio,
       MIN(m.valor) AS minimo, MAX(m.valor) AS maximo,
       CASE WHEN t.rango_normal_min IS NULL OR t.rango_normal_max IS NULL
                 OR t.rango_normal_min > t.rango_normal_max THEN NULL
            ELSE ROUND(100 * SUM(m.valor BETWEEN t.rango_normal_min AND t.rango_normal_max) / COUNT(*), 2) END AS porcentaje_en_rango
FROM medicion m JOIN tipo_medicion t ON t.id = m.id_tipo
WHERE m.id_usuario = %s AND m.fecha_hora >= %s AND m.fecha_hora < DATE_ADD(%s, INTERVAL 1 DAY)
GROUP BY m.id_tipo, t.rango_normal_min, t.rango_normal_max ORDER BY m.id_tipo"""
Q_ANIMO = """SELECT COUNT(*) AS cantidad, ROUND(AVG(valor), 2) AS promedio
FROM estado_diario WHERE id_usuario = %s AND fecha BETWEEN %s AND %s"""

# (usuario, inicio, fin): septiembre y octubre de Carlos, y el primer período de Julia
PERIODOS = [(2, "2026-09-01", "2026-09-30"), (2, "2026-10-01", "2026-10-31"), (4, "2026-09-15", "2026-10-14")]

def jsonable(v):
    if isinstance(v, decimal.Decimal): return float(v)
    if isinstance(v, (datetime.datetime, datetime.date)): return str(v)
    if isinstance(v, (bytes, bytearray)): return v.decode("utf-8")
    return v

def filas(cur):
    cols = [c[0] for c in cur.description]
    return [{c: jsonable(v) for c, v in zip(cols, r)} for r in cur.fetchall()]

con = pymysql.connect(**CONEXION)
cur = con.cursor()
salida = {}
for t in TABLAS:
    cur.execute(f"SELECT * FROM `{t}` ORDER BY 1, 2" if t == "miembro_grupo" else f"SELECT * FROM `{t}` ORDER BY 1")
    salida[t] = filas(cur)

esperado = {"estadisticas": [], "animo": []}
cur.execute("SELECT id_acompanante, id_afectado FROM v_acompanante_afectado ORDER BY 1, 2")
esperado["visibles"] = filas(cur)
for u, ini, fin in PERIODOS:
    cur.execute(Q_ESTADISTICA, (u, ini, fin))
    for f in filas(cur):
        esperado["estadisticas"].append({"id_usuario": u, "periodo_inicio": ini, "periodo_fin": fin, **f})
    cur.execute(Q_ANIMO, (u, ini, fin))
    for f in filas(cur):
        esperado["animo"].append({"id_usuario": u, "periodo_inicio": ini, "periodo_fin": fin, **f})
salida["esperado_sql"] = esperado

destino = sys.argv[1] if len(sys.argv) > 1 else "datos_bd.json"
with open(destino, "w", encoding="utf-8") as f:
    json.dump(salida, f, ensure_ascii=False, indent=1)
print("exportado a", destino, {t: len(salida[t]) for t in TABLAS})
