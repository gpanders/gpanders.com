(function () {
  var header = document.querySelector(".Search-header");
  const match = window.location.href.match(/\?q=(.+)/);
  if (!match) {
    header.innerText = "No search query provided.";
    return;
  }

  const query = match[1];
  header.innerText = 'Searching for "' + query + '"...';

  const re = new RegExp(query.toLowerCase());
  var httpRequest = new XMLHttpRequest();

  httpRequest.onreadystatechange = function () {
    if (httpRequest.readyState === 4) {
      if (httpRequest.status !== 200) {
        header.innerText =
          "Something went wrong while searching. Please try again.";
        return;
      }

      document
        .querySelectorAll(".Search-query")
        .forEach((el) => (el.innerText = query));

      const keys = ["title", "permalink", "tags", "contents"];
      const data = JSON.parse(httpRequest.responseText);
      var results = data.filter((item) => {
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          if (item[key]) {
            if (key === "tags") {
              if (item[key].some((tag) => re.test(tag.toLowerCase()))) {
                return true;
              }
            } else if (re.test(item[key].toLowerCase())) {
              return true;
            }
          }
        }

        return false;
      });

      var numResults = results.length;
      if (numResults === 0) {
        header.innerText = 'No results found for "' + query + '"';
      } else {
        header.innerText =
          "Found " +
          numResults +
          " result" +
          (numResults > 1 ? "s" : "") +
          ' for "' +
          query +
          '"';

        var searchItems = "";
        for (var i = 0; i < numResults; i++) {
          searchItems +=
            '<li class="List-item">' +
            '<h3 class="List-link"><a href="' +
            results[i].permalink +
            '" tabindex="0">' +
            results[i].title +
            "</a></h3>" +
            "<time>" +
            results[i].date +
            "</time>" +
            "</li>";
        }

        document.querySelector(".Search-results").innerHTML = searchItems;
      }
    }
  };

  httpRequest.open("GET", "/index.json");
  httpRequest.send();
})();
