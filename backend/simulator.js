/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  SWCMAS Sensor Simulator
 *  Simulates 5 smart bins sending fill-level readings to the backend
 *  Run with: node simulator.js
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *  This script:
 *  - Fetches real apartment IDs from your running backend
 *  - Simulates 5 bins gradually filling up with waste
 *  - Sends sensor readings every 10 seconds
 *  - Auto-resets bins to 5% when they hit 95% ("collection happened")
 *  - Uses the same X-Device-Key auth as the ESP32 firmware
 *
 *  No extra dependencies needed — uses Node.js built-in fetch (Node 18+)
 *  If using an older Node.js version, install node-fetch:
 *    npm install node-fetch
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://swcmas3.onrender.com';
const API_URL = `${BACKEND_URL}/api/v1/sensors/reading`;
const DEVICE_KEY = process.env.SENSOR_DEVICE_KEY || 'swcmas-iot-secret-2026';
const INTERVAL_MS = 10000; // Send every 10 seconds

// ── Simulated bins ───────────────────────────────────────────────────────────
// Will be populated with real apartment IDs from the backend
let bins = [
  { name: 'Sunrise Heights', fillPercent: 10, deviceId: 'SIM-BIN-001' },
  { name: 'Oasis Residences', fillPercent: 45, deviceId: 'SIM-BIN-002' },
  { name: 'Kileleshwa Gardens', fillPercent: 72, deviceId: 'SIM-BIN-003' },
  { name: 'Lavington Villas', fillPercent: 88, deviceId: 'SIM-BIN-004' },
  { name: 'South B Apartments', fillPercent: 30, deviceId: 'SIM-BIN-005' },
];

const BIN_HEIGHT_CM = 60; // Standard bin height

// ── Fetch apartment IDs from the backend ─────────────────────────────────────
async function fetchApartmentIds() {
  try {
    // We need an auth token to hit the apartments endpoint
    // First login as admin to get a token
    console.log('🔑 Logging in as admin to fetch apartment IDs...');
    const loginRes = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@swcmas.com', password: 'Password@123' }),
    });

    if (!loginRes.ok) {
      console.warn('⚠️  Could not login to fetch apartment IDs — using apartment names instead');
      return false;
    }

    const loginData = await loginRes.json();
    const token = loginData.data?.accessToken || loginData.data?.token;
    if (!token) {
      console.warn('⚠️  No token in login response — using apartment names instead');
      return false;
    }

    // Now fetch apartments
    const aptRes = await fetch(`${BACKEND_URL}/api/v1/apartments`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!aptRes.ok) {
      console.warn('⚠️  Could not fetch apartments — using apartment names instead');
      return false;
    }

    const aptData = await aptRes.json();
    // Handle both paginated ({data: {docs: [...]}}) and flat ({data: [...]}) responses
    const apartments = Array.isArray(aptData.data)
      ? aptData.data
      : (aptData.data?.docs || aptData.data?.apartments || []);

    // Match bins to real apartment IDs
    for (const bin of bins) {
      const match = apartments.find(
        a => a.name.toLowerCase() === bin.name.toLowerCase()
      );
      if (match) {
        bin.apartmentId = match._id;
        console.log(`   ✅ ${bin.name} → ${match._id}`);
      } else {
        console.log(`   ⚠️  ${bin.name} — no matching apartment found, will use name lookup`);
      }
    }
    return true;
  } catch (err) {
    console.warn(`⚠️  Error fetching apartments: ${err.message}`);
    console.warn('   Will use apartment name lookup instead');
    return false;
  }
}

// ── Send a single reading ────────────────────────────────────────────────────
async function sendReading(bin) {
  // Calculate raw distance from fill percent
  const rawDistanceCm = BIN_HEIGHT_CM * (1 - bin.fillPercent / 100);

  const payload = {
    rawDistanceCm: Math.round(rawDistanceCm * 10) / 10,
    binHeightCm: BIN_HEIGHT_CM,
    deviceId: bin.deviceId,
    batteryVoltage: 3.3 + Math.random() * 0.6,
  };

  // Use ObjectId if available, otherwise use name (controller supports both)
  if (bin.apartmentId) {
    payload.apartmentId = bin.apartmentId;
  } else {
    payload.apartmentName = bin.name;
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Key': DEVICE_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    const fillLevel = data.data?.fillLevelPercent ?? bin.fillPercent;

    // Build visual bar
    const barLength = 20;
    const filled = Math.round((bin.fillPercent / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    let statusEmoji = '✅';
    if (bin.fillPercent >= 95) statusEmoji = '🚨';
    else if (bin.fillPercent >= 80) statusEmoji = '⚠️ ';
    else if (bin.fillPercent >= 50) statusEmoji = '🟡';

    console.log(
      `  ${statusEmoji} [${bar}] ${Math.round(bin.fillPercent).toString().padStart(3)}% | ${bin.name.padEnd(22)} | ${res.status === 201 ? '✅ sent' : `❌ ${res.status}`}`
    );
  } catch (err) {
    console.error(`  ❌ ${bin.name}: ${err.message}`);
  }
}

// ── Simulation tick ──────────────────────────────────────────────────────────
let tickCount = 0;

function simulate() {
  tickCount++;
  console.log(`\n─── Tick #${tickCount} | ${new Date().toLocaleTimeString()} ${'─'.repeat(40)}`);

  for (const bin of bins) {
    // Gradually fill up — random rate per bin
    bin.fillPercent += (Math.random() * 3) + 0.5;

    // When bin hits 95%+ it gets "collected" and resets
    if (bin.fillPercent >= 95) {
      console.log(`  🚛 ${bin.name} — COLLECTED! Resetting to 5%`);
      bin.fillPercent = 5;
    }

    sendReading(bin);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           SWCMAS Sensor Simulator v1.0                   ║');
  console.log('║   Simulating 5 smart bins → SWCMAS backend               ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║   Backend: ${BACKEND_URL.padEnd(46)}║`);
  console.log(`║   Interval: ${(INTERVAL_MS / 1000)}s ${''.padEnd(43)}║`);
  console.log(`║   Device Key: ${DEVICE_KEY.substring(0, 20)}...${' '.repeat(23)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Try to fetch real apartment IDs
  await fetchApartmentIds();

  console.log('\n🟢 Simulator started — sending readings every 10 seconds');
  console.log('   Press Ctrl+C to stop\n');

  // Run immediately then on interval
  simulate();
  setInterval(simulate, INTERVAL_MS);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
//sort the backlog that occurs after multiple additions//