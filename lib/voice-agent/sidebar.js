/**
 * Voice Agent Sidebar — generic slide-in panel + Use Case Finder view.
 *
 * Architecture:
 *   Layer 1: VoiceAgentSidebar  — manages the panel (open/close, header, content)
 *   Layer 2: Use case finder    — rendered into the sidebar's content area
 *
 * Future: the voice agent can call sidebar.open() + sidebar.setContent() to
 * display other views (page summaries, navigation, etc.).
 *
 * (C) Walter A. Jablonowski 2025-2026, All rights reserved
 */

// ===== UI strings (de/en) =====

const UCF_STRINGS = {
  de: {
    subtitle: 'Beschreiben Sie Ihr Unternehmen in wenigen S&auml;tzen und erhalten Sie drei konkrete KI-Use Cases &mdash; mit Aufwandssch&auml;tzung und ROI-Signal &mdash; in unter 30 Sekunden.',
    label: 'Unternehmensbeschreibung',
    placeholder: 'z. B. Wir sind eine 12-k&ouml;pfige Steuerberatung in N&uuml;rnberg. Wir verbringen die meiste Zeit mit der Bearbeitung von Papierrechnungen, der Vorbereitung von Steuererkl&auml;rungen und der Beantwortung immer gleicher Kundenfragen per E-Mail.',
    helper: 'Seien Sie spezifisch: Branche, Teamgr&ouml;&szlig;e, Hauptzeitschlucker, gr&ouml;&szlig;te Schmerzpunkte.',
    submit: 'KI-Use Cases finden',
    resultsHeader: 'Empfohlene Use Cases',
    resultsSub: 'Nach erwartetem Business-Impact gereiht &mdash; h&ouml;chster zuerst.',
    loading: 'Use Cases werden analysiert ...',
    error: 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
    contact: 'Eines davon vertiefen?',
    contactLink: 'Kontaktieren Sie mich',
    effortLow: 'Geringer Aufwand',
    effortMedium: 'Mittlerer Aufwand',
    effortHigh: 'Hoher Aufwand'
  },
  en: {
    subtitle: 'Describe your business in a few sentences and get three concrete AI use cases &mdash; with effort estimates and ROI signals &mdash; in under 30 seconds.',
    label: 'Business description',
    placeholder: 'e.g. We run a 12-person accountancy practice in Nuremberg. We spend most of our time processing paper invoices, preparing tax returns, and answering the same client questions by email.',
    helper: 'Be specific: sector, team size, main time sinks, biggest pain points.',
    submit: 'Find my AI use cases',
    resultsHeader: 'Recommended use cases',
    resultsSub: 'Ranked by expected business impact &mdash; highest first.',
    loading: 'Analyzing use cases ...',
    error: 'An error occurred. Please try again.',
    contact: 'Want to explore one of these?',
    contactLink: 'Get in touch',
    effortLow: 'Low effort',
    effortMedium: 'Medium effort',
    effortHigh: 'High effort'
  }
};


// =========================================================================
// Layer 1: Generic sidebar panel manager
// =========================================================================

