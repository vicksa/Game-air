# Validação — 21/10/2026

## História verificada

O jogador abre a demo, escolhe webcam ou teclado, lê o tutorial, controla o ninja, enfrenta inimigos e chega a uma tela de fim. Para webcam, o navegador fornece vídeo ao MediaPipe local, que retorna pontos das mãos; o interpretador converte pontos em comandos do Phaser. Não há backend nem upload de vídeo.

## Evidências

- `npm test`: sete testes aprovados. Cobrem poses aberta/punho/V, rotação dos pontos, entrada incompleta, confirmação temporal, uma ação por gesto, tremores, movimento junto com pulo, perda de mão, baixa confiança e centro calibrado.
- `npm run build`: TypeScript e build de produção aprovados. O bundle contém o motor Phaser e o MediaPipe; Vite avisa que é maior que 500 kB, sem impedir a geração. Não há segredo ou variável de ambiente necessária.
- `npm run test:e2e`: seis testes Chromium aprovados. Abertura/tutorial/movimento/pulo/pausa/retorno; permissão negada com alternativa por teclado; ações inteiramente visíveis em 390 px; inicialização real do WASM/modelo com câmera sintética; checkpoint, queda, derrota/reinício; defesa e vitória pelo caminho de ataque e colisão.
- O teste de câmera sintética confirmou que nenhuma requisição externa foi feita e que o runtime chegou à calibração sem erro JavaScript. A imagem sintética não contém mãos: isso valida o carregamento e o fluxo de câmera, não a qualidade dos gestos físicos.
- Os cenários de checkpoint e chefe posicionam atores pelo módulo do jogo para exercitar as regras sem depender de uma partida longa. Não equivalem a uma partida inteira jogada por uma pessoa.
- Capturas de abertura, fase e tela estreita foram inspecionadas visualmente. Foi corrigido um corte dos botões em tela estreita; os testes agora exigem visibilidade integral. Há capturas de vitória nos resultados do navegador.

- Smoke test do build de produção (`npm run preview`): inicialização do modelo com câmera sintética e partida por teclado aprovadas, sem erros JavaScript, respostas HTTP de erro ou requisições externas.

## Publicação no GitHub

O projeto foi commitado localmente. O usuário forneceu `vicksa/Game-air` como destino após a integração recusar a criação de um novo repositório. O usuário autorizou explicitamente o envio público do código e da arte em `vicksa/Game-air`. O fluxo de CI está configurado para executar no GitHub a cada push.

## Ainda requer teste físico

- Chrome e Edge com webcam real, duas mãos e diferentes níveis de iluminação.
- Confirmar esquerda/direita anatômicas no computador do jogador; ajustar a conversão de handedness em `src/tracking.ts` se a câmera/driver apresentar imagem invertida.
- Calibração, gestos simultâneos, estabilidade do V/punho/palma e ergonomia do cursor por permanência com mãos reais.
- Taxa de quadros e latência em computadores menos potentes; não há medição de desempenho em hardware do usuário.
- Ajuste de dificuldade e conforto durante uma partida inteira controlada por gestos.

## Revisão manual sugerida

Autorize a webcam; mantenha ambas as mãos visíveis; calibre por 1,8 s; teste andar e pular juntos. Segure o punho e confirme que há apenas um ataque; abra e feche para atacar outra vez. Retire uma mão e aguarde a pausa; recupere o rastreamento e selecione continuar. Recalibre, desligue a câmera e confira o indicador do navegador. Ative reduzir efeitos e verifique ausência de tremor e piscadas. Abra `/sprites.html` para revisar cada animação.
