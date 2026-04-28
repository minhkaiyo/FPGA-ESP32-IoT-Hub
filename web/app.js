const boardProfiles = {
  "de2i-150": {
    label: "Terasic DE2i-150",
    chip: "Cyclone IV GX",
    leds: 18,
    switches: 18,
    channels: ["D0", "D1", "D2", "D3", "D4", "D5", "CLK", "RST"],
    capabilities: [
      ["GPIO matrix", "LED, switch, button, header expansion"],
      ["7-segment + LCD", "Text, hex counter, debug status"],
      ["VGA / framebuffer", "Pattern, scope view, raw pixel stream"],
      ["Audio DSP", "Codec bridge, FFT meter, tone generator"],
      ["SDRAM / SRAM", "Memory test, DMA window, register dump"],
      ["UART / SPI / I2C", "ESP32 lam bridge cau lenh cho FPGA"],
      ["Logic analyzer", "Capture tin hieu noi bo theo trigger"],
      ["PWM / motor", "PWM duty, servo, stepper pulse train"]
    ]
  },
  "de2-115": {
    label: "Terasic DE2-115",
    chip: "Cyclone IV E",
    leds: 18,
    switches: 18,
    channels: ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7"],
    capabilities: [
      ["GPIO matrix", "LED, switch, button, GPIO header"],
      ["7-segment + LCD", "8 digit display va LCD 16x2"],
      ["VGA / camera", "Pattern, camera preview, framebuffer"],
      ["Audio codec", "Line in/out, tone, filter demo"],
      ["SDRAM / Flash", "Memory test va stream block"],
      ["Ethernet helper", "ESP32 lam gateway neu khong dung PHY"],
      ["Logic analyzer", "Capture nhieu kenh toc do cao"],
      ["PS/2 / IR", "Input bridge cho demo dieu khien"]
    ]
  },
  "de10-lite": {
    label: "Terasic DE10-Lite",
    chip: "MAX 10",
    leds: 10,
    switches: 10,
    channels: ["D0", "D1", "D2", "D3", "ADC0", "ADC1", "CLK", "RST"],
    capabilities: [
      ["GPIO matrix", "LED, switch, button"],
      ["7-segment", "Hex display va counter"],
      ["ADC telemetry", "Doc cam bien analog qua MAX 10 ADC"],
      ["VGA", "Pattern va framebuffer don gian"],
      ["SDRAM", "Memory test neu board co module"],
      ["SPI bridge", "ESP32 gui thanh ghi cau hinh"],
      ["PWM", "Motor, LED dimming, servo"],
      ["Logic analyzer", "Capture theo trigger"]
    ]
  },
  generic: {
    label: "Generic FPGA board",
    chip: "FPGA",
    leds: 8,
    switches: 8,
    channels: ["D0", "D1", "D2", "D3", "CLK", "RST"],
    capabilities: [
      ["GPIO", "Read/write pin bank"],
      ["Register map", "Doc ghi thanh ghi FPGA"],
      ["Stream", "Gui nhan frame du lieu"],
      ["Analyzer", "Capture logic co ban"],
      ["Display", "LED, 7-seg, VGA neu co"],
      ["Peripheral", "UART, SPI, I2C, PWM"],
      ["Sensor", "ESP32 doc sensor va dong bo FPGA"],
      ["OTA config", "Nap cau hinh runtime qua gateway"]
    ]
  }
};

