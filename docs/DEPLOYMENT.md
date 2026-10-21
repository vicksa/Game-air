# Publicação na Vercel

## Destino

- Código: https://github.com/vicksa/Game-air, branch `main`.
- Nome sugerido do projeto: `game-air`.
- Equipe identificada na conta conectada: `vicksas-projects`.
- Site público em produção, servido por HTTPS, sem login obrigatório para jogar.

## Configuração pronta

O arquivo `vercel.json` declara Vite, instalação com `npm ci`, build com `npm run build` e saída estática em `dist`. Não há backend, segredo ou variável de ambiente necessária. Não há rewrite geral: recursos como WASM, modelo e `/sprites.html` devem ser servidos como arquivos estáticos.

Modelo, runtime, sprites e fontes estão versionados no projeto. O navegador precisa baixar o modelo e o WASM na primeira sessão, mas o vídeo continua sendo processado localmente. A webcam exige autorização do navegador e HTTPS, fornecido pela Vercel.

## Estado desta publicação

A publicação foi solicitada pelo usuário, mas ainda não foi criada. A conexão Vercel consegue listar os projetos existentes, porém as operações direcionadas à equipe retornam `HTTP 403: Not authorized` com indicação de autorização ausente para `vicksas-projects`. Não há autenticação alternativa da Vercel no terminal. É necessário reconectar o app Vercel no ChatGPT e autorizar essa equipe para concluir o deploy. Nenhum token ou senha deve ser enviado na conversa.

## Após liberar o acesso

1. Importar o repositório na equipe correta pela integração Git da Vercel e conferir branch `main` e commit testado.
2. Conferir as configurações do projeto e criar um deployment de produção.
3. Verificar o domínio de produção sem autenticação. Se houver proteção obrigatória, ajustar apenas o projeto do jogo conforme o pedido explícito de site público.
4. Testar abertura, tutorial, início por teclado, galeria, carregamento do modelo/WASM e inicialização da webcam sintética no endereço HTTPS.
5. Registrar aqui o endereço definitivo e o resultado das verificações.
