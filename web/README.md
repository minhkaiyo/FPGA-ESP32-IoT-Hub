# ESP32 FPGA Control Hub

Web trung gian de dieu khien ESP32 khi ESP32 dong vai tro gateway cho FPGA. Project hien la web tinh, co the mo truc tiep bang `index.html` va khong can cai dependency.

## Chuc nang chinh

- Ket noi ESP32 qua WebSocket, Web Serial USB, REST POST hoac demo mode.
- Ket noi ESP32 qua Firebase Realtime Database (cloud bridge).
- Chon profile FPGA: DE2i-150, DE2-115, DE10-Lite, generic board.
- Dieu khien GPIO LED, switch mirror, 7-segment, VGA pattern, UART/SPI/I2C/PWM bridge.
- Gui lenh JSON tuy bien den firmware ESP32.
- Logic analyzer UI: sample rate, depth, channel select, waveform canvas.
- Telemetry va log goi tin hai chieu.
- Luu cau hinh vao `localStorage` va xuat file JSON.

## Cach chay

Mo file `index.html` bang Chrome hoac Edge. Neu can Web Serial, trang nen duoc phuc vu qua `http://localhost` hoac HTTPS tuy chinh sach trinh duyet.

Co the chay server cuc bo bang PowerShell:

```powershell
python -m http.server 8080
```

Sau do mo `http://localhost:8080`.

## Firmware ESP32 can ho tro

Firmware nen nhan va tra JSON theo dong qua Serial, WebSocket text frame, hoac REST body.

Ngoai ra co the dung Firebase Realtime Database:

- Web ghi lenh vao: `<basePath>/nodes/<token>/commands/<push-id>`
- ESP32 ghi trang thai vao: `<basePath>/nodes/<token>/status/esp32`
- ESP32 ghi du lieu vao: `<basePath>/nodes/<token>/inbound`
- ESP32 ghi event stream vao: `<basePath>/nodes/<token>/events/<push-id>`

Firmware mau da noi san SPI den `bi_spi_test.v`:

- `D:\App\Code\Du_an\FPGA\esp32_firebase_bridge\esp32_firebase_bridge.ino`
- Huong dan wiring + protocol:
  - `D:\App\Code\Du_an\FPGA\esp32_firebase_bridge\README.md`

Vi du goi hello:

```json
{
  "type": "hello",
  "device": "esp32-fpga-main",
  "board": "de2i-150"
}
```

Vi du ghi LED FPGA:

```json
{
  "type": "fpga.write",
  "target": "gpio.led",
  "index": 0,
  "value": 1
}
```

Vi du capture logic:

```json
{
  "type": "fpga.capture",
  "rateMHz": 25,
  "depth": 2048,
  "channels": ["D0", "D1", "CLK"]
}
```

Telemetry tu ESP32:

```json
{
  "type": "telemetry",
  "telemetry": {
    "temp": 36.4,
    "vcore": 1.12,
    "clock": 100
  }
}
```

Logic samples tu ESP32:

```json
{
  "type": "logic.samples",
  "samples": [0.1, 0.7, 0.4, 0.9]
}
```

## Goi y mapping ESP32 - FPGA

- ESP32 WebSocket server: `/ws`, JSON text frame.
- ESP32 REST command: `POST /api/command`, bat CORS neu goi tu browser.
- UART ESP32 <-> FPGA: dung frame JSON rut gon hoac binary register protocol.
- SPI ESP32 master <-> FPGA slave: phu hop cho register map va stream nhanh.
- I2C: phu hop cho control/status toc do thap.
- GPIO handshake: `READY`, `IRQ`, `RESET_N`, `CS_N` nen co trong moi thiet ke.

## Firebase setup nhanh

1. Tao Firebase project, bat Realtime Database.
2. Copy thong so Web App (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`) vao form trong web.
3. Chon mode `Firebase`, nhap `Device token` dung voi token ESP32 dang nghe.
4. Bam `Ket noi`, web se gui lenh vao node `commands`.

Mau rule de test nhanh (moi truong lab):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Khi dua vao production, can thay bang rule theo auth token / uid.

## Board DE2i-150

Profile `de2i-150` da bat san cac khoi phu hop: LED/switch, 7-seg/LCD, VGA/framebuffer, audio DSP, SDRAM/SRAM, UART/SPI/I2C bridge, logic analyzer va PWM/motor.
