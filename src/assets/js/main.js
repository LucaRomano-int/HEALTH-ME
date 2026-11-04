document.addEventListener("DOMContentLoaded", () => {
  // 0. Si hay una sesión iniciada, el menú del inicio ofrece volver al panel en lugar de "Iniciar sesión".
  //    Esta página es estática y no sabe sola si estás logueado; se lo pregunta al servidor (la sesión no se toca).
  const actualizarMenuSegunSesion = async () => {
    const enlaceLogin = document.querySelector("#nav-links a.btn-login");
    if (enlaceLogin == null) return;
    const BACKEND = "/health-me_backend-php"; // misma ruta que usa login.js
    try {
      const respuesta = await fetch(`${BACKEND}/api/sesion.php`, {
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      if (!respuesta.ok) return; // 401: no hay sesión, queda "Iniciar sesión"
      const datos = await respuesta.json();
      if (datos == null || datos.ok !== true) return;

      const esAdmin = datos.usuario != null && datos.usuario.nivel === "administrador";
      enlaceLogin.textContent = "MI PANEL";
      enlaceLogin.setAttribute("href", `${BACKEND}/${esAdmin ? "admin.php" : "user.php"}`);

      const enlaceSalir = document.createElement("a");
      enlaceSalir.className = "nav-link";
      enlaceSalir.textContent = "CERRAR SESIÓN";
      enlaceSalir.setAttribute("href", `${BACKEND}/api/logout.php`);
      enlaceLogin.insertAdjacentElement("afterend", enlaceSalir);
    } catch (_) {
      // Sin conexión con el servidor: el menú queda como estaba
    }
  };
  actualizarMenuSegunSesion();

  // 1. Animación del Logo y Botón en el Hero
  const heroLogo = document.querySelector(".hero-logo");
  if (heroLogo != null) {
    setTimeout(() => {
      heroLogo.classList.add("hero-animate");
    }, 150);
  }

  // 2. Control del Navbar según el Scroll (Oculto arriba de todo, visible al bajar)
  const navbar = document.getElementById("main-navbar");
  const scrollThreshold = 50; // Píxeles requeridos para mostrar la barra

  window.addEventListener("scroll", () => {
    if (window.scrollY > scrollThreshold) {
      navbar.classList.remove("navbar-hidden");
    } else {
      navbar.classList.add("navbar-hidden");
    }
  });

  // 3. Animación progresiva de elementos al hacer Scroll (Intersection Observer)
  const observerOptions = {
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  }, observerOptions);

  const animatedElements = document.querySelectorAll(".about-container, .download-container");
  animatedElements.forEach(el => {
    el.classList.add("fade-in-element");
    observer.observe(el);
  });

  // Función auxiliar para activar una pestaña específica
  const activateTab = (targetTabId) => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === targetTabId) {
        const targetIndex = btn.getAttribute('data-index');
        
        // Remover estado activo de todos
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Activar el botón y contenido correspondiente
        btn.classList.add('active');
        const activeContent = document.getElementById(targetTabId);
        if (activeContent != null) {
          activeContent.classList.add('active');
        }

        // Mover la barra indicadora deslizante
        const container = document.querySelector('.tabs-container');
        if (container != null && targetIndex != null) {
          container.setAttribute('data-active-index', targetIndex);
        }
      }
    });
  };

  // 4. Control de pestañas en la sección "Quiénes Somos" con barra deslizante
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  if (tabButtons != null && tabContents != null) {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        activateTab(targetTab);
      });
    });
  }

  // Función general para realizar el scroll suave respetando la altura del navbar
  const scrollToSection = (e, targetSelector) => {
    e.preventDefault();
    const targetElement = document.querySelector(targetSelector);

    if (targetElement != null) {
      const navbarHeight = navbar != null ? navbar.offsetHeight : 80;
      const offsetPosition = targetElement.offsetTop - navbarHeight - 10;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // 5. Control del desplazamiento del botón "Saber más"
  const btnHeroMore = document.querySelector('.btn-hero-more');
  if (btnHeroMore != null) {
    btnHeroMore.addEventListener('click', (e) => {
      scrollToSection(e, '#quienes-somos');
      // Por defecto al hacer "Saber más" dejamos activa la pestaña app web
      activateTab('tab-app');
    });
  }

  // 6. Control de los enlaces del Footer para "Quiénes Somos" (App Web y Desarrolladores)
  const footerLinks = document.querySelectorAll('.footer-col a[href="#quienes-somos"]');
  if (footerLinks != null) {
    footerLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        scrollToSection(e, '#quienes-somos');

        // Evaluamos según el texto del enlace cuál pestaña activar
        const linkText = link.textContent.trim().toLowerCase();
        if (linkText.includes('desarrolladores')) {
          activateTab('tab-devs');
        } else {
          activateTab('tab-app');
        }
      });
    });
  }

  // 7. Control de los enlaces del Footer con atributos data-target
  const footerTabLinks = document.querySelectorAll('.footer-tab-link');
  
  if (footerTabLinks != null) {
    footerTabLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const targetTab = link.getAttribute('data-target');
        
        // Si ya estamos en el index, evitamos el salto brusco y activamos la pestaña con scroll suave
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
          scrollToSection(e, '#quienes-somos');
          if (targetTab != null) {
            activateTab(targetTab);
          }
        }
      });
    });
  }
});

