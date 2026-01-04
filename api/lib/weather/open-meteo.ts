import fetch from '../fetch.js';
import { Static } from "@sinclair/typebox";
import { WeatherInterface, FetchHourly } from '../interface-weather.js';

export default class OpenMeteo implements WeatherInterface {
    async get(lon: number, lat: number): Promise<Static<typeof FetchHourly>> {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.append('latitude', lat.toString());
        url.searchParams.append('longitude', lon.toString());
        url.searchParams.append('hourly', 'temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code');
        url.searchParams.append('timezone', 'auto');
        url.searchParams.append('forecast_days', '7');

        const res = await fetch(url);
        const data = await res.json() as {
            elevation?: number;
            hourly: {
                time: string[];
                temperature_2m: number[];
                relative_humidity_2m: number[];
                precipitation_probability: number[];
                wind_speed_10m: number[];
                wind_direction_10m: number[];
                weather_code: number[];
            };
        };

        // Convert Open-Meteo data to NWS format
        const periods = [];
        for (let i = 0; i < Math.min(168, data.hourly.time.length); i++) { // 7 days * 24 hours
            const time = new Date(data.hourly.time[i]);
            periods.push({
                number: i + 1,
                name: time.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric' }),
                startTime: time.toISOString(),
                endTime: new Date(time.getTime() + 3600000).toISOString(),
                isDaytime: time.getHours() >= 6 && time.getHours() < 18,
                temperature: Math.round(data.hourly.temperature_2m[i]),
                temperatureUnit: 'C',
                temperatureTrend: null,
                probabilityOfPrecipitation: {
                    unitCode: 'wmoUnit:percent',
                    value: data.hourly.precipitation_probability[i] || 0
                },
                dewpoint: {
                    unitCode: 'wmoUnit:degC',
                    value: 0
                },
                relativeHumidity: {
                    unitCode: 'wmoUnit:percent',
                    value: data.hourly.relative_humidity_2m[i] || 0
                },
                windSpeed: `${Math.round(data.hourly.wind_speed_10m[i] || 0)} km/h`,
                windDirection: this.getWindDirection(data.hourly.wind_direction_10m[i] || 0),
                icon: this.getWeatherIcon(data.hourly.weather_code[i] || 0, time.getHours() >= 6 && time.getHours() < 18),
                shortForecast: this.getWeatherDescription(data.hourly.weather_code[i] || 0),
                detailedForecast: this.getWeatherDescription(data.hourly.weather_code[i] || 0)
            });
        }

        return {
            type: 'Feature',
            properties: {
                units: 'si',
                forecastGenerator: 'Open-Meteo Weather',
                generatedAt: new Date().toISOString(),
                updateTime: new Date().toISOString(),
                validTimes: `${new Date().toISOString()}/${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}`,
                elevation: {
                    unitCode: 'wmoUnit:m',
                    value: data.elevation || 0
                },
                periods
            },
            geometry: {
                type: 'Polygon',
                coordinates: [[[lon, lat], [lon + 0.01, lat], [lon + 0.01, lat + 0.01], [lon, lat + 0.01], [lon, lat]]]
            }
        };
    }

    getWindDirection(degrees: number): string {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        return directions[Math.round(degrees / 22.5) % 16];
    }

    getWeatherDescription(code: number): string {
        const descriptions: { [key: number]: string } = {
            0: 'Clear', 1: 'Mostly sunny', 2: 'Partly cloudy', 3: 'Cloudy',
            45: 'Fog', 48: 'Fog', 51: 'Light rain', 53: 'Rain',
            55: 'Heavy rain', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
            71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 95: 'Thunderstorm'
        };
        return descriptions[code] || 'Clear';
    }

    getWeatherIcon(code: number, isDaytime: boolean): string {
        const timeOfDay = isDaytime ? 'day' : 'night';
        const iconMap: { [key: number]: string } = {
            0: 'skc', 1: 'few', 2: 'sct', 3: 'ovc',
            45: 'fg', 48: 'fg', 51: 'ra', 53: 'ra',
            55: 'ra', 61: 'ra', 63: 'ra', 65: 'ra',
            71: 'sn', 73: 'sn', 75: 'sn', 95: 'tsra'
        };
        const icon = iconMap[code] || 'skc';
        return `https://api.weather.gov/icons/land/${timeOfDay}/${icon}?size=medium`;
    }
}
