/*
 * Adapted from the hugo-book theme by Alex Shpak
 *
 *   The MIT License (MIT)
 *
 *   Copyright (c) 2018 Alex Shpak
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of
 *   this software and associated documentation files (the "Software"), to deal in
 *   the Software without restriction, including without limitation the rights to
 *   use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 *   the Software, and to permit persons to whom the Software is furnished to do so,
 *   subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 *   FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 *   COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 *   IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 *   CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

'use strict';

{{- $KEY_RETURN := 13 -}}
{{- $KEY_ESC    := 27 -}}
{{- $KEY_UP     := 38 -}}
{{- $KEY_DOWN   := 40 -}}

{{ $searchData := resources.Get "js/search-data.tpl.js" | resources.ExecuteAsTemplate "js/search-data.js" . | minify | fingerprint }}

(function() {
  const icon = document.querySelector('.Search-icon');
  const form = document.querySelector('.Search-form');
  const input = document.querySelector('.Search-input');
  const results = document.querySelector('.Search-results');

  if (!form || !input || !results) {
    return
  }

  // The search icon acts as the submit button when Javascript is not enabled.
  // However, when Javascript *is* enabled form submission is disabled in favor
  // of selecting one of the search items directly. In order to avoid
  // confusion, remove the 'cursor: pointer' style directive on the icon.
  icon.style.cursor = 'auto';

  let timer = undefined;
  form.addEventListener('submit', submit);
  form.addEventListener('keydown', navigate);
  form.addEventListener('blur', function() {
    timer = setTimeout(function() { clearResults(); }, 20);
  }, true);
  form.addEventListener('focus', function() { if (timer) clearTimeout(timer); }, true);

  input.addEventListener('focus', init);
  input.addEventListener('keyup', search);

  // Close search results on escape
  document.addEventListener('keyup', function(e) { if (e.keyCode === {{ $KEY_ESC }}) clearResults(); });

  function init() {
    input.removeEventListener('focus', init); // init once
    input.required = true;

    loadScript('{{ "js/flexsearch.min.js" | relURL }}');
    loadScript('{{ $searchData.RelPermalink }}', function() {
      input.required = false;
      search();
    });

    input.addEventListener('focus', search);
  }

  function clearResults() {
    while (results.firstChild) {
      results.removeChild(results.firstChild);
    }
    results.style.display = '';
  }

  function submit(event) {
    event.preventDefault();
    let selected = results.querySelector('li.selected');
    if (!selected) {
      return;
    }

    let href = selected.querySelector('a').href;
    window.location.href = href;
  }

  function select(event) {
    let items = results.querySelectorAll('li');
    let selected = results.querySelector('li.selected');
    if (selected) {
      selected.classList.remove('selected');
    }

    event.target.classList.add('selected');
  }

  function deselect(event) {
    event.target.classList.remove('selected');
  }

  function navigate(event) {
    let key = event.keyCode;
    if (![{{ $KEY_UP }}, {{ $KEY_DOWN }}].includes(key)) {
      return;
    }

    event.preventDefault();
    let items = results.querySelectorAll('li');

    if (!items.length) {
      return;
    }

    let current = undefined;
    let selected = results.querySelector('li.selected');

    if (key == {{ $KEY_DOWN }}) {
      if (!selected || !selected.nextElementSibling) {
        current = items[0];
      } else {
        current = selected.nextElementSibling;
      }
    } else {
      if (!selected || !selected.previousElementSibling) {
        current = items[items.length - 1];
      } else {
        current = selected.previousElementSibling;
      }
    }

    current.focus();
  }

  function search(event) {
    if (event && [{{ $KEY_UP }}, {{ $KEY_DOWN }}].includes(event.keyCode)) {
      return;
    }

    clearResults();

    if (!input.value) {
      return;
    }

    window.searchIndex.search(input.value, 10, function(hits) {
      hits.forEach(function(hit) {
        let li = createResultItem(hit);
        results.appendChild(li);
      });
      results.style.display = 'block';
    });
  }

  function createResultItem(page) {
    const li = document.createElement('li');
    const a = li.appendChild(document.createElement('a'));

    li.tabIndex = 0;
    li.addEventListener('mouseenter', select);
    li.addEventListener('focus', select);
    li.addEventListener('mouseleave', deselect);
    li.addEventListener('click', submit);
    li.addEventListener('keyup', function(e) { if (e.keyCode === {{ $KEY_RETURN }}) submit(e); });

    a.tabIndex = -1;
    a.href = page.href;
    a.title = page.title;
    a.textContent = page.title;

    return li;
  }

  /**
   * @param {String} src
   * @param {Function} callback
   */
  function loadScript(src, callback) {
    const script = document.createElement('script');
    script.defer = true;
    script.async = false;
    script.src = src;
    script.onload = callback;

    document.head.appendChild(script);
  }
})();
