'use strict';

(function() {
  const indexCfg = { 'cache': true };
  indexCfg.doc = {
    id: 'id',
    field: ['title', 'content'],
    store: ['title', 'href', 'section'],
  };

  const index = FlexSearch.create('balance', indexCfg);
  window.searchIndex = index;

  {{- range $index, $page := .Site.RegularPages -}}
  index.add({
    'id': {{ $index }},
    'href': '{{ $page.RelPermalink }}',
    'title': {{ $page.Title | jsonify }},
    'content': {{ $page.Plain | jsonify }},
    'section': {{ (humanize $page.Section) | jsonify }},
  });
  {{- end -}}
})();
