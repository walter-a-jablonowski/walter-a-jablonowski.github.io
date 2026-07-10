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
    effortHigh: 'Hoher Aufwand',
    reset: 'Zur&uuml;cksetzen',
    printTitle: 'Drucken oder als PDF speichern',
    downloadTitle: 'Als Textdatei herunterladen',
    docTitle: 'KI-Use Cases',
    docDescriptionLabel: 'Unternehmensbeschreibung',
    docEffortLabel: 'Aufwand',
    docRoiLabel: 'ROI'
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
    effortHigh: 'High effort',
    reset: 'Reset',
    printTitle: 'Print or save as PDF',
    downloadTitle: 'Download as text file',
    docTitle: 'AI Use Cases',
    docDescriptionLabel: 'Business description',
    docEffortLabel: 'Effort',
    docRoiLabel: 'ROI'
  }
};


const UCF_STORAGE_KEY = 'ucf-state';


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

    // Close sidebar when the user hovers the header/nav so dropdown menus remain usable
    const header = document.querySelector( 'header' );
    if( header )
    {
      header.addEventListener( 'mouseenter', () => {
        if( this.isOpen )
          this.close();
      });
    }
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
        <div class="ucf-actions">
          <button type="submit" class="ucf-submit" id="ucf-submit">${this.t.submit}</button>
          <button type="button" class="ucf-reset" id="ucf-reset">${this.t.reset}</button>
          <button type="button" class="ucf-icon-btn" id="ucf-print" title="${this.t.printTitle}" disabled><i class="fas fa-print"></i></button>
          <button type="button" class="ucf-icon-btn" id="ucf-download" title="${this.t.downloadTitle}" disabled><i class="fas fa-download"></i></button>
        </div>
      </form>
      <div class="ucf-results" id="ucf-results"></div>
    ` );

    const form = this.sidebar.contentEl.querySelector( '#ucf-form' );
    form.addEventListener( 'submit', ( e ) => this._onSubmit( e ) );

    const resetBtn = this.sidebar.contentEl.querySelector( '#ucf-reset' );
    resetBtn.addEventListener( 'click', () => this._reset() );

    const printBtn = this.sidebar.contentEl.querySelector( '#ucf-print' );
    printBtn.addEventListener( 'click', () => this._print() );

    const downloadBtn = this.sidebar.contentEl.querySelector( '#ucf-download' );
    downloadBtn.addEventListener( 'click', () => this._download() );

    this._restoreState();
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

    const textarea = this.sidebar.contentEl.querySelector( '#ucf-description' );
    const description = textarea ? textarea.value.trim() : '';
    this._lastDescription = description;
    this._lastUseCases = useCases;
    this._saveState( description, useCases );

    const printBtn = this.sidebar.contentEl.querySelector( '#ucf-print' );
    const downloadBtn = this.sidebar.contentEl.querySelector( '#ucf-download' );
    if( printBtn ) printBtn.disabled = false;
    if( downloadBtn ) downloadBtn.disabled = false;
  }

  _escapeHtml( str )
  {
    const div = document.createElement( 'div' );
    div.textContent = str;
    return div.innerHTML;
  }

  _saveState( description, useCases )
  {
    try
    {
      sessionStorage.setItem( UCF_STORAGE_KEY, JSON.stringify({
        description: description,
        useCases: useCases,
        lang: this.lang
      }) );
    }
    catch( e ) {}
  }

  _loadState()
  {
    try
    {
      const raw = sessionStorage.getItem( UCF_STORAGE_KEY );
      if( ! raw )
        return null;
      const state = JSON.parse( raw );
      if( state.lang !== this.lang )
        return null;
      return state;
    }
    catch( e )
    {
      return null;
    }
  }

  _clearState()
  {
    try
    {
      sessionStorage.removeItem( UCF_STORAGE_KEY );
    }
    catch( e ) {}
  }

  hasSavedState()
  {
    return this._loadState() !== null;
  }

  _restoreState()
  {
    const state = this._loadState();
    if( ! state )
      return false;

    const textarea = this.sidebar.contentEl.querySelector( '#ucf-description' );
    if( textarea )
      textarea.value = state.description;

    this._renderResults( state.useCases );
    return true;
  }

  _reset()
  {
    this._lastDescription = '';
    this._lastUseCases = null;
    this._clearState();
    this.render();
  }

  _buildDocHtml()
  {
    const effortLabel = {
      'Low': this.t.effortLow,
      'Medium': this.t.effortMedium,
      'High': this.t.effortHigh
    };

    const cardsHtml = ( this._lastUseCases || [] ).map( ( uc, i ) => {
      const effort = effortLabel[ uc.effort ] || uc.effort || 'Medium';
      return `
        <div class="uc">
          <h3>${i + 1}. ${this._escapeHtml( uc.title || '' )} <span class="effort">${this._escapeHtml( effort )}</span></h3>
          <p>${this._escapeHtml( uc.description || '' )}</p>
          <p class="roi"><strong>${this.t.docRoiLabel}:</strong> ${this._escapeHtml( uc.roi || '' )}</p>
        </div>
      `;
    }).join( '' );

    return `<!DOCTYPE html>
