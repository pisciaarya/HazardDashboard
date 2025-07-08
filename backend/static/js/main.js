// Main Navigation Controller
document.addEventListener('DOMContentLoaded', function() {
  // ======================
  // MOBILE MENU TOGGLE
  // ======================
  const navElement = document.querySelector('.main-nav');
  const navList = document.querySelector('.main-nav ul');
  
  // Create mobile menu toggle button
  const mobileMenuToggle = document.createElement('button');
  mobileMenuToggle.className = 'mobile-menu-toggle';
  mobileMenuToggle.setAttribute('aria-label', 'Toggle navigation menu');
  mobileMenuToggle.innerHTML = '<i class="fas fa-bars"></i>';
  navElement.appendChild(mobileMenuToggle);

  // Toggle mobile menu
  mobileMenuToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    navList.classList.toggle('show');
    mobileMenuToggle.setAttribute('aria-expanded', navList.classList.contains('show'));
    mobileMenuToggle.innerHTML = navList.classList.contains('show') 
      ? '<i class="fas fa-times"></i>' 
      : '<i class="fas fa-bars"></i>';
  });

  // Close mobile menu when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.main-nav')) {
      navList.classList.remove('show');
      mobileMenuToggle.setAttribute('aria-expanded', 'false');
      mobileMenuToggle.innerHTML = '<i class="fas fa-bars"></i>';
    }
  });

  // Prevent clicks inside nav from closing
  navElement.addEventListener('click', function(e) {
    e.stopPropagation();
  });

  // ======================
  // ACTIVE LINK HIGHLIGHTING
  // ======================
  function setActiveLinks() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const currentHash = window.location.hash || '#home';
    const currentParams = window.location.search;
    
    // Handle regular nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      const linkPage = link.getAttribute('href');
      const isActive = (
        linkPage === currentPage || 
        (currentPage === 'index.html' && linkPage === '#') ||
        (linkPage.includes('map.html') && currentPage === 'map.html')
      );
      
      link.classList.toggle('active', isActive);
      link.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    
    // Handle dropdown items
    document.querySelectorAll('.dropdown-item').forEach(item => {
      const itemPage = item.getAttribute('href');
      const isActive = (
        itemPage === currentPage || 
        itemPage === currentHash ||
        (currentParams && itemPage.includes(currentParams))
      );
      
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-current', isActive ? 'page' : 'false');
      
      // Update parent dropdown link if child is active
      if (isActive) {
        const dropdownLink = item.closest('.dropdown')?.querySelector('.nav-link');
        if (dropdownLink) {
          dropdownLink.classList.add('active');
          dropdownLink.setAttribute('aria-current', 'page');
        }
      }
    });
  }

  // Initialize and watch for changes
  setActiveLinks();
  window.addEventListener('hashchange', setActiveLinks);
  window.addEventListener('popstate', setActiveLinks);

  // ======================
  // DROPDOWN INTERACTIONS
  // ======================
  document.querySelectorAll('.dropdown').forEach(dropdown => {
    const dropdownMenu = dropdown.querySelector('.dropdown-menu');
    const dropdownLink = dropdown.querySelector('.nav-link');
    
    // Mouse interactions
    dropdown.addEventListener('mouseenter', function() {
      if (window.innerWidth > 768) { // Desktop only
        dropdownMenu.classList.add('show');
        dropdownLink.setAttribute('aria-expanded', 'true');
      }
    });
    
    dropdown.addEventListener('mouseleave', function() {
      if (window.innerWidth > 768) { // Desktop only
        dropdownMenu.classList.remove('show');
        dropdownLink.setAttribute('aria-expanded', 'false');
      }
    });
    
    // Touch/click interactions
    dropdownLink.addEventListener('click', function(e) {
      if (window.innerWidth <= 768) { // Mobile only
        e.preventDefault();
        const isExpanded = dropdownMenu.classList.toggle('show');
        dropdownLink.setAttribute('aria-expanded', isExpanded);
      }
    });
  });

  // ======================
  // RESPONSIVE ADJUSTMENTS
  // ======================
  function handleResponsiveChanges() {
    const isMobile = window.innerWidth <= 768;
    
    document.querySelectorAll('.dropdown').forEach(dropdown => {
      const dropdownMenu = dropdown.querySelector('.dropdown-menu');
      const dropdownLink = dropdown.querySelector('.nav-link');
      
      if (isMobile) {
        dropdownMenu.classList.remove('show');
        dropdownLink.setAttribute('aria-expanded', 'false');
      } else {
        // Reset any mobile-specific behaviors
        dropdownLink.removeAttribute('style');
      }
    });
  }

  // Initialize and watch for resize
  handleResponsiveChanges();
  window.addEventListener('resize', handleResponsiveChanges);

  // ======================
  // ACCESSIBILITY IMPROVEMENTS
  // ======================
  document.querySelectorAll('.nav-link').forEach(link => {
    // Keyboard navigation
    link.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  });

  // ======================
  // SMOOTH SCROLLING
  // ======================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      // Skip if it's a dropdown item or external link
      if (this.classList.contains('dropdown-item') || 
          this.getAttribute('href').startsWith('http') ||
          this.getAttribute('href').includes('.html')) {
        return;
      }
      
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        const navbarHeight = document.querySelector('.main-nav').offsetHeight;
        const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navbarHeight;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
        
        // Close mobile menu if open
        navList.classList.remove('show');
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
        mobileMenuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        
        // Update URL without page reload
        history.pushState(null, null, targetId);
        setActiveLinks(); // Update active states
      }
    });
  });

  // ======================
  // CURRENT PAGE INDICATOR
  // ======================
  function updateCurrentPageIndicator() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.body.setAttribute('data-current-page', currentPage.replace('.html', ''));
  }

  updateCurrentPageIndicator();
  window.addEventListener('popstate', updateCurrentPageIndicator);
});

// Add responsive navigation styles
const navStyles = document.createElement('style');
navStyles.textContent = `
  /* Mobile menu transitions */
  .main-nav ul {
    transition: all 0.3s ease;
  }
  
  /* Accessibility focus states */
  .nav-link:focus {
    outline: 2px solid #00bfa6;
    outline-offset: 2px;
  }
  
  /* Current page indicator */
  body[data-current-page="map"] .map-link,
  body[data-current-page="info"] .info-link,
  body[data-current-page="about"] .about-link,
  body[data-current-page="documentation"] .documentation-link {
    color: #00bfa6 !important;
  }
  
  /* Dropdown arrow animation */
  .dropdown .fa-caret-down {
    transition: transform 0.3s ease;
  }
  
  .dropdown.show .fa-caret-down {
    transform: rotate(180deg);
  }
`;
document.head.appendChild(navStyles);