const firebasePreset = {
  apiKey: "AIzaSyDdJFdnQTXILXLmI1XHl1leUlprn61CBKo",
  authDomain: "esp32-5e620.firebaseapp.com",
  projectId: "esp32-5e620",
  storageBucket: "esp32-5e620.firebasestorage.app",
  messagingSenderId: "731967187178",
  appId: "1:731967187178:web:c4cf84af7a44602a908f93",
  measurementId: "G-W3SFSBH58Y",
  databaseURL: "https://esp32-5e620-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const state = {
  mode: "websocket",
  connected: false,
  transport: null,
  boardKey: "de2i-150",
  packets: 0,
  latency: null,
  leds: [],
  switches: [],
  keys: [0, 0, 0, 0],
  channels: {},
  logs: [],
  telemetry: {
    temp: 34.2,
    vcore: 1.11,
    clock: 50
  },
  lastPhysicalSwitchBits: -1,
  lastPhysicalKeyBits: -1,
  devices: [
    { id: "esp32-fpga-main", ip: "192.168.4.1", board: "DE2i-150", status: "demo", rssi: "-42 dBm" },
    { id: "lab-node-02", ip: "192.168.1.88", board: "DE2-115", status: "idle", rssi: "-61 dBm" }
  ],
  signal: Array.from({ length: 140 }, (_, i) => Math.sin(i / 7) * 0.5 + 0.5),
  firebase: {
    app: null,
    db: null,
    firestore: null,
    modules: null,
    inboundUnsub: null,
    eventsUnsub: null,
    heartbeatTimer: null,
    persistTimer: null,
    lastInboundTs: 0
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  statusDot: $("#statusDot"),
  statusText: $("#statusText"),
  statusSubtext: $("#statusSubtext"),
  metricEsp: $("#metricEsp"),
  metricFpga: $("#metricFpga"),
  metricLatency: $("#metricLatency"),
  metricPackets: $("#metricPackets"),
  boardSelect: $("#boardSelect"),
  transportPill: $("#transportPill"),
  connectionForm: $("#connectionForm"),
  connectBtn: $("#connectBtn"),
  disconnectBtn: $("#disconnectBtn"),
  wsUrl: $("#wsUrl"),
  restUrl: $("#restUrl"),
  token: $("#deviceToken"),
  firebaseApiKey: $("#firebaseApiKey"),
  firebaseAuthDomain: $("#firebaseAuthDomain"),
  firebaseDatabaseUrl: $("#firebaseDatabaseUrl"),
  firebaseProjectId: $("#firebaseProjectId"),
  firebaseAppId: $("#firebaseAppId"),
  firebaseBasePath: $("#firebaseBasePath"),
  commandEditor: $("#commandEditor"),
  ledGrid: $("#ledGrid"),
  switchGrid: $("#switchGrid"),
  logView: $("#logView")
};

function init() {
  loadSavedConfig();
  initBoardSelect();
  bindEvents();
  updateModeButtons();
  applyBoardProfile();
  updateConnectionState(false, "Offline", "Chua ket noi ESP32");
  setDefaultCommand();
  addLog("system", "Web trung gian san sang. Ket noi ESP32 qua WebSocket.");
}

function loadSavedConfig() {
  const saved = localStorage.getItem("esp32FpgaHubConfig");
  if (!saved) return;

  try {
    const config = JSON.parse(saved);
    state.boardKey = config.boardKey || state.boardKey;
    state.mode = config.mode || state.mode;
    if (config.wsUrl) els.wsUrl.value = config.wsUrl;
    if (config.restUrl) els.restUrl.value = config.restUrl;
    if (config.token) els.token.value = config.token;
    if (config.firebaseApiKey) els.firebaseApiKey.value = config.firebaseApiKey;
    if (config.firebaseAuthDomain) els.firebaseAuthDomain.value = config.firebaseAuthDomain;
    if (config.firebaseDatabaseUrl || config.firebaseProjectId) {
      els.firebaseDatabaseUrl.value = normalizeFirebaseDatabaseUrl(
        config.firebaseDatabaseUrl || "",
        config.firebaseProjectId || ""
      );
    }
    if (config.firebaseProjectId) els.firebaseProjectId.value = config.firebaseProjectId;
    if (config.firebaseAppId) els.firebaseAppId.value = config.firebaseAppId;
    if (config.firebaseBasePath) els.firebaseBasePath.value = config.firebaseBasePath;
  } catch {
    localStorage.removeItem("esp32FpgaHubConfig");
  }
}

function normalizeFirebaseDatabaseUrl(databaseURL, projectId) {
  const trimmed = String(databaseURL || "").trim().replace(/\/+$/, "");
  if (projectId === firebasePreset.projectId) {
    const legacy = `https://${firebasePreset.projectId}-default-rtdb.firebaseio.com`;
    if (!trimmed || trimmed === legacy) return firebasePreset.databaseURL;
  }

  if (!trimmed && projectId) {
    return `https://${projectId}-default-rtdb.firebasedatabase.app`;
  }
  return trimmed;
}

function saveConfig() {
  localStorage.setItem("esp32FpgaHubConfig", JSON.stringify({
    boardKey: state.boardKey,
    mode: state.mode,
    wsUrl: els.wsUrl.value.trim(),
    restUrl: els.restUrl.value.trim(),
    token: els.token.value.trim(),
    firebaseApiKey: els.firebaseApiKey.value.trim(),
    firebaseAuthDomain: els.firebaseAuthDomain.value.trim(),
    firebaseDatabaseUrl: els.firebaseDatabaseUrl.value.trim(),
    firebaseProjectId: els.firebaseProjectId.value.trim(),
    firebaseAppId: els.firebaseAppId.value.trim(),
    firebaseBasePath: els.firebaseBasePath.value.trim()
  }));
}

function initBoardSelect() {
  els.boardSelect.innerHTML = Object.entries(boardProfiles)
    .map(([key, profile]) => `<option value="${key}">${profile.label}</option>`)
    .join("");
  els.boardSelect.value = state.boardKey;
}

function bindEvents() {
  $$(".segment").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  els.connectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    connect();
  });

  els.disconnectBtn.addEventListener("click", disconnect);
  els.boardSelect.addEventListener("change", () => {
    state.boardKey = els.boardSelect.value;
    applyBoardProfile();
    saveConfig();
    queuePersistRuntimeState();
    sendCommand({ type: "fpga.profile", board: state.boardKey });
  });

  $("#sendCustomBtn").addEventListener("click", sendCustomCommand);
  $("#hexApplyBtn").addEventListener("click", applyHex);
  $("#lcdApplyBtn").addEventListener("click", applyLcd);
  $("#vgaApplyBtn").addEventListener("click", applyVga);
  $("#sdListBtn").addEventListener("click", () => {
    $("#sdFileList").innerHTML = "Dang quet the SD...";
    sendCommand({ type: "fpga.sd", action: "list" });
  });
  $("#sdReadBtn").addEventListener("click", () => {
    const filename = $("#sdFileName").value.trim();
    if (filename) {
      $("#sdContent").value = "Dang doc file " + filename + "...";
      sendCommand({ type: "fpga.sd", action: "read", filename: filename });
    }
  });
  $("#panicBtn").addEventListener("click", panicStop);
  $("#clearLogBtn").addEventListener("click", () => {
    state.logs = [];
    renderLog();
    queuePersistRuntimeState();
  });
  $("#exportConfigBtn").addEventListener("click", exportConfig);
}

