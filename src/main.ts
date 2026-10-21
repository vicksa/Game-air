import Phaser from "phaser";
import "./style.css";
import { Quest, type GameEvent } from "./game";
import {
  GestureController,
  classify,
  neutral,
  resolveHands,
  type Hand,
} from "./controls";
import { Tracker } from "./tracking";
import { drawHandPreview } from "./hand-monitor";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
document.querySelector("#app")!.innerHTML = `
<header class="topbar"><a class="wordmark" href="./" aria-label="Hand Quest início"><span class="mark">手</span> HAND<span class="red">QUEST</span><small>ARCADE / 001</small></a><div class="top-note"><span class="live-dot"></span> VISÃO COMPUTACIONAL · LOCAL</div><button class="small-button" id="help">COMO JOGAR <span>↗</span></button></header>
<main><div class="chapter"><span>01 / TELHADOS DO AMANHECER</span><span>UM ARCADE. SUAS DUAS MÃOS.</span></div>
<section class="cabinet" aria-label="Jogo Hand Quest">
<div class="play-stage">
<div id="game"></div>
<div id="hud" class="hud hidden"><div><span class="hud-label">NINJA / 01</span><div id="hearts" class="hearts">◆ ◆ ◆ ◆ ◆</div></div><div class="hud-center"><span id="stage-label">TELHADOS DO AMANHECER</span><div class="progress"><i id="progress"></i></div></div><div class="hud-right"><span class="hud-label">INIMIGOS</span><strong id="score">00</strong></div><div id="boss-hud" class="hidden">GUARDIÃO <meter id="boss-life" min="0" max="12" value="12"></meter></div></div>
<div id="title-screen" class="overlay title-screen"><div class="title-copy"><p class="eyebrow"><span></span> MOVIMENTO É PODER</p><h1>HAND<br><span>QUEST</span><b>手の冒険</b></h1><p class="intro">O controle está nas suas mãos.<br>Literalmente.</p><button class="primary" id="camera-start">ATIVAR WEBCAM <span>→</span></button><button class="text-button" id="keyboard-start">JOGAR COM TECLADO <span>↗</span></button><p class="privacy">SEM CADASTRO. IMAGENS PROCESSADAS NO SEU PC.</p></div><div class="hero-stamp"><span>199X</span><b>NO CONTROLLER<br>JUST YOU.</b></div><div class="title-bottom"><span>1 JOGADOR · PIXEL ART ORIGINAL</span><span class="blink">PRESS START _</span></div></div>
<div id="modal" class="overlay modal hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-card"><p id="modal-kicker" class="eyebrow">DOJO / PREPARAÇÃO</p><h2 id="modal-title">Encontre seu equilíbrio.</h2><div id="modal-body"></div><div id="modal-actions"></div></div></div>
<div id="toast" role="status" class="toast hidden"></div><div id="hand-cursor" class="hand-cursor hidden"><i></i></div>
</div>
<aside id="hand-monitor" class="hand-monitor" aria-label="Visualização das mãos em tempo real">
<div class="monitor-header"><span>VISÃO DAS MÃOS</span><strong id="hand-count" role="status">0/2</strong></div>
<div class="monitor-viewport"><video id="webcam" aria-label="Prévia espelhada da webcam" playsinline muted></video><canvas id="landmarks" width="480" height="360" aria-hidden="true"></canvas><span id="camera-placeholder">WEBCAM<br>DESLIGADA</span><span class="mirror-label">ESPELHO / AO VIVO</span></div>
<div class="hand-states"><div id="left-hand-state" class="hand-state hand-left" data-detected="false"><span>ESQUERDA</span><strong id="left-hand-action">NÃO DETECTADA</strong></div><div id="right-hand-state" class="hand-state hand-right" data-detected="false"><span>DIREITA</span><strong id="right-hand-action">NÃO DETECTADA</strong></div></div>
<div class="monitor-status"><p id="tracking-status">Webcam desligada</p><small id="pose-status">Aguardando jogador</small><p class="monitor-hint">Veja aqui se suas duas mãos estão dentro da câmera.</p></div>
<div class="monitor-actions"><button id="monitor-camera-start" class="text-button">ATIVAR CÂMERA ↗</button><button id="recalibrate" class="text-button hidden">RECALIBRAR ↗</button><button id="swap-hands" class="text-button" aria-pressed="false">TROCAR ESQUERDA / DIREITA</button></div>
</aside>
</section>
<section class="control-deck" aria-label="Controles e webcam"><div class="deck-main"><div class="deck-heading"><span class="section-number">操作</span><div><h2>Seu corpo. Seu controle.</h2><p id="control-description">Duas mãos na câmera. Uma missão pela frente.</p></div></div><div class="gestures"><div><span class="gesture-symbol">↔</span><p><b>ESQUERDA</b><span>Mova para andar</span></p></div><div><span class="gesture-symbol">V</span><p><b>DIREITA / V</b><span>Pular</span></p></div><div><span class="gesture-symbol">拳</span><p><b>DIREITA / PUNHO</b><span>Atacar</span></p></div><div><span class="gesture-symbol">掌</span><p><b>DIREITA / PALMA</b><span>Defender</span></p></div></div></div></section>
<div class="utility-row"><span id="session-status" role="status">PRONTO QUANDO VOCÊ ESTIVER.</span><div><label><input id="reduced-motion" type="checkbox"> Reduzir efeitos</label><button id="pause" class="small-button" disabled>PAUSAR / ESC</button><button id="camera-off" class="small-button hidden">DESLIGAR CÂMERA</button></div></div>
</main><footer><span>HAND QUEST <b>© 2026</b></span><p>Feito de pixels, gestos e um pouco de coragem.</p><span>INSERT YOUR ENERGY ↗</span></footer>`;
const controller = new GestureController();
let mode: "keyboard" | "hands" = "keyboard";
let active = false,
  paused = false,
  calibrating = false,
  trackingReady = false,
  loadingCamera = false;
