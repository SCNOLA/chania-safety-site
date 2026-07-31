const CHANIA_LAT = 35.5138;
const CHANIA_LON = 24.0180;

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

async function loadForecast() {
  const el = document.getElementById('forecast-strip');
  if (!el) return;

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${CHANIA_LAT}&longitude=${CHANIA_LON}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_mean,windspeed_10m_max` +
    `&timezone=auto&forecast_days=5`;

  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${CHANIA_LAT}&longitude=${CHANIA_LON}` +
    `&hourly=sea_surface_temperature&timezone=auto&forecast_days=5`;

  try {
    const [weatherRes, marineRes] = await Promise.all([fetch(weatherUrl), fetch(marineUrl)]);
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
  } catch (err) {
    el.innerHTML = `<p class="note">Couldn't load live forecast right now (${err.message}). Try refreshing, or check <a href="https://www.windy.com/" target="_blank" rel="noopener">Windy.com</a> directly.</p>`;
  }
}

loadForecast();