function setMode(mode) {
  if (mode !== state.mode && (state.connected || state.transport)) {
    disconnect(false);
  }
  state.mode = mode;
  updateModeButtons();
  els.transportPill.textContent = mode;
  saveConfig();
  addLog("ui", `Da chon che do ${mode}.`);
}

function updateModeButtons() {
  $$(".segment").forEach((button) => button.classList.toggle("active", button.dataset.mode === state.mode));
  els.transportPill.textContent = state.mode;
}

function applyBoardProfile() {
  const profile = boardProfiles[state.boardKey];
  state.leds = Array.from({ length: profile.leds }, (_, i) => state.leds[i] || 0);
  state.switches = Array.from({ length: profile.switches }, (_, i) => state.switches[i] || 0);
  state.channels = Object.fromEntries(profile.channels.map((channel) => [channel, state.channels[channel] ?? true]));

  els.metricFpga.textContent = profile.label;
  renderLeds();
  renderSwitches();
  renderKeys();
  setDefaultCommand();
}

function renderCapabilities(profile) {
  els.capabilityGrid.innerHTML = profile.capabilities
    .map(([title, description]) => `
      <button class="capability" type="button" data-capability="${title}">
        <strong>${title}</strong>
        <span>${description}</span>
      </button>
    `)
    .join("");

  $$(".capability").forEach((button) => {
    button.addEventListener("click", () => {
      sendCommand({
        type: "fpga.capability.select",
        board: state.boardKey,
        capability: button.dataset.capability
      });
    });
  });
}

function renderLeds() {
  els.ledGrid.innerHTML = state.leds
    .map((value, index) => `<button class="led-button ${value ? "on" : ""}" data-led="${index}" type="button">L${index}</button>`)
    .join("");

  $$(".led-button").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.led);
      state.leds[index] = state.leds[index] ? 0 : 1;
      renderLeds();
      sendCommand({ type: "fpga.write", target: "gpio.led", index, value: state.leds[index] });
    });
  });
}

function renderSwitches() {
  els.switchGrid.innerHTML = state.switches.slice(0, 8)
    .map((value, index) => `
      <button class="switch-card" data-switch="${index}" type="button">
        <span>SW${index}</span>
        <span class="toggle ${value ? "on" : ""}" aria-hidden="true"></span>
      </button>
    `)
    .join("");

  $$(".switch-card").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.switch);
      state.switches[index] = state.switches[index] ? 0 : 1;
      renderSwitches();
      sendCommand({ type: "fpga.write", target: "gpio.switch-mirror", index, value: state.switches[index] });
    });
  });
}

