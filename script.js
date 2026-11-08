// SkyCast — plain JavaScript, no libraries. Weather from Open-Meteo (free, no API key).
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var CITY_KEY = 'lastCity';          // kept from the old version so returning visitors keep their city
  var UNIT_KEY = 'skycast_unit';
  var THEME_KEY = 'skycast_theme';

  var unit = localStorage.getItem(UNIT_KEY) === 'f' ? 'f' : 'c';
  var place = null;                   // { name, sub, lat, lon }
  var requestId = 0;                  // ignore answers from older searches

  // ---------- Theme: follows the device/browser until the visitor picks one ----------
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  function setThemeColor() { themeMeta.content = root.dataset.theme === 'dark' ? '#111214' : '#f7f7f5'; }
  setThemeColor();
  $('theme-btn').addEventListener('click', function () {
    if (root.dataset.theme === 'dark') delete root.dataset.theme; else root.dataset.theme = 'dark';
    try { localStorage.setItem(THEME_KEY, root.dataset.theme === 'dark' ? 'dark' : 'light'); } catch (e) {}
    setThemeColor();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (err) {}
    if (saved === 'dark' || saved === 'light') return;
    if (e.matches) root.dataset.theme = 'dark'; else delete root.dataset.theme;
    setThemeColor();
  });

  // ---------- Unit ----------
  var unitButtons = document.querySelectorAll('[data-unit]');
  function showUnit() {
    unitButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.unit === unit)); });
  }
  showUnit();
  unitButtons.forEach(function (b) {
    b.addEventListener('click', function () {
      if (unit === b.dataset.unit) return;
      unit = b.dataset.unit;
      localStorage.setItem(UNIT_KEY, unit);
      showUnit();
      if (place) loadWeather(place);
    });
  });

  // ---------- Status line ----------
  function status(text, isError) {
    $('status').textContent = text || '';
    $('status').classList.toggle('error', !!isError);
  }

  // ---------- Search ----------
  $('search').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('city').value.trim();
    if (q) searchCity(q);
  });
  document.querySelectorAll('[data-city]').forEach(function (b) {
    b.addEventListener('click', function () { $('city').value = b.dataset.city; searchCity(b.dataset.city); });
  });

  function searchCity(q) {
    var id = ++requestId;
    status('Finding ' + q + '…');
    fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=' + encodeURIComponent(q))
      .then(function (r) { if (!r.ok) throw new Error('net'); return r.json(); })
      .then(function (data) {
        if (id !== requestId) return;
        var hit = data.results && data.results[0];
        if (!hit) { status('No city called "' + q + '" was found. Check the spelling.', true); return; }
        var sub = [hit.admin1, hit.country].filter(function (s, i, a) { return s && a.indexOf(s) === i && s !== hit.name; }).join(', ');
        loadWeather({ name: hit.name, sub: sub, lat: hit.latitude, lon: hit.longitude }, id);
      })
      .catch(function () { if (id === requestId) status('Could not reach the weather service. Check your internet and try again.', true); });
  }

  // ---------- My location ----------
  $('locate').addEventListener('click', function () {
    if (!navigator.geolocation) { status('Your browser does not share location. Search a city instead.', true); return; }
    var id = ++requestId;
    var btn = $('locate');
    btn.disabled = true;
    status('Getting your location…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      if (id !== requestId) return;
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      loadWeather({ name: 'Your location', sub: lat.toFixed(2) + ', ' + lon.toFixed(2), lat: lat, lon: lon }, id);
    }, function (err) {
      btn.disabled = false;
      if (id !== requestId) return;
      status(err.code === 1 ? 'Location is blocked for this site. Allow it in your browser, or search a city.' : 'Could not get your location. Search a city instead.', true);
    }, { timeout: 10000, maximumAge: 600000 });
  });

  // ---------- Weather ----------
  function loadWeather(p, id) {
    if (id === undefined) id = ++requestId;
    status('Loading weather for ' + p.name + '…');
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day' +
      '&hourly=temperature_2m,weather_code,precipitation_probability,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=auto&forecast_days=7&wind_speed_unit=kmh' + (unit === 'f' ? '&temperature_unit=fahrenheit' : '');
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('net'); return r.json(); })
      .then(function (data) {
        if (id !== requestId) return;
        place = p;
        if (p.name !== 'Your location') localStorage.setItem(CITY_KEY, p.name);
        render(p, data);
        status('');
      })
      .catch(function () { if (id === requestId) status('Could not load the weather. Try again in a moment.', true); });
  }

  function deg(v) { return Math.round(v) + '°'; }

  function render(p, d) {
    var c = d.current, h = d.hourly, day = d.daily;
    var w = describe(c.weather_code, c.is_day);

    $('place').textContent = p.name;
    $('place-sub').textContent = p.sub;
    $('now').className = 'now ' + w.sky;
    $('now-icon').innerHTML = icon(w.icon);
    $('now-temp').textContent = deg(c.temperature_2m);
    $('now-text').textContent = w.text;
    $('now-range').textContent = 'High ' + deg(day.temperature_2m_max[0]) + ' · Low ' + deg(day.temperature_2m_min[0]);
    $('f-feels').textContent = deg(c.apparent_temperature);
    $('f-hum').textContent = Math.round(c.relative_humidity_2m) + '%';
    $('f-wind').textContent = Math.round(c.wind_speed_10m) + ' km/h';
    $('f-rain').textContent = (day.precipitation_probability_max[0] == null ? 0 : day.precipitation_probability_max[0]) + '%';

    // Next 24 hours, starting at the current local hour of that place.
    var nowHour = c.time.slice(0, 13);              // "YYYY-MM-DDTHH"
    var start = 0;
    while (start < h.time.length && h.time[start].slice(0, 13) < nowHour) start++;
    var hours = $('hours');
    hours.innerHTML = '';
    for (var i = start; i < Math.min(start + 24, h.time.length); i++) {
      var hw = describe(h.weather_code[i], h.is_day[i]);
      var rain = h.precipitation_probability[i];
      var li = document.createElement('li');
      if (i === start) li.className = 'is-now';
      li.innerHTML = '<span class="h-time">' + (i === start ? 'Now' : hourLabel(h.time[i])) + '</span>' +
        icon(hw.icon) +
        '<span class="h-temp num">' + deg(h.temperature_2m[i]) + '</span>' +
        '<span class="h-rain num">' + (rain >= 20 ? rain + '%' : '') + '</span>';
      li.setAttribute('aria-label', (i === start ? 'Now' : hourLabel(h.time[i])) + ', ' + hw.text + ', ' + deg(h.temperature_2m[i]));
      hours.appendChild(li);
    }

    // Next 7 days with a shared low-to-high scale.
    var lo = Math.min.apply(null, day.temperature_2m_min), hi = Math.max.apply(null, day.temperature_2m_max);
    var span = Math.max(hi - lo, 1);
    var days = $('days');
    days.innerHTML = '';
    day.time.forEach(function (t, k) {
      var dw = describe(day.weather_code[k], 1);
      var min = day.temperature_2m_min[k], max = day.temperature_2m_max[k];
      var rain = day.precipitation_probability_max[k];
      var li = document.createElement('li');
      li.innerHTML = '<span class="d-name">' + (k === 0 ? 'Today' : dayLabel(t)) +
          (rain >= 20 ? '<span class="d-rain num">' + rain + '% rain</span>' : '') + '</span>' +
        icon(dw.icon) +
        '<span class="d-min num">' + deg(min) + '</span>' +
        '<span class="bar" aria-hidden="true"><span style="left:' + ((min - lo) / span * 100).toFixed(1) + '%;right:' + ((hi - max) / span * 100).toFixed(1) + '%"></span></span>' +
        '<span class="d-max num">' + deg(max) + '</span>';
      li.setAttribute('aria-label', (k === 0 ? 'Today' : dayLabel(t)) + ', ' + dw.text + ', low ' + deg(min) + ', high ' + deg(max));
      days.appendChild(li);
    });

    $('empty').hidden = true;
    $('result').hidden = false;
    document.title = p.name + ' weather · SkyCast';
  }

  // "2026-11-08T15:00" → "3 PM" (the place's own local time, no time zone maths needed).
  function hourLabel(t) {
    var hr = Number(t.slice(11, 13));
    return (hr % 12 || 12) + (hr < 12 ? ' AM' : ' PM');
  }
  // "2026-11-09" → "Mon", read as a calendar date so the visitor's time zone cannot shift it.
  function dayLabel(t) {
    var parts = t.split('-');
    var date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  }

  // WMO weather codes → words, panel colour and icon.
  function describe(code, isDay) {
    var night = !isDay;
    if (code === 0) return { text: night ? 'Clear night' : 'Clear sky', sky: night ? 'night' : 'clear', icon: night ? 'moon' : 'sun' };
    if (code === 1 || code === 2) return { text: code === 1 ? 'Mostly clear' : 'Partly cloudy', sky: night ? 'night' : 'partly', icon: night ? 'moon-cloud' : 'sun-cloud' };
    if (code === 3) return { text: 'Cloudy', sky: night ? 'night' : 'cloudy', icon: 'cloud' };
    if (code === 45 || code === 48) return { text: 'Fog', sky: night ? 'night' : 'fog', icon: 'fog' };
    if (code >= 51 && code <= 57) return { text: 'Drizzle', sky: 'rain', icon: 'rain' };
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { text: code >= 80 ? 'Showers' : 'Rain', sky: 'rain', icon: 'rain' };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { text: 'Snow', sky: 'snow', icon: 'snow' };
    if (code >= 95) return { text: 'Thunderstorm', sky: 'storm', icon: 'storm' };
    return { text: 'Unknown', sky: 'cloudy', icon: 'cloud' };
  }

  function icon(name) {
    var cloud = '<path d="M7.5 19h9a4 4 0 0 0 .5-7.97A6 6 0 0 0 5.6 12.6 3.3 3.3 0 0 0 7.5 19z"/>';
    var paths = {
      'sun': '<g class="sun"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></g>',
      'moon': '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"/>',
      'sun-cloud': '<g class="sun"><path d="M9 3v1.5M3.5 9H5M4.9 4.9l1 1M13.1 4.9l-1 1"/><path d="M6.2 11.2A3.4 3.4 0 0 1 12.3 7.7"/></g><path d="M9 20h8a3.6 3.6 0 0 0 .4-7.2 5.2 5.2 0 0 0-9.9 1.4A2.9 2.9 0 0 0 9 20z"/>',
      'moon-cloud': '<path d="M13 4.5a4.6 4.6 0 0 0 5.6 5.6A5 5 0 0 1 13 4.5z"/><path d="M8 20h8a3.6 3.6 0 0 0 .4-7.2 5.2 5.2 0 0 0-9.9 1.4A2.9 2.9 0 0 0 8 20z"/>',
      'cloud': cloud,
      'fog': '<path d="M7.5 14h9a4 4 0 0 0 .5-7.97A6 6 0 0 0 5.6 7.6 3.3 3.3 0 0 0 7.5 14z"/><path d="M4 18h16M6 21.5h12"/>',
      'rain': '<path d="M7.5 15h9a4 4 0 0 0 .5-7.97A6 6 0 0 0 5.6 8.6 3.3 3.3 0 0 0 7.5 15z"/><path class="drop" d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>',
      'snow': '<path d="M7.5 15h9a4 4 0 0 0 .5-7.97A6 6 0 0 0 5.6 8.6 3.3 3.3 0 0 0 7.5 15z"/><path d="M8 19h.01M12 21h.01M16 19h.01M10 22.5h.01M14 22.5h.01" stroke-width="2.6"/>',
      'storm': '<path d="M7.5 15h9a4 4 0 0 0 .5-7.97A6 6 0 0 0 5.6 8.6 3.3 3.3 0 0 0 7.5 15z"/><path d="M12.5 15.5L10.5 19h3l-2 3.5"/>'
    };
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || cloud) + '</svg>';
  }

  // ---------- Start: reopen the last city ----------
  var last = localStorage.getItem(CITY_KEY);
  if (last) { $('city').value = last; searchCity(last); }
})();
