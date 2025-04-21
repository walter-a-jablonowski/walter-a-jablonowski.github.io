// Popover handling for info icons
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    const popover = document.createElement('div');
    popover.className = 'popover';
    popover.style.display = 'none';
    document.body.appendChild(popover);

    let currentIcon = null;

    function hidePopover() {
      popover.style.display = 'none';
      if(currentIcon) currentIcon.classList.remove('active');
      currentIcon = null;
    }

    document.querySelectorAll('.info-icon').forEach(function(icon) {
      icon.addEventListener('click', function(e) {
        e.stopPropagation();
        if(currentIcon === icon) {
          hidePopover();
          return;
        }
        // Set popover content
        popover.textContent = icon.getAttribute('data-popover') || '';
        // Position popover
        const rect = icon.getBoundingClientRect();
        const popoverWidth = 220;
        popover.style.width = popoverWidth + 'px';
        let top = rect.bottom + 8;
        let left = rect.left + (rect.width / 2) - (popoverWidth / 2);
        left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));
        if( top + 100 > window.innerHeight ) top = rect.top - 8 - 48;
        popover.style.top = top + 'px';
        popover.style.left = left + 'px';
        popover.style.display = 'block';
        if(currentIcon) currentIcon.classList.remove('active');
        currentIcon = icon;
        icon.classList.add('active');
      });
    });

    document.addEventListener('click', function() {
      hidePopover();
    });
    document.addEventListener('keydown', function(e) {
      if(e.key === 'Escape') hidePopover();
    });
    window.addEventListener('resize', function() {
      if(popover.style.display === 'block' && currentIcon) {
        currentIcon.click(); // reposition
      }
    });
  });
})();
