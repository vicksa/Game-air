# Publicação na Vercel

## Site público

**https://game-air-kohl.vercel.app**

- Ambiente: produção, estado `READY`, HTTPS, sem login obrigatório para jogar.
- Repositório: https://github.com/vicksa/Game-air, branch `main`.
- Projeto Vercel: `game-air` (`prj_mxl0xdQvYFl7NcCroPDSSsvnfacx`).
- Equipe: `vicksas-projects` (`team_ZLxxgrm2dl9sjCumMvi7TUcY`).
- Primeiro deployment verificado: `dpl_2Yu1JuuQqQkghMtPduadFkSmuGPw`, commit `87cd4fc7c01201c03e4bcf3d5d8601b0ec80a305`.
- Domínio alternativo: https://game-air-vicksas-projects.vercel.app.

## Configuração

O arquivo `vercel.json` declara Vite, instalação com `npm ci`, build com `npm run build` e saída estática em `dist`. O projeto foi criado vinculado ao repositório GitHub. O build inicial levou cerca de 21 segundos, usando Node.js 24 na Vercel. Não há backend, segredo ou variável de ambiente necessária.

Não há rewrite geral: WASM, modelo e `/sprites.html` são arquivos estáticos. Modelo, runtime, sprites e fontes estão versionados. O navegador precisa baixar o modelo e o WASM na primeira sessão, mas o vídeo é processado localmente. A webcam exige autorização do navegador e HTTPS.

A proteção por senha e login Vercel está desativada apenas neste projeto, conforme o pedido de site público. Os demais projetos da conta não foram alterados.

## Verificação no domínio público — 21/10/2026

Teste Chromium em contexto novo, sem sessão Vercel:

- Página inicial respondeu HTTP 200 e abriu sem autenticação.
- O navegador confirmou `isSecureContext: true`.
- MediaPipe e modelo reais inicializaram com câmera sintética e chegaram à calibração.
- Modelo `.task` e runtime `.wasm` responderam HTTP 200 no próprio domínio.
- Partida por teclado iniciou e a pausa funcionou.
- Galeria `/sprites.html` carregou os 28 conjuntos de animação.
- Nenhum erro JavaScript ou resposta HTTP de erro nos recursos do site foi observado.

A validação com mãos reais e webcam física continua pendente; o teste sintético verifica a publicação e a inicialização do reconhecimento, não sua precisão em pessoas. Consulte [VALIDATION.md](VALIDATION.md) para a suíte de 30 testes e os limites da validação.

## Manutenção

O projeto foi criado com a conexão Git de `vicksa/Game-air`; alterações em `main` podem gerar novos deployments. Verifique o estado `READY` e o domínio de produção após cada publicação. A CI do GitHub executa os testes separadamente.

Na conexão usada nesta sessão, chamadas com equipe explícita retornaram 403, enquanto criação e deployment pela conta padrão funcionaram e retornaram a equipe correta. Não tratar esse erro isolado como prova de que toda a conexão está desautorizada. Conferir o `accountId` retornado antes de alterar recursos.
