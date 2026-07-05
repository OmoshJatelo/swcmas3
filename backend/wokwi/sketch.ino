#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>

// ══════════════════════════════════════════════════════════════════════════════
//  SWCMAS Smart Bin Sensor — Wokwi Edition
//  Connects to your real SWCMAS backend via ngrok tunnel
// ══════════════════════════════════════════════════════════════════════════════

// ── WIFI ─────────────────────────────────────────────────────────────────────
// In Wokwi, these can be anything — simulated WiFi always connects
const char *WIFI_SSID = "Wokwi-GUEST";
const char *WIFI_PASSWORD = "";

// ── BACKEND CONNECTION ───────────────────────────────────────────────────────
// ⚠️  UPDATE THIS every time you restart ngrok!
// Run:  ngrok http 5000
// Then paste the https URL here (keep the /api/v1/sensors/reading path)
const char *SERVER_URL =
    "https://YOUR-NGROK-URL.ngrok-free.app/api/v1/sensors/reading";

// ── DEVICE AUTH ──────────────────────────────────────────────────────────────
// Must match SENSOR_DEVICE_KEY in your backend .env file
const char *DEVICE_KEY = "swcmas-iot-secret-2026";

// ── BIN IDENTITY ─────────────────────────────────────────────────────────────
// Option A: Use apartment name (the controller looks it up by name)
const char *APARTMENT_NAME = "Sunrise Heights";

// Option B: Use the actual MongoDB ObjectId (get it from your DB after seeding)
// Uncomment and set this if you prefer, and set APARTMENT_NAME to ""
// const char* APARTMENT_ID = "6671a2b3c4d5e6f7a8b9c0d1";

const char *DEVICE_ID = "ESP32-WOKWI-001";

// ── PIN DEFINITIONS ──────────────────────────────────────────────────────────
const int TRIG_PIN = 5;  // GPIO5  → HC-SR04 TRIG
const int ECHO_PIN = 18; // GPIO18 → HC-SR04 ECHO
const int LED_GREEN = 2; // GPIO2  → Green LED (normal)
const int LED_RED = 4;   // GPIO4  → Red LED (warning / nearly full)

// ── BIN CONFIGURATION ────────────────────────────────────────────────────────
// Physical bin height in cm — distance from sensor to empty bin floor
// In Wokwi the HC-SR04 "distance" slider ranges from 2cm to 400cm
// We treat: distance = 60cm → bin empty (0%), distance = 2cm → bin full (~97%)
const float BIN_HEIGHT_CM = 60.0;

// ── TIMING ───────────────────────────────────────────────────────────────────
const unsigned long SEND_INTERVAL_MS = 15000; // Send reading every 15 seconds
unsigned long lastSendTime = 0;
int readingCount = 0;

// ═════════════════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  delay(500);

  // Configure pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);

  // ── Startup banner ──
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║   SWCMAS Smart Bin Sensor v2.0         ║");
  Serial.println("║   Wokwi Simulation Edition             ║");
  Serial.println("╠════════════════════════════════════════╣");
  Serial.printf("║   Apartment: %-25s║\n", APARTMENT_NAME);
  Serial.printf("║   Device:    %-25s║\n", DEVICE_ID);
  Serial.printf("║   Bin Height: %.0f cm                    ║\n",
                BIN_HEIGHT_CM);
  Serial.println("╚════════════════════════════════════════╝\n");

  // Startup LED test — both flash once
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED, HIGH);
  delay(800);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);

  // ── Connect to WiFi ──
  Serial.printf("📶 Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.printf("   IP Address: %s\n\n", WiFi.localIP().toString().c_str());
    // Success: green LED blinks 3 times
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_GREEN, HIGH);
      delay(200);
      digitalWrite(LED_GREEN, LOW);
      delay(200);
    }
  } else {
    Serial.println("\n❌ WiFi connection failed!");
    // Failure: red LED blinks fast
    for (int i = 0; i < 6; i++) {
      digitalWrite(LED_RED, HIGH);
      delay(100);
      digitalWrite(LED_RED, LOW);
      delay(100);
    }
  }
}

// ── READ ULTRASONIC SENSOR ───────────────────────────────────────────────────
float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Timeout after 30ms (~5m max range)
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    Serial.println("⚠️  Sensor timeout — no echo received");
    return -1;
  }

  // Speed of sound: 0.0343 cm/µs, divide by 2 (round trip)
  float distance = (duration * 0.0343) / 2.0;
  return distance;
}

