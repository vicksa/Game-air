# Proveniência e licenças

## Arte original do projeto

- `public/assets/title-art.png`: ilustração gerada por IA para este projeto em 21/10/2026. Direção: arcade ninja original dos anos 90, cidade sob chuva, céu índigo, iluminação âmbar, lua vermelha, ninja com lenço vermelho à direita e área calma à esquerda. Não foi usada imagem de personagem de terceiros como referência.
- `ninja.png`, `guard.png`, `archer.png`, `boss.png`: desenhos procedurais originais em Pillow, reproduzíveis por `scripts/generate_assets.py`; 288×336, com quadros de 48×48.
- `city-0.png`, `city-1.png`, `city-2.png`, `platform.png`, `spikes.png`: fundos, plataformas e obstáculos originais do mesmo script. A semente fixa torna a geração determinística.
- `atlas.json`: índices, taxa de quadros, repetição e ponto de origem dos personagens.

O repositório é público; a publicação não concede uma licença adicional para a arte original. As dependências de terceiros conservam suas licenças próprias.

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

## Reconhecimento compatível sem WebGL

- TensorFlow.js Core/Converter/WASM 4.22.0 e Hand Pose Detection 2.0.1: Apache 2.0, projetos oficiais TensorFlow. O JS é empacotado em um chunk carregado sob demanda; binários WASM ficam em `public/vendor/tfjs/`. Licença em `public/licenses/TensorFlowJS-Apache-2.0.txt`.
- Modelos MediaPipe Handpose 3D, detector-lite e landmark-lite, versão 1: Apache 2.0, obtidos do catálogo oficial https://www.kaggle.com/models/mediapipe/handpose-3d e incluídos em `public/models/tfjs/`. Downloads públicos: `/api/v1/models/mediapipe/handpose-3d/TfJs/detector-lite/1/download` e `/api/v1/models/mediapipe/handpose-3d/TfJs/landmark-lite/1/download`. Nenhum vídeo é enviado ao Kaggle ou TensorFlow durante o jogo.
- `tests/fixtures/hands.jpg`: fotografia de teste do repositório oficial TensorFlow.js Models (Apache 2.0), https://github.com/tensorflow/tfjs-models/blob/master/hand-pose-detection/test_data/hands.jpg. É usada somente pelos testes, não publicada como recurso do jogo.

SHA-256 dos arquivos de modelos compatíveis:

- `public/models/tfjs/detector/group1-shard1of1.bin`: `8ba46d2152f48320cdb8835854f53d469dc6a33933099ff89929755ca1a88d51`.
- `public/models/tfjs/detector/model.json`: `2de2e139e240169c9794c21676b8ca94da2bbc0146a3e0664133ce66e021b1a5`.
- `public/models/tfjs/landmark/group1-shard1of1.bin`: `444bee1c7d6d330991bd3ce840a95d0c0afcc3a3fcec47c0c3b7f66a3f3533b0`.
- `public/models/tfjs/landmark/model.json`: `2d6bd4d3b34a684e96293ff71e31f9fbc1b4922e0a88d82184cb584055ff3783`.
