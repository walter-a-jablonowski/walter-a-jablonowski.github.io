/**
 * Alternative cookie consent implementation for GitHub Pages
 * This script exactly matches the original implementation but uses direct DOM injection
 * to ensure visibility on GitHub Pages
 */
(function() {
  // Wait for DOM to be fully loaded
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Cookie fix script loaded');
    
    // Check if consent is already set
    function hasConsent() {
      try {
        return localStorage.getItem('cookieConsent') !== null;
      } catch (e) {
        console.error('Error checking consent:', e);
        return false;
      }
    }
    
    // If consent is already set, don't show the banner
    if (hasConsent()) {
      console.log('Consent already set, showing no banner');
      return;
    }
    
    console.log('No consent found, creating banner');
    
    // Get CSS variables from the page to match styles exactly
    const computedStyle = getComputedStyle(document.documentElement);
    const darkColor = computedStyle.getPropertyValue('--dark') || '#333';
    const whiteColor = computedStyle.getPropertyValue('--white') || '#fff';
    const primaryColor = computedStyle.getPropertyValue('--primary') || '#ff6b00';
    const spacingLg = computedStyle.getPropertyValue('--spacing-lg') || '24px';
    const spacingMd = computedStyle.getPropertyValue('--spacing-md') || '16px';
    
    // Create banner element that exactly matches the original HTML structure
    const banner = document.createElement('div');
    banner.id = 'cookie-consent-alt';
    banner.innerHTML = `
      <div class="cookie-content" style="
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <p style="margin: 0; padding-right: ${spacingLg}">
          This website uses cookies to ensure you get the best experience on our website. 
          By continuing to use this site, you consent to the use of cookies.
        </p>
        <div class="cookie-buttons" style="display: flex; gap: ${spacingMd}">
          <button id="accept-cookies-alt" class="btn" style="
            display: inline-block;
            padding: 0.75rem 1.5rem;
            border-radius: var(--border-radius-pill, 30px);
            font-weight: 600;
            text-align: center;
            cursor: pointer;
            transition: all var(--transition-normal, 0.3s ease);
            border: none;
            font-size: 1rem;
            letter-spacing: 0.5px;
            background-color: ${primaryColor};
            color: ${whiteColor};
          ">Accept</button>
          <button id="decline-cookies-alt" class="btn btn-outline" style="
            display: inline-block;
            padding: 0.75rem 1.5rem;
            border-radius: var(--border-radius-pill, 30px);
            font-weight: 600;
            text-align: center;
            cursor: pointer;
            transition: all var(--transition-normal, 0.3s ease);
            font-size: 1rem;
            letter-spacing: 0.5px;
            background-color: transparent;
            color: ${primaryColor};
            border: 2px solid ${primaryColor};
          ">Decline</button>
        </div>
      </div>
    `;
    
    // Apply styles to match the original banner
    banner.style.position = 'fixed';
    banner.style.bottom = '0';
    banner.style.left = '0';
    banner.style.width = '100%';
    banner.style.backgroundColor = darkColor;
    banner.style.color = whiteColor;
    banner.style.padding = spacingLg;
    banner.style.zIndex = '9999';
    banner.style.boxShadow = '0 -2px 10px rgba(0, 0, 0, 0.2)';
    banner.style.display = 'block';
    
    // Add responsive styles for mobile
    const mediaQuery768 = window.matchMedia('(max-width: 768px)');
    const mediaQuery480 = window.matchMedia('(max-width: 480px)');
    
    function applyResponsiveStyles() {
      const cookieContent = banner.querySelector('.cookie-content');
      const cookieContentP = banner.querySelector('.cookie-content p');
      const cookieButtons = banner.querySelector('.cookie-buttons');
      const buttons = banner.querySelectorAll('.cookie-buttons .btn');
      
      if (mediaQuery768.matches) {
        cookieContent.style.flexDirection = 'column';
        cookieContent.style.textAlign = 'center';
        cookieContentP.style.marginBottom = spacingMd;
        cookieContentP.style.paddingRight = '0';
        cookieButtons.style.width = '100%';
        cookieButtons.style.justifyContent = 'center';
        
        buttons.forEach(btn => {
          btn.style.flex = '1';
          btn.style.maxWidth = '150px';
        });
      }
      
      if (mediaQuery480.matches) {
        banner.style.padding = spacingMd;
        cookieButtons.style.flexDirection = 'column';
        cookieButtons.style.width = '100%';
        cookieButtons.style.maxWidth = '200px';
        cookieButtons.style.margin = '0 auto';
        
        buttons.forEach(btn => {
          btn.style.maxWidth = 'none';
          btn.style.marginBottom = computedStyle.getPropertyValue('--spacing-xs') || '8px';
        });
      }
    }
    
    // Apply responsive styles initially
    mediaQuery768.addListener(applyResponsiveStyles);
    mediaQuery480.addListener(applyResponsiveStyles);
    
    // Append to body
    document.body.appendChild(banner);
    console.log('Banner appended to body');
    
    // Apply responsive styles after appending
    applyResponsiveStyles();
    
    // Get buttons
    const acceptButton = document.getElementById('accept-cookies-alt');
    const declineButton = document.getElementById('decline-cookies-alt');
    
    // Add event listeners to match original functionality exactly
    if (acceptButton) {
      acceptButton.addEventListener('click', function() {
        console.log('Accept clicked');
        localStorage.setItem('cookieConsent', 'accepted');
        banner.style.display = 'none';
        // Here you would initialize analytics or misc cookie-dependent features
      });
    }
    
    if (declineButton) {
      declineButton.addEventListener('click', function() {
        console.log('Decline clicked');
        // No localStorage for declined, matching original implementation
        banner.style.display = 'none';
        // Redirect to terms declined page
        window.location.href = 'terms_declined.html';
      });
    }
  });
})();
