/**
 * Use Case Finder — a Sidebar view.
 *
 * Implements the sidebar view contract (id / getTitle() / render(root)) and is
 * hosted by the generic panel in sidebar.js. Lets a visitor describe their
 * business and get ranked AI use cases (worker action `find_use_cases`), then
 * select some and carry them into the contact form.
 *
 * Renders entirely into its own container (`this.root`), so it stays isolated
 * from the panel chrome and from any other sidebar view.
 *
 * (C) Walter A. Jablonowski 2025-2026, All rights reserved
 */

// ===== UI strings (de/en) =====

const UCF_STRINGS = {
  de: {
    subtitle: 'Beschreiben Sie Ihr Unternehmen oder Problem in wenigen S&auml;tzen und erhalten Sie {count} konkrete KI-Use Cases &mdash; mit Aufwandssch&auml;tzung und ROI-Signal &mdash; in unter 30 Sekunden.',
    label: 'Unternehmens- oder Problembeschreibung',
    placeholder: 'z. B. Wir sind eine Eventagentur mit 8 Projektmanagern. Aktuell verlieren wir enorm viel Zeit durch manuelle Prozesse: Wir digitalisieren und pr&uuml;fen Rechnungen von Event-Dienstleistern, Locations und Caterern h&auml;ndisch. Zudem beantworten wir per E-Mail st&auml;ndig die gleichen Kundenfragen.',

    // Topic-specific placeholders (chosen via the trigger's data-ucf-topic);
    // fall back to the generic one above (index page)
    placeholders: {
      automation: 'z. B. Wir sind ein Gro&szlig;handel mit 12 Mitarbeitern im Innendienst. Viel Zeit geht f&uuml;r wiederkehrende manuelle Abl&auml;ufe drauf: Wir &uuml;bertragen Bestellungen aus E-Mails und PDFs von Hand ins ERP, pflegen Lieferantenpreise manuell und beantworten st&auml;ndig die gleichen Statusanfragen zu Auftr&auml;gen.',
      integration: 'z. B. Wir sind ein mittelst&auml;ndischer Dienstleister mit mehreren Systemen (CRM, ERP, Shop, Buchhaltung), die nicht miteinander reden. Daten pflegen wir doppelt, exportieren CSVs hin und her und &uuml;bertragen Auftrags- und Kundendaten manuell zwischen den Tools.'
    },
    helper: 'Seien Sie spezifisch: Branche, Teamgr&ouml;&szlig;e, gr&ouml;&szlig;te Zeitschlucker, gr&ouml;&szlig;te Probleme.',
    submit: 'KI-Use Cases finden',
    resultsHeader: 'Empfohlene Use Cases',
    resultsSub: 'Nach erwartetem Business-Nutzen gereiht &mdash; h&ouml;chster zuerst.',
    loading: 'Use Cases werden analysiert ...',
    loadingMore: 'Weitere Use Cases werden gesucht ...',
    showMore: 'Weitere Use Cases',
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
    docDescriptionLabel: 'Unternehmens- oder Problembeschreibung',
    docEffortLabel: 'Aufwand',
    docRoiLabel: 'ROI',
    selectAll: 'Alle ausw&auml;hlen',
    selectNone: 'Keine ausw&auml;hlen',
    inquire: 'Anfragen',
    inquirySubject: 'KI-Use-Case-Anfrage',
    inquiryDescLabel: 'Unternehmens- oder Problembeschreibung',
    inquirySelectedLabel: 'Gew&auml;hlte Use Cases',
    inquiryEffortLabel: 'Aufwand'
  },
  en: {
    subtitle: 'Describe your business or problem in a few sentences and get {count} concrete AI use cases &mdash; with effort estimates and ROI signals &mdash; in under 30 seconds.',
    label: 'Business or problem description',
    placeholder: 'e.g. We are an event agency with 8 project managers. Currently we lose a huge amount of time to manual processes: we digitize and check invoices from event vendors, venues and caterers by hand. We also constantly answer the same client questions by email.',

    // Topic-specific placeholders (chosen via the trigger's data-ucf-topic);
    // fall back to the generic one above (index page)
    placeholders: {
      automation: 'e.g. We are a wholesaler with 12 back-office staff. A lot of time goes into repetitive manual steps: we retype orders from emails and PDFs into our ERP by hand, maintain supplier prices manually, and constantly answer the same order-status questions.',
      integration: 'e.g. We are a mid-sized service company running several systems (CRM, ERP, shop, accounting) that don\'t talk to each other. We maintain data twice, shuffle CSV exports back and forth, and copy order and customer data between tools by hand.'
    },
    helper: 'Be specific: sector, team size, main time sinks, biggest pain points.',
    submit: 'Find my AI use cases',
    resultsHeader: 'Recommended use cases',
    resultsSub: 'Ranked by expected business value &mdash; highest first.',
    loading: 'Analyzing use cases ...',
    loadingMore: 'Looking for more use cases ...',
    showMore: 'Show more use cases',
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
    docDescriptionLabel: 'Business or problem description',
    docEffortLabel: 'Effort',
    docRoiLabel: 'ROI',
    selectAll: 'Select all',
    selectNone: 'Select none',
    inquire: 'Inquire',
    inquirySubject: 'AI Use Case Inquiry',
    inquiryDescLabel: 'Business or problem description',
    inquirySelectedLabel: 'Selected use cases',
    inquiryEffortLabel: 'Effort'
  }
};