// Validación para controlar el menú desplegable en dispositivos móviles y zoom
const menuToggle = document.getElementById('menu-toggle');
const navLinks = document.getElementById('nav-links');

if (menuToggle != null && navLinks != null) {
  menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('nav-active');
  });

  // Comentario: Cierra el menú automáticamente al hacer clic en alguna opción
  const links = navLinks.querySelectorAll('.nav-link');
  links.forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('nav-active');
    });
  });
}

// 9. Control de la galería interactiva de tarjetas apiladas "¿Qué hace Health Me?"
// --- CONTROL PRIMERA GALERÍA (3 IMÁGENES) ---
  const slideData1 = [
    {
      title: "Parámetros de Salud",
      description: "Visualizá y monitoreá tus signos vitales y métricas de salud principales con indicadores visuales en tiempo real.",
      imgSrc: "public/renders/parametros.png"
    },
    {
      title: "Gestión de Fechas y Turnos",
      description: "Organizá tus citas médicas, controles periódicos y recordatorios importantes desde una vista de calendario integrada.",
      imgSrc: "public/renders/fechas.png"
    },
    {
      title: "Bitácora Médica",
      description: "Llevá un registro cronológico detallado de tus síntomas, consultas y observaciones médicas para un mejor seguimiento.",
      imgSrc: "public/renders/bitacora.png"
    }
  ];

  let currentSlideIndex1 = 0;
  const cards1 = document.querySelectorAll('#cardsStackWrapper .stack-card');
  const infoTitle1 = document.getElementById('infoTitle');
  const infoDescription1 = document.getElementById('infoDescription');
  const prevBtn1 = document.querySelector('#cardsStackWrapper .prev-btn');
  const nextBtn1 = document.querySelector('#cardsStackWrapper .next-btn');

  const updateGallery1 = (newIndex) => {
    currentSlideIndex1 = (newIndex + slideData1.length) % slideData1.length;

    if (infoTitle1 != null && infoDescription1 != null) {
      infoTitle1.textContent = slideData1[currentSlideIndex1].title;
      infoDescription1.textContent = slideData1[currentSlideIndex1].description;
    }

    cards1.forEach((card, i) => {
      card.classList.remove('active', 'next', 'back');
      const relativeIndex = (i - currentSlideIndex1 + slideData1.length) % slideData1.length;
      
      if (relativeIndex === 0) {
        card.classList.add('active');
      } else if (relativeIndex === 1) {
        card.classList.add('next');
      } else {
        card.classList.add('back');
      }
    });
  };

  if (nextBtn1 != null) nextBtn1.addEventListener('click', () => updateGallery1(currentSlideIndex1 + 1));
  if (prevBtn1 != null) prevBtn1.addEventListener('click', () => updateGallery1(currentSlideIndex1 - 1));


  // --- CONTROL SEGUNDA GALERÍA INVERTIDA (3 IMÁGENES) ---
  const slideData2 = [
    {
      title: "Panel General Dashboard",
      description: "Accedé a un resumen integral con los accesos rápidos y la información de salud más relevante unificada en un solo lugar.",
      imgSrc: "public/renders/dashboard.png"
    },
    {
      title: "Control de Medicamentos",
      description: "Administrá tu esquema de medicación diaria, dosis exactas y alertas automáticas de reposición.",
      imgSrc: "public/renders/medicamentos.png"
    },
    {
      title: "Botón y Alerta S.O.S.",
      description: "Acceso rápido a contactos de emergencia y protocolos de asistencia inmediata ante cualquier imprevisto de salud.",
      imgSrc: "public/renders/sos.png"
    }
  ];

  let currentSlideIndex2 = 0;
  const cards2 = document.querySelectorAll('#cardsStackWrapper2 .stack-card');
  const infoTitle2 = document.getElementById('infoTitle2');
  const infoDescription2 = document.getElementById('infoDescription2');
  const prevBtn2 = document.querySelector('#cardsStackWrapper2 .prev-btn');
  const nextBtn2 = document.querySelector('#cardsStackWrapper2 .next-btn');

  const updateGallery2 = (newIndex) => {
    currentSlideIndex2 = (newIndex + slideData2.length) % slideData2.length;

    if (infoTitle2 != null && infoDescription2 != null) {
      infoTitle2.textContent = slideData2[currentSlideIndex2].title;
      infoDescription2.textContent = slideData2[currentSlideIndex2].description;
    }

    cards2.forEach((card, i) => {
      card.classList.remove('active', 'next', 'back');
      const relativeIndex = (i - currentSlideIndex2 + slideData2.length) % slideData2.length;
      
      if (relativeIndex === 0) {
        card.classList.add('active');
      } else if (relativeIndex === 1) {
        card.classList.add('next');
      } else {
        card.classList.add('back');
      }
    });
  };

  if (nextBtn2 != null) nextBtn2.addEventListener('click', () => updateGallery2(currentSlideIndex2 + 1));
  if (prevBtn2 != null) prevBtn2.addEventListener('click', () => updateGallery2(currentSlideIndex2 - 1));
