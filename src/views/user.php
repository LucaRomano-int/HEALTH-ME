<?php
// Nota interna: este archivo va en la raíz del proyecto (junto a login.html), no dentro de /php.

require_once __DIR__ . '/php/verificar_sesion.php'; // archivo "portero"

// Si llegó hasta acá, hay sesión iniciada
$nombre = htmlspecialchars($_SESSION['nombre'] . ' ' . $_SESSION['apellido'], ENT_QUOTES, 'UTF-8');
?>

<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HealthMe - Panel de Usuario</title>
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="css/user.css">
  </head>
  <body>

    <!-- NAVBAR -->
    <header class="navbar" id="main-navbar">
      <div class="navbar-container">
        <div class="nav-logo">
          <a href="https://lucaromano-int.github.io/HEALTH-ME/index.html">
            <img src="img/logos/logoHealthMeCeleste.png" alt="Logo HealthMe" class="logo-img"> 
          </a>
        </div>

        <!-- BOTÓN MENÚ HAMBURGUESA -->
        <button class="menu-toggle" id="menu-toggle" aria-label="Abrir menú">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </button>

        <nav class="nav-links" id="nav-links">
          <a href="https://lucaromano-int.github.io/HEALTH-ME/index.html" class="nav-link">HOME</a>
          <a href="api/logout.php" class="nav-link">CERRAR SESIÓN</a>
          <a href="contact.html" class="nav-link">CONTACTO</a>
          <span class="nav-link">Hola, <span id="nombreUsuario"><?= $nombre ?></span></span>
        </nav>
      </div>
    </header>

    <!-- CONTENEDOR PRINCIPAL FIX DE PANTALLA -->
    <main class="user-main-viewport">
      <div class="user-layout-grid">
        
        <!-- CONTENEDOR DEL MENÚ CON BARRA LATERAL UNIFICADA -->
        <div class="menu-with-indicator-container">
          <!-- MENÚ IZQUIERDO DE FUNCIONES -->
          <aside class="functions-sidebar">
            <div class="functions-menu-list" id="functionsMenuList"></div>
          </aside>

          <!-- BARRA VERTICAL UNIFICADA E ILUMINADA POR PARTES -->
          <div class="segmented-indicator-bar" id="segmentedIndicatorBar"></div>
        </div>

        <!-- PANEL CONTENEDOR DE VISTAS/UI -->
        <section class="function-display-area" id="functionDisplayArea">
          <!-- Las pantallas con sus UI se insertan aquí vía JS -->
        </section>

      </div>

      <!--/NUEVO AGREGADO: invitaciones entre usuarios.-->

      
      <section id="acceso-compartido">
        <h2>Acceso compartido</h2>

        <h3>Invitar a un acompañante</h3>

        <form id="formInvitacion">
          <label for="emailInvitado">Correo del acompañante</label>
          <input
            type="email"
            id="emailInvitado"
            name="email"
            required
          >

          <p>Seleccioná qué información querés compartir:</p>

          <label>
            <input type="checkbox" name="ver_mediciones" value="1">
            Mediciones
          </label>

          <label>
            <input type="checkbox" name="ver_medicamentos" value="1">
            Medicamentos
          </label>

          <label>
            <input type="checkbox" name="ver_recordatorios" value="1">
            Recordatorios
          </label>

          <label>
            <input type="checkbox" name="ver_estado_diario" value="1">
            Estado diario
          </label>

          <label>
            <input type="checkbox" name="ver_dashboard" value="1">
            Resumen semanal
          </label>

          <label>
            <input type="checkbox" name="ver_padecimientos" value="1">
            Padecimientos
          </label>

          <button type="submit">Enviar invitación</button>
        </form>

        <p id="mensajeInvitacion" role="status"></p>

        <hr>

        <h3>Invitaciones recibidas</h3>
        <div id="listaInvitaciones"></div>
      </section>

      <script src="health-me-frontend\src\assets\js\acceso-compartido.js"></script>
    </main>

    <!-- FOOTER -->
  <footer class="main-footer collapsible-footer" id="collapsibleFooter">
      
      <!-- BARRA REPLEGADA / CABECERA DEL FOOTER -->
      <div class="footer-summary-bar" id="footerSummaryBar">
        <div class="summary-titles">
          <span>Navegación</span>
          <span class="divider">•</span>
          <span>Marco Legal y Privacidad</span>
          <span class="divider">•</span>
          <span>Soporte y Contacto</span>
        </div>
        <button type="button" class="footer-toggle-btn" id="footerToggleBtn" aria-label="Desplegar pie de página">
          <span class="toggle-icon" id="toggleIcon">▲</span>
        </button>
      </div>

      <!-- CONTENIDO COMPLETO DESPLEGABLE -->
      <div class="footer-collapsible-content" id="footerCollapsibleContent">
        <div class="footer-container">
          
          <div class="footer-col">
            <img src="img/logos/logoNameHealthMeBlanco.png" alt="HealthMe Logo" class="footer-logo">
            <p class="footer-desc">Plataforma digital para la gestión y seguimiento integral de la salud.</p>
            <div class="emergency-notice">
              <strong>En caso de emergencia médica inmediata, comuníquese al 911 o acuda al centro asistencial más cercano.</strong>
            </div>
          </div>

          <div class="footer-col">
            <h3>Navegación</h3>
            <ul>
              <li><a href="https://lucaromano-int.github.io/HEALTH-ME/index.html">Inicio</a></li>
              <li><a href="https://lucaromano-int.github.io/HEALTH-ME/index.html#quienes-somos">Quiénes Somos</a></li>
              <li><a href="contact.html">Habla con nosotros</a></li>
            </ul>
          </div>

          <div class="footer-col">
            <h3>Marco Legal y Privacidad</h3>
            <ul>
              <li><a href="#">Términos y Condiciones de Uso</a></li>
              <li><a href="#">Política de Privacidad y Protección de Datos</a></li>
              <li><a href="#">Consentimiento Informado Digital</a></li>
              <li><a href="#">Ley de Derechos del Paciente</a></li>
            </ul>
          </div>

          <div class="footer-col">
            <h3>Soporte y Contacto</h3>
            <p>Email: <a href="mailto:soporte@healthme.com">soporte@healthme.com</a></p>
            <p>Horario: 24 hs</p>
            <p>Atención al Usuario / Reclamos de Privacidad</p>
          </div>

        </div>

        <div class="footer-bottom">
          <p class="disclaimer-text">
            <strong>Aviso Médico Importante:</strong> La información provista en esta plataforma no sustituye el diagnóstico, tratamiento o consejo médico profesional. Consulte siempre con un profesional de la salud matriculado ante cualquier duda sobre su condición clínica.
          </p>
          <div class="copyright">
            <p>&copy; 2026 HealthMe. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>

    </footer>

    <!-- MÓDULOS DE CADA APARTADO DE USUARIO -->
    <script src="https://lucaromano-int.github.io/HEALTH-ME/js/modules/signosVitales.js"></script>
    <script src="https://lucaromano-int.github.io/HEALTH-ME/js/modules/recordatorios.js"></script>
    <script src="https://lucaromano-int.github.io/HEALTH-ME/js/modules/medicamentos.js"></script>
    <script src="https://lucaromano-int.github.io/HEALTH-ME/js/modules/grupoPaciente.js"></script>
    <script src="https://lucaromano-int.github.io/HEALTH-ME/js/modules/dashboard.js"></script>
    <script src="https://lucaromano-int.github.io/HEALTH-ME/js/modules/bitacora.js"></script>

    <!-- SCRIPT PRINCIPAL DE CONTROL -->
    <script src="https://lucaromano-int.github.io/HEALTH-ME/js/user.js"></script>
  </body>
</html>