/**
 * Overview Application Controller
 * Modern class-based implementation for handling UI events
 */
class OverviewController 
{
  constructor() 
  {
    // Store references to DOM elements
    this.toolModal = document.getElementById('toolModal');
    this.colorOptions = document.querySelectorAll('.color-option');
    
    // Initialize state
    this.clickedBadge = null;
    
    // Bind methods to maintain 'this' context
    this.initTooltips = this.initTooltips.bind(this);
    this.handleModalShow = this.handleModalShow.bind(this);
    this.handleColorSelection = this.handleColorSelection.bind(this);
    this.loadBadgeColors = this.loadBadgeColors.bind(this);
    this.saveBadgeColor = this.saveBadgeColor.bind(this);
    
    // Initialize the application when DOM is loaded
    this.init();
  }
  
  /**
   * Initialize the application
   */
  init() 
  {
    this.initTooltips();
    this.setupEventListeners();
    this.loadBadgeColors();
  }
  
  /**
   * Initialize Bootstrap tooltips
   */
  initTooltips() 
  {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    this.tooltipList = tooltipTriggerList.map(tooltipTriggerEl => {
      return new bootstrap.Tooltip(tooltipTriggerEl, {
        placement: 'top',
        boundary: document.body
      });
    });
  }
  
  /**
   * Set up all event listeners
   */
  setupEventListeners() 
  {
    // Set up modal show event
    if( this.toolModal ) {
      this.toolModal.addEventListener('show.bs.modal', this.handleModalShow);
      
      // Set up color option click events
      this.colorOptions.forEach(option => {
        option.addEventListener('click', this.handleColorSelection);
      });
    }
  }
  
  /**
   * Handle modal show event
   * @param {Event} event - The modal show event
   */
  handleModalShow(event) 
  {
    const button = event.relatedTarget;
    
    // Extract info from data attributes
    const toolName = button.getAttribute('data-tool-name');
    const toolId = button.getAttribute('data-tool-id');
    const toolUrl = button.getAttribute('data-tool-url');
    
    // Store reference to the clicked badge
    this.clickedBadge = button;
    
    // Get current badge color and mark the corresponding color option as active
    this.updateActiveColorOption(button);
    
    // Update modal content
    this.updateModalContent(toolName, toolId, toolUrl);
  }
  
  /**
   * Update the active color option based on badge color
   * @param {HTMLElement} badge - The badge element
   */
  updateActiveColorOption(badge) 
  {
    const currentColor = window.getComputedStyle(badge).backgroundColor;
    
    // Remove active class from all options
    this.colorOptions.forEach(option => {
      option.classList.remove('active');
    });
    
    // Try to find and mark the active color option
    this.colorOptions.forEach(option => {
      const optionColor = option.getAttribute('data-color');
      const tempDiv = document.createElement('div');
      tempDiv.style.backgroundColor = optionColor;
      document.body.appendChild(tempDiv);
      const computedColor = window.getComputedStyle(tempDiv).backgroundColor;
      document.body.removeChild(tempDiv);
      
      if( computedColor === currentColor )
        option.classList.add('active');
    });
  }
  
  /**
   * Update modal content with tool information
   * @param {string} toolName - The name of the tool
   * @param {string} toolId - The ID of the tool
   * @param {string} toolUrl - The URL of the tool
   */
  updateModalContent(toolName, toolId, toolUrl) 
  {
    const modalTitle = this.toolModal.querySelector('.modal-title');
    const modalDescription = this.toolModal.querySelector('#toolDescription');
    const toolLink = this.toolModal.querySelector('#toolLink');
    const toolUpdated = this.toolModal.querySelector('#toolUpdated');
    
    if( modalTitle )
      modalTitle.textContent = toolName;
    
    if( modalDescription && window.toolDescriptions && window.toolDescriptions[toolId] )
      modalDescription.innerHTML = window.toolDescriptions[toolId];
    else if( modalDescription )
      modalDescription.innerHTML = '';
    
    if( toolLink )
      if( toolUrl && toolUrl.trim() !== '' ) {
        toolLink.href = toolUrl;
        toolLink.style.display = '';
      } else {
        toolLink.href = '#';
        toolLink.style.display = 'none';
      }
    
    // Update the updated date if available
    if( toolUpdated )
      // Get the updated date from the window.toolUpdated object
      if( window.toolUpdated && window.toolUpdated[toolId] )
        toolUpdated.textContent = `Updated: ${window.toolUpdated[toolId]}`;
      else
        toolUpdated.textContent = '';
  }
  
  /**
   * Handle color selection event
   * @param {Event} event - The click event
   */
  handleColorSelection(event) 
  {
    // Remove active class from all options
    this.colorOptions.forEach(opt => opt.classList.remove('active'));
    
    // Add active class to clicked option
    event.currentTarget.classList.add('active');
    
    // Get the selected color
    const selectedColor = event.currentTarget.getAttribute('data-color');
    
    // Update the badge color
    if( this.clickedBadge ) {
      // Store original background if not already stored
      if( !this.clickedBadge.getAttribute('data-original-bg') ) {
        this.clickedBadge.setAttribute('data-original-bg', 
          window.getComputedStyle(this.clickedBadge).background);
      }
      
      // Apply new background color or restore default
      if( selectedColor === 'default')
        this.clickedBadge.style.background = '';
      else
        this.clickedBadge.style.background = selectedColor;
      
      // Save the color preference using AJAX
      const toolId = this.clickedBadge.getAttribute('data-tool-id');
      if( toolId ) {
        this.saveBadgeColor(toolId, selectedColor);
      }
    }
  }
  
  /**
   * Save badge color preference to server
   * @param {string} toolId - The ID of the tool
   * @param {string} selectedColor - The selected color
   */
  saveBadgeColor(toolId, selectedColor) 
  {
    fetch('ajax.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'saveBadgeColor',
        toolId: toolId,
        color: selectedColor === 'default' ? null : selectedColor
      })
    })
    .then(response => response.json())
    .then(data => {
      if( !data.success )
        console.error('Failed to save badge color:', data.error);
    })
    .catch(error => {
      console.error('Error saving badge color:', error);
    });
  }
  
  /**
   * Load badge colors from server
   */
  loadBadgeColors() 
  {
    fetch('ajax.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getBadgeColors'
      })
    })
    .then(response => response.json())
    .then(data => {
      if( data.success && data.colors ) {
        // Apply colors to badges
        this.applyBadgeColors(data.colors);
      }
    })
    .catch(error => {
      console.error('Error loading badge colors:', error);
    });
  }
  
  /**
   * Apply colors to badges
   * @param {Object} colors - Object mapping tool IDs to colors
   */
  applyBadgeColors(colors) 
  {
    Object.keys(colors).forEach(toolId => {
      const badge = document.querySelector(`[data-tool-id="${toolId}"]`);
      if( badge ) {
        badge.style.background = colors[toolId];
      }
    });
  }
}