let pendingHandResume = false,
  pairStableSince = 0,
  hasCalibration = false;
const TRACKING_GRACE = 1200;
let lastFrameAt = 0;
let swapHands = false;
let lastTracked = 0,
  calibrationStart = 0,
  calibrationSamples: number[] = [];
let latestHands: Hand[] = [];
let dwellTarget: HTMLButtonElement | null = null,
  dwellStart = 0;
let pauseReason = "";
export const scene = new Quest(onGameEvent);
export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 640,
  height: 360,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: "#10152d",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 760 }, debug: false },
  },
  scene: [scene],
  audio: { noAudio: true },
});
function onGameEvent(e: GameEvent) {
  if (e.type === "hud") {
    $("hearts").textContent =
      "◆ ".repeat(Math.max(0, e.hp)) + "◇ ".repeat(Math.max(0, 5 - e.hp));
    $("score").textContent = String(e.kills).padStart(2, "0");
    $("progress").style.width = `${e.progress}%`;
    $("boss-hud").classList.toggle("hidden", e.progress < 83 || e.boss <= 0);
    ($("boss-life") as HTMLMeterElement).value = e.boss;
  } else if (e.type === "checkpoint") {
    toast("REFÚGIO ALCANÇADO · +2 VIDA");
  } else {
    active = false;
    paused = false;
    scene.command = neutral();
    $("pause").setAttribute("disabled", "");
    scene.time.delayedCall(550, () => {
      scene.scene.pause();
      showModal(
        e.won ? "O amanhecer é seu." : "O caminho continua.",
        e.won
          ? "<p>O guardião caiu. Você atravessou os telhados usando seu próprio movimento.</p>"
          : "<p>Todo ninja aprende caindo. Respire, ajuste a postura e tente de novo.</p>",
        [
          { text: "JOGAR NOVAMENTE →", action: () => startGame(false) },
          { text: "VOLTAR AO INÍCIO", action: home },
        ],
        e.won ? "MISSÃO CONCLUÍDA" : "FIM DE JOGO",
      );
    });
  }
}
function toast(message: string) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  setTimeout(() => $("toast").classList.add("hidden"), 3000);
}
interface Action {
  text: string;
  action: () => void;
}
function showModal(
  title: string,
  body: string,
  actions: Action[],
  kicker = "DOJO / PREPARAÇÃO",
) {
  calibrating = false;
  pendingHandResume = false;
  $("modal-title").textContent = title;
  $("modal-kicker").textContent = kicker;
  $("modal-body").innerHTML = body;
  $("modal-actions").replaceChildren();
  actions.forEach((a, i) => {
    const button = document.createElement("button");
    button.className = i === 0 ? "primary" : "text-button";
    button.textContent = a.text;
    button.onclick = a.action;
    $("modal-actions").append(button);
  });
  $("modal").classList.remove("hidden");
  dwellTarget = null;
  (
    $("modal-actions").querySelector("button") as HTMLButtonElement | null
  )?.focus();
}
function hideModal() {
  calibrating = false;
  pendingHandResume = false;
  $("modal").classList.add("hidden");
  dwellTarget = null;
}
function instructions() {
  return `<p class="modal-intro">Atravesse a cidade e enfrente o guardião. Siga os lampiões; o refúgio recupera sua vida.</p><div class="tutorial-grid"><p><b>01 / ANDAR</b>${mode === "hands" ? "Desloque sua mão esquerda para os lados. No centro, o ninja para." : "Use ← → ou A / D."}</p><p><b>02 / PULAR</b>${mode === "hands" ? "Faça V com os dedos da mão direita." : "Pressione Espaço."}</p><p><b>03 / ATACAR</b>${mode === "hands" ? "Feche o punho direito. Abra antes do próximo ataque." : "Pressione J."}</p><p><b>04 / DEFENDER</b>${mode === "hands" ? "Mantenha a palma direita aberta." : "Segure K."}</p></div><p class="modal-note">${mode === "hands" ? "Nos menus, a mão direita move o cursor. Mantenha-o sobre um botão por 1,2 segundo para selecionar. Mantenha as duas mãos visíveis." : "ESC pausa. Saltos exigem que o ninja esteja apoiado. Você pode trocar para webcam voltando ao início."}</p>`;
}
function tutorial() {
  showModal(
    "Entre no dojo.",
    instructions(),
    [
      { text: "COMEÇAR MISSÃO →", action: () => startGame(false) },
      { text: "JOGAR COM TECLADO", action: playWithKeyboard },
      { text: "VOLTAR", action: home },
    ],
    "TREINAMENTO / CONTROLES",
  );
}
function startGame(_unused: boolean) {
  hideModal();
  $("title-screen").classList.add("hidden");
  $("hud").classList.remove("hidden");
  scene.scene.resume();
  scene.events.once(Phaser.Scenes.Events.CREATE, () => {
    if (pendingHandResume) scene.scene.pause();
  });
  scene.scene.restart();
  scene.command = neutral();
  controller.reset();
  active = true;
  paused = false;
  pauseReason = "";
  $("pause").removeAttribute("disabled");
  $("pause").textContent = "PAUSAR / ESC";
  $("session-status").textContent =
    mode === "hands"
      ? "MISSÃO ATIVA · CONTROLE POR GESTOS"
      : "MISSÃO ATIVA · CONTROLE POR TECLADO";
  if (mode === "hands") {
    calibrateNeutralIfNeeded();
    if (!trackingReady) waitForHands();
  }
}
function calibrateNeutralIfNeeded() {
  const left = latestHands.find((h) => h.side === "Left");
  if (!hasCalibration && trackingReady && left) {
    controller.center = 1 - left.points[9].x;
    hasCalibration = true;
    controller.reset();
  }
}
function playWithKeyboard() {
  stopCamera();
  mode = "keyboard";
  if (active) resume();
  else startGame(false);
  $("session-status").textContent = "MISSÃO ATIVA · CONTROLE POR TECLADO";
}
function waitForHands() {
  paused = true;
  scene.command = neutral();
  scene.scene.pause();
  showModal(
    "Missão pronta.",
    '<p>Devolva as mãos à câmera. A partida continua automaticamente quando as duas forem reconhecidas — você não precisa clicar de novo.</p><p id="waiting-hands-status" role="status"></p><p class="modal-note">Afaste um pouco as mãos uma da outra e mantenha-as dentro da prévia. Você também pode entrar agora com o teclado.</p>',
    [
      { text: "JOGAR COM TECLADO →", action: playWithKeyboard },
      { text: "RECALIBRAR", action: beginCalibration },
    ],
    "MISSÃO / AGUARDANDO MÃOS",
  );
  pendingHandResume = true;
  $("waiting-hands-status").textContent =
    `Mãos detectadas: ${latestHands.length}/2`;
  $("pause").textContent = "CONTINUAR / ESC";
}
function home() {
  active = false;
  paused = false;
  calibrating = false;
  scene.command = neutral();
  scene.scene.pause();
  hideModal();
  $("title-screen").classList.remove("hidden");
  $("hud").classList.add("hidden");
  $("pause").setAttribute("disabled", "");
  $("session-status").textContent = "PRONTO QUANDO VOCÊ ESTIVER.";
}
function pause(reason = "manual") {
  if (!active || paused) return;
  paused = true;
  pauseReason = reason;
  scene.command = neutral();
  scene.scene.pause();
  $("pause").textContent = "CONTINUAR / ESC";
  showModal(
    reason === "tracking" ? "Cadê suas mãos?" : "Uma pausa no telhado.",
    `<p>${reason === "tracking" ? "O rastreamento foi interrompido. Mostre as duas mãos novamente e selecione continuar quando estiver pronto." : "Respire. Sua missão espera por você."}</p>`,
    [
      { text: "CONTINUAR →", action: resume },
      { text: "JOGAR COM TECLADO", action: playWithKeyboard },
      {
        text: "REVER CONTROLES",
        action: () =>
          showModal("Seu próximo movimento.", instructions(), [
            {
              text: "VOLTAR À PAUSA",
              action: () => {
                paused = false;
                pause(pauseReason);
              },
            },
          ]),
      },
      { text: "VOLTAR AO INÍCIO", action: home },
    ],
    "MISSÃO / PAUSADA",
  );
}
function resume() {
  if (mode === "hands" && !trackingReady) {
    waitForHands();
    return;
  }
  calibrateNeutralIfNeeded();
  hideModal();
  paused = false;
  controller.reset();
  scene.command = neutral();
  scene.scene.resume();
  $("pause").textContent = "PAUSAR / ESC";
}
function beginCalibration() {
  if (active && !paused) pause();
  calibrationStart = 0;
  calibrationSamples = [];
  showModal(
    "Encontre seu equilíbrio.",
    '<p>Fique a uma distância confortável e mostre as duas mãos, separadas, na altura do peito. Mantenha a mão esquerda na posição em que deseja ficar parado.</p><div class="calibration-track"><i id="calibration-fill"></i></div><p id="calibration-status" role="status">Aguardando as duas mãos…</p><p class="modal-note">A prévia é espelhada como um espelho. Evite contraluz. Não cruze as mãos.</p>',
    [
      { text: "COMEÇAR MISSÃO →", action: () => startGame(false) },
      {
        text: "USAR TECLADO",
        action: () => {
          stopCamera();
          mode = "keyboard";
          tutorial();
        },
      },
    ],
    "WEBCAM / CALIBRAÇÃO",
  );
  calibrating = true;
}
async function activateCamera() {
  if (loadingCamera) return;
  loadingCamera = true;
  showModal(
    "Abrindo o dojo…",
    "<p>Autorize a webcam no navegador. Na primeira vez, o modelo de reconhecimento será carregado.</p>",
    [],
    "WEBCAM / CONEXÃO",
  );
  try {
    await tracker.start();
    mode = "hands";
    $("monitor-camera-start").classList.add("hidden");
    hasCalibration = false;
    pairStableSince = 0;
    $("camera-placeholder").classList.add("hidden");
    $("camera-off").classList.remove("hidden");
    $("recalibrate").classList.remove("hidden");
    $("control-description").textContent =
      "Esquerda movimenta. Direita pula, ataca e defende.";
    beginCalibration();
  } catch (e) {
    const message =
      e instanceof DOMException && e.name === "NotAllowedError"
        ? "O navegador não autorizou a câmera. Libere o acesso nas permissões do site e tente novamente."
        : e instanceof DOMException && e.name === "NotFoundError"
          ? "Não encontramos uma webcam conectada."
          : e instanceof Error
            ? e.message
            : "Não foi possível iniciar a webcam.";
    cameraError(message);
  } finally {
    loadingCamera = false;
  }
}
function cameraError(message: string) {
  latestHands = [];
  drawHands([]);
  $("camera-placeholder").classList.remove("hidden");
  $("monitor-camera-start").classList.remove("hidden");
  $("tracking-status").textContent = "Câmera indisponível";
  $("pose-status").textContent = "Tente reconectar a câmera";
  trackingReady = false;
  calibrating = false;
  if (active && !paused) pause("tracking");
  showModal(
    "A câmera precisa de atenção.",
    '<p id="camera-error-message"></p>',
    [
      {
        text: "TENTAR NOVAMENTE →",
        action: () => {
          tracker.stop();
          void activateCamera();
        },
      },
      {
        text: "JOGAR COM TECLADO",
        action: () => {
          stopCamera();
          mode = "keyboard";
          tutorial();
        },
      },
    ],
    "WEBCAM / INDISPONÍVEL",
  );
  $("camera-error-message").textContent = message;
}
function stopCamera() {
  tracker.stop();
  trackingReady = false;
  calibrating = false;
  latestHands = [];
  $("camera-placeholder").classList.remove("hidden");
  $("monitor-camera-start").classList.remove("hidden");
  $("camera-off").classList.add("hidden");
  $("recalibrate").classList.add("hidden");
  $("tracking-status").textContent = "Webcam desligada";
  $("pose-status").textContent = "Aguardando jogador";
  drawHands([]);
  $("hand-cursor").classList.add("hidden");
}
export const tracker = new Tracker(
  $("webcam") as HTMLVideoElement,
  onHands,
  cameraError,
);
function onHands(hands: Hand[], now: number) {
  lastFrameAt = now;
  const resolved = resolveHands(
    swapHands
      ? hands.map((hand) => ({
          ...hand,
          side: hand.side === "Left" ? "Right" : "Left",
        }))
      : hands,
  );
  latestHands = resolved;
  const left = resolved.find((h) => h.side === "Left"),
    right = resolved.find((h) => h.side === "Right");
  trackingReady = !!left && !!right;
  if (trackingReady) {
    lastTracked = now;
    if (!pairStableSince) pairStableSince = now;
  } else pairStableSince = 0;
  if (pendingHandResume) {
    $("waiting-hands-status").textContent =
      `Mãos detectadas: ${resolved.length}/2`;
    if (trackingReady && now - pairStableSince >= 200) resume();
  }
  $("tracking-status").textContent = trackingReady
    ? "Duas mãos conectadas"
    : `Mãos detectadas: ${resolved.length}/2`;
  const cmd = controller.update(resolved, now);
  $("pose-status").textContent = trackingReady
    ? `ESQ: ${cmd.move < 0 ? "←" : cmd.move > 0 ? "→" : "CENTRO"} · DIR: ${{ none: "—", open: "DEFESA", fist: "ATAQUE", victory: "PULO" }[controller.pose]}`
    : resolved.length === 1
      ? `${left ? "Direita" : "Esquerda"} não reconhecida · mostre a palma inteira`
      : "Mostre as palmas, com luz de frente";
  if (active && !paused) {
    scene.command.move = cmd.move;
    scene.command.defend = cmd.defend;
    scene.command.jump ||= cmd.jump;
    scene.command.attack ||= cmd.attack;
  }
  if (calibrating && left && right) {
    if (!calibrationStart) calibrationStart = now;
    calibrationSamples.push(1 - left.points[9].x);
    const progress = Math.min(1, (now - calibrationStart) / 1800);
    $("calibration-fill").style.width = `${progress * 100}%`;
    $("calibration-status").textContent = "Mantenha a posição…";
    if (progress === 1) {
      controller.center =
        calibrationSamples.reduce((a, b) => a + b, 0) /
        calibrationSamples.length;
      controller.reset();
      hasCalibration = true;
      calibrating = false;
      if (active) {
        showModal(
          "Calibração concluída.",
          "<p>Sua posição neutra foi atualizada.</p>",
          [{ text: "CONTINUAR →", action: resume }],
        );
      } else tutorial();
    }
  } else if (calibrating && now - lastTracked > 250) {
    calibrationStart = 0;
    calibrationSamples = [];
    $("calibration-fill").style.width = "0%";
    $("calibration-status").textContent = "Aguardando as duas mãos…";
  }
  drawHands(resolved);
}
function drawHands(hands: Hand[]) {
  drawHandPreview($("landmarks") as HTMLCanvasElement, hands);
  const write = (id: string, value: string) => {
    if ($(id).textContent !== value) $(id).textContent = value;
  };
  write("hand-count", `${hands.length}/2`);
  for (const side of ["Left", "Right"] as const) {
    const hand = hands.find((h) => h.side === side);
    const prefix = side === "Left" ? "left" : "right";
    $(`${prefix}-hand-state`).dataset.detected = String(!!hand);
    const pose = hand ? classify(hand.points) : "none";
    const action = !hand
      ? "NÃO DETECTADA"
      : side === "Left"
        ? "MÃO VISÍVEL · ANDAR"
        : {
            open: "PALMA · DEFENDER",
            fist: "PUNHO · ATACAR",
            victory: "V · PULAR",
            none: "MÃO VISÍVEL",
          }[pose];
    write(`${prefix}-hand-action`, action);
  }
}

