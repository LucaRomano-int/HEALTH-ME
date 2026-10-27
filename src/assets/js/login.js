// Referencias a elementos del DOM
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const togglePill = document.getElementById('togglePill');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');

const API_URL = "https://health-me.infinityfreeapp.com";

tabLogin.addEventListener('click', () => {
  if (tabLogin.classList.contains('active') != true) {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    togglePill.style.transform = 'translateX(0%)';
    
    loginForm.classList.add('active');
    registerForm.classList.remove('active');

    authTitle.textContent = 'Bienvenido a HealthMe';
    authSubtitle.textContent = 'Ingrese sus credenciales para acceder al sistema de gestión de salud.';
  }
});

tabRegister.addEventListener('click', () => {
  if (tabRegister.classList.contains('active') != true) {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    togglePill.style.transform = 'translateX(100%)';

    registerForm.classList.add('active');
    loginForm.classList.remove('active');

    authTitle.textContent = 'Crea tu cuenta';
    authSubtitle.textContent = 'Regístrate para comenzar a gestionar tu información de salud.';
  }
});

document.querySelectorAll('.toggle-password').forEach(button => {
  button.addEventListener('click', () => {
    const targetId = button.getAttribute('data-target');
    const input = document.getElementById(targetId);
    const isPassword = input.getAttribute('type') === 'password';
    input.setAttribute('type', isPassword ? 'text' : 'password');
    button.textContent = isPassword ? 'Ocultar' : 'Ver';
  });
});

// Envía el formulario de inicio de sesión a su endpoint PHP
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  fetch(`${API_URL}/api/login_usuario.php`, {
    method: 'POST',
    credentials: 'include', // <--- ¡Vital para que la cookie de sesión viaje entre dominios!
    headers: {
      'X-Requested-With': 'XMLHttpRequest' // <--- Necesario para pasar la validación requerirAjax()
    },
    body: new FormData(loginForm)
  })
    .then((respuesta) => respuesta.json())
    .then((datos) => {
      if (datos.ok) {
        alert('¡Inicio de sesión exitoso!');
        window.location.href = `${API_URL}/user.php`;
      } else {
        alert(datos.mensaje || 'No pudimos iniciar sesión. Intenta nuevamente.');
      }
    })
    .catch(() => {
      alert('No pudimos conectar con el servidor. Intenta nuevamente.');
    });
});

registerForm.addEventListener('submit', (e) => {
  e.preventDefault();

  fetch(`${API_URL}/api/registrar_usuario.php`, {
    method: 'POST',
    credentials: 'include', // <--- ¡Vital para peticiones cruzadas!
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: new FormData(registerForm)
  })
    .then((respuesta) => respuesta.json())
    .then((datos) => {
      if (datos.ok) {
        alert('¡Cuenta creada con éxito! Ya puedes iniciar sesión.');
        registerForm.reset();
      } else {
        alert(datos.mensaje || 'No pudimos crear la cuenta. Intenta nuevamente.');
      }
    })
    .catch(() => {
      alert('No pudimos conectar con el servidor. Intenta nuevamente.');
    });
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
