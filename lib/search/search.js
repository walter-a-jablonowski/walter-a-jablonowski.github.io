/**
 * Site search dialog
 *
 * Keyboard-driven overlay (Ctrl/Cmd+K or the magnifier in the main nav) that
 * searches the whole site without a server: tools/upd_search_index.php builds
 * search-index-<lang>.json from the pages, this class loads that index once and
 * walks it in memory.
 *
 * The dialog markup is created here, not in the pages - it must exist on every
 * page and the site has no include mechanism. Loaded lazily by controller.js
 * (initSearch) on the first trigger, so a visitor who never searches never pays
 * for it.
 *
 * Index shape:  { lang, pages: [ { url, title, group, keywords, desc,
 *                                  sections: [ { t, a, x } ] } ] }
 *   url  page path relative to the site root      t  section heading
 *   a    anchor: element id or ":~:text=…"        x  section text
 *
 * (C) Walter A. Jablonowski 2026, All rights reserved
 */

class SearchManager
{
  /**
   * @param options.base     absolute URL of the site root (with trailing slash)
   * @param options.version  cache-busting token of the current build ("?v=…")
   */
  constructor( options )
  {
    this.base    = options.base;
    this.version = options.version || '';
    this.lang    = (document.documentElement.lang || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
    this.text    = SearchManager.TEXTS[this.lang];

    this.index     = null;   // parsed index, once loaded
    this.loading   = null;   // in-flight load promise
    this.hits      = [];     // results currently rendered
    this.modal     = null;   // built on first open
    this.lastFocus = null;   // element to return focus to on close
  }

  /**
   * Show the dialog: cleared, focused, index warming up in the background
   */
  open()
  {
    if( ! this.modal )
      this.build();

    this.lastFocus = document.activeElement;
    this.input.value = '';
    this.results.innerHTML = '';
    this.modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Focus once the panel is actually visible
    setTimeout(() => this.input.focus(), 0);

    this.loadIndex().catch(() => {});
  }

  close()
  {
    if( ! this.isOpen() ) return;

    this.modal.classList.remove('open');
    document.body.style.overflow = '';

    if( this.lastFocus && this.lastFocus.focus )
      this.lastFocus.focus();
  }

  isOpen()
  {
    return !! this.modal && this.modal.classList.contains('open');
  }


  // ── Data ──────────────────────────────────────────────────────────────────

  /**
   * Load the index for the current language (once per page view). Everything
   * after this is a plain in-memory walk - no request per query.
   */
  loadIndex()
  {
    if( ! this.loading )
    {
      this.loading = fetch(`${this.base}search-index-${this.lang}.json${this.version}`)
        .then(response => {
          if( ! response.ok ) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(data => {
          this.index = data;
          return data;
        });
    }

    return this.loading;
  }


  // ── Search ────────────────────────────────────────────────────────────────

  /**
   * Run the search for what is currently in the input (Enter or the go button).
   * An empty query just clears the results.
   */
  runSearch()
  {
    const query = this.input.value.trim();

    if( ! query ) {
      this.results.innerHTML = '';
      return;
    }

    if( ! this.index )
      this.note(this.text.loading);

    this.loadIndex()
      .then(() => this.render(this.walk(query)))
      .catch(() => this.note(this.text.error));
  }

  /**
   * Walk the index and collect the matches, best first.
   *
   * A section matches on its text or its heading. Page-level fields (title,
   * meta keywords) are a fallback: they describe the whole page, so they yield
   * one result for it instead of repeating every section.
   */
  walk( query )
  {
    const q = SearchManager.fold(query);
    const hits = [];

    this.index.pages.forEach(page => {
      const inTitle = SearchManager.fold(page.title).indexOf(q);

      // A page whose title matches is what the query is about, so its sections
      // outrank the same kind of hit elsewhere
      const bonus = inTitle >= 0 ? 1 : 0;
      let found = 0;

      page.sections.forEach(section => {
        const hit = this.matchSection(page, section, q);

        if( hit ) {
          hit.score += bonus;
          hits.push(hit);
          found++;
        }
      });

      if( found )
        return;

      const inKeys = SearchManager.fold(page.keywords).indexOf(q);
      const inDesc = SearchManager.fold(page.desc).indexOf(q);

      if( inTitle < 0 && inKeys < 0 && inDesc < 0 )
        return;

      hits.push({
        page,
        section: page.sections[0],
        name:    page.title,
        snippet: inDesc >= 0 ? this.snippet(page.desc, inDesc, q.length)
               : inKeys >= 0 ? this.snippet(page.keywords, inKeys, q.length) : null,
        score:   inTitle >= 0 ? 5 : 2
      });
    });

    hits.sort((a, b) => b.score - a.score);

    return hits.slice(0, SearchManager.MAX_RESULTS);
  }

  /**
   * Match one section, text before heading (the text carries the snippet, so it
   * is the more useful hit), or null when it doesn't match
   */
  matchSection( page, section, q )
  {
    const inText = SearchManager.fold(section.x).indexOf(q);

    if( inText >= 0 )
      return {
        page,
        section,
        name:    section.t || page.title,
        snippet: this.snippet(section.x, inText, q.length),
        score:   1
      };

    if( SearchManager.fold(section.t).indexOf(q) >= 0 )
      return {
        page,
        section,
        name:    section.t,
        snippet: null,
        score:   3
      };

    return null;
  }

  /**
   * A window of context around the match, as { before, match, after } with
   * ellipses where the text was cut
   */
  snippet( text, pos, length )
  {
    const from = Math.max(0, pos - SearchManager.CONTEXT);
    const to   = Math.min(text.length, pos + length + SearchManager.CONTEXT);

    return {
      before: (from > 0 ? '… ' : '') + text.slice(from, pos),
      match:  text.slice(pos, pos + length),
      after:  text.slice(pos + length, to) + (to < text.length ? ' …' : '')
    };
  }

  /**
   * Comparison form of a text: lower case, umlauts and accents folded onto
   * their base letter. Length-preserving on purpose - the match position is
   * used to cut the snippet out of the original text.
   */
  static fold( text )
  {
    return (text || '')
      .toLowerCase()
      .replace(/ß/g, 's')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }


  // ── Rendering ─────────────────────────────────────────────────────────────

  render( hits )
  {
    this.hits = hits;

    if( ! hits.length ) {
      this.note(this.text.empty);
      return;
    }

    this.results.innerHTML = hits.map((hit, i) => `
      <button type="button" class="ss-result" data-hit="${i}">
        <span class="ss-name">${SearchManager.escape(hit.name)}</span>
        <span class="ss-loc">${this.describeLocation(hit)}</span>
        ${hit.snippet ? `<span class="ss-snip">${this.highlight(hit.snippet)}</span>` : ''}
      </button>`).join('');
  }

  /**
   * Where the hit lives: "Group › Page" (and "· Section" when the result is a
   * section of that page rather than the page itself)
   */
  describeLocation( hit )
  {
    const sep   = ' <span class="ss-sep">›</span> ';
    const parts = [hit.page.group, hit.page.title].filter(Boolean).map(SearchManager.escape);

    let location = parts.join(sep);

    if( hit.section && hit.section.t && hit.section.t !== hit.name )
      location += ' <span class="ss-sep">·</span> ' + SearchManager.escape(hit.section.t);

    return location;
  }

  highlight( snippet )
  {
    return SearchManager.escape(snippet.before)
         + '<mark>' + SearchManager.escape(snippet.match) + '</mark>'
         + SearchManager.escape(snippet.after);
  }

  note( message )
  {
    this.hits = [];
    this.results.innerHTML = `<p class="ss-note">${SearchManager.escape(message)}</p>`;
  }

  static escape( text )
  {
    return String(text).replace(/[&<>"']/g, c => SearchManager.ENTITIES[c]);
  }


  // ── Opening a result ──────────────────────────────────────────────────────

  /**
   * Close the dialog and go to the hit: a jump inside the current page when it
   * is this page (so the mini-tab handler in controller.js can react to the
   * hash), a normal navigation otherwise.
   */
  openHit( hit )
  {
    const anchor = hit.section ? hit.section.a : '';
    const url    = this.base + hit.page.url + (anchor ? '#' + anchor : '');

    this.close();

    if( ! this.isCurrentPage(hit.page.url) ) {
      window.location.href = url;
      return;
    }

    if( ! anchor ) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // A text fragment is a navigation feature - inside the page, look the
    // heading up ourselves
    if( anchor.startsWith(':~:text=') ) {
      this.scrollToText(decodeURIComponent(anchor.slice(8)));
      return;
    }

    if( window.location.hash === '#' + anchor ) {
      const target = document.getElementById(anchor);
      if( target ) target.scrollIntoView({ behavior: 'smooth' });
    }
    else
      window.location.hash = anchor;
  }

  isCurrentPage( url )
  {
    const strip = path => path.replace(/index\.html$/, '');

    return strip(new URL(this.base + url).pathname) === strip(window.location.pathname);
  }

  scrollToText( text )
  {
    const headings = document.querySelectorAll('h1, h2, h3');

    for( const heading of headings )
      if( heading.textContent.trim().startsWith(text) ) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  // ── Markup + events ───────────────────────────────────────────────────────

  /**
   * Build the dialog once and wire it up
   */
  build()
  {
    const modal = document.createElement('div');

    modal.className = 'site-search';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', this.text.title);

    modal.innerHTML = `
      <div class="ss-panel">
        <div class="ss-head">
          <h2 class="ss-title">${this.text.title}</h2>
          <button type="button" class="ss-close" aria-label="${this.text.close}">&times;</button>
        </div>
        <div class="ss-bar">
          <input type="search" class="ss-input" placeholder="${this.text.placeholder}"
                 aria-label="${this.text.title}" autocomplete="off" spellcheck="false">
          <button type="button" class="ss-go" aria-label="${this.text.title}">
            <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
          </button>
        </div>
        <div class="ss-results"></div>
      </div>`;

    document.body.appendChild(modal);

    this.modal   = modal;
    this.input   = modal.querySelector('.ss-input');
    this.results = modal.querySelector('.ss-results');

    modal.querySelector('.ss-close').addEventListener('click', () => this.close());
    modal.querySelector('.ss-go').addEventListener('click', () => this.runSearch());

    // Backdrop click (but not a click inside the panel)
    modal.addEventListener('click', (e) => {
      if( e.target === modal ) this.close();
    });

    this.input.addEventListener('keydown', (e) => this.handleInputKeydown(e));
    this.results.addEventListener('keydown', (e) => this.handleResultsKeydown(e));

    this.results.addEventListener('click', (e) => {
      const button = e.target.closest('.ss-result');
      if( button ) this.openHit(this.hits[button.dataset.hit]);
    });
  }

  handleInputKeydown( e )
  {
    if( e.key === 'Enter' ) {
      e.preventDefault();
      this.runSearch();
    }
    else if( e.key === 'ArrowDown' ) {
      e.preventDefault();
      const first = this.results.querySelector('.ss-result');
      if( first ) first.focus();
    }
  }

  handleResultsKeydown( e )
  {
    if( e.key !== 'ArrowDown' && e.key !== 'ArrowUp' ) return;

    e.preventDefault();

    const items = Array.from(this.results.querySelectorAll('.ss-result'));
    const at    = items.indexOf(document.activeElement);

    if( e.key === 'ArrowDown' ) {
      if( at < items.length - 1 ) items[at + 1].focus();
      return;
    }

    // Up past the first result returns to the input
    if( at > 0 ) items[at - 1].focus();
    else this.input.focus();
  }
}

SearchManager.MAX_RESULTS = 30;

// Characters of context on each side of a match in a snippet
SearchManager.CONTEXT = 30;

SearchManager.ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

SearchManager.TEXTS = {
  de: {
    title:       'Suche',
    placeholder: 'Website durchsuchen … (Enter)',
    close:       'Schließen',
    loading:     'Suchindex wird geladen …',
    empty:       'Keine Treffer gefunden',
    error:       'Die Suche ist gerade nicht verfügbar.'
  },
  en: {
    title:       'Search',
    placeholder: 'Search the site … (press Enter)',
    close:       'Close',
    loading:     'Loading search index …',
    empty:       'No matches found',
    error:       'Search is currently unavailable.'
  }
};