const UCF_STORAGE_KEY = 'ucf-state';
const UCF_INQUIRY_KEY = 'ucf-inquiry';


// Numeric setting from USE_CASE_FINDER_CONFIG (config.js may be absent)
function ucfSetting( key, fallback )
{
  return ( typeof USE_CASE_FINDER_CONFIG !== 'undefined' && typeof USE_CASE_FINDER_CONFIG[ key ] === 'number' )
    ? USE_CASE_FINDER_CONFIG[ key ]
    : fallback;
}


class UseCaseFinder
{
  constructor( sidebar )
  {
    this.id = 'use-case-finder';

    // Host panel (for close()) and the container this view renders into
    this.sidebar = sidebar;
    this.root = null;

    // Page topic (e.g. 'automation' | 'integration'), set from the trigger's
    // data-ucf-topic. Only primes the placeholder; the description stays primary
    this.topic = null;

    this.lang = document.documentElement.lang === 'en' ? 'en' : 'de';
    this.t = UCF_STRINGS[ this.lang ];
    this.proxyUrl = ( typeof VOICE_AGENT_CONFIG !== 'undefined' && VOICE_AGENT_CONFIG.proxyUrl )
      ? VOICE_AGENT_CONFIG.proxyUrl
      : '';
    this.countPerLoad = ucfSetting( 'countPerLoad', 3 );
    this.maxShowMore = ucfSetting( 'maxShowMore', 1 );

    this._lastDescription = '';
    this._lastUseCases = null;
    this._selectedIndices = new Set();

    // How often "Show more" was used for the current result set
    this._moreCount = 0;
  }

  getTitle()
  {
    return 'Use Case Finder';
  }

  // Topic-specific example (service pages) or the generic one (index)
  getPlaceholder()
  {
    return ( this.topic && this.t.placeholders && this.t.placeholders[ this.topic ] )
      ? this.t.placeholders[ this.topic ]
      : this.t.placeholder;
  }

  render( root )
  {
    this.root = root;

    this.root.innerHTML = `
      <p class="ucf-subtitle">${this.t.subtitle.replace( '{count}', this.countPerLoad )}</p>
      <form class="ucf-form" id="ucf-form">
        <label for="ucf-description">${this.t.label}</label>
        <textarea id="ucf-description" name="description"
          placeholder="${this.getPlaceholder()}"
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
    `;

    const form = this.root.querySelector( '#ucf-form' );
    form.addEventListener( 'submit', ( e ) => this._onSubmit( e ) );

    const resetBtn = this.root.querySelector( '#ucf-reset' );
    resetBtn.addEventListener( 'click', () => this._reset() );

    const printBtn = this.root.querySelector( '#ucf-print' );
    printBtn.addEventListener( 'click', () => this._print() );

    const downloadBtn = this.root.querySelector( '#ucf-download' );
    downloadBtn.addEventListener( 'click', () => this._download() );

    this._restoreState();
  }

