# API REST

Todas as rotas ficam sob `/api`. Sucesso retorna `{ "data": ... }`; erros retornam `{ "error": { "code", "message", "details?" } }`. Os endpoints privados exigem a sessão criada no login/cadastro.

| Método | Caminho | Acesso e finalidade |
| --- | --- | --- |
| POST | `/auth/register` | Público; cria usuário e inicia sessão (201) |
| POST | `/auth/login` | Público; autentica e inicia sessão |
| GET | `/auth/session` | Retorna o usuário da sessão atual |
| POST | `/auth/logout` | Invalida a sessão atual |
| GET | `/users/:id` | Consulta o próprio perfil autenticado |
| GET | `/dashboard/summary` | Contagens do produtor autenticado |
| GET, POST | `/properties` | Lista e cria propriedades próprias |
| GET, PATCH, DELETE | `/properties/:id` | Consulta, atualiza e exclui propriedade própria |
| GET | `/properties/:propertyId/ponds` | Lista viveiros de propriedade própria |
| POST | `/ponds` | Cria viveiro em propriedade própria |
| GET, PATCH, DELETE | `/ponds/:id` | Consulta, atualiza e exclui viveiro próprio |
| GET, POST | `/species` | Consulta ou cadastra item no catálogo compartilhado |
| GET | `/species/:id` | Consulta espécie |
| GET, POST | `/parameters` | Consulta ou cadastra item no catálogo compartilhado |
| GET | `/parameters/:id` | Consulta parâmetro |
| GET, POST | `/measurements` | Lista com filtros e registra medição própria |
| GET | `/ponds/:pondId/measurements` | Histórico filtrável de viveiro próprio |
| GET, DELETE | `/measurements/:id` | Consulta ou exclui medição própria |
| POST | `/measurements/:id/analysis` | Analisa e salva uma avaliação rastreável |
| GET | `/measurements/:id/analysis` | Consulta a avaliação mais recente |
| GET, POST | `/references` | Lista referências visíveis ou cadastra referência privada |
| GET, PATCH | `/references/:id` | Consulta referência visível ou atualiza referência própria |
| GET | `/species/:speciesId/references` | Lista fontes públicas e privadas visíveis da espécie |

## Filtros e dados

`GET /measurements` aceita `pondId`, `parameterId`, `from` e `to`; `GET /ponds/:pondId/measurements` aceita `parameterId`, `from` e `to`. Datas devem estar em UTC no formato ISO 8601 com milissegundos, por exemplo `2026-11-22T15:00:00.000Z`.

Viveiros aceitam `speciesId`, `cultivationPhase`, `cultureSystem`, `waterType` (`freshwater`, `brackish`, `saltwater`) e `salinityPpt`. Medições guardam unidade e horário individualmente. Referências técnicas recebem espécie, parâmetro, fonte, versão (quando disponível), contexto, unidade, faixa e classificação explícita. Faixas sem limites podem ser registradas, mas não classificam medições.

## Autenticação e escopo dos dados

O cadastro exige nome, e-mail e senha com no mínimo 12 caracteres. A senha é armazenada como hash scrypt com salt aleatório. O token de sessão é aleatório, fica armazenado no banco somente como SHA-256 e é enviado em cookie HttpOnly, SameSite=Lax; em produção, o cookie recebe Secure. A sessão expira em sete dias. O servidor obtém o usuário da sessão; ignora identificadores de proprietário enviados pelo cliente. Propriedades, viveiros e medições são filtrados pelo proprietário. Referências privadas são visíveis apenas ao dono; fontes do catálogo (sem proprietário) são somente leitura.

O limite de tentativas de login/cadastro é por processo e endereço remoto. CORS e verificação de Origin são proteções complementares; não substituem autenticação. Configure `FRONTEND_ORIGINS` com origens completas confiáveis e HTTPS em produção. Os catálogos de espécies e parâmetros são compartilhados e só devem receber entradas revisadas em uma instalação pública.

Para detalhes de implantação e limitações da análise técnica, consulte [`../../../docs/production.md`](../../../docs/production.md).
