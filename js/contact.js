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
    alert(`¡Gracias por contactarnos, ${name} ${lastname}! Hemos recibido tu mensaje sobre "${motivo}" y te responderemos a la brevedad a ${email}.`);
    contactForm.reset();
  }
});