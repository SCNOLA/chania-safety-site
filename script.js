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

async function loadForecast() {
  const el = document.getElementById('forecast-strip');
  if (!el) return;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${CHANIA_LAT}&longitude=${CHANIA_LON}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_mean,windspeed_10m_max` +
    `&timezone=auto&forecast_days=5`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const days = data.daily;

    el.innerHTML = days.time.map((date, i) => `
      <div class="forecast-day">
        <div class="day">${dayLabel(date, i)}</div>
        <div class="icon">${weatherIcon(days.weathercode[i])}</div>
        <div class="temps"><span class="hi">${Math.round(days.temperature_2m_max[i])}°</span> / <span class="lo">${Math.round(days.temperature_2m_min[i])}°</span></div>
        <div class="meta">💨 ${Math.round(days.windspeed_10m_max[i])} km/h</div>
        <div class="meta">💧 ${days.precipitation_probability_mean[i]}%</div>
      </div>
    `).join('');
  } catch (err) {
    el.innerHTML = `<p class="note">Couldn't load live forecast right now (${err.message}). Try refreshing, or check <a href="https://www.windy.com/" target="_blank" rel="noopener">Windy.com</a> directly.</p>`;
  }
}

loadForecast();
