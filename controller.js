/**
 * Walter A. Jablonowski - Personal Website
 * Main JavaScript Controller
 */

class WebsiteController
{
  constructor()
  {
    // Store references to DOM elements as class properties
    this.header = document.querySelector('header');
    this.menuToggle = document.querySelector('.menu-toggle');
    this.navMenu = document.querySelector('.nav-menu');
    this.navLinks = document.querySelectorAll('.nav-link');
    this.body = document.body;
    // this.backToTopButton = document.querySelector('.back-to-top');  // (TASK) hidden for now (replaced by Speak to an AI)
    this.floatingAiButton = document.querySelector('.floating-ai-button');
    this.contactForm = document.getElementById('contact-form');
    this.requestCvButton = document.querySelector('.request-cv');
    this.cookieBanner = document.getElementById('cookie-consent');
    this.acceptCookieButton = document.getElementById('accept-cookies');
    this.declineCookieButton = document.getElementById('decline-cookies');
    this.tabLinks = document.querySelectorAll('.tab-link');
    this.tabContents = document.querySelectorAll('.tab-content');
    this.infoIcons = document.querySelectorAll('.info-icon');
    
    // Initialize the website
    this.init();
  }
  
  /**
   * Initialize all website components
   */
  init()
  {
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', () => {
      this.initNavigation();
      this.initScrollAnimations();
      // this.initBackToTop();  // (TASK) hidden for now (replaced by Speak to an AI)
      this.initFloatingAiButton();
      this.initContactForm();
      this.initCookieConsent();
      this.initResponsiveAdjustments();
      this.initTabNavigation();
      this.initInfoIcons();
      this.initTypewriterEffect();
      this.initProjectCarousel();
      this.initPastSkillsToggle();
      
      // Add animation classes to elements
      document.querySelectorAll('.fade-in').forEach( (element, index) => {
        element.classList.add(`delay-${index % 3 + 1}`);
      });
      
      // Initial check for header background
      this.checkHeaderBackground();
    });
  }
  
  /**
   * Navigation functionality
   */
  initNavigation()
  {
    // Handle scroll events for header styling
    window.addEventListener('scroll', () => {
      if( window.scrollY > 50 )
        this.header.classList.add('scrolled');
      else
        this.header.classList.remove('scrolled');
      
      // Update active nav link based on scroll position
      this.updateActiveNavLink();
      
      // Check if header is over white sections
      this.checkHeaderBackground();
    });
    
    // Mobile menu toggle
    this.menuToggle.addEventListener('click', () => {
      this.navMenu.classList.toggle('active');
      this.menuToggle.querySelector('i').classList.toggle('fa-bars');
      this.menuToggle.querySelector('i').classList.toggle('fa-times');
      
      // Prevent body scrolling when menu is open
      this.body.style.overflow = this.navMenu.classList.contains('active') ? 'hidden' : '';
      
      // Ensure menu is properly positioned when opened
      if( this.navMenu.classList.contains('active') ) {
        // Set menu height to viewport height
        this.navMenu.style.height = `${window.innerHeight}px`;
      }
    });
    
    // Close mobile menu when clicking a link
    this.navLinks.forEach( link => {
      link.addEventListener('click', () => {
        this.navMenu.classList.remove('active');
        this.menuToggle.querySelector('i').classList.add('fa-bars');
        this.menuToggle.querySelector('i').classList.remove('fa-times');
        this.body.style.overflow = '';
      });
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      if( this.navMenu.classList.contains('active') && 
          ! this.navMenu.contains(e.target) && 
          ! this.menuToggle.contains(e.target)) {
        this.navMenu.classList.remove('active');
        this.menuToggle.querySelector('i').classList.add('fa-bars');
        this.menuToggle.querySelector('i').classList.remove('fa-times');
        this.body.style.overflow = '';
      }
    });
  }
  
  /**
   * Update active nav link based on scroll position
   */
  updateActiveNavLink()
  {
    const sections = document.querySelectorAll('section');
    const scrollPosition = window.scrollY + 200;
    
    sections.forEach( section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');
      
      if( scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        this.navLinks.forEach( link => {
          link.classList.remove('active');
          if( link.getAttribute('href') === `#${sectionId}`)
            link.classList.add('active');
        });
      }
    });
  }
  
  /**
   * Scroll animations
   */
  initScrollAnimations()
  {
    // Animate elements when they come into view
    const animatedElements = document.querySelectorAll('.service-card, .skill-category, .interest-card, .timeline-item');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach( entry => {
        if( entry.isIntersecting ) {
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    animatedElements.forEach( element => {
      observer.observe(element);
    });
    
    // Animate skill bars when they come into view
    const skillBars = document.querySelectorAll('.skill-level');
    
    const skillObserver = new IntersectionObserver((entries) => {
      entries.forEach( entry => {
        if( entry.isIntersecting ) {
          const width = entry.target.style.width;
          entry.target.style.width = '0';
          setTimeout(() => {
            entry.target.style.width = width;
          }, 100);
          skillObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    skillBars.forEach( bar => {
      skillObserver.observe(bar);
    });
  }
  
  /**
   * Back to top button
   */
  initBackToTop()
  {
    window.addEventListener('scroll', () => {
      if( window.scrollY > 500)
        this.backToTopButton.classList.add('show');
      else
        this.backToTopButton.classList.remove('show');
    });
    
    this.backToTopButton.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  /**
   * Floating AI button - show/hide based on scroll position
   */
  initFloatingAiButton()
  {
    if( !this.floatingAiButton )
      return;

    window.addEventListener('scroll', () => {
      const servicesSection = document.getElementById('services');
      if( servicesSection ) {
        const servicesSectionTop = servicesSection.offsetTop - 500; // Show slightly before reaching the section
        
        if( window.scrollY >= servicesSectionTop )
          this.floatingAiButton.classList.add('show');
        else
          this.floatingAiButton.classList.remove('show');
      }
    });
  }
  
  /**
   * Contact form
   */
  initContactForm()
  {
    if( this.contactForm ) {
      // Create validation message container
      const validationContainer = document.createElement('div');
      validationContainer.className = 'validation-messages';
      this.contactForm.appendChild(validationContainer);
      
      // Create spinner element
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinner.innerHTML = '<div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div>';
      spinner.style.display = 'none';
      this.contactForm.appendChild(spinner);
      
      // Create status message container
      const statusContainer = document.createElement('div');
      statusContainer.className = 'form-status';
      statusContainer.style.display = 'none';
      this.contactForm.appendChild(statusContainer);
      
      this.contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form values
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const subject = document.getElementById('subject').value.trim();
        const message = document.getElementById('message').value.trim();
        
        // Reset validation messages
        validationContainer.innerHTML = '';
        validationContainer.style.display = 'none';
        statusContainer.style.display = 'none';
        
        // Validate form
        let isValid = true;
        const errors = [];
        
        if( ! name ) {
          errors.push('Please enter your name');
          isValid = false;
        }
        
        if( ! email ) {
          errors.push('Please enter your email address');
          isValid = false;
        } else if( ! this.isValidEmail(email) ) {
          errors.push('Please enter a valid email address');
          isValid = false;
        }
        
        if( ! subject ) {
          errors.push('Please enter a subject');
          isValid = false;
        }
        
        if( ! message ) {
          errors.push('Please enter your message');
          isValid = false;
        }
        
        // Display validation errors if any
        if( ! isValid ) {
          validationContainer.style.display = 'block';
          const errorList = document.createElement('ul');
          errors.forEach(error => {
            const li = document.createElement('li');
            li.textContent = error;
            errorList.appendChild(li);
          });
          validationContainer.appendChild(errorList);
          return;
        }
        
        // Prepare template parameters
        const templateParams = {
          name: name,
          mail: email,
          subject: subject,
          message: message
        };
        
        // EmailJS configuration
        const serviceID  = 'service_r1nitci';   // Update this with your actual service ID
        const templateID = 'template_ltytzqx';  // Update this with your actual template ID
        
        // Show spinner
        spinner.style.display = 'flex';
        
        // Send email using EmailJS
        emailjs.send(serviceID, templateID, templateParams)
          .then((response) => {
            // Hide spinner
            spinner.style.display = 'none';
            
            // Show success message
            statusContainer.style.display = 'block';
            statusContainer.className = 'form-status success';
            statusContainer.innerHTML = '<i class="fas fa-check-circle"></i> Thank you for your message! I will get back to you soon.';
            
            // Reset form
            this.contactForm.reset();
            
            // Hide success message after 5 seconds
            setTimeout(() => {
              statusContainer.style.display = 'none';
            }, 5000);
          })
          .catch(error => {
            // Hide spinner
            spinner.style.display = 'none';
            
            // Show detailed error message in development
            let errorMessage = '<i class="fas fa-exclamation-circle"></i> Oops! Something went wrong. Please try again later.';
            if(error && error.text) {
              errorMessage += `<br><small>Error details: ${error.text}</small>`;
            }
            
            // Show error message
            statusContainer.style.display = 'block';
            statusContainer.className = 'form-status error';
            statusContainer.innerHTML = errorMessage;
          });
      });
    }
    
    // CV request button
    if( this.requestCvButton ) {
      this.requestCvButton.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Scroll to contact form
        document.querySelector('#contact').scrollIntoView({ behavior: 'smooth' });
        
        // Pre-fill subject field
        const subjectField = document.getElementById('subject');
        if( subjectField )
          subjectField.value = 'CV Request';
      });
    }
  }
  
  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @return {boolean} True if valid or false
   */
  isValidEmail(email)
  {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Cookie consent banner
   */
  initCookieConsent()
  {
    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem('cookieConsent');
    
    if( cookieConsent === null && this.cookieBanner ) {
      // Show the cookie banner if no choice has been made
      this.cookieBanner.style.display = 'block';
    }
    
    // Handle accept button click
    if( this.acceptCookieButton ) {
      this.acceptCookieButton.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'accepted');
        this.cookieBanner.style.display = 'none';
        
        // Here you would initialize analytics or misc cookie-dependent features
      });
    }
    
    // Handle decline button click
    if( this.declineCookieButton ) {
      this.declineCookieButton.addEventListener('click', () => {
        // localStorage.setItem('cookieConsent', 'declined');
        this.cookieBanner.style.display = 'none';
        // Redirect to terms declined page
        window.location.href = 'terms_declined.html';
      });
    }
  }

  /**
   * Responsive adjustments
   */
  initResponsiveAdjustments()
  {
    // Set the --vh value initially
    this.setVhProperty();
    
    // Update the --vh value on resize and orientation change
    window.addEventListener('resize', () => {
      this.setVhProperty();
      
      // Update menu height if it's open
      if( this.navMenu.classList.contains('active') ) {
        this.navMenu.style.height = `${window.innerHeight}px`;
      }
      
      // Check header background on resize
      this.checkHeaderBackground();
    });
    window.addEventListener('orientationchange', () => {
      this.setVhProperty();
      
      // Small delay to ensure correct calculations after orientation change
      setTimeout(() => {
        if( this.navMenu.classList.contains('active') ) {
          this.navMenu.style.height = `${window.innerHeight}px`;
        }
        this.checkHeaderBackground();
      }, 100);
    });
    
    // Fix for iOS Safari 100vh issue
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if( isIOS )
      document.documentElement.classList.add('ios');
    
    // TASK: removed, was adding padding to all links (AI says "common for mobile-friendly")
    // 
    // Adjust touch targets for better mobile experience
    // const touchTargets = document.querySelectorAll('a:not(.logo a), button:not(.logo button), .nav-link, .btn');
    // touchTargets.forEach( target => {
    //   if( window.getComputedStyle(target).getPropertyValue('padding') === '0px')
    //     target.style.padding = '8px';
    // });
  }
  
  /**
   * Adjust viewport height for mobile browsers
   */
  setVhProperty()
  {
    // First we get the viewport height and multiply it by 1% to get a value for a vh unit
    const vh = window.innerHeight * 0.01;
    // Then we set the value in the --vh custom property to the root of the document
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  
  /**
   * Tab navigation for projects section
   */
  initTabNavigation()
  {
    if( this.tabLinks.length > 0 ) {
      this.tabLinks.forEach( link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Get the tab to show
          const tabId = link.getAttribute('data-tab');
          
          // Hide all tab contents
          this.tabContents.forEach( content => {
            content.style.display = 'none';
          });
          
          // Remove active class from all tab links
          this.tabLinks.forEach( tabLink => {
            tabLink.classList.remove('active');
          });
          
          // Show the selected tab content
          const selectedTab = document.getElementById(tabId + '-tab');
          if( selectedTab )
            selectedTab.style.display = 'block';
          
          // Add active class to the clicked tab link
          link.classList.add('active');
          
          // Show/hide projects notice based on active tab
          const projectsComment = document.getElementById('projects-comment');
          if( projectsComment ) {
            if( tabId === 'projects' )
              projectsComment.style.display = 'block';
            else
              projectsComment.style.display = 'none';
          }
          
          // Adjust tab-navigation spacing based on active tab
          const tabNavigation = document.querySelector('.tab-navigation');
          if( tabNavigation ) {
            if( tabId === 'projects' )
              tabNavigation.classList.remove('expanded');
            else
              tabNavigation.classList.add('expanded');
          }
        });
      });
    }
  }
  
  /**
   * Initialize info icons with popover functionality
   */
  initInfoIcons()
  {
    if( ! this.infoIcons.length ) return;
    
    // Add click event to each info icon
    this.infoIcons.forEach( icon => {
      icon.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from propagating
        
        // Close any open popovers first
        this.infoIcons.forEach( i => {
          if( i !== icon ) {
            i.classList.remove('active');
          }
        });
        
        // Toggle active class on the clicked icon
        icon.classList.toggle('active');
      });
    });
    
    // Close popovers when clicking elsewhere on the page
    document.addEventListener('click', () => {
      this.infoIcons.forEach( icon => {
        icon.classList.remove('active');
      });
    });
    
    // Close popovers when pressing escape
    document.addEventListener('keydown', (e) => {
      if( e.key === 'Escape' ) {
        this.infoIcons.forEach( icon => {
          icon.classList.remove('active');
        });
      }
    });
  }
  
  /**
   * Initialize typewriter effect and hide cursor after typing
   */
  initTypewriterEffect()
  {
    const typewriterElement = document.querySelector('.typewriter');
    
    if( typewriterElement ) {
      const text = typewriterElement.textContent;
      typewriterElement.textContent = '';
      
      let charIndex = 0;
      
      // Function to type one character at a time with variable speed
      function typeNextChar() {
        if( charIndex < text.length ) {
          typewriterElement.textContent += text.charAt(charIndex);
          charIndex++;
          
          // Variable typing speed for more realistic effect
          // Faster for most characters, slower for punctuation
          const currentChar = text.charAt(charIndex - 1);
          let delay = 70; // Base typing speed
          
          // Add random variation to typing speed
          delay += Math.random() * 50; // Add 0-50ms random delay
          
          // Slow down for punctuation or spaces
          if( currentChar === ' ' || currentChar === '-' || currentChar === '.' ) {
            delay += 50; // Additional delay for these characters
          }
          
          setTimeout(typeNextChar, delay);
        } else {
          // Typing is complete, hide the cursor after a short delay
          setTimeout(() => {
            typewriterElement.classList.add('typing-done');
          }, 1500); // Wait 1.5 seconds before hiding cursor
        }
      }
      
      // Start typing after a short delay
      setTimeout(typeNextChar, 800);
    }
  }
  
  /**
   * Initialize project carousel
   */
  initProjectCarousel()
  {
    const carouselContainer = document.querySelector('.project-cards-container');
    const prevArrow = document.querySelector('.carousel-arrow.prev');
    const nextArrow = document.querySelector('.carousel-arrow.next');
    
    if( ! carouselContainer || ! prevArrow || ! nextArrow ) return;
    
    // Set initial state - hide prev arrow if at start
    this.updateCarouselArrows(carouselContainer);
    
    // Handle next arrow click
    nextArrow.addEventListener('click', () => {
      const cardWidth = carouselContainer.querySelector('.project-card').offsetWidth;
      const gap = parseInt(window.getComputedStyle(carouselContainer).getPropertyValue('gap'));
      const scrollAmount = cardWidth + gap;
      
      carouselContainer.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    });
    
    // Handle prev arrow click
    prevArrow.addEventListener('click', () => {
      const cardWidth = carouselContainer.querySelector('.project-card').offsetWidth;
      const gap = parseInt(window.getComputedStyle(carouselContainer).getPropertyValue('gap'));
      const scrollAmount = cardWidth + gap;
      
      carouselContainer.scrollBy({
        left: -scrollAmount,
        behavior: 'smooth'
      });
    });
    
    // Update arrows visibility on scroll
    carouselContainer.addEventListener('scroll', () => {
      this.updateCarouselArrows(carouselContainer);
    });
    
    // Update arrows on window resize
    window.addEventListener('resize', () => {
      this.updateCarouselArrows(carouselContainer);
    });
    
    // Touch swipe functionality for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    
    carouselContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    carouselContainer.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe(carouselContainer, touchStartX, touchEndX);
    }, { passive: true });
  }
  
  /**
   * Update carousel arrows visibility based on scroll position
   * @param {HTMLElement} container - The carousel container element
   */
  updateCarouselArrows(container)
  {
    const prevArrow = document.querySelector('.carousel-arrow.prev');
    const nextArrow = document.querySelector('.carousel-arrow.next');
    
    if( ! container || ! prevArrow || ! nextArrow ) return;
    
    // Show/hide prev arrow based on scroll position
    if( container.scrollLeft <= 10 ) {
      prevArrow.style.opacity = '0';
      prevArrow.style.pointerEvents = 'none';
    } else {
      prevArrow.style.opacity = '0.8';
      prevArrow.style.pointerEvents = 'auto';
    }
    
    // Show/hide next arrow based on if we can scroll more
    const maxScrollLeft = container.scrollWidth - container.clientWidth - 10;
    if( container.scrollLeft >= maxScrollLeft ) {
      nextArrow.style.opacity = '0';
      nextArrow.style.pointerEvents = 'none';
    } else {
      nextArrow.style.opacity = '0.8';
      nextArrow.style.pointerEvents = 'auto';
    }
  }
  
  /**
   * Handle swipe gesture for carousel
   * @param {HTMLElement} container - The carousel container
   * @param {number} startX - Touch start X position
   * @param {number} endX - Touch end X position
   */
  handleSwipe(container, startX, endX)
  {
    const cardWidth = container.querySelector('.project-card').offsetWidth;
    const gap = parseInt(window.getComputedStyle(container).getPropertyValue('gap'));
    const scrollAmount = cardWidth + gap;
    const swipeThreshold = 50; // Minimum swipe distance to trigger scroll
    
    if( startX - endX > swipeThreshold ) {
      // Swipe left, go to next
      container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    } else if( endX - startX > swipeThreshold ) {
      // Swipe right, go to prev
      container.scrollBy({
        left: -scrollAmount,
        behavior: 'smooth'
      });
    }
  }
  
  /**
   * Initialize past skills toggle functionality
   */
  initPastSkillsToggle()
  {
    const toggleButton = document.getElementById('past-skills-toggle');
    const content = document.getElementById('past-skills-content');
    
    if( ! toggleButton || ! content ) return;
    
    toggleButton.addEventListener('click', () => {
      toggleButton.classList.toggle('active');
      content.classList.toggle('expanded');
    });
  }
  
  /**
   * Check if header is over white or light sections
   */
  checkHeaderBackground()
  {
    // Only run this check on mobile devices
    if( window.innerWidth > 768 ) {
      this.header.classList.remove('over-white');
      return;
    }
    
    const headerRect = this.header.getBoundingClientRect();
    const headerBottom = headerRect.bottom;
    const headerTop = headerRect.top;
    
    // Get all sections that could be white or light colored
    const lightSections = document.querySelectorAll('.about, .skills, section[style*="background-color: var(--white)"], section[style*="background-color: var(--lighter-gray)"], section[style*="background-color: #FFFFFF"], section[style*="background-color: #EEEEEE"]');
    
    let isOverWhite = false;
    
    lightSections.forEach( section => {
      const sectionRect = section.getBoundingClientRect();
      
      // Check if header overlaps with this section
      if( headerBottom > sectionRect.top && headerTop < sectionRect.bottom ) {
        isOverWhite = true;
      }
    });
    
    // Add or remove over-white class
    if( isOverWhite ) {
      this.header.classList.add('over-white');
    } else {
      this.header.classList.remove('over-white');
    }
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
function copyToClipboard( text )
{
  // Create a temporary textarea element
  const textarea = document.createElement('textarea');
  textarea.value = text;
  
  // Make it invisible
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  
  // Add to document, select text, and execute command
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  
  // Remove the temporary element
  document.body.removeChild(textarea);
  
  // Visual feedback with CSS
  const element = event.currentTarget;
  element.classList.add('copied');
  
  // Remove the class after animation completes
  setTimeout(() => {
    element.classList.remove('copied');
  }, 2000);
}
