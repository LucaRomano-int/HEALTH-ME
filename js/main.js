document.addEventListener("DOMContentLoaded", () => {
  // 1. Animación del Logo y Botón en el Hero
  const heroLogo = document.querySelector(".hero-logo");
  if (heroLogo) {
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
});