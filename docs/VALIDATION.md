# Validação — 21/10/2026

## História verificada

O jogador abre a demo, escolhe webcam ou teclado, passa pelo tutorial, controla o ninja, atravessa plataformas, enfrenta inimigos e chega à vitória ou derrota. No modo webcam, o MediaPipe local fornece pontos das mãos; o interpretador converte esses pontos em comandos do Phaser. Não há backend nem upload de vídeo.

## Cobertura automatizada

**30 testes: 7 de gestos e 23 no Chromium.** Executar com `npm test` e `npm run test:e2e`.

| Área                 | Verificação                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gestos               | Palma, punho e V, pontos rotacionados, confirmação temporal, tremores, centro calibrado, baixa confiança, perda de mão e movimento simultâneo com pulo.                                                  |
| Animações            | Os 28 conjuntos dos quatro personagens usam quadros PNG reais, com transparência e poses distintas; o Phaser percorre todos os quadros do atlas e termina os estados sem repetição.                      |
| Combate em movimento | Os cinco quadros do ataque do jogador aparecem; o inimigo mostra o segundo quadro de dano e toca a morte antes de desaparecer; arqueiros retornam ao repouso após disparar.                              |
| Estados do ninja     | Caminhar, virar, pular, defender e receber dano selecionam a animação correta; a pausa congela posição e quadro.                                                                                         |
| Física               | Cada um dos quatro abismos é atravessável com um único pulo; espinhos causam dano; invulnerabilidade impede dano duplicado imediato; projéteis expiram.                                                  |
| Partida              | Tutorial, movimentação por teclado, checkpoint, recuperação, queda, derrota, reinício, defesa e vitória contra o chefe. O HUD publica zero vida na derrota.                                              |
| Fluxo por mãos       | Pontos simulados percorrem a calibração, andar/pular, ataques sem repetição ao segurar o gesto, defesa, pausa por perda das mãos, bloqueio de retomada sem mãos, seleção por permanência e recalibração. |
| Webcam               | WASM e modelo reais inicializam com câmera sintética; permissão negada oferece teclado; falha de download encerra a câmera e permite tentar novamente; desligar encerra os tracks de vídeo.              |
| Interface            | Ações principais inteiramente visíveis em 390 px; abrir ajuda durante a calibração não interrompe o rastreamento; reduzir efeitos desliga tremor de câmera e piscadas de dano.                           |

O build passa por TypeScript e Vite, e o código passa por `npm run format:check`. O bundle inclui Phaser e MediaPipe; o aviso do Vite sobre tamanho acima de 500 kB permanece. O smoke test do build de produção inicializa a câmera sintética, carrega recursos locais e inicia a partida por teclado sem erros JavaScript, respostas HTTP de erro ou requisições externas.

## Falhas encontradas e corrigidas nesta revisão

- Ataque interrompido antes de mostrar todos os quadros: a taxa de ataque agora corresponde à duração da ação; o jogo lê o mesmo atlas usado na galeria, e estados sem repetição mantêm o último quadro até a próxima ação.
- Inimigos eliminados desapareciam imediatamente: agora ficam sem colisão enquanto exibem a animação de morte.
- Reação de dano do inimigo reiniciava todo quadro: ela agora tem prioridade sobre a movimentação até terminar.
- Arqueiro permanecia no último quadro de ataque: ele volta ao repouso entre os disparos.
- Toques curtos de Espaço/J podiam ser perdidos entre quadros: eventos de tecla agora preservam a ação para o próximo update. Há tolerância de 120 ms após sair da borda e buffer de pulo de 140 ms antes de pousar.
- Abrir ajuda durante a calibração podia acessar elementos removidos e encerrar a câmera: trocar de modal cancela a calibração corrente; recalibrar inicia uma nova sessão.
- HUD podia congelar com vidas antigas na derrota: o estado final é publicado antes da tela de fim.
- Reiniciar a webcam fecha a sessão anterior e reinicia o controle de quadros de vídeo.

## Evidências visuais

Abertura, fase, tela estreita e montagem das animações foram inspecionadas no navegador. A galeria também foi gravada durante reprodução real:

- [Captura dos sprites](previews/sprite-gallery.png)
- [Vídeo das animações (WebM)](previews/animations.webm)
- Galeria interativa: `/sprites.html` no servidor local.

Capturas dos testes ficam em `test-results/` e são salvas como artefatos pela CI. A CI no GitHub executa testes, build e testes de navegador a cada push.

## Limites da validação

A câmera sintética usada para inicializar o MediaPipe **não contém mãos reais**. O fluxo por mãos usa pontos simulados depois do reconhecimento: valida calibração, comandos, menus e pausa, mas não mede a precisão do modelo em pessoas. Os testes de combate/checkpoint posicionam atores para isolar regras; os abismos são testados um a um com comandos simultâneos. Isso não equivale a uma partida inteira jogada por uma pessoa.

Ainda é necessário validar com webcam física no computador do jogador:

- Chrome e Edge reais, iluminação, oclusão, identificação anatômica de esquerda/direita e mãos de pessoas diferentes.
- Ergonomia do cursor por permanência e reconhecimento consistente de punho, V e palma.
- Taxa de quadros, latência e conforto ao longo de uma partida inteira. Não há medição de desempenho no hardware do usuário.

Não foi realizado um teste físico com mãos nem execução do navegador Microsoft Edge nesta máquina. O vídeo da galeria é evidência de animação renderizada no navegador, não de controle por mãos reais.
