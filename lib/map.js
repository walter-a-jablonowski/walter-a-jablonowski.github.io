/**
 * Walter A. Jablonowski - Personal Website
 * Map implementation using Leaflet
 */

class MapController
{
  constructor()
  {
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', () => {
      this.mapElement = document.getElementById('map');
      this.stegaurachCoords = [49.858181, 10.855379]; // Am Anger 9, Stegaurach coordinates
      this.map = null;
      
      if (this.mapElement) {
        this.loadMapResources();
      }
    });
  }
  
  /**
   * Resolve the path to the local /lib folder from this script's own src,
   * so Leaflet loads correctly regardless of the page's directory depth
   * (and also under file://). Falls back to a relative 'lib/'.
   */
  libBase()
  {
    const s = document.querySelector('script[src*="lib/map.js"]');
    if (s && s.src) {
      return s.src.replace(/map\.js(\?.*)?$/, '');  // -> .../lib/
    }
    return 'lib/';
  }

  /**
   * Load Leaflet resources (self-hosted) and initialize map
   */
  loadMapResources()
  {
    const base = this.libBase();

    // Create link element for Leaflet CSS if missing
    if (!document.querySelector('link[href*="leaflet"]')) {
      const leafletCss = document.createElement('link');
      leafletCss.rel = 'stylesheet';
      leafletCss.href = base + 'leaflet/leaflet.css?v=26071601';
      document.head.appendChild(leafletCss);
    }

    // Create script element for Leaflet JS if no load
    if (typeof L === 'undefined') {
      const leafletScript = document.createElement('script');
      leafletScript.src = base + 'leaflet/leaflet.js?v=26071601';
      leafletScript.onload = () => this.initMap();
      document.head.appendChild(leafletScript);
    } else {
      // Leaflet already loaded, initialize map
      this.initMap();
    }
  }
  
  /**
   * Initialize the map
   */
  initMap()
  {
    if (!this.mapElement) return;
    
    // Create map
    this.map = L.map('map', {
      zoomControl: false, // Hide zoom controls for cleaner look
      attributionControl: false // Hide attribution for cleaner look
    }).setView(this.stegaurachCoords, 13);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);
    
    // Add marker for Stegaurach
    L.marker(this.stegaurachCoords).addTo(this.map)
      .bindPopup('<strong>Walter A. Jablonowski</strong><br>Stegaurach, Germany')
      .openPopup();
      
    // Add minimal zoom controls to bottom right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(this.map);
    
    // Add attribution to bottom right
    L.control.attribution({
      position: 'bottomright'
    }).addTo(this.map);
  }
}
