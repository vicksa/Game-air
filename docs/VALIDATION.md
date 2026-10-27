# Validação — 22/10/2026

## História verificada

O jogador abre a demo, escolhe webcam ou teclado, passa pelo tutorial, controla o ninja, atravessa plataformas, enfrenta inimigos e chega à vitória ou derrota. No modo webcam, o MediaPipe local fornece pontos das mãos; o interpretador converte esses pontos em comandos do Phaser. Não há backend nem upload de vídeo.

## Cobertura automatizada

**83 testes: 32 de gestos/rastreamento, 36 de gameplay no Chromium e 15 da câmera em Chromium/Firefox/WebKit.** Executar com `npm test` e `npm run test:e2e`.

| Área                 | Verificação                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gestos               | Palma, punho e V, pontos rotacionados, confirmação temporal, tremores, centro calibrado, confiança de lado incerta, perda de mão e movimento simultâneo com pulo.                                                |
| Animações            | Os 28 conjuntos dos quatro personagens usam quadros PNG reais, com transparência e poses distintas; o Phaser percorre todos os quadros do atlas e termina os estados sem repetição.                              |
| Combate em movimento | Os cinco quadros do ataque do jogador aparecem; o inimigo mostra o segundo quadro de dano e toca a morte antes de desaparecer; arqueiros retornam ao repouso após disparar.                                      |
| Estados do ninja     | Caminhar, virar, pular, defender e receber dano selecionam a animação correta; a pausa congela posição e quadro.                                                                                                 |
| Física               | Cada um dos quatro abismos é atravessável com um único pulo; espinhos causam dano; invulnerabilidade impede dano duplicado imediato; projéteis expiram.                                                          |
| Partida              | Tutorial, movimentação por teclado, checkpoint, recuperação, queda, derrota, reinício, defesa e vitória contra o chefe. O HUD publica zero vida na derrota.                                                      |
| Fluxo por mãos       | Pontos simulados percorrem a calibração, andar/pular, ataques com cadência limitada ao segurar o punho, defesa, pausa por perda das mãos, bloqueio de retomada sem mãos, seleção por permanência e recalibração. |
| Webcam               | WASM e modelo reais inicializam com câmera sintética; permissão negada oferece teclado; falha de download encerra a câmera e permite tentar novamente; desligar encerra os tracks de vídeo.                      |
| Interface            | Ações principais inteiramente visíveis em 390 px; abrir ajuda durante a calibração não interrompe o rastreamento; reduzir efeitos desliga tremor de câmera e piscadas de dano.                                   |

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

A captura solicita 640×480 e 24 fps como preferência; o navegador escolhe o formato disponível. O modelo usa limiares de detecção/presença de 0,35 e rastreamento de 0,4, com GPU e alternativa CPU se a inicialização falhar. A calibração tolera lacunas de até 250 ms. O jogador pode trocar os lados pelo painel, reiniciando a calibração.

Quatro testes de unidade verificam continuidade, retorno de uma mão, expiração, mapeamento dos rótulos e alternativa CPU. Dois cenários adicionais de navegador verificam a troca manual e a calibração com perda breve. Os limiares foram ajustados, mas o ganho de precisão em mãos reais ainda precisa de medição física; baixar os limiares pode também aumentar falsos positivos.

## Campo de visão curto e recuperação no celular

O limiar padrão para andar caiu de 9,5% para 3% da largura da imagem. Segurar esse deslocamento mantém o comando de andar; não há relação entre distância percorrida pelo ninja e deslocamento acumulado da mão. Sensibilidade ajustável, zona neutra simétrica sem retenção de direção e suavização por tempo tornam a resposta consistente entre taxas de inferência. Dois testes de unidade cobrem deslocamento curto, manutenção, retorno e sensibilidade.

A inferência roda em até 20 quadros/s. Falhas em execução na GPU tentam CPU sem encerrar o stream; falha definitiva do reconhecimento mantém a prévia e oferece reconexão. Congelamento do vídeo dispara nova captura após 2,5 s, limitado a duas tentativas consecutivas. Inicializações canceladas fecham modelos recebidos após o cancelamento. Quatro testes de unidade cobrem essas condições.