function renderKeys() {
  const keyGrid = $("#keyGrid");
  if (!keyGrid) return;
  keyGrid.innerHTML = state.keys.map((value, index) => `
    <div class="key-card" data-key="${index}" style="cursor: pointer; flex: 1; padding: 8px; text-align: center; border-radius: 4px; font-weight: bold; font-family: monospace; transition: all 0.2s; background: ${value ? '#ef4444' : '#27272a'}; color: ${value ? '#fff' : '#a1a1aa'}; box-shadow: ${value ? '0 0 10px rgba(239, 68, 68, 0.5)' : 'none'};">
      KEY${index}
    </div>
  `).join("");

  $$(".key-card").forEach((button) => {
    const trigger = (val) => {
      const index = Number(button.dataset.key);
      if (state.keys[index] !== val) {
        state.keys[index] = val;
        renderKeys();
        sendCommand({ type: "fpga.write", target: "gpio.key-mirror", index, value: val });
      }
    };
    button.addEventListener("mousedown", () => trigger(1));
    button.addEventListener("mouseup", () => trigger(0));
    button.addEventListener("mouseleave", () => trigger(0));
  });
}

function setDefaultCommand() {
  els.commandEditor.value = JSON.stringify({
    type: "fpga.write",
    board: state.boardKey,
    target: "register",
    address: "0x0004",
    value: "0x00000001",
    token: els.token.value.trim()
  }, null, 2);
}

async function connect() {
  saveConfig();
  disconnect(false);

  if (state.mode === "websocket") {
    connectWebSocket();
    return;
  }

  if (state.mode === "serial") {
    await connectSerial();
    return;
  }

  if (state.mode === "rest") {
    await pingRest();
    return;
  }

  if (state.mode === "firebase") {
    await connectFirebase();
  }
}

function connectWebSocket() {
  const url = els.wsUrl.value.trim();
  if (!url) {
    addLog("error", "Thieu WebSocket URL.");
    return;
  }

  try {
    const socket = new WebSocket(url);
    state.transport = socket;
    updateConnectionState(false, "Dang ket noi", url);

    socket.addEventListener("open", () => {
      updateConnectionState(true, "WebSocket online", url);
      sendCommand({ type: "hello", role: "web", board: state.boardKey, token: els.token.value.trim() });
    });
    socket.addEventListener("message", (event) => handleIncoming(event.data));
    socket.addEventListener("close", () => {
      updateConnectionState(false, "WebSocket closed", "ESP32 da ngat ket noi");
      state.transport = null;
    });
    socket.addEventListener("error", () => {
      addLog("error", "Loi WebSocket. Kiem tra IP, port va firmware ESP32.");
    });
  } catch (error) {
    addLog("error", error.message);
  }
}

async function connectSerial() {
  if (!("serial" in navigator)) {
    addLog("error", "Trinh duyet nay chua ho tro Web Serial. Dung Chrome/Edge desktop.");
    return;
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    state.transport = { type: "serial", port };
    updateConnectionState(true, "Serial online", "USB 115200 baud");
    readSerialLoop(port);
    sendCommand({ type: "hello", role: "web-serial", board: state.boardKey, token: els.token.value.trim() });
  } catch (error) {
    addLog("error", error.message);
  }
}

async function readSerialLoop(port) {
  const decoder = new TextDecoderStream();
  port.readable.pipeTo(decoder.writable).catch(() => {});
  const reader = decoder.readable.getReader();
  let buffer = "";

  while (state.transport?.port === port) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    lines.filter(Boolean).forEach(handleIncoming);
  }
}

async function pingRest() {
  const ok = await sendRest({ type: "ping", token: els.token.value.trim() });
  if (ok) {
    updateConnectionState(true, "REST online", els.restUrl.value.trim());
  }
}

function disconnect(writeLog = true) {
  if (state.transport instanceof WebSocket) {
    state.transport.close();
  }

  if (state.transport?.port) {
    state.transport.port.close().catch(() => {});
  }
  stopFirebaseBridge();

  state.transport = null;
  updateConnectionState(false, "Offline", "Chua ket noi ESP32");
  if (writeLog) addLog("system", "Da ngat ket noi.");
}

function updateConnectionState(connected, text, subtext) {
  state.connected = connected;
  els.statusDot.classList.toggle("online", connected);
  els.statusDot.classList.toggle("offline", !connected);
  els.statusText.textContent = text;
  els.statusSubtext.textContent = subtext;
  els.metricEsp.textContent = connected ? "online" : "offline";
  els.transportPill.textContent = state.mode;
}

