# AI Proxy

This is an authorizing proxy for LLMs.

## Usage

Instead of sending an API request to `https://api.openai.com/`:

- Replace `https://api.openai.com/` with `https://aiproxy.sanand.workers.dev/openai/`

For example:

```shell
curl -X POST http://aiproxy.sanand.workers.dev/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "What is 2 + 2"}]}'
```

## Setup

- Log into <https://dash.cloudflare.com/> as <root.node@gmail.com>
- Create a worker called `aiproxy` deployed at <https://aiproxy.sanand.workers.dev>
- Clone [this repository](https://github.com/sanand0/aiproxy)
- Run `npm install` to install dependencies
- Run `npm run lint` to validate code
- Run `wrangler secret put <key>` also add them to `.dev.vars` as `KEY=value`:
  - `OPENAI_API_KEY`
- Run `npm run deploy` to deploy on Cloudflare
