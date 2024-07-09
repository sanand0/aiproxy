# AI Proxy

This is an authorizing proxy for LLMs.

## Usage

Get an API token from the IITM Data Science support team.

Then, instead of sending an API request to `https://api.openai.com/`:

- Replace `https://api.openai.com/` with `https://aiproxy.sanand.workers.dev/openai/`
- Replace the OPENAI_API_KEY with the AIPROXY_TOKEN

For example:

```shell
curl -X POST http://aiproxy.sanand.workers.dev/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AIPROXY_TOKEN" \
  -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "What is 2 + 2"}]}'

curl -X POST http://aiproxy.sanand.workers.dev/openai/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AIPROXY_TOKEN" \
  -d '{"model": "text-embedding-3-small", "input": ["king", "queen"]}'
```

AI Proxy only supports these endpoints and models:

- `GET https://aiproxy.sanand.workers.dev/v1/models`
- `POST https://aiproxy.sanand.workers.dev/v1/embeddings`
  - `model: text-embedding-3-small`
- `POST https://aiproxy.sanand.workers.dev/v1/chat/completions`
  - `model: gpt-3.5-turbo`

It returns a set of additional headers:

1. `cost`: Cost of this request in USD
2. `monthlyCost`: Total costs (in USD) of requests used this month. Monthly limit is $0.5 (resets at midnight UTC on the first of the next month).
3. `monthlyRequests`: Total requests made this month.

## Setup

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
