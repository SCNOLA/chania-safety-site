const CHANIA_LAT = 35.5138;
const CHANIA_LON = 24.0180;

// Free NASA FIRMS rate-limiting key — not a login credential, designed to be used
// openly in public tile URLs (NASA's own docs embed it the same way).
const FIRMS_MAP_KEY = 'e31606c855138484f21659534b7d4d64';
const FIRMS_LAYERS = 'fires_viirs_snpp_24,fires_viirs_noaa20_24,fires_viirs_noaa21_24';

const WEATHER_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️'
};

function weatherIcon(code) {
  return WEATHER_ICONS[code] || '🌡️';
}

function dayLabel(isoDate, index) {
  if (index === 0) return 'Today';
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// fetch() has no built-in timeout — on a slow/flaky connection a stalled request
// would otherwise hang forever with the refresh button stuck disabled.
function fetchWithTimeout(url, ms = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

function friendlyError(err) {
  return err.name === 'AbortError' ? 'timed out — check your connection' : err.message;
}

// Averages hourly sea_surface_temperature readings into one value per calendar day (YYYY-MM-DD).
function dailySeaTemps(hourlyTimes, hourlyTemps, days) {
  const byDay = {};
  hourlyTimes.forEach((t, i) => {
    const day = t.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    if (hourlyTemps[i] !== null && hourlyTemps[i] !== undefined) byDay[day].push(hourlyTemps[i]);
  });
  return days.map(day => {
    const vals = byDay[day] || [];
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });
}

// US EPA AQI breakpoints.
function aqiLevel(aqi) {
  if (aqi <= 50) return { label: 'Good', cls: 'aqi-good' };
  if (aqi <= 100) return { label: 'Moderate', cls: 'aqi-moderate' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', cls: 'aqi-usg' };
  if (aqi <= 200) return { label: 'Unhealthy', cls: 'aqi-unhealthy' };
  if (aqi <= 300) return { label: 'Very Unhealthy', cls: 'aqi-very-unhealthy' };
  return { label: 'Hazardous', cls: 'aqi-hazardous' };
}

async function loadForecast() {
  const el = document.getElementById('forecast-strip');
  const statusEl = document.getElementById('forecast-status-text');
  const btn = document.getElementById('forecast-refresh');
  if (!el) return;
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Refreshing…'; }
  if (statusEl) statusEl.textContent = 'Loading…';

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${CHANIA_LAT}&longitude=${CHANIA_LON}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_mean,windspeed_10m_max` +
    `&timezone=auto&forecast_days=5`;

  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${CHANIA_LAT}&longitude=${CHANIA_LON}` +
    `&hourly=sea_surface_temperature&timezone=auto&forecast_days=5`;

  try {
    const [weatherRes, marineRes] = await Promise.all([fetchWithTimeout(weatherUrl), fetchWithTimeout(marineUrl)]);
    if (!weatherRes.ok) throw new Error(`HTTP ${weatherRes.status}`);
    const data = await weatherRes.json();
    const days = data.daily;

    let seaTemps = days.time.map(() => null);
    if (marineRes.ok) {
      const marine = await marineRes.json();
      if (marine.hourly && marine.hourly.sea_surface_temperature) {
        seaTemps = dailySeaTemps(marine.hourly.time, marine.hourly.sea_surface_temperature, days.time);
      }
    }

    el.innerHTML = days.time.map((date, i) => `
      <div class="forecast-day">
        <div class="day">${dayLabel(date, i)}</div>
        <div class="icon">${weatherIcon(days.weathercode[i])}</div>
        <div class="temps"><span class="hi">${Math.round(days.temperature_2m_max[i])}°</span> / <span class="lo">${Math.round(days.temperature_2m_min[i])}°</span></div>
        <div class="meta">💨 ${Math.round(days.windspeed_10m_max[i])} km/h</div>
        <div class="meta">💧 ${days.precipitation_probability_mean[i]}%</div>
        <div class="meta sea">🌊 ${seaTemps[i] !== null ? Math.round(seaTemps[i]) + '°' : '—'}</div>
      </div>
    `).join('');

    if (statusEl) statusEl.textContent = `Data as of ${formatTime(new Date())}`;
  } catch (err) {
    el.innerHTML = `<p class="note">Couldn't load live forecast (${friendlyError(err)}). Try refreshing, or check <a href="https://www.windy.com/" target="_blank" rel="noopener">Windy.com</a> directly.</p>`;
    if (statusEl) statusEl.textContent = 'Failed to load — try refresh';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⟳ Refresh'; }
  }
}

async function loadAirQuality() {
  const card = document.getElementById('aqi-card');
  const statusEl = document.getElementById('aqi-status-text');
  const btn = document.getElementById('aqi-refresh');
  if (!card) return;
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Refreshing…'; }
  if (statusEl) statusEl.textContent = 'Loading…';

  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${CHANIA_LAT}&longitude=${CHANIA_LON}` +
    `&current=pm2_5,pm10,us_aqi&timezone=auto`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const c = data.current;
    const level = aqiLevel(c.us_aqi);

    card.innerHTML = `
      <div>
        <div class="aqi-value">${Math.round(c.us_aqi)}</div>
        <div class="aqi-value-unit">US AQI</div>
      </div>
      <div>
        <div class="aqi-label ${level.cls}">${level.label}</div>
        <div class="aqi-detail">PM2.5: ${c.pm2_5} µg/m³ &nbsp;·&nbsp; PM10: ${c.pm10} µg/m³</div>
      </div>
    `;
    if (statusEl) statusEl.textContent = `Data as of ${formatTime(new Date())}`;
  } catch (err) {
    card.innerHTML = `<p class="note">Couldn't load live air quality (${friendlyError(err)}). Use the links below instead.</p>`;
    if (statusEl) statusEl.textContent = 'Failed to load — try refresh';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⟳ Refresh'; }
  }
}

document.getElementById('forecast-refresh')?.addEventListener('click', loadForecast);
document.getElementById('aqi-refresh')?.addEventListener('click', loadAirQuality);

loadForecast();
loadAirQuality();

let firmsWmsLayer = null;

function setupFirmsMap() {
  const container = document.getElementById('firms-map');
  const statusEl = document.getElementById('firms-status-text');
  const btn = document.getElementById('firms-refresh');
  if (!container || typeof L === 'undefined') return;

  const map = L.map('firms-map').setView([CHANIA_LAT, CHANIA_LON], 9);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 12,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  L.marker([CHANIA_LAT, CHANIA_LON]).addTo(map).bindPopup('Chania');

  function addFirmsLayer() {
    if (firmsWmsLayer) map.removeLayer(firmsWmsLayer);
    firmsWmsLayer = L.tileLayer.wms(`https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/${FIRMS_MAP_KEY}/`, {
      layers: FIRMS_LAYERS,
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      _t: Date.now(), // cache-bust so "Refresh" actually re-fetches instead of reusing cached tiles
      attribution: '<a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noopener">NASA FIRMS</a>'
    });
    firmsWmsLayer.on('load', () => {
      if (btn) { btn.disabled = false; btn.textContent = '⟳ Refresh'; }
      if (statusEl) statusEl.textContent = `Data as of ${formatTime(new Date())}`;
    });
    firmsWmsLayer.addTo(map);
  }

  if (btn) {
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = '⟳ Refreshing…';
      if (statusEl) statusEl.textContent = 'Loading…';
      addFirmsLayer();
    });
  }

  addFirmsLayer();
}

setupFirmsMap();

function setupHelpModal() {
  const helpBtn = document.getElementById('help-btn');
  const modal = document.getElementById('help-modal');
  const closeBtn = document.getElementById('help-close');
  if (!helpBtn || !modal || !closeBtn) return;

  function open() {
    modal.hidden = false;
    closeBtn.focus();
  }

  function close() {
    modal.hidden = true;
    helpBtn.focus();
  }

  helpBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}

setupHelpModal();
