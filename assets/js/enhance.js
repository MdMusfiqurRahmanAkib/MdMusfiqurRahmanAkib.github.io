/* ============================================================
   enhance.js - reading-experience layer on top of the paper:
     · book-style page-flip navigation (buttons + keys)
     · reader panel: animated stats, star rating, visitor reviews
     · command palette (Ctrl/Cmd-K) to jump anywhere
   All features are self-injecting and degrade gracefully; the
   paper renders fine without this file.
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var AUTHOR_EMAIL = 'mdmusfiqurrahmanakib@gmail.com';
  var LS = 'portfolio.reviews';

  function store(v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(LS)) || {}; localStorage.setItem(LS, JSON.stringify(v)); } catch (e) { return {}; } }

  /* ============ scroll-mode page navigation (arrows) ============ */

  function pages() { return $$('#doc .page'); }
  function tbH() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tb-h')) || 48; }

  function currentPageIndex() {
    var ps = pages(), top = tbH() + 60, idx = 0;
    ps.forEach(function (p, i) { if (p.getBoundingClientRect().top <= top) idx = i; });
    return idx;
  }
  function scrollToPage(p) {
    var y = p.getBoundingClientRect().top + scrollY - tbH() - 16;
    scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  function pageStep(dir) {
    var ps = pages(), t = currentPageIndex() + dir;
    if (t >= 0 && t < ps.length) scrollToPage(ps[t]);
  }

  var pagerPrev, pagerNext;
  function updatePager() {
    if (!pagerPrev) return;
    var paged = window.Paper.mode === 'paged' && !bookOpen, i = currentPageIndex(), n = pages().length;
    pagerPrev.disabled = !paged || i <= 0;
    pagerNext.disabled = !paged || i >= n - 1;
  }
  function buildPager() {
    var mk = function (cls, d, path) {
      var b = document.createElement('button');
      b.className = 'pager ' + cls; b.setAttribute('aria-label', d > 0 ? 'Next page' : 'Previous page');
      b.innerHTML = '<svg viewBox="0 0 24 24">' + path + '</svg>';
      b.addEventListener('click', function () { pageStep(d); });
      document.body.appendChild(b); return b;
    };
    pagerPrev = mk('prev', -1, '<path d="M15 5l-7 7 7 7"/>');
    pagerNext = mk('next',  1, '<path d="M9 5l7 7-7 7"/>');
    var t;
    addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(updatePager, 80); }, { passive: true });
  }

  /* ============ book mode - real drag/swipe page-flip ============ */
  /* Uses the bundled StPageFlip engine over clones of the rendered
     sheets: soft page-curl that tracks the pointer, works with touch,
     single page on phones and a two-page spread on wide screens. */

  var bookEl, bookHolder, bookCount, bookHint, pf = null, bookOpen = false, lastGeom = '';

  function geometry() {
    var portrait = innerWidth < 1024;      // single page on phones/tablets, spread on desktop
    var barH = 52, hintH = 40, padX = 20, padY = 20;
    var availW = innerWidth - padX * 2;
    var availH = innerHeight - barH - hintH - padY * 2;
    var aspect = 8.5 / 11;                    // page width / height
    var w, h;
    if (portrait) {
      h = availH; w = h * aspect;
      if (w > availW) { w = availW; h = w / aspect; }
      w = Math.min(w, 560);
    } else {
      h = availH; w = h * aspect;
      if (w * 2 > availW) { w = availW / 2; h = w / aspect; }
      w = Math.min(w, 540);
    }
    h = w / aspect;
    return { portrait: portrait, w: Math.round(w), h: Math.round(h) };
  }

  function buildBookUI() {
    bookEl = document.createElement('div');
    bookEl.className = 'book-overlay'; bookEl.id = 'bookOverlay';
    bookEl.innerHTML =
      '<div class="book-bar">' +
        '<span class="book-title">Book view</span>' +
        '<span class="book-count" id="bookCount"></span>' +
        '<button class="book-close" id="bookClose" aria-label="Close book view">Close ✕</button>' +
      '</div>' +
      '<div class="book-stage">' +
        '<button class="book-nav prev" id="bookPrev" aria-label="Previous">' +
          '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>' +
        '<div class="book-holder" id="bookHolder"></div>' +
        '<button class="book-nav next" id="bookNext" aria-label="Next">' +
          '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>' +
      '</div>' +
      '<div class="book-hint" id="bookHint">Drag a page corner, or swipe, to turn, like a real book.</div>';
    document.body.appendChild(bookEl);
    bookHolder = $('#bookHolder', bookEl);
    bookCount = $('#bookCount', bookEl);
    bookHint = $('#bookHint', bookEl);
    $('#bookClose', bookEl).addEventListener('click', function () { closeBook(); });
    $('#bookPrev', bookEl).addEventListener('click', function () { if (pf) pf.flipPrev(); });
    $('#bookNext', bookEl).addEventListener('click', function () { if (pf) pf.flipNext(); });
    bookEl.querySelector('.book-stage').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) closeBook();      // click empty space closes
    });
  }

  function destroyFlip() {
    // pf.destroy() removes the element it was mounted on, so we mount on a
    // disposable child and keep #bookHolder stable across open/close.
    if (pf) { try { pf.destroy(); } catch (e) {} pf = null; }
    if (bookHolder) bookHolder.innerHTML = '';
  }

  function buildFlip() {
    if (!window.St || !window.St.PageFlip) { toast('Page-flip engine not loaded'); return false; }
    destroyFlip();
    var g = geometry(); lastGeom = g.portrait + ':' + g.w;
    // scale each cloned sheet to the slot via the shared em base
    bookHolder.style.setProperty('--base', (g.w / 61.2) + 'px');

    // Always clone the paginated sheets - force paged layout if the document
    // is in mobile flow mode, then restore it (this happens behind the overlay).
    var restore = window.Paper.mode !== 'paged';
    if (restore) window.Paper.render(true, 'paged');

    var mount = document.createElement('div');
    bookHolder.appendChild(mount);

    var clones = pages().map(function (p) {
      var c = p.cloneNode(true); c.classList.add('book-page');
      c.style.animation = 'none'; c.style.opacity = '1'; c.style.transform = 'none';
      return c;
    });

    if (restore) window.Paper.render(true);   // back to flow for the underlying doc

    pf = new window.St.PageFlip(mount, {
      width: g.w, height: g.h, size: 'fixed',
      minWidth: 200, maxWidth: 1000, minHeight: 260, maxHeight: 1400,
      showCover: false, usePortrait: g.portrait, mobileScrollSupport: false,
      maxShadowOpacity: 0.5, drawShadow: true, flippingTime: reduce ? 0 : 700,
      useMouseEvents: true, swipeDistance: 18, clickEventForward: true
    });
    pf.loadFromHTML(clones);
    var total = pf.getPageCount();
    var setCount = function (i) { bookCount.textContent = 'Page ' + (i + 1) + ' of ' + total; };
    setCount(pf.getCurrentPageIndex ? pf.getCurrentPageIndex() : 0);
    pf.on('flip', function (e) { setCount(e.data); });
    return true;
  }

  function openBook() {
    if (bookOpen) return;
    if (!bookEl) buildBookUI();
    bookEl.classList.add('on');
    document.body.classList.add('book-lock');
    bookOpen = true;
    void bookEl.offsetWidth;                 // force layout so the overlay is measurable
    setTimeout(function () { if (!buildFlip()) { closeBook(); } updatePager(); }, 0);
    $('#btnBook') && $('#btnBook').setAttribute('aria-expanded', 'true');
  }

  function closeBook() {
    if (!bookOpen) return;
    destroyFlip();
    bookEl.classList.remove('on');
    document.body.classList.remove('book-lock');
    bookOpen = false;
    $('#btnBook') && $('#btnBook').setAttribute('aria-expanded', 'false');
    updatePager();
  }

  var bookRz;
  addEventListener('resize', function () {
    if (!bookOpen) return;
    clearTimeout(bookRz);
    bookRz = setTimeout(function () {
      var g = geometry();
      if (g.portrait + ':' + g.w !== lastGeom) buildFlip();   // rebuild only on real change
    }, 200);
  });

  /* ============ reader panel ============ */

  function countUp(el, to) {
    if (reduce) { el.textContent = to; return; }
    var start = performance.now(), dur = 900;
    (function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e);
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

  function stats() {
    var pubs = $$('#doc .pub');
    var first = pubs.filter(function (p) {
      var au = $('.pub-au', p);
      return au && au.firstChild && au.firstChild.nodeName === 'B';
    }).length;
    var scopus = $$('#doc .pub .badge').length;
    return { pubs: pubs.length, first: first, scopus: scopus, conf: 4 };
  }

  var reader, starEls = [], rated = 0;
  function paintStars(n) { starEls.forEach(function (s, i) { s.classList.toggle('lit', i < n); }); }

  function renderNotes() {
    var box = $('#rNotes'); if (!box) return;
    var data = store(), list = data.notes || [];
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<li class="n-empty">No notes yet. Be the first to leave one.</li>'; return; }
    list.slice().reverse().forEach(function (n) {
      var li = document.createElement('li');
      li.innerHTML = '<div class="n-top"><span class="n-name"></span><span class="n-stars"></span></div><p class="n-msg"></p>';
      $('.n-name', li).textContent = n.name || 'Anonymous reader';
      $('.n-stars', li).textContent = n.stars ? '★'.repeat(n.stars) : '';
      $('.n-msg', li).textContent = n.msg;
      box.appendChild(li);
    });
  }

  function buildReader() {
    reader = document.createElement('aside');
    reader.className = 'reader'; reader.id = 'reader';
    reader.setAttribute('aria-label', 'Reader panel');
    var s = stats();
    reader.innerHTML =
      '<h3>Reader panel</h3>' +
      '<p class="r-sub">Metrics, and a place to leave a note for the author.</p>' +

      '<section><p class="r-lab">At a glance</p><div class="stat-grid">' +
        '<div class="stat accent"><b data-c="' + s.pubs + '">0</b><span>Peer-reviewed papers</span></div>' +
        '<div class="stat"><b data-c="' + s.first + '">0</b><span>First-author</span></div>' +
        '<div class="stat"><b data-c="' + s.scopus + '">0</b><span>Scopus-indexed</span></div>' +
        '<div class="stat"><b data-c="' + s.conf + '">0</b><span>Conferences</span></div>' +
      '</div></section>' +

      '<section><p class="r-lab">Rate this portfolio</p>' +
        '<div class="stars" id="rStars" role="radiogroup" aria-label="Rating"></div>' +
        '<p class="rate-note" id="rNote"></p></section>' +

      '<section><p class="r-lab">Leave a note or idea</p>' +
        '<input type="text" id="rName" maxlength="60" placeholder="Your name (optional)">' +
        '<textarea id="rMsg" maxlength="1000" placeholder="Feedback, an idea, or a research question…"></textarea>' +
        '<div class="btn-row">' +
          '<button class="r-btn primary" id="rSend">Send to author</button>' +
          '<button class="r-btn ghost" id="rSave">Save note</button>' +
        '</div>' +
        '<ul class="notes" id="rNotes"></ul>' +
        '<p class="r-cap">“Send” opens your email app addressed to the author. ' +
          '“Save note” keeps it on this device and shows it above. ' +
          '<a href="#" id="rCite">Cite this portfolio ↗</a></p>' +
      '</section>';
    document.body.appendChild(reader);

    // stars
    var wrap = $('#rStars');
    for (var i = 1; i <= 5; i++) {
      (function (v) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = '★'; b.setAttribute('role', 'radio');
        b.setAttribute('aria-label', v + ' star' + (v > 1 ? 's' : ''));
        b.addEventListener('mouseenter', function () { paintStars(v); });
        b.addEventListener('click', function () {
          rated = v; paintStars(v);
          var d = store(); d.rating = v; store(d);
          $('#rNote').textContent = 'Thanks! You rated this ' + v + '/5.';
        });
        starEls.push(b); wrap.appendChild(b);
      })(i);
    }
    wrap.addEventListener('mouseleave', function () { paintStars(rated); });

    var saved = store();
    if (saved.rating) { rated = saved.rating; paintStars(rated); $('#rNote').textContent = 'You rated this ' + rated + '/5.'; }
    renderNotes();

    $('#rSend').addEventListener('click', function () {
      var name = $('#rName').value.trim(), msg = $('#rMsg').value.trim();
      if (!msg && !rated) { toast('Add a rating or a note first'); return; }
      var subj = 'Portfolio feedback' + (rated ? ': ' + rated + '/5' : '');
      var body = (rated ? 'Rating: ' + rated + '/5\n' : '') +
                 (name ? 'Name: ' + name + '\n' : '') + '\n' + msg + '\n\n(sent from your portfolio site)';
      location.href = 'mailto:' + AUTHOR_EMAIL + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);
    });

    $('#rSave').addEventListener('click', function () {
      var name = $('#rName').value.trim(), msg = $('#rMsg').value.trim();
      if (!msg) { toast('Write a note to save it'); return; }
      var d = store(); d.notes = d.notes || [];
      d.notes.push({ name: name, msg: msg, stars: rated, at: Date.now() });
      store(d); $('#rMsg').value = ''; renderNotes(); toast('Note saved on this device');
    });

    $('#rCite').addEventListener('click', function (e) {
      e.preventDefault();
      var y = new Date().getFullYear();
      var bib = '@misc{akib' + y + 'portfolio,\n' +
        '  author = {Akib, Md. Musfiqur Rahman},\n' +
        '  title  = {Academic Portfolio},\n' +
        '  year   = {' + y + '},\n  howpublished = {\\url{' + location.href.split('#')[0] + '}}\n}';
      navigator.clipboard.writeText(bib).then(function () { toast('Portfolio BibTeX copied'); })
        .catch(function () { toast('Could not copy'); });
    });
  }

  var statsAnimated = false;
  function openReader(open) {
    document.body.classList.toggle('reader-open', open);
    $('#btnReader').setAttribute('aria-expanded', String(open));
    if (open && !statsAnimated) {
      statsAnimated = true;
      $$('#reader .stat b').forEach(function (b) { countUp(b, +b.dataset.c); });
    }
  }

  /* ============ command palette ============ */

  var cmdk, cmdInput, cmdList, cmdItems = [], cmdSel = 0;

  function cmdData() {
    var items = $$('#doc .sec, #doc .sub').map(function (h) {
      return { icon: h.classList.contains('sec') ? '§' : '·', label: h.textContent.trim(),
               sub: 'section', run: function () { location.hash = '#' + h.id; scrollToTarget(h); } };
    });
    [['Google Scholar', 'https://scholar.google.com/citations?hl=en&user=owhPU2cAAAAJ'],
     ['ORCID', 'https://orcid.org/0009-0002-6775-8302'],
     ['GitHub', 'https://github.com/MdMusfiqurRahmanAkib'],
     ['Scopus', 'https://www.scopus.com/authid/detail.uri?authorId=60546389100']
    ].forEach(function (l) {
      items.push({ icon: '↗', label: l[0], sub: 'open link', run: function () { open(l[1], '_blank'); } });
    });
    items.push({ icon: '📖', label: 'Read as book (flip pages)', sub: 'book view', run: function () { openBook(); } });
    items.push({ icon: '▦', label: 'Switch to ' + (window.Paper.format === 'springer' ? 'IEEE two-column' : 'Springer single-column') + ' format', sub: 'format', run: function () { toggleFormat(); } });
    items.push({ icon: '★', label: 'Rate / leave a note', sub: 'panel', run: function () { openReader(true); } });
    items.push({ icon: '⤓', label: 'Save as PDF', sub: 'print', run: function () { print(); } });
    return items;
  }

  function scrollToTarget(h) {
    var y = h.getBoundingClientRect().top + scrollY - tbH() - 20;
    scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }

  function cmdRender(q) {
    q = q.toLowerCase();
    var all = cmdData();
    cmdItems = q ? all.filter(function (it) { return it.label.toLowerCase().indexOf(q) >= 0; }) : all;
    cmdSel = 0;
    cmdList.innerHTML = '';
    cmdItems.forEach(function (it, i) {
      var li = document.createElement('li');
      li.className = i === 0 ? 'sel' : '';
      li.innerHTML = '<span class="c-ic"></span><span class="c-t"></span><span class="c-sub"></span>';
      $('.c-ic', li).textContent = it.icon;
      $('.c-t', li).textContent = it.label;
      $('.c-sub', li).textContent = it.sub;
      li.addEventListener('click', function () { it.run(); cmdOpen(false); });
      li.addEventListener('mousemove', function () { cmdSel = i; cmdHi(); });
      cmdList.appendChild(li);
    });
  }
  function cmdHi() { $$('#cmdkList li').forEach(function (li, i) { li.classList.toggle('sel', i === cmdSel); }); }

  function cmdOpen(open) {
    cmdk.classList.toggle('on', open);
    if (open) { cmdInput.value = ''; cmdRender(''); setTimeout(function () { cmdInput.focus(); }, 30); }
  }

  function buildPalette() {
    cmdk = document.createElement('div'); cmdk.className = 'cmdk'; cmdk.id = 'cmdk';
    cmdk.innerHTML =
      '<div class="cmdk-back"></div><div class="cmdk-box">' +
        '<input type="text" id="cmdkInput" placeholder="Jump to a section, open a profile…" aria-label="Command palette">' +
        '<ul class="cmdk-list" id="cmdkList"></ul>' +
        '<div class="cmdk-foot"><span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>' +
      '</div>';
    document.body.appendChild(cmdk);
    cmdInput = $('#cmdkInput'); cmdList = $('#cmdkList');
    $('.cmdk-back', cmdk).addEventListener('click', function () { cmdOpen(false); });
    cmdInput.addEventListener('input', function () { cmdRender(cmdInput.value); });
    cmdInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); cmdSel = Math.min(cmdItems.length - 1, cmdSel + 1); cmdHi(); scrollSel(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cmdSel = Math.max(0, cmdSel - 1); cmdHi(); scrollSel(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (cmdItems[cmdSel]) { cmdItems[cmdSel].run(); cmdOpen(false); } }
    });
  }
  function scrollSel() { var li = $$('#cmdkList li')[cmdSel]; if (li) li.scrollIntoView({ block: 'nearest' }); }

  /* ============ toolbar buttons ============ */

  function buildToolbarButtons() {
    var group = $('#toolbar .tb-group');
    var host = group ? group.parentNode : $('#toolbar');
    var ref = $('#btnTheme');

    var hint = document.createElement('span');
    hint.className = 'kbd-hint';
    hint.innerHTML = '<kbd>' + (navigator.platform.indexOf('Mac') >= 0 ? '⌘' : 'Ctrl') + '</kbd><kbd>K</kbd>';
    hint.title = 'Command palette';
    hint.style.cursor = 'pointer';
    hint.addEventListener('click', function () { cmdOpen(true); });
    host.insertBefore(hint, ref);

    var fb = document.createElement('button');
    fb.className = 'tb-btn tb-fmt'; fb.id = 'btnFormat';
    fb.setAttribute('aria-label', 'Switch paper format');
    fb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="1"/><path d="M12 5v14"/></svg><span class="fmt-lab">IEEE</span>';
    fb.addEventListener('click', toggleFormat);
    host.insertBefore(fb, ref);

    var bb = document.createElement('button');
    bb.className = 'tb-btn'; bb.id = 'btnBook';
    bb.setAttribute('aria-label', 'Open book view'); bb.title = 'Book view: flip pages';
    bb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-1.6-1-4-1.6-6-1.6-1 0-2 .1-3 .4v13c1-.3 2-.4 3-.4 2 0 4.4.6 6 1.6 1.6-1 4-1.6 6-1.6 1 0 2 .1 3 .4v-13c-1-.3-2-.4-3-.4-2 0-4.4.6-6 1.6zM12 5v14"/></svg>';
    bb.addEventListener('click', function () { bookOpen ? closeBook() : openBook(); });
    host.insertBefore(bb, ref);

    var rb = document.createElement('button');
    rb.className = 'tb-btn'; rb.id = 'btnReader';
    rb.setAttribute('aria-label', 'Reader panel and feedback'); rb.title = 'Reader & feedback';
    rb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.3 4.9 5.2.7-3.8 3.6 1 5.2L12 15.9 7.3 17.4l1-5.2L4.5 8.6l5.2-.7z"/></svg>';
    rb.addEventListener('click', function () { openReader(!document.body.classList.contains('reader-open')); });
    host.insertBefore(rb, ref);
  }

  /* ============ format toggle + first-load coach mark ============ */
  var FMT_KEY = 'portfolio.format', COACH_KEY = 'portfolio.coach', coachEl;

  function updateFormatBtn() {
    var b = $('#btnFormat'); if (!b) return;
    var sp = window.Paper.format === 'springer';
    $('.fmt-lab', b).textContent = sp ? 'Springer' : 'IEEE';
    b.title = 'Format: ' + (sp ? 'Springer single-column' : 'IEEE two-column') + '. Click to switch';
  }
  function toggleFormat() {
    var to = window.Paper.format === 'springer' ? 'ieee' : 'springer';
    window.Paper.setFormat(to);
    try { localStorage.setItem(FMT_KEY, to); } catch (e) {}
    updateFormatBtn();
    toast(to === 'springer' ? 'Springer single-column format' : 'IEEE two-column format');
  }
  function applySavedFormat() {
    var f = null; try { f = localStorage.getItem(FMT_KEY); } catch (e) {}
    if (f === 'springer') window.Paper.setFormat('springer');
    updateFormatBtn();
  }
  function buildCoach() {
    var seen = null; try { seen = localStorage.getItem(COACH_KEY); } catch (e) {}
    if (seen) return;
    var target = $('#btnFormat'); if (!target) return;
    coachEl = document.createElement('div');
    coachEl.className = 'coach';
    coachEl.innerHTML =
      '<div class="coach-arrow"></div>' +
      '<p><b>New:</b> switch between <b>IEEE</b> two-column and <b>Springer</b> single-column layout here.</p>' +
      '<button class="coach-ok">Got it</button>';
    document.body.appendChild(coachEl);
    var place = function () {
      var r = target.getBoundingClientRect();
      coachEl.style.top = (r.bottom + 12) + 'px';
      var left = r.left + r.width / 2 - coachEl.offsetWidth / 2;
      left = Math.max(10, Math.min(innerWidth - coachEl.offsetWidth - 10, left));
      coachEl.style.left = left + 'px';
      coachEl.style.setProperty('--arrow-x', (r.left + r.width / 2 - left) + 'px');
    };
    place();
    setTimeout(function () { if (coachEl) { coachEl.classList.add('show'); place(); } }, 700);
    var dismiss = function () {
      if (!coachEl) return;
      coachEl.classList.remove('show');
      try { localStorage.setItem(COACH_KEY, '1'); } catch (e) {}
      var el = coachEl; coachEl = null;
      setTimeout(function () { el.remove(); }, 250);
    };
    $('.coach-ok', coachEl).addEventListener('click', function () { dismiss(); });
    setTimeout(function () { dismiss(); }, 15000);
    addEventListener('resize', function () { if (coachEl) place(); });
    addEventListener('scroll', function () { dismiss(); }, { once: true, passive: true });
  }

  /* ============ intro: under-construction gate + type-in reveal ============ */
  var INTRO_KEY = 'portfolio.intro';   // sessionStorage: play once per browser session

  var LOGO_SVG =
    '<svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><linearGradient id="ucg" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#6db6e8"/><stop offset="1" stop-color="#00629b"/></linearGradient></defs>' +
    '<circle cx="48" cy="48" r="42" stroke="url(#ucg)" stroke-width="4"/>' +
    '<circle cx="48" cy="48" r="34" stroke="rgba(255,255,255,.28)" stroke-width="2" stroke-dasharray="5 9"/>' +
    '<text x="48" y="61" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="34" fill="#fff">MA</text>' +
    '</svg>';

  /** Reveal all text in `root` character-by-character, finishing in `duration`
   *  ms, with a caret at the write head. Wraps each glyph in a span (no reflow,
   *  opacity only), then restores the original markup when done. */
  function typeIn(root, duration, done) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        while (p && p !== root) {
          var tag = p.tagName;
          if (tag === 'svg' || tag === 'SVG' || tag === 'PRE' || tag === 'SCRIPT' || tag === 'STYLE')
            return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var textNodes = [], node;
    while ((node = walker.nextNode())) textNodes.push(node);

    var spans = [];
    textNodes.forEach(function (tn) {
      var frag = document.createDocumentFragment(), s = tn.nodeValue;
      for (var i = 0; i < s.length; i++) {
        var ch = s[i];
        if (ch === ' ' || ch === '\n' || ch === '\t') { frag.appendChild(document.createTextNode(ch)); }
        else { var sp = document.createElement('span'); sp.className = 'ty'; sp.textContent = ch; frag.appendChild(sp); spans.push(sp); }
      }
      tn.parentNode.replaceChild(frag, tn);
    });

    if (!spans.length) { if (done) done(); return; }

    var caret = document.createElement('div');
    caret.className = 'type-caret';
    document.body.appendChild(caret);

    var total = spans.length, revealed = 0, start = null, finished = false;
    function finalize() {
      if (finished) return; finished = true;
      for (var i = revealed; i < total; i++) spans[i].classList.add('on');
      caret.remove();
      // restore plain text so no leftover spans burden clones / re-pagination
      spans.forEach(function (sp) { if (sp.parentNode) sp.parentNode.replaceChild(document.createTextNode(sp.textContent), sp); });
      if (root.normalize) root.normalize();
      if (done) done();
    }
    function placeCaret(idx) {
      var r = spans[Math.min(idx, total - 1)].getBoundingClientRect();
      caret.style.left = r.right + 'px'; caret.style.top = r.top + 'px'; caret.style.height = r.height + 'px';
    }
    function step(ts) {
      if (finished) return;
      if (start === null) start = ts;
      var target = Math.floor(Math.min(1, (ts - start) / duration) * total);
      while (revealed < target) { spans[revealed].classList.add('on'); revealed++; }
      if (revealed > 0) placeCaret(revealed - 1);
      if (revealed < total) requestAnimationFrame(step); else finalize();
    }
    requestAnimationFrame(step);
    setTimeout(finalize, duration + 700);      // frozen-tab / stall safety net
  }

  function startIntro(after) {
    var seen = null; try { seen = sessionStorage.getItem(INTRO_KEY); } catch (e) {}
    if (seen) { if (after) after(); return; }
    try { sessionStorage.setItem(INTRO_KEY, '1'); } catch (e) {}

    var rest = $$('#doc .page:not(:first-child)');
    var body1 = $('#doc .page:first-child .page-body');
    rest.forEach(function (p) { p.classList.add('pg-hidden'); });

    var modal = document.createElement('div');
    modal.className = 'uc-modal';
    modal.innerHTML =
      '<div class="uc-card">' +
        '<div class="uc-logo">' + LOGO_SVG + '</div>' +
        '<div class="uc-badge">Under construction</div>' +
        '<h2>This portfolio is being finalized</h2>' +
        '<p>A few sections are still being added. You are welcome to look through the work so far.</p>' +
        '<button class="uc-enter">Enter</button>' +
        '<div class="uc-bar"><span></span></div>' +
      '</div>';
    document.body.appendChild(modal);
    setTimeout(function () { modal.classList.add('show'); }, 30);

    var started = false;
    function enter() {
      if (started) return; started = true;
      modal.classList.remove('show');
      setTimeout(function () { modal.remove(); }, 380);
      rest.forEach(function (p) { p.classList.remove('pg-hidden'); if (!reduce) p.classList.add('pg-reveal'); });
      if (reduce || !body1) { if (after) after(); return; }
      typeIn(body1, 1300, after);
    }
    $('.uc-enter', modal).addEventListener('click', enter);
    modal.addEventListener('click', function (e) { if (e.target === modal) enter(); });
  }

  /* ============ toast (reuse app.js's if present) ============ */
  var toastEl, toastT;
  function toast(m) {
    toastEl = toastEl || (function () { var d = document.querySelector('.toast'); if (!d) { d = document.createElement('div'); d.className = 'toast'; document.body.appendChild(d); } return d; })();
    toastEl.textContent = m; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ============ wiring ============ */

  buildPager();
  buildReader();
  buildPalette();
  buildToolbarButtons();
  applySavedFormat();
  updatePager();
  startIntro(buildCoach);        // under-construction gate, then type-in, then the coach mark

  document.addEventListener('paper:rendered', function () {
    statsAnimated = false;                 // recount if layout switched
    $$('#reader .stat b').forEach(function (b) { b.textContent = document.body.classList.contains('reader-open') ? b.dataset.c : '0'; });
    if (document.body.classList.contains('reader-open')) { statsAnimated = true; $$('#reader .stat b').forEach(function (b) { b.textContent = b.dataset.c; }); }
    updatePager();
  });

  addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); cmdOpen(!cmdk.classList.contains('on')); return; }
    if (cmdk.classList.contains('on')) { if (k === 'escape') cmdOpen(false); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;

    if (bookOpen) {                                  // book view captures navigation
      if (k === 'arrowright' || k === 'pagedown' || k === ' ') { e.preventDefault(); if (pf) pf.flipNext(); }
      else if (k === 'arrowleft' || k === 'pageup') { e.preventDefault(); if (pf) pf.flipPrev(); }
      else if (k === 'escape') { closeBook(); }
      return;
    }
    if (k === 'arrowright' || k === 'pagedown') { pageStep(1); }
    else if (k === 'arrowleft' || k === 'pageup') { pageStep(-1); }
    else if (k === 'b') { openBook(); }
    else if (k === 'escape') { openReader(false); }
  });

})();
