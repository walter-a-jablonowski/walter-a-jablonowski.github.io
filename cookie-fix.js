/**
 * Alternative cookie consent implementation for GitHub Pages
 * This script creates and injects the cookie banner directly into the DOM
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
      console.log('Consent already set, not showing banner');
      return;
    }
    
    console.log('No consent found, creating banner');
    
    // Create banner element
    const banner = document.createElement('div');
    banner.id = 'cookie-consent-alt';
    banner.innerHTML = `
      <div style="
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: #333;
        color: white;
        padding: 20px;
        z-index: 99999;
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
        font-family: 'Roboto', sans-serif;
      ">
        <div style="
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
        ">
          <p style="margin: 0; padding-right: 20px;">
            This website uses cookies to ensure you get the best experience on our website. 
            By continuing to use this site, you consent to the use of cookies.
          </p>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button id="accept-cookies-alt" style="
              padding: 8px 16px;
              background-color: #ff6b00;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-family: inherit;
            ">Accept</button>
            <button id="decline-cookies-alt" style="
              padding: 8px 16px;
              background-color: transparent;
              color: #ff6b00;
              border: 1px solid #ff6b00;
              border-radius: 4px;
              cursor: pointer;
              font-family: inherit;
            ">Decline</button>
          </div>
        </div>
      </div>
    `;
    
    // Append to body
    document.body.appendChild(banner);
    console.log('Banner appended to body');
    
    // Get buttons
    const acceptButton = document.getElementById('accept-cookies-alt');
    const declineButton = document.getElementById('decline-cookies-alt');
    
    // Add event listeners
    if (acceptButton) {
      acceptButton.addEventListener('click', function() {
        console.log('Accept clicked');
        try {
          localStorage.setItem('cookieConsent', 'accepted');
          banner.remove();
        } catch (e) {
          console.error('Error saving consent:', e);
          banner.remove();
        }
      });
    }
    
    if (declineButton) {
      declineButton.addEventListener('click', function() {
        console.log('Decline clicked');
        try {
          localStorage.setItem('cookieConsent', 'declined');
          banner.remove();
          window.location.href = 'terms_declined.html';
        } catch (e) {
          console.error('Error saving consent:', e);
          banner.remove();
          window.location.href = 'terms_declined.html';
        }
      });
    }
  });
})();