async function sendCommand(command) {
  const payload = {
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()),
    ts: Date.now(),
    board: state.boardKey,
    token: els.token.value.trim(),
    ...command
  };

  const start = performance.now();
  let sent = false;

  if (state.mode === "websocket" && state.transport instanceof WebSocket && state.transport.readyState === WebSocket.OPEN) {
    state.transport.send(JSON.stringify(payload));
    sent = true;
  } else if (state.mode === "serial" && state.transport?.port?.writable) {
    await writeSerial(JSON.stringify(payload) + "\n");
    sent = true;
  } else if (state.mode === "rest") {
    sent = await sendRest(payload);
  } else if (state.mode === "firebase") {
    sent = await sendFirebase(payload);
  } else if (!state.connected) {
    sent = true;
  }

  state.packets += 1;
  state.latency = Math.round(performance.now() - start);
  updateMetrics();
  addLog(sent ? "tx" : "drop", JSON.stringify(payload));
  if (sent) queuePersistRuntimeState();

  // Optional Firestore logging; failures should not break control flow.
  if (sent && state.firebase.firestore && !["ping", "hello"].includes(command.type)) {
    saveActivityToFirestore(payload);
  }
}

async function saveActivityToFirestore(data) {
  try {
    if (!state.firebase.modules?.fs || !state.firebase.firestore) return;
    const { addDoc, collection, serverTimestamp } = state.firebase.modules.fs;
    await addDoc(collection(state.firebase.firestore, "activity_logs"), {
      ...data,
      server_ts: serverTimestamp()
    });
  } catch (error) {
    addLog("warn", `Firestore log skipped: ${error.message}`);
  }
}

async function writeSerial(text) {
  const writer = state.transport.port.writable.getWriter();
  const data = new TextEncoder().encode(text);
  await writer.write(data);
  writer.releaseLock();
}

async function sendRest(payload) {
  try {
    const response = await fetch(els.restUrl.value.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    if (text) handleIncoming(text);
    return response.ok;
  } catch (error) {
    addLog("error", `REST failed: ${error.message}`);
    return false;
  }
}

function getFirebaseConfig() {
  const projectId = els.firebaseProjectId.value.trim() || firebasePreset.projectId;
  const databaseURLInput = els.firebaseDatabaseUrl.value.trim();
  const inferredDatabaseURL = projectId ? `https://${projectId}-default-rtdb.firebasedatabase.app` : "";
  const normalizedDatabaseURL = normalizeFirebaseDatabaseUrl(
    databaseURLInput || firebasePreset.databaseURL || inferredDatabaseURL,
    projectId
  );

  return {
    apiKey: els.firebaseApiKey.value.trim() || firebasePreset.apiKey,
    authDomain: els.firebaseAuthDomain.value.trim() || firebasePreset.authDomain,
    databaseURL: normalizedDatabaseURL,
    projectId,
    appId: els.firebaseAppId.value.trim() || firebasePreset.appId,
    storageBucket: firebasePreset.storageBucket,
    messagingSenderId: firebasePreset.messagingSenderId,
    measurementId: firebasePreset.measurementId,
    basePath: sanitizeFirebasePath(els.firebaseBasePath.value.trim() || "esp32-fpga-hub")
  };
}

function sanitizeFirebasePath(path) {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function getFirebaseNodeRoot() {
  const config = getFirebaseConfig();
  const token = els.token.value.trim() || "esp32-fpga-local";
  return `${config.basePath}/nodes/${token}`;
}

function validateFirebaseConfig(config) {
  const requiredFields = [
    ["apiKey", "Firebase API key"],
    ["authDomain", "Firebase auth domain"],
    ["projectId", "Firebase project ID"],
    ["appId", "Firebase app ID"]
  ];
  return requiredFields.filter(([key]) => !config[key]).map(([, label]) => label);
}

async function loadFirebaseModules() {
  if (state.firebase.modules) return state.firebase.modules;

  const appModule = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
  const dbModule = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js");
  let fsModule = null;
  try {
    fsModule = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
  } catch {
    fsModule = null;
  }
  state.firebase.modules = { app: appModule, db: dbModule, fs: fsModule };
  return state.firebase.modules;
}

async function connectFirebase() {
  const config = getFirebaseConfig();
  const missing = validateFirebaseConfig(config);
  if (missing.length) {
    addLog("error", `Thieu Firebase config: ${missing.join(", ")}.`);
    return;
  }

  try {
    const modules = await loadFirebaseModules();
    const existingApp = modules.app.getApps().find((app) => app.options.projectId === config.projectId);
    const app = existingApp || modules.app.initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      databaseURL: config.databaseURL,
      projectId: config.projectId,
      appId: config.appId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      measurementId: config.measurementId
    }, `esp32-fpga-hub-${config.projectId}`);

    state.firebase.app = app;
    state.firebase.db = modules.db.getDatabase(app, config.databaseURL);
    state.firebase.firestore = modules.fs ? modules.fs.getFirestore(app) : null;
    state.transport = { type: "firebase" };
    stopFirebaseBridge(false);
    await restoreRuntimeStateFromCloud();

    const nodeRoot = getFirebaseNodeRoot();
    const inboundRef = modules.db.ref(state.firebase.db, `${nodeRoot}/inbound`);
    const eventsRef = modules.db.query(
      modules.db.ref(state.firebase.db, `${nodeRoot}/events`),
      modules.db.limitToLast(25)
    );

    state.firebase.inboundUnsub = modules.db.onValue(inboundRef, (snapshot) => {
      processFirebaseIncoming(snapshot.val());
    });
    state.firebase.eventsUnsub = modules.db.onChildAdded(eventsRef, (snapshot) => {
      processFirebaseIncoming(snapshot.val());
    });

    await writeFirebasePresence("online");
    state.firebase.heartbeatTimer = setInterval(() => {
      writeFirebasePresence("online").catch(() => {});
    }, 15000);

    updateConnectionState(true, "Firebase online", `${config.projectId}/${nodeRoot}`);
    addLog("system", "Da ket noi Firebase Realtime Database.");
    sendCommand({ type: "hello", role: "web-firebase", board: state.boardKey });
  } catch (error) {
    state.transport = null;
    addLog("error", `Firebase connect failed: ${error.message}`);
  }
}

