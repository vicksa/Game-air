# Fotografia para testes

`hands.jpg` vem do projeto TensorFlow.js Models, licença Apache 2.0.

Fonte: https://github.com/tensorflow/tfjs-models/blob/master/hand-pose-detection/test_data/hands.jpg

Os testes transformam a fotografia em um stream local de canvas e passam esses pixels pelos modelos reais, sem injetar landmarks. Isso verifica presença de duas mãos em uma imagem conhecida, e não substitui webcam física, movimento, iluminação ou oclusão.
