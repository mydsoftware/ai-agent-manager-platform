# MYD Coding Agent MCP

سرور MCP برای اتصال Agent Skills موبایل به GitHub.

## Endpoint

`/mcp`

انتقال: Streamable HTTP.

## احراز هویت

Bearer Token با دو متغیر محیطی:

- `MCP_AUTH_TOKEN`: توکنی که کلاینت MCP ارسال می‌کند.
- `GITHUB_TOKEN`: توکن GitHub که سرور برای عملیات GitHub استفاده می‌کند.

توکن‌ها هرگز نباید در Git Commit شوند.

## ابزارها

- `server_info`
- `repo`
- `read_file`
- `search_code`
- `issues`
- `pulls`
- `commits`
- `create_branch`
- `create_file`
- `update_file`
- `delete_file`
- `create_pull_request`

## جریان

`Gemma → Agent Skills → MCP → MYD Coding Agent → GitHub`
