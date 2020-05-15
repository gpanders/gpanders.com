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
  form.addEventListener('blur', function() { timer = setTimeout(function() { clearResults(); }, 20); }, true);
  form.addEventListener('focus', function() { if (timer) clearTimeout(timer); }, true);

  form.addEventListener('keydown', navigate);

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
    results.style.display = 'none';
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

    const searchHits = window.searchIndex.search(input.value, 10);
    searchHits.forEach(function(page) {
      let li = createResultItem(page);
      results.appendChild(li);
    });

    results.style.display = '';
  }

  function createResultItem(page) {
    const li = document.createElement('li');
    const a = li.appendChild(document.createElement('a'));
    const section = li.appendChild(document.createElement('small'));

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
    section.innerText = page.section;

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
