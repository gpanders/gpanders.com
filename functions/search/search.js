const fetch = require("node-fetch");
const lunr = require("lunr");

exports.handler = async (event, context) => {
  try {
    let results = [];
    const query = event.queryStringParameters.q;
    if (query) {
      const host = "https://gpanders.com";
      const urls = ["search/index.json", "lunr.json"];
      const headers = { Accept: "application/json" };
      const tasks = await Promise.all(
        urls.map(url => fetch(`${host}/${url}`, { headers: headers }))
      );

      for (let i = 0; i < tasks.length; i++) {
        if (!tasks[i].ok) {
          return { statusCode: tasks[i].status, body: tasks[i].statusText };
        }
      }

      const items = await tasks[0].json();
      const index = lunr.Index.load(await tasks[1].json());
      results = index
        .search(query)
        .map(result => items.filter(item => item.title == result.ref)[0]);
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
