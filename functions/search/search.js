const fetch = require("node-fetch");
const lunr = require("lunr");

const buildIndex = (items) => {
  const idx = lunr(function () {
    this.ref("title");
    this.field("title");
    this.field("permalink");
    this.field("contents");
    this.field("tags");

    items.forEach((item) => this.add(item), this);
  });

  return JSON.parse(JSON.stringify(idx));
};

exports.handler = async (event, context) => {
  try {
    let results = [];
    const query = event.queryStringParameters.q;
    if (query) {
      const response = await fetch("https://gpanders.com/index.json", {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        // NOT res.status >= 200 && res.status < 300
        return { statusCode: response.status, body: response.statusText };
      }

      const items = await response.json();
      const index = lunr.Index.load(buildIndex(items));

      index.search(query).forEach((result) => {
        let item = items.filter((item) => item.title == result.ref)[0];
        delete item.contents;
        results.push(item);
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify(results),
      headers: {
        "Content-Type": "application/json",
      },
    };
  } catch (err) {
    console.log(err); // output to netlify function log
    return {
      statusCode: 500,
      body: JSON.stringify({ msg: err.message }), // Could be a custom message or object i.e. JSON.stringify(err)
    };
  }
};