Dois cenários de navegador verificam movimento/pulo simultâneos por ponteiros em 390×844 e cancelamento de movimento; outro percurso no mesmo segundo cenário provoca falha do modelo, confirma que o stream foi preservado, congela o vídeo e verifica a troca de stream com liberação do anterior. Esses defeitos são injetados deliberadamente em uma câmera sintética. Isso não valida hardware Android/iOS ou a taxa de recuperação em celulares reais.

## Correção de movimento preso

A zona de retorno anterior era menor que a zona de partida: após andar para a direita, um deslocamento dentro dessa faixa mantinha o comando anterior indefinidamente, inclusive se a mão passasse ligeiramente para o lado oposto. A zona neutra agora interrompe o movimento em ambos os sentidos imediatamente, sem retenção nem avanço residual da suavização.

Começar/retomar usa a posição atual como centro. Punho esquerdo interrompe o movimento sem alterar o centro; o botão Parar / centralizar redefine o centro. Eventos de soltura/cancelamento de ponteiro são tratados na janela, mesmo se ocorrerem fora dos botões. Três testes de unidade reproduzem o movimento preso e a parada por punho; um cenário de navegador verifica a velocidade real ao voltar ao centro, centralizar e retomar em outra posição. O cenário de toque também solta um ponteiro fora do painel.

## Bateria da câmera — 22/10/2026

O Chromium passava, mas o Firefox sem contexto gráfico abria vídeo e falhava ao enviar pixels ao modelo: `GLctx is undefined`. O delegate CPU do Tasks Vision também usa WebGL para preparar imagens, portanto não era uma alternativa suficiente. Agora há um terceiro backend, TensorFlow.js/WASM, carregado apenas quando necessário e selecionável pela tela de conexão/erro.

A primeira rodada com fotografia real detectou palmas, mas descartava os recortes: o SDK consultava `video.width/height` (zero), em vez de `video.videoWidth/videoHeight`. A entrada agora é um tensor de pixels com as dimensões reais do vídeo, liberado após cada inferência. A fotografia passa pelos modelos reais e precisa produzir duas mãos; os pontos não são injetados nesses cenários.

Também foram corrigidos: repetição com configurações padrão quando as restrições de captura não são aceitas; nova tentativa após liberar câmera exclusiva que responde NotReadableError; vídeo explicitamente mudo e inline; cancelamento durante permissão/modelo pendentes; prazos de carregamento; fechamento de recursos que chegam após cancelar; descarte de resultados assíncronos após desligar. A UI informa cada etapa, permite cancelar e orienta abrir Chrome/Safari quando o link está em navegador interno.

Os modelos/JS/WASM novos são servidos pela própria origem. A CI ganhou um job de câmera nos três motores. Testes com fotografia e câmera sintética não validam a webcam do usuário, iluminação nem movimento físico. Android/Chrome e iPhone/Safari em aparelhos físicos continuam pendentes.

## Recuo e combate — 22/10/2026

Fechar a esquerda agora somente interrompe o movimento; o centro permanece fixo até centralização explícita ou início/retomada. O teste do fluxo de entrada verifica também velocidade negativa após andar para a direita. Punho direito mantido fechado repete golpes a cada 600 ms; abrir encerra a repetição.

O golpe olha para um inimigo próximo, preserva a orientação durante sua animação e aceita alvos sobrepostos ao corpo, incluindo distância horizontal zero. Antes, `Math.sign(0)` rejeitava esse contato. O jogo informa acertos, golpes restantes e derrota. Três cenários novos derrotam guardas com os três pontos de vida originais, à esquerda, à direita e sobrepostos, mantendo IA e temporização de combate.

### Chrome no PC: vídeo ativo sem mãos detectadas

O rastreador agora troca para o detector independente TensorFlow.js/WASM após dez segundos consecutivos sem nenhuma mão detectada no modelo nativo. A troca automática mantém o mesmo MediaStream e acontece apenas uma vez por sessão; o modo WASM não reinicia em loop quando não há mãos no enquadramento. O botão Modo compatível fica disponível após a conexão para troca manual. Isso cobre resultados vazios silenciosos, além das exceções já tratadas; não comprova que esse seja o problema específico do dispositivo do usuário.

