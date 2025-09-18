function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getFallbackResponse(query) {
  const responses = [
    `
    <div>
      <p>I found some information related to "<b class="query">${escapeHtml(query)}</b>",</p>
      <p>but I couldn’t generate a full response right now.</p>
      <p>You can check the details below or try a different query.</p>
    </div>
    `,
    `
    <div>
      <p>Here’s what I found about "<b class="query">${escapeHtml(query)}</b>".</p>
      <p>The details may be limited at the moment,</p>
      <p>but you can explore the results below or refine your search.</p>
    </div>
    `,
    `
    <div>
      <p>I was able to find some results for "<b class="query">${escapeHtml(query)}</b>",</p>
      <p>but they don’t contain enough detail for a complete answer.</p>
      <p>Try checking the results below or ask another question.</p>
    </div>
    `,
    `
    <div>
      <p>There is some information available on "<b class="query">${escapeHtml(query)}</b>",</p>
      <p>though it’s not detailed enough right now.</p>
      <p>You can review the results below or try a new query.</p>
    </div>
    `
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}


module.exports = { getFallbackResponse, escapeHtml }