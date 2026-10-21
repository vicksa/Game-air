# Hand Quest — bíblia visual

## Intenção

Um cartucho de arcade de 199X: noite sobre telhados, um lenço vermelho contra uma cidade azul, o amanhecer como recompensa. A abertura é uma ilustração de apresentação; o jogo usa sprites menores, legíveis e consistentes. Não reproduzir personagens de franquias existentes.

## Sistema

- Canvas lógico: 640×360; nearest-neighbor, sem suavização de sprites.
- Personagens: células 48×48, pés embaixo, centro horizontal. Chefe ampliado em 1,65× para leitura de ameaça.
- Fundo: #10152d, #171d3b, #22294b, #303653.
- Ninja: #18264b / #405584; assinatura #ed5357.
- Sinais: âmbar #ffc477, defesa/refúgio #8ce3ce, perigo #f46a62.
- Texto principal: #e7e4d9. Texto secundário: #8793ab. Não usar texto secundário sobre áreas claras da arte.
- Barlow Condensed em títulos; IBM Plex Mono em legendas. As fontes estão no projeto para funcionamento sem Google Fonts.
- HUD sempre compacto: vida à esquerda, avanço ao centro, inimigos à direita; chefe ganha barra própria.

## Composição e movimento

O título ocupa a esquerda; ninja e lua equilibram a direita. Menus usam moldura angular, âmbar para a ação principal e vermelho como assinatura. Não usar grades de cartões, blobs, vidro ou ícones aleatórios.

Durante a fase, o cenário tem três planos de paralaxe. Plataformas têm borda superior clara; espinhos têm ponta clara e lateral vermelha. Ataques desenham arco claro, defesa tem contorno verde e impactos usam partículas curtas. O lenço acompanha os ciclos de movimento. Não depender de cor para distinguir inimigos: guarda usa proteção de ombro, arqueiro chapéu e arco, chefe elmo com chifres.

## Recursos e revisão

Os sprites e fundos são desenhos originais gerados pelo script Python determinístico; o arquivo de abertura foi gerado por IA a partir da direção visual do projeto. Não alegar que é arte manual. Veja ASSETS.md para proveniência e licenças de terceiros.

Inspecionar abertura, tutorial, fase, pausa, câmera negada e mobile. Nenhum texto ou ação principal pode ficar cortado. Movimento reduzido desliga tremor de câmera, piscadas e flashes de impacto.