Novos testes Chromium simulam resultados vazios do modelo nativo e verificam a recuperação com inferência real da fotografia de duas mãos, preservando o stream. Outro teste verifica o acesso ao modo compatível depois de uma conexão bem-sucedida. Não houve teste físico da webcam do usuário.

Resultado desta revisão: 32 testes unitários, 7 testes de câmera no Chromium e 36 testes de jogo passaram; build, formatação e diff sem erros. Captura de tela do reconhecimento revisada: botão compatível legível e sem sobreposição no painel. Os testes usam imagem de mãos e câmeras sintéticas, não uma webcam física no Chrome do PC do usuário.

## Bateria completa — 26/10/2026

Revisão do commit de aplicação `5ab99f3` após relato de câmera com vídeo ativo e nenhuma mão reconhecida no Chrome do PC. O teste de ausência de mãos foi reforçado: agora espera `0/2` antes de verificar a recuperação, confirma que o modelo nativo foi substituído e que o MediaStream permanece o mesmo. Quando a sessão já começa em WASM, mantém zero mãos por 11 segundos, verifica que o modelo não é recriado e só então restaura a inferência para exigir `2/2`. Isso evita aprovação por leitura de um resultado anterior.

A primeira execução da matriz encontrou dependências ausentes no lançamento do WebKit. Bibliotecas já disponíveis em `/workspace/scratch/browser-libs` foram expostas ao processo por `LD_LIBRARY_PATH`; a validação automática de dependências foi dispensada apenas para esta execução local. Os navegadores abriram e os modelos reais executaram os cenários. Nenhuma configuração de biblioteca local foi adicionada ao produto ou à CI.

Os 32 testes unitários e os 21 cenários de câmera (7 em Chromium, Firefox sem WebGL e WebKit) passaram. Compilação TypeScript/Vite, formatação e verificação de diff passaram. A compilação mantém o aviso conhecido de bundles maiores que 500 kB.

A CI da aplicação `5ab99f3` também concluiu com sucesso: https://github.com/vicksa/Game-air/actions/runs/40420269739.

Limite: imagens de duas mãos passam pelos modelos reais, mas o vídeo é fornecido por canvas; gestos e falhas de hardware são simulados em testes separados. Não houve acesso físico à webcam nem à instalação do Google Chrome do usuário. Chromium automatizado não comprova funcionamento em todos os drivers, permissões, condições de luz ou aparelhos.

Os 36 cenários de jogo também passaram nesta rodada: 28 animações, movimento e recuo, parada e centralização, ataque repetido, guardas com vida original em três posições, defesa, dano, chefe, vitória/derrota, checkpoints, reinício, quatro abismos, espinhos, projéteis, efeitos reduzidos, toque e perda/recuperação de rastreamento. Total: 89 testes automatizados aprovados (32 + 21 + 36). Capturas de abertura, jogo e tela estreita revisadas, sem novos cortes ou sobreposições observados.

Checagens adicionais no site público `https://game-air-kohl.vercel.app/`: reconhecimento com os modelos reais em viewport desktop e móvel, troca manual para modo compatível, dez verificações consecutivas de `2/2` ao longo de dez segundos, avanço do tempo do vídeo, desligamento com todas as tracks encerradas, ausência de erros JavaScript e de requisições para outras origens. Uma segunda checagem entrou pela interface com teclado, enviou movimento nos dois sentidos e golpes até derrotar o primeiro guarda, depois pausou e retomou. Não alterou posições, vida nem estado da cena. Ambas as checagens passaram.

## Webcam após morrer e jogar novamente — 27/10/2026

Reproduzido o desligamento com webcam ativa: depois da derrota, retirar uma mão para clicar em Jogar novamente abre a espera pelas duas mãos. Se a outra mão deixa o cursor sobre Jogar com teclado, a seleção por permanência acionava a alternativa após 1,2 segundo, encerrava o MediaStream e mudava o modo sem um clique explícito. O teste falhou antes da correção ao constatar a câmera encerrada.

Botões de troca para teclado agora exigem clique, toque ou ativação por teclado; ficam fora da seleção automática pelo cursor das mãos. Continuar e Jogar novamente permanecem selecionáveis pelas mãos. Isso se aplica à abertura, calibração, tutorial, espera de mãos, pausa e erro de câmera.