function tick(now: number) {
  if (
    mode === "hands" &&
    latestHands.length > 0 &&
    now - lastFrameAt > TRACKING_GRACE
  ) {
    trackingReady = false;
    latestHands = [];
    drawHands([]);
    scene.command = neutral();
  }
  if (
    mode === "hands" &&
    active &&
    !paused &&
    now - lastTracked > TRACKING_GRACE
  )
    pause("tracking");
  const hand = latestHands.find((h) => h.side === "Right");
  const cursor = $("hand-cursor");
  if (
    mode === "hands" &&
    hand &&
    (!$("modal").classList.contains("hidden") ||
      !$("title-screen").classList.contains("hidden"))
  ) {
    const box = document.querySelector(".play-stage")!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (1 - hand.points[8].x - 0.1) / 0.8)),
      y = Math.max(0, Math.min(1, (hand.points[8].y - 0.1) / 0.8));
    cursor.classList.remove("hidden");
    cursor.style.left = `${x * 100}%`;
    cursor.style.top = `${y * 100}%`;
    const target = document
      .elementFromPoint(box.left + x * box.width, box.top + y * box.height)
      ?.closest("button") as HTMLButtonElement | null;
    if (target && !target.disabled) {
      if (target !== dwellTarget) {
        dwellTarget = target;
        dwellStart = now;
      }
      const progress = Math.min(1, (now - dwellStart) / 1200);
      cursor.style.setProperty("--dwell", `${progress * 360}deg`);
      if (progress === 1) {
        dwellTarget = null;
        latestHands = [];
        target.click();
      }
    } else {
      dwellTarget = null;
      cursor.style.setProperty("--dwell", "0deg");
    }
  } else {
    cursor.classList.add("hidden");
    dwellTarget = null;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
$("camera-start").onclick = () => void activateCamera();
$("monitor-camera-start").onclick = () => {
  if (active && !paused) pause();
  void activateCamera();
};
drawHands([]);
$("keyboard-start").onclick = () => {
  mode = "keyboard";
  stopCamera();
  tutorial();
};
$("pause").onclick = () => (paused ? resume() : pause());
$("help").onclick = () => {
  if (active && !paused) pause();
  showModal(
    "Suas mãos fazem a história.",
    instructions(),
    [
      {
        text: active ? "VOLTAR À MISSÃO →" : "ENTENDI →",
        action: () => (active ? resume() : hideModal()),
      },
    ],
    "HAND QUEST / MANUAL",
  );
};
$("recalibrate").onclick = beginCalibration;
$("swap-hands").onclick = () => {
  swapHands = !swapHands;
  $("swap-hands").setAttribute("aria-pressed", String(swapHands));
  $("swap-hands").textContent = swapHands
    ? "LADOS TROCADOS · DESFAZER"
    : "TROCAR ESQUERDA / DIREITA";
  hasCalibration = false;
  controller.reset();
  latestHands = [];
  trackingReady = false;
  pairStableSince = 0;
  scene.command = neutral();
  drawHands([]);
  if (mode === "hands") {
    if (active) pause("tracking");
    beginCalibration();
  }
};
$("camera-off").onclick = () => {
  if (active && !paused) pause();
  stopCamera();
  mode = "keyboard";
  toast("Câmera desligada. Use A/D, Espaço, J e K.");
};
($("reduced-motion") as HTMLInputElement).checked = matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
scene.reducedMotion = ($("reduced-motion") as HTMLInputElement).checked;
document.body.classList.toggle("reduced-motion", scene.reducedMotion);
$("reduced-motion").onchange = () => {
  scene.reducedMotion = ($("reduced-motion") as HTMLInputElement).checked;
  document.body.classList.toggle("reduced-motion", scene.reducedMotion);
};
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && active) {
    e.preventDefault();
    paused ? resume() : pause();
  }
  if (active && ["Space", "ArrowLeft", "ArrowRight"].includes(e.code))
    e.preventDefault();
});
window.addEventListener("blur", () => pause());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("pagehide", () => tracker.stop());
// Keep the title scene alive as a backdrop, then pause until the player starts.
game.events.once("ready", () => {
  scene.events.once("create", () => {
    if (!active) scene.scene.pause();
  });
});