class VoiceAgentSidebar
{
  constructor()
  {
    this.isOpen = false;
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
        <h2 class="va-sidebar-title">Use Case Finder</h2>
        <button class="va-sidebar-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="va-sidebar-content"></div>
    `;
    document.body.appendChild( this.el );

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
  }

  open( title )
  {
    if( title )
      this.el.querySelector( '.va-sidebar-title' ).textContent = title;
    this.el.classList.add( 'open' );
    this.backdrop.classList.add( 'open' );
    this.isOpen = true;
  }

  close()
  {
    this.el.classList.remove( 'open' );
    this.backdrop.classList.remove( 'open' );
    this.isOpen = false;
  }

  setContent( html )
  {
    this.contentEl.innerHTML = html;
  }

  appendContent( html )
  {
    this.contentEl.insertAdjacentHTML( 'beforeend', html );
  }
}


// =========================================================================
// Layer 2: Use Case Finder view
// =========================================================================

class UseCaseFinder
{
  constructor( sidebar )
  {
    this.sidebar = sidebar;
    this.lang = document.documentElement.lang === 'en' ? 'en' : 'de';
    this.t = UCF_STRINGS[ this.lang ];
    this.proxyUrl = ( typeof VOICE_AGENT_CONFIG !== 'undefined' && VOICE_AGENT_CONFIG.proxyUrl )
      ? VOICE_AGENT_CONFIG.proxyUrl
      : '';
  }

  render()
  {
    this.sidebar.setContent( `
      <p class="ucf-subtitle">${this.t.subtitle}</p>
      <form class="ucf-form" id="ucf-form">
        <label for="ucf-description">${this.t.label}</label>
        <textarea id="ucf-description" name="description"
          placeholder="${this.t.placeholder}"
          aria-describedby="ucf-helper" required></textarea>
        <p class="ucf-helper" id="ucf-helper">${this.t.helper}</p>
        <button type="submit" class="ucf-submit" id="ucf-submit">${this.t.submit}</button>
      </form>
      <div class="ucf-results" id="ucf-results"></div>
    ` );

    const form = this.sidebar.contentEl.querySelector( '#ucf-form' );
    form.addEventListener( 'submit', ( e ) => this._onSubmit( e ) );
  }

  async _onSubmit( e )
{
    e.preventDefault();

    const textarea = this.sidebar.contentEl.querySelector( '#ucf-description' );
    const description = textarea.value.trim();

    if( !description )
      return;

    const submitBtn = this.sidebar.contentEl.querySelector( '#ucf-submit' );
    const resultsEl = this.sidebar.contentEl.querySelector( '#ucf-results' );

    submitBtn.disabled = true;
    resultsEl.innerHTML = `
      <div class="ucf-loading">
        <div class="ucf-spinner"></div>
        <span>${this.t.loading}</span>
      </div>
    `;

    try
    {
      const response = await fetch( this.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'find_use_cases',
          description: description,
          lang: this.lang,
          model: ( typeof VOICE_AGENT_CONFIG !== 'undefined' && VOICE_AGENT_CONFIG.textModel )
            ? VOICE_AGENT_CONFIG.textModel
            : 'gemini-3.1-flash-lite'
        })
      });

      if( ! response.ok )
      {
        let errDetail = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errDetail = errData.error || errDetail;
        } catch( e ) {}
        throw new Error( errDetail );
      }

      const data = await response.json();

      if( ! data.success )
        throw new Error( data.error || 'Unknown error' );

      this._renderResults( data.useCases );
    }
    catch( error )
    {
      console.error( 'Use Case Finder error:', error );
      resultsEl.innerHTML = `
        <div class="ucf-error">${this.t.error}<br><small>${error.message}</small></div>
      `;
    }
    finally
    {
      submitBtn.disabled = false;
    }
  }

  _renderResults( useCases )
  {
    const resultsEl = this.sidebar.contentEl.querySelector( '#ucf-results' );

    if( ! useCases || ! useCases.length )
    {
      resultsEl.innerHTML = `<div class="ucf-error">${this.t.error}</div>`;
      return;
    }

    const effortClass = { 'Low': 'low', 'Medium': 'medium', 'High': 'high' };
    const effortLabel = {
      'Low': this.t.effortLow,
      'Medium': this.t.effortMedium,
      'High': this.t.effortHigh
    };

    const cardsHtml = useCases.map( ( uc, i ) => {
      const effort = uc.effort || 'Medium';
      const cls = effortClass[ effort ] || 'medium';
      const label = effortLabel[ effort ] || effort;
      const title = this._escapeHtml( uc.title || '' );
      const desc = this._escapeHtml( uc.description || '' );
      const roi = this._escapeHtml( uc.roi || '' );

      return `
        <div class="ucf-card">
          <div class="ucf-card-head">
            <span class="ucf-card-num">${i + 1}</span>
            <div class="ucf-card-title">${title}</div>
            <div class="ucf-effort ucf-effort-${cls}">${label}</div>
          </div>
          <p class="ucf-card-desc">${desc}</p>
          <div class="ucf-card-roi">
            <span class="ucf-card-roi-label">ROI</span>
            <span class="ucf-card-roi-text">${roi}</span>
          </div>
        </div>
      `;
    }).join( '' );

    const contactHref = this.lang === 'en' ? '#contact' : '#contact';

    resultsEl.innerHTML = `
      <hr class="ucf-divider">
      <h3 class="ucf-results-header">${this.t.resultsHeader}</h3>
      <p class="ucf-results-sub">${this.t.resultsSub}</p>
      ${cardsHtml}
      <p class="ucf-contact">${this.t.contact}
        <a href="${contactHref}">${this.t.contactLink}</a>
      </p>
    `;
  }

  _escapeHtml( str )
  {
    const div = document.createElement( 'div' );
    div.textContent = str;
    return div.innerHTML;
  }
}


// =========================================================================
// Init — wire up the hero button on each index page
// =========================================================================

(function()
{
  function init()
  {
    const trigger = document.getElementById( 'use-case-finder-trigger' );
    if( ! trigger )
      return;

    const sidebar = new VoiceAgentSidebar();
    const finder = new UseCaseFinder( sidebar );

    trigger.addEventListener( 'click', ( e ) => {
      e.preventDefault();
      finder.render();
      sidebar.open( 'Use Case Finder' );
    });
  }

  if( document.readyState === 'loading' )
    document.addEventListener( 'DOMContentLoaded', init );
  else
    init();
})();