Dois cenários novos mantêm o stream real da câmera sintética aberto, substituindo apenas a saída de landmarks para controlar os gestos. O primeiro morre e reinicia duas vezes, verificando identidade do stream, tracks vivas e movimento por gestos após cada reinício. O segundo retira uma mão, aponta a restante para a alternativa de teclado por 1,8 segundo, exige que a câmera permaneça ligada e retoma ao devolver as duas mãos; depois confirma que clicar explicitamente em teclado encerra todas as tracks. Não houve validação física da webcam do usuário.

Após a correção passaram 32 testes unitários e os 38 testes de jogo no Chromium, incluindo os dois cenários novos. Build e formatação aprovados. Não foi necessário alterar captura ou modelos de visão; o defeito reproduzido estava na ativação automática de ações do menu.

## Área de jogo e tela cheia — 27/10/2026

O layout normal passa a usar a largura disponível até 1800 px, com margens menores e painel de mãos de 240 px no desktop. Em 1440 px, o canvas normal precisa ultrapassar 1100 px de largura (antes, cerca de 944 px). O botão Tela cheia usa a API do navegador; se ela não estiver disponível ou for recusada, amplia o jogo dentro da janela. Sair restaura o layout normal. O pedido só é feito por clique, toque ou teclado.

Na ampliação, instruções externas saem da composição e a câmera fica como prévia pequena no canto, preservando o mesmo MediaStream. Um ResizeObserver atualiza o tamanho do parent do Phaser para manter o canvas inteiro, com a proporção lógica 640×360. Isso corrige o corte observado na primeira revisão do celular em paisagem.

Os novos cenários verificam largura real do canvas, aumento ao entrar em tela cheia, restauração ao sair, câmera ativa com o mesmo stream e alternativa sem API de tela cheia com controles de toque e botão de saída acessíveis. Os modelos e o processamento local da câmera permanecem os mesmos.

Verificação: 32 testes unitários aprovados, build e formatação aprovados. A suíte de 41 cenários teve 40 aprovações e uma falha de sincronização na preparação da morte simulada: ela alterava o jogador antes de o reinício enfileirado do Phaser terminar, e o create restaurava a vida. O teste agora aguarda o novo cenário atualizar antes de simular a queda; os dois cenários de reinício e os três de tela cheia passaram juntos após o ajuste. As últimas alterações visuais afetam apenas a tela cheia em paisagem; os três cenários de tela cheia foram repetidos e passaram. A revisão de abertura, jogo e tela estreita também passou. Capturas de título, fase, mobile e ampliação revisadas; o canvas inteiro permanece visível e a prévia da câmera fica abaixo do placar. A verificação de câmera usa captura sintética, sem acesso físico ao aparelho do usuário.

## Andar e pular com as mãos — 27/10/2026

Não havia exclusão direta entre movimento e salto, mas o V emitia somente um pulso ao entrar na pose. Depois do primeiro salto, manter o V e começar/continuar a andar não gerava outro pedido; era preciso desfazer e refazer o gesto. Os dois novos cenários reproduziram esse limite andando para a esquerda e para a direita: observaram um salto e falharam ao exigir outro após pousar com V mantido.

O V estável agora mantém o pedido de salto ativo enquanto a mão esquerda controla o movimento. A física existente continua aceitando o salto apenas com apoio/coyote time, cooldown e buffer; ela não foi alterada e não permite saltos sucessivos no ar. Desfazer o V interrompe os novos pedidos imediatamente; pedidos já aceitos pelo pequeno buffer preservam a temporização existente. Perder uma mão limpa os comandos como antes. O tutorial explica que o V pode ser mantido para repetir ao pousar.

Dois testes unitários verificam comando simultâneo de movimento e salto mantido, liberação do gesto e perda de mão. Dois testes de navegador passam pela saída do rastreador, interpretação de gestos e física do Phaser, medindo velocidade horizontal e decolagens consecutivas nos dois sentidos, além da interrupção ao soltar. A captura é sintética e os landmarks são controlados; não representa validação física da webcam do usuário.

Resultado: 34 testes unitários e os 43 testes de jogo passaram nesta revisão, incluindo os dois novos cenários com salto durante movimento. Build TypeScript/Vite, formatação e diff aprovados. Não foi necessário alterar a captura da câmera nem a física para esta correção.
