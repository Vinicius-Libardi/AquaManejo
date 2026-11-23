# Backend AquaManejo

API REST em Node.js e Express 5, persistida com `better-sqlite3` e validada com Zod. O backend serve também a interface de `frontend/`, mantendo API e interface na mesma origem por padrão.

O servidor é iniciado com `npm start` (produção) ou `npm run dev` (desenvolvimento). A porta padrão é `3000`. O arquivo de banco padrão é `backend/data/aquamanejo.sqlite`; configure `AQUAMANEJO_DB_PATH` para outro caminho. `FRONTEND_ORIGINS` define origens adicionais permitidas, separadas por vírgula; em produção a variável é obrigatória.

As rotas, autenticação e análise estão descritas em [`src/routes/README.md`](src/routes/README.md). Orientações de configuração de produção, operação e migração de banco estão em [`../docs/production.md`](../docs/production.md).

Execute `npm test` na raiz para rodar os testes. As sessões usam cookie HttpOnly, SameSite=Lax e Secure em produção. Configure HTTPS no servidor/reverse proxy antes de publicar.
