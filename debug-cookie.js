/**
 * Debug script for cookie consent on GitHub Pages
 */

(function() {
  // Run this script as early as possible
  console.log('Debug script loaded');
  
  // Test localStorage availability
  function testLocalStorage() {
    try {
      const testKey = 'testLocalStorage';
      localStorage.setItem(testKey, 'test');
      const testValue = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      return testValue === 'test';
    } catch (e) {
      console.error('localStorage test failed:', e);
      return false;
    }
  }
  
  // Check if we're on GitHub Pages
  function isGitHubPages() {
    return window.location.hostname.includes('github.io');
  }
  
  // Get cookie consent status
  function getCookieConsent() {
    try {
      return localStorage.getItem('cookieConsent');
    } catch (e) {
      console.error('Error getting cookie consent:', e);
      return null;
    }
  }
  
  // Force cookie banner visibility with important inline styles
  function forceCookieBanner() {
    const banner = document.getElementById('cookie-consent');
    if (banner) {
      console.log('Force showing cookie banner with !important styles');
      
      // Apply critical inline styles to force visibility
      banner.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 99999 !important; position: fixed !important; bottom: 0 !important; left: 0 !important; width: 100% !important;');
      
      // Log the computed style to verify visibility
      const computedStyle = window.getComputedStyle(banner);
      console.log('Banner computed style - display:', computedStyle.display, 'visibility:', computedStyle.visibility, 'opacity:', computedStyle.opacity);
      
      // Add event listeners directly
      const acceptButton = document.getElementById('accept-cookies');
      const declineButton = document.getElementById('decline-cookies');
      
      if (acceptButton) {
        console.log('Accept button found, adding listener');
        acceptButton.addEventListener('click', function() {
          try {
            localStorage.setItem('cookieConsent', 'accepted');
            console.log('Consent accepted via debug script');
            banner.style.display = 'none';
          } catch (e) {
            console.error('Error saving consent:', e);
            banner.style.display = 'none';
          }
        });
      } else {
        console.error('Accept button not found');
      }
      
      if (declineButton) {
        console.log('Decline button found, adding listener');
        declineButton.addEventListener('click', function() {
          try {
            localStorage.setItem('cookieConsent', 'declined');
            console.log('Consent declined via debug script');
            banner.style.display = 'none';
            window.location.href = 'terms_declined.html';
          } catch (e) {
            console.error('Error saving consent:', e);
            banner.style.display = 'none';
            window.location.href = 'terms_declined.html';
          }
        });
      } else {
        console.error('Decline button not found');
      }
    } else {
      console.error('Cookie banner element not found');
    }
  }
  
  // Wait for DOM to be fully loaded
  function onDOMReady(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }
  
  // Main debug function
  function runDebug() {
    console.log('Running cookie consent debug');
    console.log('Is GitHub Pages:', isGitHubPages());
    console.log('localStorage available:', testLocalStorage());
    console.log('Current cookie consent:', getCookieConsent());
    
    // If we're on GitHub Pages and localStorage works but no consent is set
    if (isGitHubPages() && testLocalStorage() && getCookieConsent() === null) {
      forceCookieBanner();
    }
  }
  
  // Run debug when DOM is ready
  onDOMReady(runDebug);
})();
