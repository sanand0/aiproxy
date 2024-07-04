import * as jose from "jose";

export default {
  async fetch(request, env) {
    // We use plugins to handle different LLMs.
    // The plugin is the first part of the path between /.../ -- e.g. /openai/
    const url = new URL(request.url);
    const plugin = url.pathname.split("/")[1];

    // Let the user know if there's no plugin or an unknown plugin
    if (!plugin) return jsonResponse({ code: 200, message: "See docs at https://github.com/sanand0/aiproxy" });
    if (!plugins[plugin]) return jsonResponse({ code: 404, message: `Unknown plugin: ${plugin}` });

    // Get the Authorization: Bearer token, stripping the "Bearer " and whitespace
    const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/, "").trim();
    let payload;
    if (!token)
      return jsonResponse({
        code: 401,
        message: "Missing Authorization: Bearer header. See https://github.com/sanand0/aiproxy",
      });
    const secret = new TextEncoder().encode(env.AIPROXY_TOKEN_SECRET);
    try {
      payload = (await jose.jwtVerify(token, secret)).payload;
      if (!payload.email)
        return jsonResponse({ code: 401, message: `Bearer ${token} is invalid: email not found in payload` });
    } catch (err) {
      return jsonResponse({ code: 401, message: `Bearer ${token} is invalid: ${err}` });
    }

    // Check if user has quota left
    const today = new Date().toISOString().split("T")[0];
    const usage = await mongoRequest("findOne", { filter: { user: payload.email, date: today } }, env);
    if (usage.error) return jsonResponse({ code: 500, message: `MongoDB error: ${usage.error}` });
    const dailyCost = usage?.document?.dailyCost;
    const limit = 1.0;
    if (dailyCost > limit)
      return jsonResponse({ code: 429, message: `On ${today} you used $${dailyCost}, exceeding $${limit}` });

    let body;
    try {
      body = await plugins[plugin].validate(request);
    } catch (err) {
      return jsonResponse({ code: err.code, message: err.message });
    }

    const { method, url: targetUrl, headers } = await plugins[plugin].request({ url, request, env });

    const response = await fetch(targetUrl, {
      method,
      headers: skipHeaders(headers, skipRequestHeaders),
      body: JSON.stringify(body),
    });
    const result = await response.json();

    result.dailyCost = plugins[plugin].cost(result) + (usage.document?.dailyCost ?? 0);
    result.dailyRequests = 1 + (usage.document?.dailyRequests ?? 0);
    if (usage.document)
      await mongoRequest(
        "updateOne",
        {
          filter: { user: payload.email, date: today },
          update: { $set: { dailyCost: result.dailyCost, dailyRequests: result.dailyRequests } },
        },
        env,
      );
    else
      await mongoRequest(
        "insertOne",
        { document: { user: payload.email, date: today, dailyCost: result.dailyCost, dailyRequests: 1 } },
        env,
      );

    return new Response(JSON.stringify(result, null, 2), {
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
      headers.set("Authorization", `Bearer ${OPENAI_API_KEY}`);
      return {
        url: `https://api.openai.com${targetPath}${url.search}`,
        method: request.method,
        headers,
      };
    },
    validate: async function (request) {
      const url = new URL(request.url);
      // Ensure that the body is valid JSON
      let body;
      try {
        body = request.method == "POST" ? await request.json() : undefined;
      } catch (err) {
        throw new CustomError({ code: 400, message: `Invalid JSON body: ${err}` });
      }
      // Ensure that the model is valid
      if (body && body.model && !["text-embedding-3-small", "gpt-3.5-turbo"].includes(body.model))
        throw new CustomError({ code: 400, message: `Invalid model: ${body.model}` });
      // Allow only requests to /chat/completions, /embeddings, /models
      if (
        url.pathname != "/openai/v1/chat/completions" &&
        url.pathname != "/openai/v1/embeddings" &&
        url.pathname != "/openai/v1/models"
      )
        throw new CustomError({ code: 400, message: `Invalid path: ${url.pathname}` });
      // Ensure that the streaming is disabled
      if (body && body.stream) throw new CustomError({ code: 400, message: `Streaming is not supported` });
      return body;
    },
    cost: function (result) {
      return result.model == "text-embedding-3-small"
        ? (0.02 / 1e6) * result.usage?.prompt_tokens
        : result.model.match(/gpt-3.5-turbo/)
          ? (3 / 1e6) * result.usage?.prompt_tokens + (6 / 1e6) * result.usage?.completion_tokens
          : 0;
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

async function mongoRequest(action, params, { MONGODB_API_KEY, MONGODB_APP_ID }) {
  return await fetch(`https://data.mongodb-api.com/app/${MONGODB_APP_ID}/endpoint/data/v1/action/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      apiKey: MONGODB_API_KEY,
    },
    body: JSON.stringify({ dataSource: "iitm-tds", database: "iitm-tds-usage", collection: "user", ...params }),
  }).then((r) => r.json());
}

function jsonResponse({ code, ...rest }) {
  return new Response(JSON.stringify(rest, null, 2), {
    status: code,
    headers: { "content-type": "application/json" },
  });
}

class CustomError extends Error {
  constructor({ code, message }) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
  }
}
