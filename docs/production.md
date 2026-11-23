# Preparação para implantação

## Inicialização

Use Node.js 22 ou superior. Faça `npm ci`, configure as variáveis no ambiente do processo e execute `npm start`. O Express serve a interface e a API na mesma origem; o proxy reverso, se usado, deve encaminhar essa origem e terminar HTTPS.

Variáveis reconhecidas:

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `PORT` | Não | Porta HTTP local; padrão `3000` |
| `AQUAMANEJO_DB_PATH` | Não | Caminho absoluto do arquivo SQLite |
| `FRONTEND_ORIGINS` | Sim em produção | Lista separada por vírgulas de origens confiáveis, por exemplo `https://aqua.exemplo.br` |
| `NODE_ENV` | Recomendada | Defina `production` para exigir a lista de origens e habilitar cookie `Secure` e HSTS |

Não é necessário manter segredo de sessão no código: tokens são aleatórios e a sessão é persistida no banco apenas como hash. Proteja as variáveis e os arquivos do ambiente de qualquer forma. Não publique o banco, logs com dados pessoais ou cópias de segurança na pasta web.

## Segurança operacional

- Publique somente atrás de HTTPS. Defina `NODE_ENV=production` e `FRONTEND_ORIGINS` com origens completas, sem curingas; a lista deve refletir a origem real da interface.
- O cookie de sessão é HttpOnly, SameSite=Lax, Secure em produção, com duração de sete dias. Logout invalida a sessão no banco. Revise política de expiração, recuperação de conta, verificação de e-mail e encerramento global de sessões antes de operar uma base de usuários pública.
- O backend deriva o proprietário da sessão e aplica escopo de usuário às propriedades, viveiros e medições. CORS/Origin não são substitutos da autorização.
- O limite de tentativas de autenticação usa memória de um processo. Em várias instâncias ou atrás de proxy, ele não é um limite distribuído; implemente armazenamento compartilhado e configuração de IP/proxy antes de escalar. A configuração atual deliberadamente não confia em cabeçalhos `X-Forwarded-*`.
- Espécies e parâmetros formam um catálogo compartilhado. Restrinja a operação de cadastro a uma equipe revisora ou implemente governança de catálogo antes de abrir cadastro para muitos produtores.
- Preferências das configurações não persistem ainda.

## SQLite, durabilidade e escala

SQLite é adequado para desenvolvimento, demonstrações e uma instalação pequena em uma única instância com armazenamento persistente. Não execute duas instâncias independentes apontando para o mesmo arquivo em discos efêmeros ou compartilhamentos não compatíveis. Garanta volume persistente, espaço, permissões restritas e monitore cópias de segurança. Faça backup consistente com a API de backup do SQLite ou pare o processo antes de copiar o banco e arquivos WAL. Teste restauração, não apenas criação do backup.

Antes de usar várias réplicas, alta concorrência de escrita ou maior disponibilidade, planeje migração para PostgreSQL. A implementação atual usa SQL e `better-sqlite3` diretamente; a migração exige adapter de persistência, substituição de transações/consultas SQLite específicas, migrações equivalentes, cópia e conferência dos dados, além de uma janela de corte e plano de retorno. Nenhuma conversão automática foi incluída e nenhum arquivo SQLite foi removido.

## Análise técnica e fontes

O catálogo inicial contém os exemplos da tabela 6 do [ASC Farm Standard Interpretation Manual v1.0.1](https://programme-centre.asc-aqua.org/farm-v1/farm-interpretation/), aplicáveis à tilápia-do-Nilo. O próprio documento declara caráter orientativo, não normativo. A aplicação limita a referência cadastrada a um contexto específico e deixa sem análise automática parâmetros, espécies, fases, sistemas e condições sem fonte compatível; essas faixas não são recomendação de manejo nem substituem responsável técnico.

A amônia não ionizada (NH₃) pode ser derivada de TAN-N somente quando a água está declarada doce e pH/temperatura têm medições no mesmo instante. A fração de NH₃ usa a equação de equilíbrio de [Emerson et al. (1975)](https://doi.org/10.1139/f75-274); a relação de toxicidade entre amônia, pH e temperatura também é discutida no estudo primário de [Pedrazzani et al. (2020)](https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2020.606388/full). A regra não estima contexto ausente nem extrapola lacunas entre faixas. Cada avaliação salva versão do motor, fonte/versão usada quando há correspondência e contexto do viveiro. Revisão por especialista e atualização controlada das fontes seguem necessárias antes do uso como orientação técnica.

## Verificações antes de publicar

1. Configure e teste HTTPS, domínio e `FRONTEND_ORIGINS` no ambiente de destino.
2. Confirme que o volume persistente e as permissões limitam acesso ao arquivo SQLite.
3. Execute `npm test` e faça teste manual de cadastro, login/logout, CRUD, histórico e recuperação após reinício.
4. Faça backup e restauração de ensaio antes de importar dados reais.
5. Revise com especialista aquícola as fontes/condições da análise e defina governança para novas referências.
6. Configure monitoramento, logs sem credenciais, alertas e resposta a incidentes no provedor de hospedagem.

O projeto está preparado para essas configurações, mas esta alteração não publicou o sistema nem validou um provedor, domínio ou infraestrutura de produção.
