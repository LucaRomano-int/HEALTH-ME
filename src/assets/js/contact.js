const contactForm = document.getElementById('contactForm');

// Ruta desde la raíz del sitio: sirve con cualquier puerto o host.
const API_URL = "/health-me_backend-php/api";

// Si hay una sesión iniciada, el menú ofrece volver al panel en lugar de "Iniciar sesión".
// Esta página es estática y no sabe sola si estás logueado; se lo pregunta al servidor (la sesión no se toca).
async function actualizarMenuSegunSesion() {
  const enlaceLogin = document.querySelector('#nav-links a.btn-login');
  if (enlaceLogin == null) return;
  const BACKEND = '/health-me_backend-php'; // misma ruta que usa login.js
  try {
    const respuesta = await fetch(`${BACKEND}/api/sesion.php`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (!respuesta.ok) return; // 401: no hay sesión, queda "Iniciar sesión"
    const datos = await respuesta.json();
    if (datos == null || datos.ok !== true) return;

    const esAdmin = datos.usuario != null && datos.usuario.nivel === 'administrador';
    enlaceLogin.textContent = 'MI PANEL';
    enlaceLogin.setAttribute('href', `${BACKEND}/${esAdmin ? 'admin.php' : 'user.php'}`);

    const enlaceSalir = document.createElement('a');
    enlaceSalir.className = 'nav-link';
    enlaceSalir.textContent = 'CERRAR SESIÓN';
    enlaceSalir.setAttribute('href', `${BACKEND}/api/logout.php`);
    enlaceLogin.insertAdjacentElement('afterend', enlaceSalir);
  } catch (_) {
    // Sin conexión con el servidor: el menú queda como estaba
  }
}
actualizarMenuSegunSesion();

contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const name = document.getElementById('name').value;
  const lastname = document.getElementById('lastname').value;
  const email = document.getElementById('email').value;
  const motivo = document.getElementById('motivo').value;
  
  if (name != '' && lastname != '' && email != '' && motivo != '') {
    
    // Envía el formulario a guardar_contacto.php para guardarlo en consulta_contacto
    fetch(`${API_URL}/guardar_contacto.php`, {
      method: 'POST',
      credentials: 'include', // <--- ¡Vital para peticiones cruzadas!
      headers: {
        'X-Requested-With': 'XMLHttpRequest' // <--- Necesario para pasar la validación requerirAjax()
      },
      body: new FormData(contactForm)
    })
      .then((respuesta) => respuesta.json())
            .then((datos) => {
        if (datos.ok) {
          hmToast(`¡Gracias por contactarnos, ${name} ${lastname}! Hemos recibido tu mensaje sobre "${motivo}" y te responderemos a la brevedad a ${email}.`, 'ok', 9000);
          contactForm.reset();
        } else {
          hmToast('No pudimos enviar tu mensaje. Intenta nuevamente.', 'error');
        }
      })
      .catch(() => {
        hmToast('No pudimos enviar tu mensaje. Intenta nuevamente.', 'error');
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

  const links = navLinks.querySelectorAll('.nav-link');
  links.forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('nav-active');
    });
  });
}
