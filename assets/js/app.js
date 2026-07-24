/* ============================================================
   app.js - reader chrome: theme, zoom, outline, scroll-spy,
   citation popovers, BibTeX copy, keyboard shortcuts.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS = 'portfolio.prefs';

  var prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { prefs = {}; }
  function save() { try { localStorage.setItem(LS, JSON.stringify(prefs)); } catch (e) {} }

  /* ---------------- theme ---------------- */

  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    prefs.theme = t; save();
  }
  setTheme(prefs.theme ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  /* ---------------- zoom ---------------- */

  /* Zoom is a CSS transform on the sheet stack - like a real PDF viewer,
     the layout never re-flows, it only scales. #docSizer reserves the
     scaled footprint so scrolling stays correct. Pagination is fixed at
     a single layout base, so the page count never jumps while zooming. */
  var ZMIN = 0.3, ZMAX = 2.6, z = 1, natW = 0, natH = 0;

  function measureNatural() {
    var d = $('#doc');
    natW = d.offsetWidth; natH = d.offsetHeight;   // layout box, ignores transform
  }

  function applyScale(nz, quiet) {
    z = Math.max(ZMIN, Math.min(ZMAX, nz));
    var doc = $('#doc'), sizer = $('#docSizer');
    if (window.Paper.mode === 'flow') {           // mobile: never scale
      doc.style.transform = ''; sizer.style.width = ''; sizer.style.height = '';
      $('#zoomLabel').textContent = '100%';
      return;
    }
    if (!natW) measureNatural();
    doc.style.transform = 'scale(' + z + ')';
    sizer.style.width = Math.round(natW * z) + 'px';
    sizer.style.height = Math.round(natH * z) + 'px';
    $('#zoomLabel').textContent = Math.round(z * 100) + '%';
    if (!quiet) { prefs.z = z; save(); }
  }

  function zoomBy(f) { applyScale(z * f); }

  /** Initial scale so a full sheet fits the viewer width (never upscaled). */
  function fitScale() {
    measureNatural();
    if (!natW) return 1;
    var avail = $('#viewer').clientWidth - (innerWidth < 700 ? 16 : 48);
    return Math.max(ZMIN, Math.min(1, avail / natW));
  }

  /* ---------------- outline ---------------- */

  var headings = [];

  function buildOutline() {
    var list = $('#outlineList');
    list.textContent = '';
    headings = $$('#doc .sec, #doc .sub');

    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'h-' + i;
      var page = h.closest('.page');
      var li = document.createElement('li');
      li.className = h.classList.contains('sub') ? 'lvl-2' : 'lvl-1';
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.innerHTML = '<span class="ol-t"></span>' +
        (window.Paper.mode === 'paged' ? '<span class="ol-pg"></span>' : '');
      $('.ol-t', a).textContent = h.textContent.trim();
      if (page && $('.ol-pg', a)) $('.ol-pg', a).textContent = page.dataset.page;
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function spy() {
    var y = scrollY + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tb-h')) || 48) + 40;
    var active = null;
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top + scrollY <= y) active = headings[i]; else break;
    }
    $$('#outlineList a').forEach(function (a) {
      a.classList.toggle('active', !!active && a.getAttribute('href') === '#' + active.id);
    });
  }

  function progress() {
    var max = document.documentElement.scrollHeight - innerHeight;
    var p = max > 0 ? Math.min(1, scrollY / max) : 0;
    $('#progress span').style.width = (p * 100) + '%';
    var pages = $$('#doc .page');
    if (pages.length && window.Paper.mode === 'paged') {
      var cur = 1;
      pages.forEach(function (pg) { if (pg.getBoundingClientRect().top < innerHeight * 0.4) cur = +pg.dataset.page; });
      $('#tbPages').textContent = '· page ' + cur + ' of ' + pages.length;
    } else {
      $('#tbPages').textContent = '· continuous view';
    }
  }

  var ticking = false;
  addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { spy(); progress(); ticking = false; });
  }, { passive: true });

  /* ---------------- citation popovers ---------------- */

  var pop;
  function showPop(a) {
    var ref = document.getElementById((a.getAttribute('href') || '').slice(1));
    if (!ref) return;
    if (!pop) { pop = document.createElement('div'); pop.className = 'cite-pop'; document.body.appendChild(pop); }
    pop.innerHTML = '<b>Reference</b>';
    pop.appendChild(document.createTextNode(ref.textContent.trim()));

    var r = a.getBoundingClientRect();
    pop.style.left = '0px'; pop.style.top = '0px';
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.max(8, Math.min(innerWidth - w - 8, r.left + scrollX - w / 2 + r.width / 2));
    var top = r.top + scrollY - h - 10;
    if (top - scrollY < 60) top = r.bottom + scrollY + 10;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    pop.classList.add('show');
  }
  function hidePop() { if (pop) pop.classList.remove('show'); }

  function bindDocument() {
    $$('#doc a.cite').forEach(function (a) {
      a.addEventListener('mouseenter', function () { showPop(a); });
      a.addEventListener('focus', function () { showPop(a); });
      a.addEventListener('mouseleave', hidePop);
      a.addEventListener('blur', hidePop);
    });

    $$('#doc .bib-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var pre = document.getElementById(b.dataset.bib);
        if (!pre) return;
        navigator.clipboard.writeText(pre.textContent.trim())
          .then(function () { toast('BibTeX entry copied to clipboard'); })
          .catch(function () { toast('Could not access the clipboard'); });
      });
    });

    /* Links that still point at a placeholder should say so rather than
       silently jumping to the top of the page. */
    $$('#doc a[href="#"][data-need]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        toast('Placeholder link: “' + a.dataset.need + '” not set yet');
      });
    });
  }

  /* ---------------- toast ---------------- */

  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ---------------- outline open/close ---------------- */

  function setOutline(open) {
    document.body.classList.toggle('outline-open', open);
    $('#scrim').hidden = !(open && innerWidth < 1100);
    $('#btnOutline').setAttribute('aria-expanded', String(open));
    prefs.outline = open; save();
  }

  /* ---------------- wiring ---------------- */

  document.addEventListener('paper:rendered', function () {
    buildOutline();
    bindDocument();
    measureNatural();
    applyScale(z, true);          // re-reserve footprint after a re-render
    spy(); progress();
  });

  window.Paper.init();
  applyScale(prefs.z || fitScale(), true);
  setOutline(prefs.outline !== undefined ? prefs.outline : innerWidth >= 1100);

  $('#btnTheme').addEventListener('click', function () {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  $('#btnZoomIn').addEventListener('click', function () { zoomBy(1.15); });
  $('#btnZoomOut').addEventListener('click', function () { zoomBy(1 / 1.15); });
  $('#btnPrint').addEventListener('click', function () { print(); });
  $('#btnOutline').addEventListener('click', function () {
    setOutline(!document.body.classList.contains('outline-open'));
  });
  $('#scrim').addEventListener('click', function () { setOutline(false); });
  $('#btnPh').addEventListener('click', function () {
    document.body.classList.toggle('show-ph');
    $('#btnPh').textContent = document.body.classList.contains('show-ph')
      ? 'Hide placeholder highlights' : 'Highlight placeholders';
  });

  $('#outlineList').addEventListener('click', function (e) {
    if (e.target.closest('a') && innerWidth < 1100) setOutline(false);
  });

  addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    var k = e.key.toLowerCase();
    if (k === 't') { $('#btnTheme').click(); }
    else if (k === 'o') { $('#btnOutline').click(); }
    else if (k === '+' || k === '=') { zoomBy(1.15); }
    else if (k === '-') { zoomBy(1 / 1.15); }
    else if (k === 'escape') { setOutline(false); hidePop(); }
  });

  var rzTimer, lastW = innerWidth;
  addEventListener('resize', function () {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function () {
      var was = window.Paper.mode;
      window.Paper.render(false);          // switches paged <-> flow when needed
      // Keep the sheet fitting the window on width changes; a mode switch
      // re-fits, otherwise preserve the user's chosen zoom.
      if (window.Paper.mode !== was) { z = fitScale(); }
      applyScale(z, true);
      $('#scrim').hidden = !(document.body.classList.contains('outline-open') && innerWidth < 1100);
      lastW = innerWidth;
    }, 180);
  });

  // expose for the enhancement layer (book mode reuses the layout base)
  window.PaperView = { applyScale: function (v) { applyScale(v); }, fitScale: fitScale, get zoom() { return z; } };

})();