<html lang="${this.lang}">
<head>
<meta charset="utf-8">
<title>${this.t.docTitle}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 2rem auto; color: #222; line-height: 1.6; }
  h1 { font-size: 1.4rem; border-bottom: 2px solid #ff6b00; padding-bottom: .5rem; }
  .desc { background: #f5f5f5; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem; white-space: pre-wrap; }
  .uc { margin-bottom: 1.5rem; page-break-inside: avoid; }
  .uc h3 { font-size: 1.05rem; margin: 0 0 .4rem; }
  .effort { font-size: .8rem; font-weight: 600; color: #666; border: 1px solid #ccc; border-radius: 3px; padding: 1px 6px; margin-left: .5rem; }
  .roi { font-size: .9rem; color: #555; margin: .3rem 0 0; }
  .label { font-weight: 600; color: #ff6b00; }
</style>
</head>
<body>
  <h1>${this.t.docTitle}</h1>
  <p><span class="label">${this.t.docDescriptionLabel}:</span></p>
  <div class="desc">${this._escapeHtml( this._lastDescription || '' )}</div>
  <p><span class="label">${this.t.resultsHeader}</span></p>
  ${cardsHtml}
</body>
</html>`;
  }

  _print()
  {
    if( ! this._lastUseCases )
      return;

    const iframe = document.createElement( 'iframe' );
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild( iframe );

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write( this._buildDocHtml() );
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout( () => document.body.removeChild( iframe ), 1000 );
    };
  }

  _download()
  {
    if( ! this._lastUseCases )
      return;

    const effortLabel = {
      'Low': this.t.effortLow,
      'Medium': this.t.effortMedium,
      'High': this.t.effortHigh
    };

    const lines = [];
    lines.push( this.t.docTitle );
    lines.push( '='.repeat( this.t.docTitle.length ) );
    lines.push( '' );
    lines.push( this.t.docDescriptionLabel + ':' );
    lines.push( this._lastDescription || '' );
    lines.push( '' );
    lines.push( this.t.resultsHeader );
    lines.push( '-'.repeat( this.t.resultsHeader.length ) );
    lines.push( '' );

    this._lastUseCases.forEach( ( uc, i ) => {
      const effort = effortLabel[ uc.effort ] || uc.effort || 'Medium';
      lines.push( `${i + 1}. ${uc.title || ''}  [${this.t.docEffortLabel}: ${effort}]` );
      lines.push( `   ${uc.description || ''}` );
      lines.push( `   ${this.t.docRoiLabel}: ${uc.roi || ''}` );
      lines.push( '' );
    } );

    const blob = new Blob( [ lines.join( '\n' ) ], { type: 'text/plain;charset=utf-8' } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = 'use-cases.txt';
    document.body.appendChild( a );
    a.click();
    document.body.removeChild( a );
    URL.revokeObjectURL( url );
  }
}


// =========================================================================
// Init — wire up the hero button on each index page
// =========================================================================

(function()
{
  function init()
  {
    const sidebar = new VoiceAgentSidebar();
    const finder = new UseCaseFinder( sidebar );

    const trigger = document.getElementById( 'use-case-finder-trigger' );
    if( trigger )
    {
      trigger.addEventListener( 'click', ( e ) => {
        e.preventDefault();
        if( ! sidebar.isOpen )
        {
          finder.render();
          sidebar.open( 'Use Case Finder' );
        }
      });
    }
  }

  if( document.readyState === 'loading' )
    document.addEventListener( 'DOMContentLoaded', init );
  else
    init();
})();