  /**
   * Ask the worker for use cases. "exclude" holds titles already shown, so a
   * "Show more" round returns different ones instead of repeating itself.
   */
  async _fetchUseCases( description, exclude )
  {
    const response = await fetch( this.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'find_use_cases',
        description: description,
        exclude: exclude || [],
        count: this.countPerLoad,
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

    return data.useCases;
  }

  async _onSubmit( e )
  {
    e.preventDefault();

    const textarea = this.root.querySelector( '#ucf-description' );
    const description = textarea.value.trim();

    if( !description )
      return;

    const submitBtn = this.root.querySelector( '#ucf-submit' );
    const resultsEl = this.root.querySelector( '#ucf-results' );

    submitBtn.disabled = true;
    resultsEl.innerHTML = `
      <div class="ucf-loading">
        <div class="ucf-spinner"></div>
        <span>${this.t.loading}</span>
      </div>
    `;

    try
    {
      const useCases = await this._fetchUseCases( description, [] );

      this._moreCount = 0;
      this._selectedIndices = new Set();
      this._renderResults( useCases );
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

  async _showMore()
  {
    if( ! this._lastUseCases || this._moreCount >= this.maxShowMore )
      return;

    const btn = this.root.querySelector( '#ucf-more' );
    if( ! btn )
      return;

    const oldError = this.root.querySelector( '.ucf-more-error' );
    if( oldError )
      oldError.remove();

    btn.disabled = true;
    btn.innerHTML = `<span class="ucf-spinner-sm"></span>${this.t.loadingMore}`;

    try
    {
      const exclude = this._lastUseCases.map( uc => uc.title || '' );
      const useCases = await this._fetchUseCases( this._lastDescription, exclude );

      if( ! useCases || ! useCases.length )
        throw new Error( 'Empty result' );

      // Appended cases keep the indices of the existing ones, so the selection stays valid
      this._moreCount++;
      this._renderResults( this._lastUseCases.concat( useCases ) );
    }
    catch( error )
    {
      console.error( 'Use Case Finder error:', error );
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-plus"></i>${this.t.showMore}`;

      btn.parentElement.insertAdjacentHTML( 'afterend',
        `<div class="ucf-error ucf-more-error">${this.t.error}<br><small>${this._escapeHtml( error.message )}</small></div>` );
    }
  }

  _renderResults( useCases )
  {
    const resultsEl = this.root.querySelector( '#ucf-results' );

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
      const sel = this._selectedIndices.has( i );

      return `
        <div class="ucf-card" data-uc-index="${i}">
          <div class="ucf-card-head">
            <span class="ucf-card-num${sel ? ' selected' : ''}" data-uc-toggle="${i}" role="checkbox" aria-checked="${sel}" tabindex="0">${i + 1}</span>
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

    const moreHtml = this._moreCount < this.maxShowMore
      ? `<div class="ucf-more-row">
           <button type="button" class="ucf-more-btn" id="ucf-more">${this.t.showMore}</button>
         </div>`
      : '';

    resultsEl.innerHTML = `
      <hr class="ucf-divider">
      <div class="ucf-results-header-row">
        <h3 class="ucf-results-header">${this.t.resultsHeader}</h3>
        <span class="ucf-results-arrow" aria-hidden="true"><i class="fas fa-arrow-right"></i></span>
        <div class="ucf-results-actions">
          <button type="button" class="ucf-select-toggle" id="ucf-select-all">${this.t.selectAll}</button>
          <button type="button" class="ucf-select-toggle" id="ucf-select-none">${this.t.selectNone}</button>
          <button type="button" class="ucf-inquire-btn" id="ucf-inquire" disabled>${this.t.inquire}</button>
        </div>
      </div>
      <p class="ucf-results-sub">${this.t.resultsSub}</p>
      ${cardsHtml}
      ${moreHtml}
    `;

    const textarea = this.root.querySelector( '#ucf-description' );
    const description = textarea ? textarea.value.trim() : '';
    this._lastDescription = description;
    this._lastUseCases = useCases;
    this._saveState( description, useCases );

    const printBtn = this.root.querySelector( '#ucf-print' );
    const downloadBtn = this.root.querySelector( '#ucf-download' );
    if( printBtn ) printBtn.disabled = false;
    if( downloadBtn ) downloadBtn.disabled = false;

    this._bindSelectionEvents();
  }

  _bindSelectionEvents()
  {
    const toggles = this.root.querySelectorAll( '[data-uc-toggle]' );
    toggles.forEach( el => {
      el.addEventListener( 'click', () => this._toggleCard( el ) );
      el.addEventListener( 'keydown', ( e ) => {
        if( e.key === ' ' || e.key === 'Enter' )
        {
          e.preventDefault();
          this._toggleCard( el );
        }
      });
    });

    const selectAll = this.root.querySelector( '#ucf-select-all' );
    if( selectAll )
      selectAll.addEventListener( 'click', () => this._selectAll() );

    const selectNone = this.root.querySelector( '#ucf-select-none' );
    if( selectNone )
      selectNone.addEventListener( 'click', () => this._selectNone() );

    const inquireBtn = this.root.querySelector( '#ucf-inquire' );
    if( inquireBtn )
      inquireBtn.addEventListener( 'click', () => this._inquire() );

    const moreBtn = this.root.querySelector( '#ucf-more' );
    if( moreBtn )
      moreBtn.addEventListener( 'click', () => this._showMore() );

    this._updateInquireBtn();
  }

  _toggleCard( el )
  {
    const idx = parseInt( el.dataset.ucToggle, 10 );
    if( this._selectedIndices.has( idx ) )
    {
      this._selectedIndices.delete( idx );
      el.classList.remove( 'selected' );
      el.setAttribute( 'aria-checked', 'false' );
    }
    else
    {
      this._selectedIndices.add( idx );
      el.classList.add( 'selected' );
      el.setAttribute( 'aria-checked', 'true' );
    }
    this._updateInquireBtn();
  }

  _selectAll()
  {
    if( ! this._lastUseCases )
      return;
    this._selectedIndices = new Set();
    this._lastUseCases.forEach( ( _, i ) => this._selectedIndices.add( i ) );
    const toggles = this.root.querySelectorAll( '[data-uc-toggle]' );
    toggles.forEach( el => {
      el.classList.add( 'selected' );
      el.setAttribute( 'aria-checked', 'true' );
    });
    this._updateInquireBtn();
  }

  _selectNone()
  {
    this._selectedIndices = new Set();
    const toggles = this.root.querySelectorAll( '[data-uc-toggle]' );
    toggles.forEach( el => {
      el.classList.remove( 'selected' );
      el.setAttribute( 'aria-checked', 'false' );
    });
    this._updateInquireBtn();
  }

  _updateInquireBtn()
  {
    const btn = this.root.querySelector( '#ucf-inquire' );
    if( btn )
      btn.disabled = this._selectedIndices.size === 0;
  }

  _inquire()
  {
    if( ! this._lastUseCases || this._selectedIndices.size === 0 )
      return;

    const effortLabel = {
      'Low': this.t.effortLow,
      'Medium': this.t.effortMedium,
      'High': this.t.effortHigh
    };

    const selected = Array.from( this._selectedIndices ).sort( ( a, b ) => a - b )
      .map( i => this._lastUseCases[ i ] )
      .filter( Boolean );

    const lines = [];
    lines.push( this.t.inquiryDescLabel + ':' );
    lines.push( this._lastDescription || '' );
    lines.push( '' );
    lines.push( this.t.inquirySelectedLabel + ':' );
    lines.push( '' );

    selected.forEach( ( uc, i ) => {
      const effort = effortLabel[ uc.effort ] || uc.effort || 'Medium';
      lines.push( `${i + 1}. ${uc.title || ''}  [${this.t.inquiryEffortLabel}: ${effort}]` );
      lines.push( `   ${uc.description || ''}` );
      lines.push( `   ${this.t.docRoiLabel}: ${uc.roi || ''}` );
      lines.push( '' );
    });

    const inquiry = {
      subject: this.t.inquirySubject,
      message: lines.join( '\n' ),
      lang: this.lang
    };

    try
    {
      sessionStorage.setItem( UCF_INQUIRY_KEY, JSON.stringify( inquiry ) );
    }
    catch( e ) {}

    this.sidebar.close();

    const contactForm = document.getElementById( 'contact-form' );
    if( contactForm )
    {
      this._prefillContactForm( inquiry );
      document.querySelector( '#contact' ).scrollIntoView( { behavior: 'smooth' } );
    }
    else
    {
      const path = window.location.pathname;
      if( path.includes( '/pages/' ) || path.includes( '/offers/' ) )
        window.location.href = '../../index.html';
      else
        window.location.href = 'index.html';
    }
  }

  _prefillContactForm( inquiry )
  {
    const subjectField = document.getElementById( 'subject' );
    if( subjectField )
      subjectField.value = inquiry.subject;

    const messageField = document.getElementById( 'message' );
    if( messageField )
      messageField.value = inquiry.message;
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
        moreCount: this._moreCount,
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

    const textarea = this.root.querySelector( '#ucf-description' );
    if( textarea )
      textarea.value = state.description;

    this._moreCount = state.moreCount || 0;
    this._selectedIndices = new Set();
    this._renderResults( state.useCases );
    return true;
  }

  _reset()
  {
    this._lastDescription = '';
    this._lastUseCases = null;
    this._selectedIndices = new Set();
    this._moreCount = 0;
    this._clearState();
    try { sessionStorage.removeItem( UCF_INQUIRY_KEY ); } catch( e ) {}
    this.render( this.root );
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
// Init — register the view and wire the hero trigger button
// =========================================================================

(function()
{
  function init()
  {
    const sidebar = Sidebar.instance();
    const finder = new UseCaseFinder( sidebar );
    sidebar.registerView( finder );

    const trigger = document.getElementById( 'use-case-finder-trigger' );
    if( trigger )
    {
      // The page declares its topic on the trigger; primes the placeholder
      finder.topic = trigger.dataset.ucfTopic || null;

      trigger.addEventListener( 'click', ( e ) => {
        e.preventDefault();
        if( ! sidebar.isOpen )
          sidebar.open( finder.id );
      });
    }
  }

  if( document.readyState === 'loading' )
    document.addEventListener( 'DOMContentLoaded', init );
  else
    init();
})();