// ── CONVERT DISTANCE TO FILL PERCENTAGE ──────────────────────────────────────
float distanceToFillPercent(float distanceCm) {
  // Empty bin: sensor reads BIN_HEIGHT_CM (far from bottom)
  // Full bin:  sensor reads ~0 (waste surface near sensor)
  float fillPercent = ((BIN_HEIGHT_CM - distanceCm) / BIN_HEIGHT_CM) * 100.0;

  // Clamp 0–100
  if (fillPercent < 0)
    fillPercent = 0;
  if (fillPercent > 100)
    fillPercent = 100;
  return fillPercent;
}

// ── UPDATE STATUS LEDS ───────────────────────────────────────────────────────
void updateLEDs(float fillPercent) {
  if (fillPercent >= 80.0) {
    // Warning: red ON, green OFF
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, LOW);
  } else {
    // Normal: green ON, red OFF
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_RED, LOW);
  }
}

// ── SEND READING TO SWCMAS BACKEND ───────────────────────────────────────────
bool sendToBackend(float rawDistanceCm, float fillPercent) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected — skipping send");
    return false;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key",
                 DEVICE_KEY); // ← Auth header your backend requires
  http.setTimeout(10000);

  // Build JSON payload — matches SWCMAS sensor controller format
  StaticJsonDocument<256> doc;

  // Send apartment name (controller will look it up)
  doc["apartmentName"] = APARTMENT_NAME;
  // Uncomment below if using ObjectId directly instead of name:
  // doc["apartmentId"] = APARTMENT_ID;

  doc["rawDistanceCm"] = round(rawDistanceCm * 10) / 10.0; // 1 decimal
  doc["binHeightCm"] = BIN_HEIGHT_CM;
  doc["deviceId"] = DEVICE_ID;
  doc["batteryVoltage"] = 3.7; // Simulated LiPo voltage

  String payload;
  serializeJson(doc, payload);

  Serial.println("📡 Sending to SWCMAS backend...");
  Serial.printf("   URL:     %s\n", SERVER_URL);
  Serial.printf("   Payload: %s\n", payload.c_str());

  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("   ✅ Response %d: %s\n", httpResponseCode,
                  response.c_str());
    http.end();
    return true;
  } else {
    Serial.printf("   ❌ HTTP Error: %s\n",
                  http.errorToString(httpResponseCode).c_str());
    http.end();
    return false;
  }
}

// ── PRINT VISUAL STATUS BAR ──────────────────────────────────────────────────
void printStatusBar(float fillPercent) {
  int bars = (int)(fillPercent / 5); // 20 bars total
  Serial.print("   Fill: [");
  for (int i = 0; i < 20; i++) {
    Serial.print(i < bars ? "█" : "░");
  }
  Serial.printf("] %.1f%%", fillPercent);

  if (fillPercent >= 95)
    Serial.println("  🚨 CRITICAL — OVERFLOW RISK");
  else if (fillPercent >= 80)
    Serial.println("  ⚠️  WARNING  — NEARLY FULL");
  else if (fillPercent >= 50)
    Serial.println("  🟡 MODERATE — HALF FULL");
  else
    Serial.println("  ✅ NORMAL   — PLENTY OF SPACE");
}

// ═════════════════════════════════════════════════════════════════════════════

void loop() {
  unsigned long now = millis();

  // Only send at the defined interval
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;
    readingCount++;

    Serial.println("\n────────────────────────────────────────");
    Serial.printf("📊 Reading #%d | Time: %lums\n", readingCount, now);

    // 1. Read sensor distance
    float distanceCm = readDistanceCm();

    if (distanceCm < 0) {
      Serial.println("   Skipping this reading — sensor error");
      return;
    }

    Serial.printf("   📏 Distance: %.1f cm\n", distanceCm);

    // 2. Convert to fill percentage
    float fillPercent = distanceToFillPercent(distanceCm);

    // 3. Print visual status bar
    printStatusBar(fillPercent);

    // 4. Update LEDs
    updateLEDs(fillPercent);

    // 5. Send raw distance to backend (backend calculates fill % server-side)
    bool sent = sendToBackend(distanceCm, fillPercent);
    if (!sent) {
      Serial.println("   ⏳ Will retry on next interval");
    }

    Serial.println("────────────────────────────────────────");
  }

  delay(100); // Small delay to prevent watchdog timer issues
}
