/* ============================================================
   paginate.js
   Flows the content of #source into fixed-size .page sheets the
   way a LaTeX class would. Two layout formats are supported:
     · IEEE     - two columns per sheet
     · Springer - single column per sheet
   The paginator is format-agnostic; it appends one top-level
   block at a time into a page body with `column-fill: auto` and
   a fixed height, and starts a new sheet when a block overflows.
   ============================================================ */
(function (global) {
  'use strict';

  // Always paginate into real sheets - even on phones - so the two-column
  // paper identity is preserved; narrow screens scale the sheet to fit.
  var FLOW_BREAKPOINT = 0;

  var doc, src, blocks = [], mode = null, format = 'ieee';

  /* ---------- setup ---------- */

  function romanize(n) {
    var map = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']], out = '';
    map.forEach(function (p) { while (n >= p[0]) { out += p[1]; n -= p[0]; } });
    return out;
  }

  /** Headings wherever they currently live - in `src` at first run, or held
   *  in the `blocks` refs once the document has been laid out into pages. */
  function headingEls() {
    if (blocks.length) {
      return blocks.filter(function (b) {
        return b.nodeType === 1 && b.classList &&
          (b.classList.contains('sec') || b.classList.contains('sub'));
      });
    }
    return Array.prototype.slice.call(src.querySelectorAll('.sec, .sub'));
  }

  /** Write section/subsection numerals into the headings. CSS counters can't
   *  be used because pagination splits headings across separate .page
   *  subtrees. IEEE uses "I."/"A."; Springer uses "1"/"1.1". */
  function numberHeadings() {
    var sec = 0, sub = 0, springer = format === 'springer';
    headingEls().forEach(function (h) {
      var old = h.querySelector('.num');
      if (old) old.remove();
      if (h.classList.contains('sec')) {
        sub = 0;
        if (h.classList.contains('unnum')) return;
        sec++;
        h.insertAdjacentHTML('afterbegin',
          '<span class="num">' + (springer ? sec + ' ' : romanize(sec) + '. ') + '</span>');
      } else {
        sub++;
        h.insertAdjacentHTML('afterbegin',
          '<span class="num">' +
          (springer ? sec + '.' + sub + ' ' : String.fromCharCode(64 + sub) + '. ') +
          '</span>');
      }
    });
  }

  /** Render the skill-matrix proficiency dots from data-lvl. */
  function renderLevels() {
    src.querySelectorAll('td.lvl').forEach(function (td) {
      var n = Math.max(0, Math.min(5, parseInt(td.dataset.lvl, 10) || 0));
      td.textContent = '●'.repeat(n) + '○'.repeat(5 - n);
      td.setAttribute('aria-label', n + ' out of 5');
    });
  }

  /** Wrap tables once so they can scroll horizontally if ever needed. */
  function wrapTables() {
    src.querySelectorAll(':scope > .tbl').forEach(function (t) {
      var w = document.createElement('div');
      w.className = 'tbl-wrap';
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    });
  }

  /* ---------- page construction ---------- */

  function formatName() { return format === 'springer' ? 'Springer LNCS' : 'IEEE conference'; }

  function runningHead() {
    var name = (src.querySelector('.au-name') || {}).textContent || 'Author';
    var d = new Date();
    var month = d.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    return 'PORTFOLIO OF ' + name.toUpperCase() +
           ' · CURRICULUM VITÆ, VOL. 1, NO. 1, ' + month + ' ' + d.getFullYear();
  }

  function addPage(n) {
    var page = document.createElement('article');
    page.className = 'page';
    page.setAttribute('aria-label', 'Page ' + n);
    page.dataset.page = n;
    page.style.animationDelay = Math.min(n - 1, 6) * 40 + 'ms';

    var head = document.createElement('header');
    head.className = 'run-head';
    head.innerHTML = '<span class="rh-l"></span><span class="rh-r"></span>';
    head.querySelector('.rh-l').textContent = runningHead();
    head.querySelector('.rh-r').textContent = n;

    var body = document.createElement('div');
    body.className = 'page-body';

    var foot = document.createElement('footer');
    foot.className = 'run-foot';
    if (n === 1) {
      foot.innerHTML = '<span>Compiled ' +
        new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        '. Typeset in ' + formatName() + ' format.</span><span>1 of <span class="tot"></span></span>';
    } else {
      foot.innerHTML = '<span></span><span>' + n + ' of <span class="tot"></span></span>';
    }

    page.append(head, body, foot);
    doc.appendChild(page);
    return body;
  }

  /** True when the last appended block spilled past the content box. */
  function overflows(body) {
    var last = body.lastElementChild;
    if (!last) return false;
    if (body.scrollWidth > body.clientWidth + 1) return true;
    var br = body.getBoundingClientRect(), lr = last.getBoundingClientRect();
    return lr.right > br.right + 1 || lr.bottom > br.bottom + 1;
  }

  function reclaim() {
    blocks.forEach(function (b) { src.appendChild(b); });
    doc.textContent = '';
  }

  function finish(pages) {
    doc.querySelectorAll('.run-foot .tot').forEach(function (s) { s.textContent = pages; });
    document.dispatchEvent(new CustomEvent('paper:rendered', { detail: { pages: pages, mode: mode, format: format } }));
  }

  /* ---------- render modes ---------- */

  function renderPaged() {
    reclaim();
    doc.className = 'doc';
    var n = 1, body = addPage(n);

    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      body.appendChild(b);
      if (overflows(body) && body.children.length > 1) {
        body.removeChild(b);
        body = addPage(++n);
        body.appendChild(b);
      }
    }
    finish(n);
  }

  function renderFlow() {
    reclaim();
    doc.className = 'doc flow';
    var body = addPage(1);
    blocks.forEach(function (b) { body.appendChild(b); });
    finish(1);
  }

  /* ---------- public ---------- */

  function render(force, override) {
    // `override` ('paged'|'flow') forces a layout regardless of width.
    var want = override || ((global.innerWidth < FLOW_BREAKPOINT) ? 'flow' : 'paged');
    if (!force && want === mode) return;
    mode = want;
    (want === 'flow' ? renderFlow : renderPaged)();
  }

  /** Switch the document between 'ieee' (two-column) and 'springer'
   *  (single-column) - re-numbers headings and re-paginates. */
  function setFormat(f) {
    if ((f !== 'ieee' && f !== 'springer') || f === format) return;
    format = f;
    document.body.classList.toggle('fmt-springer', f === 'springer');
    numberHeadings();
    render(true);
  }

  function init() {
    doc = document.getElementById('doc');
    src = document.getElementById('source');
    numberHeadings();
    renderLevels();
    wrapTables();
    blocks = Array.prototype.slice.call(src.children);
    // Flatten publication lists so each entry paginates on its own. A whole
    // <ol> is one atomic block that jumps to the next page, leaving a large
    // blank column behind it.
    var flat = [];
    blocks.forEach(function (b) {
      if (b.classList && b.classList.contains('pubs')) {
        Array.prototype.slice.call(b.children).forEach(function (li) { flat.push(li); });
      } else { flat.push(b); }
    });
    blocks = flat;
    render(true);
  }

  global.Paper = {
    init: init,
    render: render,
    setFormat: setFormat,
    get mode() { return mode; },
    get format() { return format; },
    get pageCount() { return doc ? doc.children.length : 0; }
  };

})(window);
