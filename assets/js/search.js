(function () {
	const header = document.querySelector(".Search-header");
	const match = window.location.href.match(/\?q=([^&]+)/);
	if (!match) {
		header.innerText = "No search query provided.";
		return;
	}

	const query = decodeURIComponent(match[1].replace(/\+/g, " "));
	header.innerText = 'Searching for "' + query + '"...';

	var httpRequest = new XMLHttpRequest();
	httpRequest.onreadystatechange = function () {
		if (httpRequest.readyState !== 4) {
			return;
		}

		if (httpRequest.status !== 200) {
			header.innerText =
				"Something went wrong while searching. Please try again.";
			return;
		}

		const results = JSON.parse(httpRequest.responseText);
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
		results.forEach(function (result) {
			searchItems +=
				'<li class="List-item">' +
				'<h2 class="List-link"><a href="' +
				result.permalink +
				'" tabindex="0">' +
				result.title +
				"</a></h2>" +
				'<time datetime="' +
				result.date +
				'">' +
				new Date(result.date).toLocaleDateString("en-US", {
					year: "numeric",
					month: "long",
					day: "numeric",
				}) +
				"</time>" +
				"</li>";
		});

		document.querySelector(".Search-results").innerHTML = searchItems;
	};

	httpRequest.open("GET", "/.netlify/functions/search?q=" + query);
	httpRequest.send();
})();
