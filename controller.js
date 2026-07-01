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
    this.offerForm = document.getElementById('offer-form');
    this.requestCvButton = document.querySelector('.request-cv');
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
    // Initialize loading screen before DOM is fully loaded
    this.initLoadingScreen();

    // Reveal the hero offer callout (if enabled) — runs synchronously so it is
    // already visible before the loading screen fades (no layout shift).
    this.initHeroOffer();

    // Inject the site-wide announcement bar (if enabled) below the header.
    this.initAnnouncementBar();

    // Persistent voice-agent overlay: apply the site-wide DOM changes (body
    // class, #about neutralization, nav label, about text) synchronously so
    // there is no flash before paint. The overlay widget itself is built by
    // voice-agent.js. No-op unless VOICE_AGENT_CONFIG.persistentAgent is true.
    this.initPersistentAgent();

    // Reveal new/unfinished content (e.g. the "Systeme" nav dropdown) via config.
    this.initNewContent();

    // Hide commercial content (prices, service-page FAQ + CTA) when hideBiz is true.
    this.initHideBiz();

    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', () => {
      this.initNavigation();
      this.initScrollAnimations();
      // this.initBackToTop();  // (TASK) hidden for now (replaced by Speak to an AI)
      this.initFloatingAiButton();
      this.initContactForm();
      this.initOfferForm();
      this.initSkillsModal();
      this.initResponsiveAdjustments();
      this.initTabNavigation();
      this.initInfoIcons();
      this.initTypewriterEffect();
      this.initProjectCarousel();
      this.initPastSkillsToggle();

      // Add animation classes to elements
      document.querySelectorAll('.fade-in').forEach((element, index) => {
        element.classList.add(`delay-${index % 3 + 1}`);
      });

      // Initial check for header background
      this.checkHeaderBackground();
    });
  }

  /**
   * Reveal the hero offer callout when enabled via LOADING_CONFIG.showHeroOffer.
   * The element is hidden by default in CSS, so when disabled the hero is
   * unchanged. Tolerant of config being absent.
   */
  initHeroOffer()
  {
    if (typeof LOADING_CONFIG === 'undefined' || !LOADING_CONFIG.showHeroOffer)
      return;

    const isDe = (document.documentElement.lang || 'en').toLowerCase().startsWith('de');
    const offers = Array.isArray(LOADING_CONFIG.heroOffers) ? LOADING_CONFIG.heroOffers : [];
    const offer = offers[LOADING_CONFIG.heroOfferIndex || 0] || {};
    const text = (isDe ? offer.de : offer.en) || offer.en || offer.de || '';

    document.querySelectorAll('.hero-offer').forEach(el => {
      const span = el.querySelector('.hero-offer-text');
      if (span && text) span.innerHTML = text;
      el.classList.add('is-on');
    });

    // The callout makes the left column taller; drop the hero CTA buttons while
    // it is shown so the column heights stay balanced (hero.css hides them).
    document.body.classList.add('hero-offer-on');
  }

  /**
   * Reveal new or unfinished content that is hidden by default until it is ready
   * for publishing (currently the "Systeme" nav dropdown). The gated elements
   * carry the .new-content class and CSS hides them unless body.show-new-content
   * is present; this method adds that class only when LOADING_CONFIG.showNewContent
   * is explicitly true. Hidden-by-default is the safe choice: if config or JS is
   * unavailable, the unfinished content stays out of sight. Tolerant of config
   * being absent.
   */
  initNewContent()
  {
    if (typeof LOADING_CONFIG !== 'undefined' && LOADING_CONFIG.showNewContent === true)
      document.body.classList.add('show-new-content');
  }

  /**
   * Hide commercial content when LOADING_CONFIG.hideBiz is true: prices and any
   * element marked .biz-only, plus the service-page FAQ mini-tab and the
   * .service-cta banner. Adds the single body class .hide-biz; the CSS rules
   * (components.css, page-components.css, hero.css) key off it. Visible by
   * default (absent/false), so everything still shows if config or JS is
   * unavailable. Tolerant of config being absent.
   */
  initHideBiz()
  {
    if (typeof LOADING_CONFIG !== 'undefined' && LOADING_CONFIG.hideBiz === true)
      document.body.classList.add('hide-biz');
  }

  /**
   * Inject the site-wide announcement bar just below the header (inside the
   * fixed header, under the nav), when enabled via LOADING_CONFIG.
   * Modes (LOADING_CONFIG.showAnnouncementBar):
   *   'off'    - nothing is added.
   *   'offer'  - bar links to the offer page (legacy boolean true == 'offer').
   *   'texts'  - shows announcementTexts[announcementTextIndex], an HTML string
   *              that may contain links; the {base} placeholder is replaced with
   *              the path to the current language root.
   * The relative paths are derived from the logo link (which always points to
   * the current language's root) so they are correct on every page and in both
   * languages. Tolerant of config absent.
   */
  initAnnouncementBar()
  {
    const config = (typeof LOADING_CONFIG !== 'undefined') ? LOADING_CONFIG : {};
    // Normalise the mode and accept the legacy boolean (true => 'offer').
    let mode = config.showAnnouncementBar;
    if (mode === true) mode = 'offer';
    if (!mode || mode === 'off') return;

    // In offer mode, reaching the offer page is the goal of the bar, so treat
    // the visit like a manual dismissal: remember it for the session so the bar
    // no longer shows here or on any other page the visitor opens this session.
    if (mode === 'offer' && /\/offers\/offer\.html$/.test(location.pathname)) {
      try { sessionStorage.setItem('waj:homepage:offerDismissed', '1'); } catch (e) { /* ignore */ }
    }

    // Stay hidden if the visitor dismissed it earlier this session (or already
    // reached the offer page above). sessionStorage is per-tab and cleared when
    // the tab/browser closes, so it reappears on the next visit.
    try {
      if (sessionStorage.getItem('waj:homepage:offerDismissed') === '1') return;
    } catch (e) { /* sessionStorage may be unavailable (privacy mode) */ }

    const header = this.header || document.querySelector('header');
    if (!header || header.querySelector('.announcement-bar')) return;

    const isDe = (document.documentElement.lang || 'en').toLowerCase().startsWith('de');
    const closeLabel = isDe ? 'Hinweis schlie&szlig;en' : 'Dismiss';

    // The logo link points to the current language's root (e.g. "#",
    // "../../index.html"), so stripping its trailing "index.html"/"#" yields the
    // prefix to that root for building relative links.
    const logo = document.querySelector('.logo a');
    const prefix = (logo ? logo.getAttribute('href') : '')
      .replace(/index\.html$/, '').replace(/^#$/, '');

    let inner;
    if (mode === 'texts') {
      const texts = Array.isArray(config.announcementTexts) ? config.announcementTexts : [];
      const entry = texts[config.announcementTextIndex || 0];
      // Each entry is { de, en }; fall back to the other language if one is
      // missing. (A bare string is also tolerated for older configs.)
      const html = (typeof entry === 'string')
        ? entry
        : (entry && ((isDe ? entry.de : entry.en) || entry.en || entry.de));
      if (!html) return; // nothing configured to show
      inner =
        '<div class="container">' +
          '<span class="announcement-bar-content">' + html.replace(/\{root\}/g, prefix) + '</span>' +
        '</div>';
    } else {
      // 'offer'
      const offer = config.announcementOffer || {};
      const text = (isDe ? offer.de : offer.en) || offer.en || offer.de || '';
      const href = prefix + 'pages/offers/offer.html';
      inner =
        '<div class="container">' +
          '<a class="announcement-bar-link" href="' + href + '">' +
            '<i class="fas fa-bolt" aria-hidden="true"></i>' +
            '<span class="announcement-bar-text">' + text + '</span>' +
            '<i class="fas fa-arrow-right announcement-bar-arrow" aria-hidden="true"></i>' +
          '</a>' +
        '</div>';
    }

    const bar = document.createElement('div');
    bar.className = 'announcement-bar';
    bar.innerHTML = inner +
      '<button class="announcement-bar-close" type="button" aria-label="' + closeLabel + '" title="' + closeLabel + '">&times;</button>';

    header.appendChild(bar);
    document.body.classList.add('has-announcement');

    bar.querySelector('.announcement-bar-close').addEventListener('click', () => {
      bar.remove();
      document.body.classList.remove('has-announcement');
      try { sessionStorage.setItem('waj:homepage:offerDismissed', '1'); } catch (e) { /* ignore */ }
    });
  }

  /**
   * Persistent voice-agent overlay — site-wide DOM changes (see
   * lib/voice-agent-persistent-overlay-plan.md). Runs only when
   * VOICE_AGENT_CONFIG.persistentAgent is true; otherwise the site is unchanged.
   * The always-on overlay widget is created separately by voice-agent.js.
   *
   * When on:
   *  - adds body.persistent-agent (CSS hook, incl. the mobile #about flip),
   *  - replaces the in-#about live widget with a static illustration so there is
   *    only one live agent (the overlay),
   *  - hides the legacy .floating-ai-button (the overlay is the entry point now),
   *  - reverts the #about nav label from "Ask AI"/"KI fragen" back to
   *    "About"/"Über mich" (the section is just About again),
   *  - swaps the about intro to the shorter, personal first-person copy.
   */
  initPersistentAgent()
  {
    if( typeof VOICE_AGENT_CONFIG === 'undefined' || !VOICE_AGENT_CONFIG.persistentAgent )
      return;

    const isDe = (document.documentElement.lang || 'en').toLowerCase().startsWith('de');
    document.body.classList.add('persistent-agent');

    // 1. Neutralize the in-#about live widget (index pages only) with a static,
    //    on-brand "talk to AI" illustration. The markup lives as a hidden
    //    <template id="va-dummy-art"> in the index page (per language), so it is
    //    not duplicated here. Removing the live mic/status guarantees a single
    //    live instance (the overlay).
    const container = document.querySelector('.voice-agent-container');
    const dummyTpl = document.getElementById('va-dummy-art');
    if( container && dummyTpl ) {
      container.classList.add('va-dummy');
      container.replaceChildren(dummyTpl.content.cloneNode(true));
    }

    // 2. Hide the legacy floating link (controller.initFloatingAiButton would
    //    otherwise add .show on scroll).
    document.querySelectorAll('.floating-ai-button').forEach(el => {
      el.classList.remove('show');
      el.style.display = 'none';
    });

    // 3. Revert the #about nav label (per page language).
    document.querySelectorAll('a.nav-link[href$="#about"]').forEach(a => {
      a.textContent = isDe ? 'Über mich' : 'About';
    });

    // 4. Swap the about intro to the shorter, personal first-person copy. The
    //    copy lives as a hidden <template id="va-about-intro"> in the index page
    //    (per language). Keep the feature list + CTA; just replace the leading
    //    paragraphs.
    const aboutText = document.querySelector('.about-text');
    const introTpl = document.getElementById('va-about-intro');
    if( aboutText && introTpl ) {
      // Replace every direct <p> before the feature list with the page's intro.
      const list = aboutText.querySelector('.feature-list');
      let node = aboutText.firstElementChild;
      while( node && node !== list ) {
        const next = node.nextElementSibling;
        if( node.tagName === 'P' )
          node.remove();
        node = next;
      }
      aboutText.insertBefore(introTpl.content.cloneNode(true), aboutText.firstChild);
    }

    // 5. Re-wire the index CTAs for persistent-agent mode (site-specific; index
    //    pages only). The #about live widget moved to the overlay, so the hero
    //    "Ask AI" button no longer jumps to #about — instead, with the round
    //    launcher it opens the overlay panel directly (via the agent's public
    //    open() method), and with the text launcher it points to Services. The
    //    two about CTAs become Contact + Services in both styles.
    const launcherStyle = VOICE_AGENT_CONFIG.launcherStyle || 'round';

    const heroPrimary = document.querySelector('.hero-cta .btn');   // first hero button
    if( heroPrimary ) {
      if( launcherStyle === 'round' ) {
        heroPrimary.setAttribute('href', '#about');   // graceful fallback if JS fails
        heroPrimary.addEventListener('click', (e) => {
          // Magically open the overlay panel instead of navigating.
          if( window.voiceAgent && typeof window.voiceAgent.open === 'function' ) {
            e.preventDefault();
            window.voiceAgent.open();
          }
        });
      } else {
        // Text launcher: the pill is the AI entry point, so this button is no
        // longer "Ask AI" — drop the mic and relabel it to its new target.
        heroPrimary.setAttribute('href', '#services');
        heroPrimary.textContent = isDe ? 'Leistungen' : 'Services';

        // The second button would otherwise duplicate Services, so point it at
        // Projects instead.
        const heroSecondary = document.querySelectorAll('.hero-cta .btn')[1];
        if( heroSecondary ) {
          heroSecondary.setAttribute('href', '#proj');
          heroSecondary.textContent = isDe ? 'Projekte' : 'Projects';
        }
      }
    }

    const ctaButtons = document.querySelectorAll('.cta-buttons .btn');
    if( ctaButtons[0] ) ctaButtons[0].setAttribute('href', '#contact');   // first -> Contact (label already fits)
    if( ctaButtons[1] ) {
      // Second -> Services: retarget and relabel (was "See samples" -> #proj).
      ctaButtons[1].setAttribute('href', '#services');
      ctaButtons[1].textContent = isDe ? 'Leistungen' : 'Services';
    }
  }

  /**
   * Initialize loading screen
   */
  initLoadingScreen() {
    // Detect whether the user is navigating within the site (e.g. coming back
    // from a sub page) versus arriving fresh from outside. Every page of the
    // site sets this flag, so once it exists we know the visitor is already
    // inside the site and we can skip the loading screen on the index pages.
    // (sessionStorage is per-tab and cleared when the tab is closed.)
    let cameFromWithinSite = false;
    try {
      cameFromWithinSite = sessionStorage.getItem('waj:homepage:siteVisited') === '1';
      sessionStorage.setItem('waj:homepage:siteVisited', '1');
    } catch (e) {
      // sessionStorage may be unavailable (e.g. privacy mode); fall back to
      // always showing the loading screen.
    }

    // Check if loading screen is enabled in config, and suppress it when the
    // user is just navigating back from a sub page.
    if (typeof LOADING_CONFIG === 'undefined' || !LOADING_CONFIG.showLoadingScreen || cameFromWithinSite) {
      // If disabled, remove the loading screen immediately and allow typewriter to start
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.remove();
      }
      // Set flag to indicate loading screen is done (or disabled)
      window.loadingScreenComplete = true;
      return;
    }

    // Initialize flag - typewriter effect will wait for this
    window.loadingScreenComplete = false;

    // Wait for window to fully load (all resources including images)
    window.addEventListener('load', () => {
      const loadingScreen = document.getElementById('loading-screen');
      if (!loadingScreen) {
        window.loadingScreenComplete = true;
        return;
      }

      // Wait for the progress bar animation to complete (1.5s) plus a small buffer
      setTimeout(() => {
        // Add hidden class to trigger fade out
        loadingScreen.classList.add('hidden');

        // Remove the element from DOM after transition completes
        setTimeout(() => {
          loadingScreen.remove();
          // Signal that loading screen is complete
          window.loadingScreenComplete = true;
          // Dispatch custom event for typewriter to start
          window.dispatchEvent(new Event('loadingScreenComplete'));
        }, 500); // Match the CSS transition duration
      }, 1600); // 1.5s progress bar + 100ms buffer
    });
  }

  /**
   * Navigation functionality
   */
  initNavigation()
  {
    // Handle scroll events for header styling
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50)
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
      if (this.navMenu.classList.contains('active')) {
        // Set menu height to viewport height
        this.navMenu.style.height = `${window.innerHeight}px`;
      }
    });

    // Close mobile menu when clicking a link
    this.navLinks.forEach(link => {
      link.addEventListener('click', () => {
        this.navMenu.classList.remove('active');
        this.menuToggle.querySelector('i').classList.add('fa-bars');
        this.menuToggle.querySelector('i').classList.remove('fa-times');
        this.body.style.overflow = '';
      });
    });

    // Services dropdown: caret toggles the submenu on mobile (desktop uses hover)
    document.querySelectorAll('.nav-dropdown-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropdown = toggle.closest('.nav-dropdown');
        if (!dropdown) return;
        const isOpen = dropdown.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.navMenu.classList.contains('active') &&
        !this.navMenu.contains(e.target) &&
        !this.menuToggle.contains(e.target)) {
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

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        this.navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`)
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
        if (entry.isIntersecting) {
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
      entries.forEach(entry => {
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
      if (window.scrollY > 500)
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
    if (!this.floatingAiButton)
      return;

    window.addEventListener('scroll', () => {
      const servicesSection = document.getElementById('services');
      if (servicesSection) {
        const servicesSectionTop = servicesSection.offsetTop - 500; // Show slightly before reaching the section

        if (window.scrollY >= servicesSectionTop)
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
    if (this.contactForm) {

      const isDe = (document.documentElement.lang || 'en').toLowerCase().startsWith('de');
      const t = isDe ? {
        errName:    'Bitte geben Sie Ihren Namen ein',
        errMail:    'Bitte geben Sie Ihre E-Mail-Adresse ein',
        errMailInv: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
        errSubject: 'Bitte geben Sie einen Betreff ein',
        errMessage: 'Bitte geben Sie Ihre Nachricht ein',
        success:    '<i class="fas fa-check-circle"></i> Vielen Dank für Ihre Nachricht! Ich melde mich bei Ihnen.',
        error:      '<i class="fas fa-exclamation-circle"></i> Hoppla, da ist etwas schiefgelaufen. Bitte versuchen Sie es später erneut.',
        errDetails: 'Fehlerdetails',
        cvSubject:  'Lebenslauf-Anfrage'
      } : {
        errName:    'Please enter your name',
        errMail:    'Please enter your email address',
        errMailInv: 'Please enter a valid email address',
        errSubject: 'Please enter a subject',
        errMessage: 'Please enter your message',
        success:    '<i class="fas fa-check-circle"></i> Thank you for your message! I will get back to you.',
        error:      '<i class="fas fa-exclamation-circle"></i> Oops! Something went wrong. Please try again later.',
        errDetails: 'Error details',
        cvSubject:  'CV Request'
      };

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
          errors.push(t.errName);
          isValid = false;
        }

        if( ! email ) {
          errors.push(t.errMail);
          isValid = false;
        } else if( ! this.isValidEmail(email)) {
          errors.push(t.errMailInv);
          isValid = false;
        }

        if( ! subject ) {
          errors.push(t.errSubject);
          isValid = false;
        }

        if( ! message ) {
          errors.push(t.errMessage);
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
            statusContainer.innerHTML = t.success;

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
            let errorMessage = t.error;
            if( error && error.text ) {
              errorMessage += `<br><small>${t.errDetails}: ${error.text}</small>`;
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
          subjectField.value = t.cvSubject;
      });
    }
  }

  /**
   * Use-case inquiry form on the offer page. Reuses the same EmailJS service and
   * template as the contact form; the two textareas (current situation + desired
   * outcome) and the helper fields are composed into the template's "message".
   * No-op on pages without the form.
   */
  initOfferForm()
  {
    if( ! this.offerForm ) return;

    const isDe = (document.documentElement.lang || 'en').toLowerCase().startsWith('de');
    const t = isDe ? {
      errName:    'Bitte geben Sie Ihren Namen ein',
      errMail:    'Bitte geben Sie Ihre E-Mail-Adresse ein',
      errMailInv: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
      errCurrent: 'Bitte beschreiben Sie die aktuelle Situation',
      success:    '<i class="fas fa-check-circle"></i> Vielen Dank! Ich melde mich zeitnah bei Ihnen.',
      error:      '<i class="fas fa-exclamation-circle"></i> Hoppla, da ist etwas schiefgelaufen. Bitte versuchen Sie es später erneut.',
      subject:    'Use-Case-Anfrage (Angebotsseite)',
      lCurrent:   'Aktuelle Situation / Aufgabe heute',
      lInputs:    'Ihre Inputs / Unterlagen',
      lSystems:   'Beteiligte Systeme / Tools',
      lOutcome:   'Gewünschtes Ergebnis',
      lFrequency: 'Häufigkeit / Volumen',
      lBudget:    'Zeit- und Budgetvorstellung',
      notGiven:   '(keine Angabe)'
    } : {
      errName:    'Please enter your name',
      errMail:    'Please enter your email address',
      errMailInv: 'Please enter a valid email address',
      errCurrent: 'Please describe the current situation',
      success:    '<i class="fas fa-check-circle"></i> Thank you! I will get back to you soon.',
      error:      '<i class="fas fa-exclamation-circle"></i> Oops! Something went wrong. Please try again later.',
      subject:    'Use case inquiry (offer page)',
      lCurrent:   'Current situation / task today',
      lInputs:    'Your inputs / documents',
      lSystems:   'Systems / tools involved',
      lOutcome:   'Desired outcome',
      lFrequency: 'Frequency / volume',
      lBudget:    'Timeline and budget expectations',
      notGiven:   '(not specified)'
    };

    // Build validation / spinner / status containers (same pattern as the contact form)
    const validationContainer = document.createElement('div');
    validationContainer.className = 'validation-messages';
    this.offerForm.appendChild(validationContainer);

    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.innerHTML = '<div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div>';
    spinner.style.display = 'none';
    this.offerForm.appendChild(spinner);

    const statusContainer = document.createElement('div');
    statusContainer.className = 'form-status';
    statusContainer.style.display = 'none';
    this.offerForm.appendChild(statusContainer);

    this.offerForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name      = document.getElementById('of-name').value.trim();
      const email     = document.getElementById('of-email').value.trim();
      const current   = document.getElementById('of-current').value.trim();
      const outcome   = document.getElementById('of-outcome').value.trim();
      const frequency = document.getElementById('of-frequency').value.trim();
      const systems   = document.getElementById('of-systems').value.trim();
      const inputs    = document.getElementById('of-inputs').value.trim();
      const budget    = document.getElementById('of-budget').value.trim();

      validationContainer.innerHTML = '';
      validationContainer.style.display = 'none';
      statusContainer.style.display = 'none';

      let isValid = true;
      const errors = [];
      if( ! name )                         { errors.push(t.errName); isValid = false; }
      if( ! email )                        { errors.push(t.errMail); isValid = false; }
      else if( ! this.isValidEmail(email)) { errors.push(t.errMailInv); isValid = false; }
      if( ! current )                      { errors.push(t.errCurrent); isValid = false; }

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

      // Compose the message body from the two textareas plus the helper fields
      const message =
        t.lCurrent + ':\n' + current + '\n\n' +
        t.lInputs + ': ' + (inputs || t.notGiven) + '\n' +
        t.lSystems + ': ' + (systems || t.notGiven) + '\n\n' +
        t.lOutcome + ':\n' + outcome + '\n\n' +
        t.lFrequency + ': ' + (frequency || t.notGiven) + '\n' +
        t.lBudget + ': ' + (budget || t.notGiven);

      const templateParams = { name: name, mail: email, subject: t.subject, message: message };

      const serviceID  = 'service_r1nitci';
      const templateID = 'template_ltytzqx';

      spinner.style.display = 'flex';

      emailjs.send(serviceID, templateID, templateParams)
        .then(() => {
          spinner.style.display = 'none';
          statusContainer.style.display = 'block';
          statusContainer.className = 'form-status success';
          statusContainer.innerHTML = t.success;
          this.offerForm.reset();
          setTimeout(() => { statusContainer.style.display = 'none'; }, 6000);
        })
        .catch(error => {
          spinner.style.display = 'none';
          let errorMessage = t.error;
          if( error && error.text )
            errorMessage += `<br><small>${error.text}</small>`;
          statusContainer.style.display = 'block';
          statusContainer.className = 'form-status error';
          statusContainer.innerHTML = errorMessage;
        });
    });
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
   * Cookie consent is handled entirely by cookie-fix.js (single source of truth,
   * injects its own banner and works reliably on GitHub Pages). It is intentionally
   * not duplicated here — having both caused a double banner / two-click accept bug.
   */

  /**
   * AI development skills modal (opened from the link in the Skills section)
   */
  initSkillsModal()
  {
    const trigger = document.getElementById('aiSkillsTrigger');
    const modal = document.getElementById('aiSkillsModal');
    if (!trigger || !modal) return;

    const open = (e) => {
      if (e) e.preventDefault();
      modal.classList.add('open');
      this.body.style.overflow = 'hidden';
      const closeBtn = modal.querySelector('.skills-modal-close');
      if (closeBtn) closeBtn.focus();
    };
    const close = () => {
      modal.classList.remove('open');
      this.body.style.overflow = '';
    };

    trigger.addEventListener('click', open);

    // Close via the X button (data-close-modal)
    modal.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', close));

    // Close when clicking the backdrop (but not the dialog box itself)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
  }

  /**
   * Responsive adjustments
   */
  initResponsiveAdjustments()
  {
    // Set the --vh value initially
    this.setVhProperty();

    // Position the scroll indicator above the system nav bar (measured, not inferred)
    this.setIndicatorBottom();

    // Track the visible viewport live so the indicator follows the URL bar and
    // stays clear of the Android buttons bar as it shows/hides on scroll.
    if( window.visualViewport ) {
      window.visualViewport.addEventListener('resize', () => this.setIndicatorBottom());
      window.visualViewport.addEventListener('scroll', () => this.setIndicatorBottom());
    }

    // Update the --vh value on resize and orientation change
    window.addEventListener('resize', () => {
      this.setVhProperty();
      this.setIndicatorBottom();

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
        this.setIndicatorBottom();
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
   * Position the scroll indicator above the system navigation bar.
   *
   * We can't trust env(safe-area-inset-bottom): it is 0 on Android devices with
   * the classic 3-button navigation bar (the browser doesn't paint behind it),
   * so the CSS-only fix failed there. Instead we measure the real gap between the
   * layout viewport and the visible viewport via the visualViewport API, which is
   * consistent across devices and nav modes, and expose it as --indicator-bottom.
   */
  setIndicatorBottom()
  {
    const vv = window.visualViewport;
    if( ! vv ) return;   // CSS fallback (env + fixed offset) stays in effect

    // Space below the visible viewport that is hidden by system UI / URL bar
    const hiddenBottom = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));

    document.documentElement.style.setProperty('--indicator-bottom', `${hiddenBottom}px`);
  }

  /**
   * Tab navigation for projects section
   */
  initTabNavigation()
  {
    if( this.tabLinks.length > 0 ) {
      this.tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();

          // Get the tab to show
          const tabId = link.getAttribute('data-tab');

          // Hide all tab contents
          this.tabContents.forEach( content => {
            content.style.display = 'none';
          });

          // Remove active class from all tab links
          this.tabLinks.forEach(tabLink => {
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
    if( !this.infoIcons.length ) return;

    // Add click event to each info icon
    this.infoIcons.forEach(icon => {
      icon.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from propagating

        // Close any open popovers first
        this.infoIcons.forEach(i => {
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

      // Function to start typing
      function startTyping() {
        setTimeout(typeNextChar, 800);
      }

      // Check if loading screen is enabled and wait for it to complete
      if( typeof LOADING_CONFIG !== 'undefined' && LOADING_CONFIG.showLoadingScreen ) {
        // Wait for loading screen to complete
        if (window.loadingScreenComplete) {
          // Loading screen already complete, start immediately
          startTyping();
        } else {
          // Wait for loading screen complete event
          window.addEventListener('loadingScreenComplete', startTyping, { once: true });
        }
      } else {
        // No loading screen, start immediately
        startTyping();
      }
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

    if( !carouselContainer || !prevArrow || !nextArrow ) return;

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

    if( !container || !prevArrow || !nextArrow ) return;

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
    }
    else if( endX - startX > swipeThreshold ) {
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

    if( !toggleButton || !content ) return;

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
function copyToClipboard(text)
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
