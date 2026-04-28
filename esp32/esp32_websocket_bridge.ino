/*
 * =====================================================
 *  ESP32 FPGA Hub — WebSocket Bridge Firmware
 * =====================================================
 *  ESP32 phát WiFi (Access Point).
 *  Web kết nối trực tiếp với ESP32 qua WebSocket.
 *  Độ trễ thấp nhất, không phụ thuộc mạng nhà/Internet.
 *
 *  Board: ESP32 Dev Module
 * =====================================================
 */

#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

// ═══════════════════════════════════════════════════════
//  CẤU HÌNH WIFI (Chế độ phát AP)
// ═══════════════════════════════════════════════════════
const char* AP_SSID     = "ESP32_FPGA_HUB";
const char* AP_PASSWORD = "password";

// Web server chạy trên port 80
AsyncWebServer server(80);
// WebSocket chạy trên path /ws
AsyncWebSocket ws("/ws");

// ═══════════════════════════════════════════════════════
//  CẤU HÌNH PHẦN CỨNG
// ═══════════════════════════════════════════════════════
#define LED_PIN 2

const int demoPins[] = {4, 5, 18, 19, 21, 22, 23, 25};
const int NUM_DEMO_PINS = 8;

unsigned long lastTelemetry = 0;
unsigned long bootTime = 0;

// ═══════════════════════════════════════════════════════
//  GỬI DỮ LIỆU QUA WEBSOCKET
// ═══════════════════════════════════════════════════════
void wsSend(uint32_t clientId, const String& data) {
  if (clientId == 0) {
    ws.textAll(data);
  } else {
    ws.text(clientId, data);
  }
}

// ═══════════════════════════════════════════════════════
//  XỬ LÝ LỆNH JSON TỪ WEB
// ═══════════════════════════════════════════════════════
void processCommand(uint32_t clientId, String jsonStr) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, jsonStr);
  if (err) {
    Serial.println("JSON parse error: " + String(err.c_str()));
    return;
  }

  const char* type = doc["type"] | "unknown";
  Serial.printf("[WS] Nhan lenh: %s\n", type);

  // Tạo JSON phản hồi
  JsonDocument res;
  res["type"] = "ack";
  res["source"] = "esp32";

  // ─── hello ───
  if (strcmp(type, "hello") == 0) {
    res["message"] = "ESP32 san sang qua WebSocket";
    res["board"] = "de2i-150";
  }
  // ─── ping ───
  else if (strcmp(type, "ping") == 0) {
    res["type"] = "pong";
    res["uptime"] = (millis() - bootTime) / 1000;
  }
  // ─── fpga.write ───
  else if (strcmp(type, "fpga.write") == 0) {
    const char* target = doc["target"] | "";
    if (strcmp(target, "gpio.led") == 0) {
      int idx = doc["index"] | -1;
      int val = doc["value"] | 0;
      if (idx >= 0 && idx < NUM_DEMO_PINS) {
        digitalWrite(demoPins[idx], val ? HIGH : LOW);
        Serial.printf("  LED%d = %d\n", idx, val);
      }
      res["led"] = idx;
      res["state"] = val;
    }
    else if (strcmp(target, "gpio.switch-mirror") == 0) {
      int idx = doc["index"] | -1;
      int val = doc["value"] | 0;
      Serial.printf("  SW%d = %d\n", idx, val);
      res["switch"] = idx;
      res["state"] = val;
    }
  }
  // ─── fpga.display ───
  else if (strcmp(type, "fpga.display") == 0) {
    Serial.printf("  7seg='%s' LCD='%s' VGA='%s'\n", 
      (const char*)(doc["sevenSegment"] | ""), 
      (const char*)(doc["lcdText"] | ""),
      (const char*)(doc["vgaPattern"] | ""));
    res["display"] = "applied";
  }
  // ─── fpga.bus ───
  else if (strcmp(type, "fpga.bus") == 0) {
    res["bus"] = (const char*)doc["bus"];
    res["sent"] = true;
  }
  // ─── fpga.capture ───
  else if (strcmp(type, "fpga.capture") == 0) {
    // Gửi mẫu logic analyzer demo
    JsonDocument capRes;
    capRes["type"] = "logic.samples";
    JsonArray samples = capRes["samples"].to<JsonArray>();
    for (int i = 0; i < 140; i++) {
      samples.add(sin(i * 0.15) * 0.35 + sin(i * 0.05) * 0.18 + 0.5);
    }
    String out;
    serializeJson(capRes, out);
    wsSend(clientId, out);
    return;
  }
  // ─── fpga.safe_state ───
  else if (strcmp(type, "fpga.safe_state") == 0) {
    Serial.println("  PANIC STOP!");
    for (int i = 0; i < NUM_DEMO_PINS; i++) {
      digitalWrite(demoPins[i], LOW);
    }
    res["safe_state"] = true;
  }

  // Chuyển JSON thành String và gửi lại Web
  String out;
  serializeJson(res, out);
  wsSend(clientId, out);
}

