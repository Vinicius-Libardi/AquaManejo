# Banco de dados

- `connection.js` abre SQLite e ativa chaves estrangeiras em cada conexão.
- `schema.js` cria tabelas, restrições e índices; alterações de colunas são aditivas.
- `initialize.js` cria a pasta, aplica o esquema e inclui o catálogo técnico documentado sem apagar registros.
- `technical-reference-seed.js` contém somente referências e faixas documentadas, sem medições demonstrativas.
- `index.js` reúne as funções públicas do módulo.

O banco padrão fica em `backend/data/aquamanejo.sqlite`. A pasta é criada automaticamente. `AQUAMANEJO_DB_PATH` define outro caminho. O banco não é removido nem recriado quando o servidor reinicia.

As medições guardam data/hora UTC ISO 8601 com milissegundos, unidade e valor. Índices apoiam consultas de histórico por viveiro e período. `quality_analyses` e `quality_analysis_items` guardam o resultado, a versão do motor, a fonte/versionamento selecionado e o contexto utilizado.

Para cópias de segurança SQLite consistentes, pare o processo antes de copiar o arquivo e seus arquivos WAL, ou use a API de backup do SQLite. A configuração atual foi feita para uma instância única; leia [`../../../docs/production.md`](../../../docs/production.md) antes de operar com múltiplos servidores.