function stopFirebaseBridge(writeOffline = true) {
  if (state.firebase.inboundUnsub) {
    state.firebase.inboundUnsub();
    state.firebase.inboundUnsub = null;
  }
  if (state.firebase.eventsUnsub) {
    state.firebase.eventsUnsub();
    state.firebase.eventsUnsub = null;
  }
  if (state.firebase.heartbeatTimer) {
    clearInterval(state.firebase.heartbeatTimer);
    state.firebase.heartbeatTimer = null;
  }
  if (state.firebase.persistTimer) {
    clearTimeout(state.firebase.persistTimer);
    state.firebase.persistTimer = null;
  }
  if (writeOffline && state.mode === "firebase" && state.firebase.db && state.connected) {
    writeFirebasePresence("offline").catch(() => {});
  }
  state.firebase.lastInboundTs = 0;
}

async function writeFirebasePresence(status) {
  if (!state.firebase.db || !state.firebase.modules) return;
  const nodeRoot = getFirebaseNodeRoot();
  const statusRef = state.firebase.modules.db.ref(state.firebase.db, `${nodeRoot}/status/web`);
  await state.firebase.modules.db.set(statusRef, {
    status,
    board: state.boardKey,
    ts: Date.now()
  });
}

async function sendFirebase(payload) {
  if (!state.firebase.db || !state.firebase.modules) {
    addLog("error", "Firebase chua duoc khoi tao. Bam Ket noi truoc khi gui lenh.");
    return false;
  }

  try {
    const nodeRoot = getFirebaseNodeRoot();
    const commandRef = state.firebase.modules.db.push(
      state.firebase.modules.db.ref(state.firebase.db, `${nodeRoot}/commands`)
    );
    await state.firebase.modules.db.set(commandRef, payload);
    return true;
  } catch (error) {
    addLog("error", `Firebase send failed: ${error.message}`);
    return false;
  }
}

function getCloudStatePayload() {
  return {
    ts: Date.now(),
    boardKey: state.boardKey,
    leds: state.leds.slice(),
    switches: state.switches.slice(),
    channels: { ...state.channels },
    telemetry: { ...state.telemetry },
    signal: state.signal.slice(-140),
    logs: state.logs.slice(-90),
    packets: state.packets,
    latency: state.latency
  };
}

function applyCloudStatePayload(payload) {
  if (!payload || typeof payload !== "object") return;

  const nextBoardKey = boardProfiles[payload.boardKey] ? payload.boardKey : state.boardKey;
  state.boardKey = nextBoardKey;
  if (els.boardSelect) els.boardSelect.value = nextBoardKey;
  applyBoardProfile();

  if (Array.isArray(payload.leds)) {
    state.leds = state.leds.map((_, index) => payload.leds[index] ? 1 : 0);
    renderLeds();
  }

  if (Array.isArray(payload.switches)) {
    state.switches = state.switches.map((_, index) => payload.switches[index] ? 1 : 0);
    renderSwitches();
  }

  if (payload.channels && typeof payload.channels === "object") {
    const profile = boardProfiles[state.boardKey];
    profile.channels.forEach((channel) => {
      if (channel in payload.channels) state.channels[channel] = Boolean(payload.channels[channel]);
    });
  }

  if (Array.isArray(payload.logs)) {
    state.logs = payload.logs.map((item) => String(item)).slice(-90);
    renderLog();
  }

  const latency = Number(payload.latency);
  const packets = Number(payload.packets);
  if (Number.isFinite(latency)) state.latency = latency;
  if (Number.isFinite(packets)) state.packets = packets;
  updateMetrics();
}