// ═══════════════════════════════════════════════════════
//  SỰ KIỆN WEBSOCKET
// ═══════════════════════════════════════════════════════
void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type,
             void *arg, uint8_t *data, size_t len) {
  switch (type) {
    case WS_EVT_CONNECT:
      Serial.printf("WS Client connect: %u\n", client->id());
      break;
      
    case WS_EVT_DISCONNECT:
      Serial.printf("WS Client disconnect: %u\n", client->id());
      break;
      
    case WS_EVT_DATA: {
      AwsFrameInfo *info = (AwsFrameInfo*)arg;
      if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
        data[len] = 0;
        String msg = (char*)data;
        processCommand(client->id(), msg);
      }
      break;
    }
    case WS_EVT_PONG:
    case WS_EVT_ERROR:
      break;
  }
}

// ═══════════════════════════════════════════════════════
//  SETUP & LOOP
// ═══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n\n========================================");
  Serial.println("  ESP32 FPGA Hub — WebSocket Mode");
  Serial.println("========================================");

  pinMode(LED_PIN, OUTPUT);
  for (int i = 0; i < NUM_DEMO_PINS; i++) {
    pinMode(demoPins[i], OUTPUT);
    digitalWrite(demoPins[i], LOW);
  }

  // Cấu hình phát WiFi (Access Point)
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  IPAddress IP = WiFi.softAPIP();
  
  Serial.println("✓ Da phat WiFi AP!");
  Serial.print("  SSID: "); Serial.println(AP_SSID);
  Serial.print("  Pass: "); Serial.println(AP_PASSWORD);
  Serial.print("  IP Address: "); Serial.println(IP);

  // Thêm CORS để cho phép Vercel kết nối tới IP local
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");

  // Start WebSocket
  ws.onEvent(onEvent);
  server.addHandler(&ws);
  server.begin();
  
  Serial.println("✓ WebSocket Server dang chay tai ws://192.168.4.1/ws");
  bootTime = millis();
}

void loop() {
  // Gửi telemetry định kỳ cho tất cả client
  if (millis() - lastTelemetry >= 3000) {
    lastTelemetry = millis();
    
    // Nếu có web nào đang kết nối
    if (ws.count() > 0) {
      JsonDocument doc;
      doc["type"] = "telemetry";
      JsonObject tele = doc["telemetry"].to<JsonObject>();
      tele["temp"] = temperatureRead();
      tele["vcore"] = 1.10 + (random(0, 5) * 0.01);
      tele["clock"] = 50;

      String out;
      serializeJson(doc, out);
      ws.textAll(out);
      
      digitalWrite(LED_PIN, !digitalRead(LED_PIN)); // Nháy LED
    } else {
      digitalWrite(LED_PIN, LOW);
    }
  }
  
  // Dọn dẹp client cũ (bắt buộc với thư viện này)
  ws.cleanupClients();
}
