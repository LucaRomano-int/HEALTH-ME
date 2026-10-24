const contactForm = document.getElementById('contactForm');

const API_URL = "https://health-me.infinityfreeapp.com/api";

contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const name = document.getElementById('name').value;
  const lastname = document.getElementById('lastname').value;
  const email = document.getElementById('email').value;
  const motivo = document.getElementById('motivo').value;
  
  if (name != '' && lastname != '' && email != '' && motivo != '') {
    
    // Envía el formulario a guardar_contacto.php para guardarlo en consulta_contacto
    fetch('${API_URL}/guardar_contacto.php', {
      method: 'POST',
      body: new FormData(contactForm)
    })
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        if (datos.ok) {
          alert(`¡Gracias por contactarnos, ${name} ${lastname}! Hemos recibido tu mensaje sobre "${motivo}" y te responderemos a la brevedad a ${email}.`);
          contactForm.reset();
        } else {
          alert('No pudimos enviar tu mensaje. Intenta nuevamente.');
        }
      })
      .catch(() => {
        alert('No pudimos enviar tu mensaje. Intenta nuevamente.');
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