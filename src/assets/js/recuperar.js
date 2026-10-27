// Obtener token de la URL si existe
const token = new URLSearchParams(location.search).get("token");
const formPedir = document.getElementById("formPedir");
const formNueva = document.getElementById("formNueva");
const msg = document.getElementById("msg");

const API_URL = "https://health-me.infinityfreeapp.com";

if (token) {
  document.getElementById("token").value = token;
  formPedir.classList.remove("active");
  formNueva.classList.add("active");
}

function enviar(form, url, onOk) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    fetch(url, { 
      method: "POST", 
      credentials: 'include', // <--- ¡Vital para mantener la sesión segura!
      headers: {
        'X-Requested-With': 'XMLHttpRequest' // <--- Necesario para pasar la validación requerirAjax()
      },
      body: new FormData(form) 
    })
      .then((r) => r.json())
      .then((d) => {
        msg.textContent =
          d.mensaje || (d.ok ? "Listo." : "Ocurrió un error.");
        if (d.ok && onOk) onOk();
      })
      .catch(() => {
        msg.textContent = "No pudimos conectar con el servidor.";
      });
  });
}

enviar(formPedir, `${API_URL}/api/solicitar_recuperacion.php`);
enviar(formNueva, `${API_URL}/api/restablecer_password.php`, () => {
  msg.textContent = "Contraseña actualizada. Ya puedes iniciar sesión.";
  setTimeout(() => (location.href = "login.html"), 2000);
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
