# AI Proxy

> [!WARNING]
> AI Proxy has been shut down in favor of [AI Pipe](https://aipipe.org/)

This is an authorizing proxy for LLMs.

## Usage

Log in at <https://aiproxy.sanand.workers.dev/> with your IITM email ID to get your AIPROXY_TOKEN.

Then, instead of sending an API request to `https://api.openai.com/`:

- Replace `https://api.openai.com/` with `https://aiproxy.sanand.workers.dev/openai/`
- Replace the OPENAI_API_KEY with the AIPROXY_TOKEN

For example:

```shell
curl -X POST http://aiproxy.sanand.workers.dev/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AIPROXY_TOKEN" \
  -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "What is 2 + 2"}]}'

curl -X POST http://aiproxy.sanand.workers.dev/openai/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AIPROXY_TOKEN" \
  -d '{"model": "text-embedding-3-small", "input": ["king", "queen"]}'
```

AI Proxy only supports these endpoints and models:

- `GET https://aiproxy.sanand.workers.dev/openai/v1/models`
- `POST https://aiproxy.sanand.workers.dev/openai/v1/embeddings`
  - `model: text-embedding-3-small`
- `POST https://aiproxy.sanand.workers.dev/openai/v1/chat/completions`
  - `model: gpt-4o-mini`

It returns a set of additional headers:

1. `cost`: Cost of this request in USD
2. `monthlyCost`: Total costs (in USD) of requests used this month. Monthly limit is $0.5 (resets at midnight UTC on the first of the next month).
3. `monthlyRequests`: Total requests made this month.

## How to set up this app (for admins, not users)

MongoDB setup

- Log into <https://cloud.mongodb.com/> as <anand@study.iitm.ac.in>
- Under Network Access, add [CloudFlare IP ranges](https://www.cloudflare.com/en-in/ips/)
- Create a cluster called `iitm-tds`
- Enable Data API

App setup

- Log into <https://dash.cloudflare.com/> as <root.node@gmail.com>
- Create a worker called `aiproxy` deployed at <https://aiproxy.sanand.workers.dev>
- Clone [this repository](https://github.com/sanand0/aiproxy)
- Run `npm install` to install dependencies
- Run `npm run lint` to validate code
- Run `wrangler secret put <key>` also add them to `.dev.vars` as `KEY=value`:
  - `AIPROXY_TOKEN_SECRET`: Generated via `crypto.randomBytes(32).toString('base64url')`
  - `OPENAI_API_KEY`: Via [OpenAI API Keys](https://platform.openai.com/api-keys)
  - `MONGODB_APP_ID`: Via [MongoDB](https://cloud.mongodb.com/) > Data API > App Services > (App) > App ID
  - `MONGODB_API_KEY`: Via [MongoDB](https://cloud.mongodb.com/) > Data API > Users > Create API Key
- Run `npm run deploy` to deploy on Cloudflare

To create an API token for an `emailId`, run:

```js
secret = new TextEncoder().encode(AIPROXY_TOKEN_SECRET);
token = await new jose.SignJWT({ email: emailId }).setProtectedHeader({ alg: "HS256" }).sign(secret);
```

## API Reference

### GET /token

Creates an authentication token for IITM users.

Query Parameters:

- `credential`: Google OAuth credential token

Returns:

- `{token, email}` on success
- `{error}` on failure

### GET /usage

Returns usage statistics for users.

Query Parameters:

- `skip`: Number of records to skip (default: 0)
- `limit`: Maximum records to return (default: 1000)
- `month`: Filter by month (YYYY-MM format)
- `email`: Filter by user email
- `sort`: Field to sort by (descending order)

### GET /openai/v1/models

Returns list of available models.

### POST /openai/v1/chat/completions

Proxies chat completion requests.

Request Body:

- `model`: Only supports "gpt-4o-mini"
- `messages`: Array of chat messages
- `stream`: Not supported

### POST /openai/v1/embeddings

Proxies embedding requests.

Request Body:

- `model`: Only supports "text-embedding-3-small"
- `input`: Text to embed

## Response Headers

All API responses include:

- `cost`: Cost of current request in USD
- `monthlyCost`: Total costs for current month
- `monthlyRequests`: Total requests for current month

## Rate Limits

- Monthly cost limit: $0.5 per user
- Costs per request:
  - Embeddings: $0.02 per million tokens
  - Chat completions: $0.003 per 1K prompt tokens, $0.006 per 1K completion tokens
