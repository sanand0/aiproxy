export default {
  async fetch(request, env) {
    // We use plugins to handle different LLMs.
    // The plugin is the first part of the path between /.../ -- e.g. /openai/
    const url = new URL(request.url);
    const plugin = url.pathname.split("/")[1];

    // Let the user know if there's no plugin or an unknown plugin
    if (!plugin) return jsonResponse({ code: 200, message: "See docs at https://github.com/sanand0/aiproxy" });
    if (!plugins[plugin]) return jsonResponse({ code: 404, error: `Unknown plugin: ${plugin}` });

    const { method, url: targetUrl, headers, body } = await plugins[plugin].request({ url, request, env });

    const proxyRequest = new Request(targetUrl, {
      method,
      headers: skipHeaders(headers, skipRequestHeaders),
      body,
    });
    const response = await fetch(proxyRequest);
    const { readable, writable } = new TransformStream();
    response.body.pipeTo(writable);

    return new Response(readable, {
      headers: skipHeaders(response.headers, skipResponseHeaders),
      status: response.status,
      statusText: response.statusText,
    });
  },
};

const plugins = {
  openai: {
    request: async function ({ url, request, env: { OPENAI_API_KEY } }) {
      // Strip the plugin part of the URL to get the target URL
      const targetPath = url.pathname.replace(/^\/openai\//, "/");
      const headers = skipHeaders(request.headers, []);
      headers.append("Authorization", `Bearer ${OPENAI_API_KEY}`);
      return {
        url: `https://api.openai.com${targetPath}${url.search}`,
        method: request.method,
        headers,
        body: request.body,
      };
    },
  },
};

const skipRequestHeaders = [/^content-length$/i, /^host$/i, /^cf-.*$/i, /^connection$/i, /^accept-encoding$/i];
const skipResponseHeaders = [/^content-length$/i, /^transfer-encoding$/i, /^connection$/i];

function skipHeaders(headers, skipList) {
  const result = new Headers();
  for (const [key, value] of headers) if (!skipList.some((pattern) => pattern.test(key))) result.append(key, value);
  return result;
}

function jsonResponse({ code, ...rest }) {
  return new Response(JSON.stringify(rest), {
    status: code,
    headers: { "content-type": "application/json" },
  });
}
