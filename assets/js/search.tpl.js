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

// Search-as-you-type dropdown backed by the search Worker (src/index.ts).
// Submitting the form without a selected result goes to the full results
// page at /search/, which is also what happens when JavaScript is disabled.
(() => {
  const form = document.querySelector('.search-form');
  const input = document.querySelector('.search-input > input');
  const results = document.querySelector('.search-results');

  if (!form || !input || !results) {
    return
  }

  const endpoint = '{{ "api/search" | relURL }}';
  const debounceMs = 150;

  let blurTimer = undefined;
  let debounceTimer = undefined;
  let pending = undefined; // AbortController for the in-flight request

  form.addEventListener('submit', submit);
  form.addEventListener('keydown', navigate);
  form.addEventListener('blur', () => {
    blurTimer = setTimeout(() => clearResults(), 20);
  }, true);
  form.addEventListener('focus', () => { if (blurTimer) clearTimeout(blurTimer); }, true);

  input.addEventListener('input', search);
  input.addEventListener('focus', search);

  // Close search results on escape
  document.addEventListener('keyup', e => { if (e.keyCode === {{ $KEY_ESC }}) clearResults(); });

  function clearResults() {
    while (results.firstChild) {
      results.removeChild(results.firstChild);
    }
    results.style.display = 'none';
  }

  function submit(event) {
    let selected = results.querySelector('li.selected');
    if (!selected) {
      // No result picked: let the form submit to the full results page.
      return;
    }

    event.preventDefault();
    window.location.href = selected.querySelector('a').href;
  }

  function select(event) {
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

  function search() {
    clearTimeout(debounceTimer);

    const query = input.value.trim();
    if (!query) {
      if (pending) {
        pending.abort();
      }
      clearResults();
      return;
    }

    debounceTimer = setTimeout(() => fetchResults(query), debounceMs);
  }

  async function fetchResults(query) {
    if (pending) {
      pending.abort();
    }
    const controller = new AbortController();
    pending = controller;

    let data;
    try {
      const response = await fetch(endpoint + '?q=' + encodeURIComponent(query), {
        signal: controller.signal,
      });
      if (!response.ok) {
        return;
      }
      data = await response.json();
    } catch (e) {
      // Aborted by a newer query, or a network error: keep what's shown.
      return;
    }

    if (controller !== pending) {
      return;
    }

    clearResults();
    data.results.forEach(hit => results.appendChild(createResultItem(hit)));
    if (data.results.length) {
      results.style.display = '';
    }
  }

  function createResultItem(page) {
    const li = document.createElement('li');
    const a = li.appendChild(document.createElement('a'));

    li.tabIndex = 0;
    li.addEventListener('mouseenter', select);
    li.addEventListener('focus', select);
    li.addEventListener('mouseleave', deselect);
    li.addEventListener('click', submit);
    li.addEventListener('keyup', e => { if (e.keyCode === {{ $KEY_RETURN }}) submit(e); });

    a.tabIndex = -1;
    a.href = page.href;
    a.title = page.snippet || page.title;
    a.textContent = page.title;

    return li;
  }
})();