function queuePersistRuntimeState() {
  if (!state.connected || state.mode !== "firebase" || !state.firebase.db || !state.firebase.modules?.db) return;
  if (state.firebase.persistTimer) return;
  state.firebase.persistTimer = setTimeout(() => {
    state.firebase.persistTimer = null;
    persistRuntimeState().catch(() => {});
  }, 350);
}

async function persistRuntimeState() {
  if (!state.connected || state.mode !== "firebase" || !state.firebase.db || !state.firebase.modules?.db) return;
  const payload = getCloudStatePayload();
  const nodeRoot = getFirebaseNodeRoot();
  const modules = state.firebase.modules;
  const uiStateRef = modules.db.ref(state.firebase.db, `${nodeRoot}/ui_state/web`);

  try {
    await modules.db.set(uiStateRef, payload);
  } catch (error) {
    addLog("warn", `RTDB state sync skipped: ${error.message}`);
  }

  try {
    if (modules.fs && state.firebase.firestore) {
      const token = els.token.value.trim() || "esp32-fpga-local";
      const docRef = modules.fs.doc(state.firebase.firestore, "node_state", token);
      await modules.fs.setDoc(docRef, { ...payload, server_ts: modules.fs.serverTimestamp() }, { merge: true });
    }
  } catch (error) {
    addLog("warn", `Firestore state sync skipped: ${error.message}`);
  }
}

async function restoreRuntimeStateFromCloud() {
  if (!state.firebase.db || !state.firebase.modules?.db) return;
  const modules = state.firebase.modules;
  const nodeRoot = getFirebaseNodeRoot();
  const token = els.token.value.trim() || "esp32-fpga-local";
  let restoredPayload = null;
  let restoredSource = "";

  if (modules.fs && state.firebase.firestore) {
    try {
      const docRef = modules.fs.doc(state.firebase.firestore, "node_state", token);
      const snapshot = await modules.fs.getDoc(docRef);
      if (snapshot.exists()) {
        restoredPayload = snapshot.data();
        restoredSource = "Firestore";
      }
    } catch (error) {
      addLog("warn", `Firestore restore skipped: ${error.message}`);
    }
  }

  if (!restoredPayload) {
    try {
      const rtdbRef = modules.db.ref(state.firebase.db, `${nodeRoot}/ui_state/web`);
      const snapshot = await modules.db.get(rtdbRef);
      if (snapshot.exists()) {
        restoredPayload = snapshot.val();
        restoredSource = "Realtime DB";
      }
    } catch (error) {
      addLog("warn", `RTDB restore skipped: ${error.message}`);
    }
  }

  if (restoredPayload) {
    applyCloudStatePayload(restoredPayload);
    addLog("system", `Da phuc hoi state tu ${restoredSource}.`);
  }
}

function processFirebaseIncoming(rawMessage) {
  if (!rawMessage) return;
  const message = rawMessage.message || rawMessage.payload || rawMessage;
  const ts = Number(message.ts ?? rawMessage.ts ?? 0);

  if (Number.isFinite(ts) && ts > 0) {
    if (ts <= state.firebase.lastInboundTs) return;
    state.firebase.lastInboundTs = ts;
  }

  handleIncoming(message);
}

function sendCustomCommand() {
  try {
    sendCommand(JSON.parse(els.commandEditor.value));
  } catch (error) {
    addLog("error", `JSON khong hop le: ${error.message}`);
  }
}

function applyHex() {
  let text = "";
  for (let i = 0; i <= 7; i++) {
    text += $(`#hex${i}`).value || " ";
  }
  sendCommand({
    type: "fpga.display",
    sevenSegment: text
  });
}

function applyLcd() {
  sendCommand({
    type: "fpga.display",
    lcdText: $("#lcdInput").value
  });
}

function applyVga() {
  sendCommand({
    type: "fpga.display",
    vgaPattern: $("#vgaPattern").value
  });
}

function panicStop() {
  state.leds = state.leds.map(() => 0);
  renderLeds();
  sendCommand({ type: "fpga.safe_state", outputs: "off", pwm: 0, bus: "idle" });
}

