document.addEventListener('DOMContentLoaded', () => {
    const cityInput = document.getElementById('city-input');
    const searchForm = document.getElementById('search-form');
    const errorMessage = document.getElementById('error-message');
    const weatherInfo = document.getElementById('weather-info');
    const backgroundGradient = document.getElementById('background-gradient');

    // Load last searched city
    const lastCity = localStorage.getItem('lastCity');
    if (lastCity) {
        cityInput.value = lastCity;
        fetchWeatherData(lastCity);
    }

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const city = cityInput.value.trim();
        if (city) {
            fetchWeatherData(city);
        }
    });

    async function fetchWeatherData(city) {
        showError(null); // Clear errors
        try {
            // 1. Geocoding
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`;
            const geoRes = await fetch(geoUrl);
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                throw new Error('City not found.');
            }

            const { latitude, longitude, name, country } = geoData.results[0];

            // Save to LocalStorage
            localStorage.setItem('lastCity', name);

            // 2. Weather Data (Current + Daily)
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&past_days=1&forecast_days=6`;
            const weatherRes = await fetch(weatherUrl);
            const weatherData = await weatherRes.json();

            updateUI(name, country, weatherData);

        } catch (error) {
            console.error(error);
            showError(error.message || 'Failed to fetch weather data.');
            weatherInfo.style.display = 'none';
        }
    }

    function updateUI(city, country, data) {
        const current = data.current_weather;
        const daily = data.daily;

        // Update Location
        document.getElementById('city-name').textContent = city;
        document.getElementById('country-name').textContent = country || '';

        // Update Current Weather
        document.getElementById('temperature').textContent = current.temperature;
        document.getElementById('wind-speed').textContent = current.windspeed;

        const { condition, description, iconSvg } = getWeatherDetails(current.weathercode);
        document.getElementById('description').textContent = description;
        document.getElementById('weather-icon-container').innerHTML = iconSvg;

        // Update Background
        backgroundGradient.className = `background-gradient ${condition}`;

        // Update Forecast
        const forecastList = document.getElementById('forecast-list');
        forecastList.innerHTML = ''; // Clear previous

        const today = new Date().toISOString().split('T')[0];

        daily.time.forEach((time, index) => {
            const date = new Date(time);
            const dayName = getDayName(date, time, today);
            const code = daily.weathercode[index];
            const maxTemp = daily.temperature_2m_max[index];
            const minTemp = daily.temperature_2m_min[index];
            const { condition: fCondition, iconSvg: fIcon } = getWeatherDetails(code, true);

            const item = document.createElement('div');
            item.className = 'forecast-item';
            item.innerHTML = `
                <span class="day">${dayName}</span>
                <div class="forecast-icon">${fIcon}</div>
                <div class="temps">
                    <span class="max">${maxTemp}°</span>
                    <span class="min">${minTemp}°</span>
                </div>
            `;
            forecastList.appendChild(item);
        });

        weatherInfo.style.display = 'block';
    }

    function getDayName(dateObj, dateString, todayString) {
        if (dateString === todayString) return 'Today';
        
        // Check for Yesterday
        const todayDate = new Date(todayString);
        const diffTime = todayDate - dateObj;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays === 1) return 'Yesterday';

        return dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    }

    function showError(message) {
        if (message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        } else {
            errorMessage.style.display = 'none';
        }
    }

    function getWeatherDetails(code, isSmall = false) {
        let condition = 'unknown';
        let description = 'Unknown';
        let iconName = 'default';

        if (code === 0) { condition = 'clear'; description = 'Clear sky'; iconName = 'sun'; }
        else if ([1, 2, 3].includes(code)) { condition = 'cloudy'; description = 'Partly cloudy'; iconName = 'cloud'; }
        else if ([45, 48].includes(code)) { condition = 'cloudy'; description = 'Fog'; iconName = 'cloud'; }
        else if ([51, 53, 55].includes(code)) { condition = 'rain'; description = 'Drizzle'; iconName = 'rain'; }
        else if ([61, 63, 65].includes(code)) { condition = 'rain'; description = 'Rain'; iconName = 'rain'; }
        else if ([71, 73, 75].includes(code)) { condition = 'snow'; description = 'Snow'; iconName = 'snow'; }
        else if ([80, 81, 82].includes(code)) { condition = 'rain'; description = 'Showers'; iconName = 'rain'; }
        else if ([95, 96, 99].includes(code)) { condition = 'thunder'; description = 'Thunderstorm'; iconName = 'thunder'; }

        const iconClass = isSmall ? 'icon tiny' : 'icon';
        const iconSvg = getSvg(iconName, iconClass);

        return { condition, description, iconSvg };
    }

    function getSvg(name, className) {
        const icons = {
            sun: `<svg class="${className} sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
            cloud: `<svg class="${className} cloud" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`,
            rain: `<svg class="${className} rain" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="13" x2="16" y2="21"></line><line x1="8" y1="13" x2="8" y2="21"></line><line x1="12" y1="15" x2="12" y2="23"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>`,
            snow: `<svg class="${className} snow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="8" y1="20" x2="8.01" y2="20"></line><line x1="12" y1="18" x2="12.01" y2="18"></line><line x1="12" y1="22" x2="12.01" y2="22"></line><line x1="16" y1="16" x2="16.01" y2="16"></line><line x1="16" y1="20" x2="16.01" y2="20"></line></svg>`,
            thunder: `<svg class="${className} thunder" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
            default: `<svg class="${className} default" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
        };
        return icons[name] || icons.default;
    }
});
