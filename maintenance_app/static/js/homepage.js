document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menuToggle');
  const sideMenu = document.getElementById('sideMenu');
  const closeMenu = document.getElementById('closeMenu');
  const pageOverlay = document.getElementById('pageOverlay');
  const loginBtn = document.getElementById('loginBtn');
  const sideLinks = document.querySelectorAll('.side-link');

  // Toggle side menu
  menuToggle.addEventListener('click', () => {
    sideMenu.classList.add('open');
    pageOverlay.classList.add('visible');
  });
  closeMenu.addEventListener('click', closeMenuFunc);
  pageOverlay.addEventListener('click', closeMenuFunc);
  sideLinks.forEach(link => link.addEventListener('click', closeMenuFunc));

  function closeMenuFunc() {
    sideMenu.classList.remove('open');
    pageOverlay.classList.remove('visible');
  }

  // Login button redirect
 loginBtn.addEventListener('click', () => {
  window.location.href = "/accounts/login/";
});

  // Scroll animation for info section
  const infoSection = document.querySelector('.info-section');
  window.addEventListener('scroll', () => {
    if (infoSection.getBoundingClientRect().top < window.innerHeight - 100) {
      infoSection.classList.add('visible');
    }
  });
});