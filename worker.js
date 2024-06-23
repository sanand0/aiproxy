export default {
  async fetch(request) {
    const { method, headers } = request;
    const url = new URL(request.url);
    const targetUrl = `https://api.openai.com${url.pathname}${url.search}`;

    const proxyRequest = new Request(targetUrl, {
      method,
      headers: skipHeaders(headers, skipRequestHeaders),
      body: request.body,
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

const skipRequestHeaders = [/^content-length$/i, /^host$/i, /^cf-.*$/i, /^connection$/i, /^accept-encoding$/i];
const skipResponseHeaders = [/^content-length$/i, /^transfer-encoding$/i, /^connection$/i];

function skipHeaders(headers, skipList) {
  const result = new Headers();
  for (const [key, value] of headers) if (!skipList.some((pattern) => pattern.test(key))) result.append(key, value);
  return result;
}
