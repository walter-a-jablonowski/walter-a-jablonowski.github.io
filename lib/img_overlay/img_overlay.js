/**
 * Reusable image overlay (lightbox) with pinch-to-zoom and pan support.
 *
 * Auto-injects the overlay HTML, binds click handlers on matching elements,
 * and handles both <img> (copies src/alt) and inline <svg> (clones the node).
 *
 * Gestures:
 *   - Two-finger pinch to zoom (touch)
 *   - One-finger drag to pan (touch, when zoomed)
 *   - Double-tap to toggle zoom (touch)
 *   - Mouse wheel to zoom (desktop)
 *   - Click backdrop / X button / Escape to close
 *   - Flip button (auto-flips landscape content on mobile)
 *
 * Usage:
 *   ImageOverlay.init('.sample-image');   // specific selector
 *   ImageOverlay.init('[data-zoomable]'); // attribute-based
 *
 * Call after DOMContentLoaded (or place the <script> at the end of <body>).
 */
const ImageOverlay = (() =>
{
  const OVERLAY_ID = 'imgOverlay';
  const OVERLAY_IMG_ID = 'imgOverlayImage';
  const OVERLAY_CLOSE_ID = 'imgOverlayClose';
  const OVERLAY_FLIP_ID = 'imgOverlayFlip';

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;
  const DOUBLE_TAP_SCALE = 2.5;

  let overlay, overlayContent, overlayImg, closeBtn, flipBtn;
  let mediaEl = null;

  // Transform state
  let scale = 1, tx = 0, ty = 0, flipd = false;
  let fitScale = 1;

  // Touch state
  let dragging = false;
  let startTx, startTy, startX, startY;
  let pinchStartDist = 0, pinchStartScale = 1;
  let lastTapTime = 0;

  function injectHTML()
  {
    if (document.getElementById(OVERLAY_ID))
      return;

    const html = `
      <div class="img-overlay" id="${OVERLAY_ID}">
        <div class="img-overlay-content">
          <button class="img-overlay-flip" id="${OVERLAY_FLIP_ID}" aria-label="Flip">
            <i class="fas fa-rotate-right"></i>
          </button>
          <button class="img-overlay-close" id="${OVERLAY_CLOSE_ID}" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>
          <img src="" alt="" id="${OVERLAY_IMG_ID}">
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function applyTransform()
  {
    if (!mediaEl)
      return;
    const rot = flipd ? 'rotate(-90deg)' : '';
    const s = fitScale * scale;
    mediaEl.style.transform = `translate(${tx}px, ${ty}px) scale(${s}) ${rot}`;
  }

  function getAspectRatio(el)
  {
    if (el.tagName === 'IMG' && el.naturalWidth)
      return el.naturalWidth / el.naturalHeight;
    if (el.tagName === 'svg' || el instanceof SVGSVGElement) {
      const vb = el.viewBox;
      if (vb && vb.baseVal && vb.baseVal.width)
        return vb.baseVal.width / vb.baseVal.height;
    }
    return el.clientWidth / el.clientHeight || 1;
  }

  function updateMaxDimensions()
  {
    if (!mediaEl)
      return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ar = getAspectRatio(mediaEl);

    // Use explicit pixel dimensions and disable CSS max-width/max-height
    mediaEl.style.maxWidth = 'none';
    mediaEl.style.maxHeight = 'none';
    mediaEl.style.flexShrink = '0';

    if (flipd) {
      // Rotated -90deg: element width maps to screen height, height maps to screen width.
      // Size element to fill screen height, then check if rotated height fits screen width.
      let elW = isMobile ? vh : vh * 0.9;
      let elH = elW / ar;
      const maxH = isMobile ? vw : vw * 0.9;
      if (elH > maxH) {
        elH = maxH;
        elW = elH * ar;
      }
      mediaEl.style.width = elW + 'px';
      mediaEl.style.height = elH + 'px';
      fitScale = 1;
    }
    else {
      // Normal: fit within viewport, using full width on mobile
      let elW = isMobile ? vw : vw * 0.9;
      let elH = elW / ar;
      const maxH = isMobile ? vh : vh * 0.9;
      if (elH > maxH) {
        elH = maxH;
        elW = elH * ar;
      }
      mediaEl.style.width = elW + 'px';
      mediaEl.style.height = elH + 'px';
      fitScale = 1;
    }
  }

  function toggleFlip()
  {
    flipd = !flipd;
    tx = 0;
    ty = 0;
    if (mediaEl) {
      mediaEl.style.transition = 'transform 0.3s ease-out, max-width 0.3s ease-out, max-height 0.3s ease-out';
      updateMaxDimensions();
      applyTransform();
    }
  }

  function isLandscape(el)
  {
    if (el.tagName === 'IMG')
      return el.naturalWidth > el.naturalHeight;
    if (el.tagName === 'svg' || el instanceof SVGSVGElement) {
      const vb = el.viewBox;
      if (vb && vb.baseVal)
        return vb.baseVal.width > vb.baseVal.height;
      return el.clientWidth > el.clientHeight;
    }
    return false;
  }

  function resetTransform()
  {
    scale = 1;
    tx = 0;
    ty = 0;
    flipd = false;
    fitScale = 1;
    updateMaxDimensions();
    applyTransform();
  }

  function open(el)
  {
    if (el.tagName === 'IMG') {
      overlayImg.style.display = '';
      overlayImg.src = el.src;
      overlayImg.alt = el.alt;
      mediaEl = overlayImg;
    }
    else if (el.tagName === 'svg' || el instanceof SVGSVGElement) {
      overlayImg.style.display = 'none';
      const clone = el.cloneNode(true);
      const existing = overlayContent.querySelector('svg');
      if (existing)
        existing.remove();
      overlayContent.appendChild(clone);
      mediaEl = clone;
    }
    else {
      return;
    }

    mediaEl.style.transformOrigin = 'center center';
    mediaEl.style.transition = 'transform 0.2s ease-out';

    // Auto-flip only significantly wide content on mobile portrait screens
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isPortrait = window.innerHeight > window.innerWidth;
    const ar = getAspectRatio(el);
    if (isMobile && isPortrait && ar >= 1.8)
      flipd = true;
    else
      flipd = false;

    updateMaxDimensions();
    applyTransform();
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function close()
  {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    const svg = overlayContent.querySelector('svg');
    if (svg)
      svg.remove();
    mediaEl = null;
    scale = 1;
    tx = 0;
    ty = 0;
    flipd = false;
    fitScale = 1;
  }

  function getTouchDistance(touches)
  {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function onTouchStart(e)
  {
    if (!mediaEl)
      return;

    // Double-tap detection (single touch)
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapTime < 300) {
        scale = (scale > 1) ? MIN_SCALE : DOUBLE_TAP_SCALE;
        tx = 0;
        ty = 0;
        mediaEl.style.transition = 'transform 0.3s ease-out';
        applyTransform();
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;

      dragging = true;
      startTx = tx;
      startTy = ty;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      mediaEl.style.transition = 'none';
    }

    // Pinch start (two touches)
    if (e.touches.length === 2) {
      dragging = false;
      pinchStartDist = getTouchDistance(e.touches);
      pinchStartScale = scale;
      mediaEl.style.transition = 'none';
    }
  }

  function onTouchMove(e)
  {
    if (!mediaEl)
      return;

    // Pan (single touch, only when zoomed)
    if (e.touches.length === 1 && dragging && scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (flipd) {
        tx = startTx - dy;
        ty = startTy + dx;
      }
      else {
        tx = startTx + dx;
        ty = startTy + dy;
      }
      applyTransform();
    }

    // Pinch zoom (two touches)
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      if (pinchStartDist > 0) {
        scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartScale * dist / pinchStartDist));
        applyTransform();
      }
    }
  }

  function onTouchEnd(e)
  {
    if (e.touches.length === 0) {
      dragging = false;
    }
    else if (e.touches.length === 1) {
      // Switched from pinch to single touch — start drag from current position
      dragging = true;
      startTx = tx;
      startTy = ty;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  }

  function onWheel(e)
  {
    if (!mediaEl)
      return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * delta));
    if (scale <= 1) {
      tx = 0;
      ty = 0;
    }
    mediaEl.style.transition = 'none';
    applyTransform();
  }

  function init(selector)
  {
    injectHTML();

    overlay = document.getElementById(OVERLAY_ID);
    overlayContent = overlay.querySelector('.img-overlay-content');
    overlayImg = document.getElementById(OVERLAY_IMG_ID);
    closeBtn = document.getElementById(OVERLAY_CLOSE_ID);
    flipBtn = document.getElementById(OVERLAY_FLIP_ID);

    const targets = document.querySelectorAll(selector);
    targets.forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => open(el));
    });

    closeBtn.addEventListener('click', e => { e.stopPropagation(); close(); });
    flipBtn.addEventListener('click',  e => { e.stopPropagation(); toggleFlip(); });

    overlay.addEventListener('click', e => {
      if (e.target === overlay)
        close();
    });

    // Touch gestures on the overlay content
    overlayContent.addEventListener('touchstart', onTouchStart, { passive: false });
    overlayContent.addEventListener('touchmove', onTouchMove, { passive: false });
    overlayContent.addEventListener('touchend', onTouchEnd);
    overlayContent.addEventListener('touchcancel', onTouchEnd);

    // Mouse wheel zoom (desktop)
    overlayContent.addEventListener('wheel', onWheel, { passive: false });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('active'))
        close();
    });
  }

  return { init };
})();
