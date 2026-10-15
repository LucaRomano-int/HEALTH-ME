// Referencia al formulario de contacto
const contactForm = document.getElementById('contactForm');

// Comentario en línea arriba del código
contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  // Comentario en línea arriba del código
  const name = document.getElementById('name').value;
  const lastname = document.getElementById('lastname').value;
  const email = document.getElementById('email').value;
  const motivo = document.getElementById('motivo').value;
  
  // Comentario en línea arriba del código
  if (name != '' && lastname != '' && email != '' && motivo != '') {
    
    // Envía el formulario a guardar_contacto.php para guardarlo en consulta_contacto
    fetch('php/guardar_contacto.php', {
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