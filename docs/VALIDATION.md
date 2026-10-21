# Validação — 21/10/2026

## História verificada

O jogador abre a demo, escolhe webcam ou teclado, passa pelo tutorial, controla o ninja, atravessa plataformas, enfrenta inimigos e chega à vitória ou derrota. No modo webcam, o MediaPipe local fornece pontos das mãos; o interpretador converte esses pontos em comandos do Phaser. Não há backend nem upload de vídeo.

## Cobertura automatizada

**44 testes: 14 de gestos/rastreamento e 30 no Chromium.** Executar com `npm test` e `npm run test:e2e`.

| Área                 | Verificação                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gestos               | Palma, punho e V, pontos rotacionados, confirmação temporal, tremores, centro calibrado, confiança de lado incerta, perda de mão e movimento simultâneo com pulo.                                        |
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

- A CI expôs tempos inconsistentes sob carga: os prazos de combate agora usam o mesmo delta de simulação das animações; a tela de fim aguarda o relógio da cena. Os testes aguardam quadros/estados observáveis e rodam com um worker para evitar disputa de renderização na máquina virtual.

## Correção do bloqueio ao começar a missão

- Começar não exige duas mãos reconhecidas no instante do clique. Se uma mão sair para usar o mouse, a cena fica pausada e mostra "Missão pronta", sem retornar ao ciclo de calibração.
- Quando as duas mãos reaparecem por 200 ms, a missão retoma automaticamente. Pausas manuais continuam exigindo uma escolha do jogador.
- Há opção de teclado no tutorial, na espera e na pausa; a preparação permite iniciar antes de terminar uma nova calibração. O centro neutro é obtido das mãos quando necessário.
- A presença agora aceita landmarks válidos com classificação de lado a partir de 0,5. A confiança de esquerda/direita não é tratada como confiança de detecção da mão. Os limiares internos de detecção do MediaPipe continuam iguais.
- Se as duas mãos receberem o mesmo rótulo de lado, a posição na imagem espelhada distribui os controles. Landmarks incompletos ou não finitos são rejeitados.
- O indicador mostra 0/2 ou 1/2, e a pausa por ausência tem tolerância de 1,2 segundo; os comandos são zerados assim que uma mão some.
- Três novos cenários de navegador reproduzem saída da mão para clicar, rótulos ambíguos e entrada por teclado sem mãos. Três novos testes de unidade cobrem classificação moderada de lado, rótulos repetidos e landmarks inválidos.

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

## Painel de mãos

Dois cenários verificam o painel ao lado da fase no desktop e abaixo dela no celular, a presença durante a calibração e a partida, os traços âmbar/verde no canvas e a transição de duas mãos para uma e nenhuma. Os pontos são simulados; não constituem validação física da webcam.

## Revisão do rastreamento e dos lados

Removida a inversão explícita dos rótulos do Tasks Vision; somente a prévia e o eixo de movimento são espelhados. A identidade espacial das mãos persiste por até 350 ms para resistir a oscilações do classificador. Mãos ausentes não são emitidas nem mantêm comandos ativos. A confiança do rótulo de lado não é usada como filtro de presença.

A captura solicita 960×720 e 30 fps como preferência; o navegador escolhe o formato disponível. O modelo usa limiares de detecção/presença de 0,35 e rastreamento de 0,4, com GPU e alternativa CPU se a inicialização falhar. A calibração tolera lacunas de até 250 ms. O jogador pode trocar os lados pelo painel, reiniciando a calibração.

Quatro testes de unidade verificam continuidade, retorno de uma mão, expiração, mapeamento dos rótulos e alternativa CPU. Dois cenários adicionais de navegador verificam a troca manual e a calibração com perda breve. Os limiares foram ajustados, mas o ganho de precisão em mãos reais ainda precisa de medição física; baixar os limiares pode também aumentar falsos positivos.
