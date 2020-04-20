(function() {
	const header = document.querySelector(".Search-header");
	const match = window.location.href.match(/\?q=([^&]+)/);
	if (!match) {
		header.innerText = "No search query provided.";
		return;
	}

	const query = decodeURIComponent(match[1].replace(/\+/g, " "));
	header.innerText = 'Searching for "' + query + '"...';

	const pat = new RegExp(
		query.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	);

	const keys = ["title", "permalink", "tags", "contents"];
	function search(item) {
		for (var i = 0; i < keys.length; i++) {
			const key = keys[i];
			if (!item[key]) {
				continue;
			}

			if (key === "tags") {
				if (item[key].some(tag => pat.test(tag.toLowerCase()))) {
					return true;
				}
			} else if (pat.test(item[key].toLowerCase())) {
				return true;
			}
		}

		return false;
	}

	var httpRequest = new XMLHttpRequest();
	httpRequest.onreadystatechange = function() {
		if (httpRequest.readyState !== 4) {
			return;
		}

		if (httpRequest.status !== 200) {
			header.innerText =
				"Something went wrong while searching. Please try again.";
			return;
		}

		const results = JSON.parse(httpRequest.responseText).filter(search);
		const numResults = results.length;
		if (numResults === 0) {
			header.innerText = 'No results found for "' + query + '"';
			return;
		}

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
				'<time datetime="' +
				results[i].date +
				'">' +
				new Date(results[i].date).toLocaleDateString("en-US", {
					year: "numeric",
					month: "long",
					day: "numeric"
				}) +
				"</time>" +
				"</li>";
		}

		document.querySelector(".Search-results").innerHTML = searchItems;
	};

	httpRequest.open("GET", "/index.json");
	httpRequest.send();
})();