function exportConfig() {
  const blob = new Blob([JSON.stringify({
    board: state.boardKey,
    mode: state.mode,
    wsUrl: els.wsUrl.value.trim(),
    restUrl: els.restUrl.value.trim(),
    token: els.token.value.trim(),
    firebaseApiKey: els.firebaseApiKey.value.trim(),
    firebaseAuthDomain: els.firebaseAuthDomain.value.trim(),
    firebaseDatabaseUrl: els.firebaseDatabaseUrl.value.trim(),
    firebaseProjectId: els.firebaseProjectId.value.trim(),
    firebaseAppId: els.firebaseAppId.value.trim(),
    firebaseBasePath: els.firebaseBasePath.value.trim(),
    leds: state.leds,
    switches: state.switches,
    channels: state.channels
  }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "esp32-fpga-hub-config.json";
  link.click();
  URL.revokeObjectURL(url);
}

function handleIncoming(raw) {
  let message = raw;
  if (typeof raw === "string") {
    try {
      message = JSON.parse(raw);
    } catch {
      addLog("rx", String(raw));
      return;
    }
  } else if (!raw || typeof raw !== "object") {
    addLog("rx", String(raw));
    return;
  }

  if (message.type === "telemetry") {
    if (message.fpga) {
      if (message.fpga.switchBits !== undefined) {
        if (state.lastPhysicalSwitchBits === -1) state.lastPhysicalSwitchBits = message.fpga.switchBits;
        if (message.fpga.switchBits !== state.lastPhysicalSwitchBits) {
          const changed = message.fpga.switchBits ^ state.lastPhysicalSwitchBits;
          for (let i = 0; i < state.switches.length; i++) {
            if (changed & (1 << i)) {
              state.switches[i] = (message.fpga.switchBits & (1 << i)) ? 1 : 0;
            }
          }
          state.lastPhysicalSwitchBits = message.fpga.switchBits;
          renderSwitches();
        }
      }
      if (message.fpga.keyBits !== undefined) {
        if (state.lastPhysicalKeyBits === -1) state.lastPhysicalKeyBits = message.fpga.keyBits;
        if (message.fpga.keyBits !== state.lastPhysicalKeyBits) {
          const changed = message.fpga.keyBits ^ state.lastPhysicalKeyBits;
          for (let i = 0; i < state.keys.length; i++) {
            if (changed & (1 << i)) {
              state.keys[i] = (message.fpga.keyBits & (1 << i)) ? 0 : 1;
            }
          }
          state.lastPhysicalKeyBits = message.fpga.keyBits;
          renderKeys();
        }
      }
    }
  }

  if (message.type === "sd.list" && message.files) {
    const listHtml = message.files.map(f => `<div>${f.name} <span style="opacity: 0.5; font-size: 0.9em;">(${f.size} bytes)</span></div>`).join("");
    $("#sdFileList").innerHTML = listHtml || "The SD trong hoac khong thay.";
  }

  if (message.type === "sd.file" && message.content !== undefined) {
    $("#sdContent").value = message.content;
  }

  if (message.type === "logic.samples" && Array.isArray(message.samples)) {
    state.signal = message.samples.slice(-140);
  }

  if (message.type === "hello" && message.board && boardProfiles[message.board]) {
    state.boardKey = message.board;
    els.boardSelect.value = message.board;
    applyBoardProfile();
  }

  if (["telemetry", "logic.samples", "hello", "ack"].includes(message.type)) {
    queuePersistRuntimeState();
  }

  addLog("rx", JSON.stringify(message));
}

function makeDemoAck(payload) {
  const samples = Array.from({ length: 140 }, (_, i) => {
    const phase = Date.now() / 250 + i / 6;
    return Math.sin(phase) * 0.35 + Math.sin(phase / 3) * 0.18 + 0.5;
  });

  return {
    type: payload.type === "fpga.capture" ? "logic.samples" : "ack",
    ack: payload.id,
    samples,
    telemetry: state.telemetry
  };
}

function updateMetrics() {
  els.metricLatency.textContent = state.latency == null ? "-- ms" : `${state.latency} ms`;
  els.metricPackets.textContent = String(state.packets);
}

function addLog(kind, message) {
  const time = new Date().toLocaleTimeString("vi-VN", { hour12: false });
  state.logs.push(`[${time}] ${kind.toUpperCase()} ${message}`);
  state.logs = state.logs.slice(-90);
  renderLog();
}

function renderLog() {
  els.logView.textContent = state.logs.join("\n");
  els.logView.scrollTop = els.logView.scrollHeight;
}

init();
