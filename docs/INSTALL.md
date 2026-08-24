# نصب

## Postgres با Docker
```bash
docker compose -f infrastructure/docker-compose.yml up -d
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm --filter @aam/db seed
pnpm --filter @aam/api dev
```

Postgres روی **ماشین خودت** اجرا می‌شود، نه روی GitHub.
GitHub فقط کد را نگه می‌دارد.
