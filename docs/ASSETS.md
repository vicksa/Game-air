# Proveniência e licenças

## Arte original do projeto

- `public/assets/title-art.png`: ilustração gerada por IA para este projeto em 21/10/2026. Direção: arcade ninja original dos anos 90, cidade sob chuva, céu índigo, iluminação âmbar, lua vermelha, ninja com lenço vermelho à direita e área calma à esquerda. Não foi usada imagem de personagem de terceiros como referência.
- `ninja.png`, `guard.png`, `archer.png`, `boss.png`: desenhos procedurais originais em Pillow, reproduzíveis por `scripts/generate_assets.py`; 288×336, com quadros de 48×48.
- `city-0.png`, `city-1.png`, `city-2.png`, `platform.png`, `spikes.png`: fundos, plataformas e obstáculos originais do mesmo script. A semente fixa torna a geração determinística.
- `atlas.json`: índices, taxa de quadros, repetição e ponto de origem dos personagens.

O repositório é privado e não concede uma licença pública para o código e a arte original. As dependências de terceiros conservam suas licenças próprias.

## Terceiros

| Recurso                                   | Origem                                                                                                         | Licença                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Phaser 3.90.0                             | https://github.com/phaserjs/phaser                                                                             | MIT; cópia em `public/licenses/Phaser-MIT.txt`                                                                                   |
| MediaPipe Tasks Vision 0.10.35, JS e WASM | https://www.npmjs.com/package/@mediapipe/tasks-vision                                                          | Apache 2.0; cópia em `public/licenses/MediaPipe-Apache-2.0.txt`                                                                  |
| Hand Landmarker, float16, versão 1        | https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task | Modelo distribuído pelo projeto MediaPipe; documentação em https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker |
| Barlow Condensed, 600/700/800/900         | Google Fonts, https://github.com/google/fonts/tree/main/ofl/barlowcondensed                                    | SIL Open Font License; cópia em `public/fonts/BarlowCondensed-OFL.txt`                                                           |
| IBM Plex Mono, 400/500/600                | Google Fonts, https://github.com/google/fonts/tree/main/ofl/ibmplexmono                                        | SIL Open Font License; cópia em `public/fonts/IBMPlexMono-OFL.txt`                                                               |

SHA-256 do modelo incluído: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`.

Modelo e WASM estão versionados para que a execução não dependa de CDNs nem de downloads adicionais de modelos. Ao atualizar a versão npm do MediaPipe, copie também os arquivos WASM correspondentes de `node_modules/@mediapipe/tasks-vision/wasm/` para `public/vendor/mediapipe/`, valide no navegador e atualize esta documentação.
