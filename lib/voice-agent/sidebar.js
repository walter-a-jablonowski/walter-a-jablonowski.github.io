/**
 * Sidebar — generic slide-in panel that hosts one or more "views".
 *
 * A view is any object implementing the small view contract:
 *   - id            : stable string id (used for tabs and showView)
 *   - getTitle()    : localized label for the tab / header
 *   - render( root ): render the view's UI into the given container element
 *                     (called once, lazily, the first time the view is shown)
 *
 * The panel shows one view at a time. With a single registered view it looks
 * like a plain titled panel; with several it grows a tab strip in the header so
 * the visitor (or, later, the voice agent) can switch between them.
 *
 * Interaction: a single shared instance is exposed via Sidebar.instance(), so
 * other modules (e.g. the voice agent in agent.js) can open the panel, switch
 * views and reach a view instance to read state or trigger actions:
 *
 *   const bar = Sidebar.instance();
 *   bar.open( 'use-case-finder' );
 *   const finder = bar.getView( 'use-case-finder' );
 *
 * Views live in their own files (e.g. use-case-finder.js) and register
 * themselves on load via Sidebar.instance().registerView( view ).
 *
 * (C) Walter A. Jablonowski 2025-2026, All rights reserved
 */

class Sidebar
{
  // Shared singleton — one panel per page, reachable from any module
  static instance()
  {
    if( ! Sidebar._instance )
      Sidebar._instance = new Sidebar();
    return Sidebar._instance;
  }

  constructor()
  {
    this.isOpen = false;

    // Registered views (insertion order = tab order) and their lazily created
    // content containers (keyed by view id)
    this.views = [];
    this._containers = {};
    this.activeId = null;

    this._buildDom();
    this._bindEvents();
  }

  _buildDom()
  {
    // Backdrop
    this.backdrop = document.createElement( 'div' );
    this.backdrop.className = 'va-sidebar-backdrop';
    document.body.appendChild( this.backdrop );

    // Sidebar
    this.el = document.createElement( 'aside' );
    this.el.className = 'va-sidebar';
    this.el.setAttribute( 'role', 'complementary' );
    this.el.innerHTML = `
      <div class="va-sidebar-header">
        <h2 class="va-sidebar-title"></h2>
        <div class="va-sidebar-tabs" role="tablist"></div>
        <button class="va-sidebar-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="va-sidebar-content"></div>
    `;
    document.body.appendChild( this.el );

    this.headerEl = this.el.querySelector( '.va-sidebar-header' );
    this.titleEl = this.el.querySelector( '.va-sidebar-title' );
    this.tabsEl = this.el.querySelector( '.va-sidebar-tabs' );
    this.closeBtn = this.el.querySelector( '.va-sidebar-close' );
    this.contentEl = this.el.querySelector( '.va-sidebar-content' );
  }

  _bindEvents()
  {
    this.closeBtn.addEventListener( 'click', () => this.close() );
    this.backdrop.addEventListener( 'click', () => this.close() );

    document.addEventListener( 'keydown', ( e ) => {
      if( e.key === 'Escape' && this.isOpen )
        this.close();
    });

    // Close the sidebar when the user hovers the page header/nav so dropdown
    // menus remain usable
    const header = document.querySelector( 'header' );
    if( header )
    {
      header.addEventListener( 'mouseenter', () => {
        if( this.isOpen )
          this.close();
      });
    }
  }

  // =======================================================================
  // View registry
  // =======================================================================

  /**
   * Register a view (see the view contract in the file header). Views appear
   * as tabs in registration order; the first registered is the default.
   */
  registerView( view )
  {
    this.views.push( view );
    if( ! this.activeId )
      this.activeId = view.id;
    this._renderTabs();
  }

  getView( id )
  {
    return this.views.find( v => v.id === id ) || null;
  }

  /**
   * Show a view by id: render it once (lazily) into its own container, hide
   * the other views, and mark its tab active. Each view keeps its own DOM, so
   * switching tabs preserves state.
   */
  showView( id )
  {
    const view = this.getView( id );
    if( ! view )
      return;

    // Build + render the view's container the first time it is shown
    let container = this._containers[ id ];
    if( ! container )
    {
      container = document.createElement( 'div' );
      container.className = 'va-view';
      container.dataset.viewId = id;
      this.contentEl.appendChild( container );
      this._containers[ id ] = container;
      view.render( container );
    }

    Object.keys( this._containers ).forEach( key => {
      this._containers[ key ].classList.toggle( 'va-hidden', key !== id );
    });

    this.activeId = id;
    this.titleEl.textContent = view.getTitle();
    this._renderTabs();
  }

  _renderTabs()
  {
    // Tabs only make sense with more than one view; a single view shows just
    // the plain header title
    const multi = this.views.length > 1;
    this.headerEl.classList.toggle( 'has-tabs', multi );

    if( ! multi )
    {
      this.tabsEl.innerHTML = '';
      return;
    }

    this.tabsEl.innerHTML = this.views.map( v => {
      const active = v.id === this.activeId;
      return `<button class="va-sidebar-tab${active ? ' active' : ''}" type="button"
                role="tab" aria-selected="${active}" data-view-id="${v.id}">${v.getTitle()}</button>`;
    }).join( '' );

    this.tabsEl.querySelectorAll( '.va-sidebar-tab' ).forEach( btn => {
      btn.addEventListener( 'click', () => this.showView( btn.dataset.viewId ) );
    });
  }

  // =======================================================================
  // Open / close
  // =======================================================================

  open( id )
  {
    const target = id || this.activeId;
    if( target )
      this.showView( target );

    this.el.classList.add( 'open' );
    this.backdrop.classList.add( 'open' );
    document.body.style.overflow = 'hidden';
    this.isOpen = true;
  }

  close()
  {
    this.el.classList.remove( 'open' );
    this.backdrop.classList.remove( 'open' );
    document.body.style.overflow = '';
    this.isOpen = false;
  }
}
