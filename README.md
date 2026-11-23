# AquaManejo

Aplicação web para registrar propriedades, viveiros e medições de qualidade da água. A interface em HTML, CSS e JavaScript é servida pelo backend Express; a API persiste os dados em SQLite e utiliza sessões autenticadas.

## Executar localmente

Requisitos: Node.js 22 ou superior e npm.

```sh
npm ci
npm start
```

Abra `http://localhost:3000`. Para desenvolvimento com reinício automático, use `npm run dev`. Execute a suíte automatizada com `npm test`.

O banco padrão é `backend/data/aquamanejo.sqlite`; `AQUAMANEJO_DB_PATH` altera o caminho. A inicialização aplica alterações aditivas ao esquema e mantém os registros já existentes. O catálogo técnico inicial inclui apenas referências documentadas e não inclui medições demonstrativas.

## Estrutura

- `frontend/`: telas, estilos e cliente centralizado da API.
- `backend/src/`: aplicação HTTP, autenticação, serviços, validação, análise e persistência.
- `tests/`: testes nativos do Node organizados por área.
- `docs/production.md`: configuração e limites para implantação.

## Limites conhecidos

- A análise técnica inicial cobre somente exemplos para tilápia-do-Nilo da tabela 6 do ASC Farm Standard Interpretation Manual v1.0.1. O próprio manual descreve esses valores como orientação, não como norma; a aplicação registra essa limitação e retorna “sem referência suficiente” em contextos não cobertos. Consulte [a documentação de implantação e análise](docs/production.md).
- As preferências da tela de configurações continuam demonstrativas e não são persistidas.
- SQLite atende a uma instância única e volume moderado. Para alta concorrência ou várias instâncias, planeje migração para PostgreSQL antes de escalar.
- Nenhuma implantação externa foi realizada por este repositório.
