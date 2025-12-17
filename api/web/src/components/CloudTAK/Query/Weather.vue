<template>
    <div class='col-12 row g-0'>
        <div class='col-12'>
            <label class='subheader mx-2'>{{ props.weather?.properties.forecastGenerator || 'National Weather Service' }}</label>
        </div>
        <div
            v-if='props.weather'
            class='col-12'
        >
            <TablerSlidedown :click-anywhere-expand='true'>
                <div class='d-flex align-items-center py-2 px-2'>
                    <component
                        :is='getIcon(props.weather.properties.periods[0].shortForecast)'
                        size='40'
                        stroke='1'
                    />

                    <div class='d-flex mx-2'>
                        <div
                            style='font-size: 30px;'
                            v-text='props.weather.properties.periods[0].temperature'
                        />
                        <div
                            class='mx-1 my-1'
                            v-text='"°" + props.weather.properties.periods[0].temperatureUnit'
                        />
                    </div>
                    <div class='d-flex ms-auto'>
                        <div
                            class='mx-2'
                            style='font-size: 20px;'
                            v-text='props.weather.properties.periods[0].shortForecast'
                        />
                    </div>
                </div>

                <div class='row px-2 pb-2'>
                    <div class='col-6 mb-2'>
                        <div class='d-flex align-items-center text-muted'>
                            <IconWind
                                :size='20'
                                stroke='1'
                            />
                            <span class='ms-2 small'>Wind</span>
                        </div>
                        <div class='ms-4'>
                            {{ props.weather.properties.periods[0].windSpeed }} {{ props.weather.properties.periods[0].windDirection }}
                        </div>
                    </div>
                    <div class='col-6 mb-2'>
                        <div class='d-flex align-items-center text-muted'>
                            <IconDroplet
                                :size='20'
                                stroke='1'
                            />
                            <span class='ms-2 small'>Humidity</span>
                        </div>
                        <div class='ms-4'>
                            {{ props.weather.properties.periods[0].relativeHumidity.value }}%
                        </div>
                    </div>
                    <div class='col-6 mb-2'>
                        <div class='d-flex align-items-center text-muted'>
                            <IconTemperature
                                :size='20'
                                stroke='1'
                            />
                            <span class='ms-2 small'>Dewpoint</span>
                        </div>
                        <div class='ms-4'>
                            {{ Math.round(props.weather.properties.periods[0].dewpoint.value) }}°C
                        </div>
                    </div>
                    <div class='col-6 mb-2'>
                        <div class='d-flex align-items-center text-muted'>
                            <IconUmbrella
                                :size='20'
                                stroke='1'
                            />
                            <span class='ms-2 small'>Precipitation</span>
                        </div>
                        <div class='ms-4'>
                            {{ props.weather.properties.periods[0].probabilityOfPrecipitation.value || 0 }}%
                        </div>
                    </div>
                </div>

                <template #expanded>
                    <div class='col-12 border-top pt-2'>
                        <template
                            v-for='(period, i) in forecastPeriods'
                            :key='period.number'
                        >
                            <div
                                v-if='i === 0 || !isSameDay(period.startTime, forecastPeriods[i-1].startTime)'
                                class='px-2 py-1 font-weight-bold small text-muted border-bottom'
                                :class='{ "mt-2": i > 0 }'
                            >
                                {{ moment(period.startTime).format('dddd, MMM Do') }}
                            </div>
                            <div
                                class='d-flex align-items-center px-2 py-1'
                                :class='{ "border-top": i > 0 && isSameDay(period.startTime, forecastPeriods[i-1].startTime) }'
                            >
                                <div
                                    style='width: 80px;'
                                    class='small font-weight-bold'
                                >
                                    <div v-text='period.name' />
                                    <div
                                        class='text-muted'
                                        style='font-size: 0.7rem'
                                        v-text='moment(period.startTime).format("h A")'
                                    />
                                </div>
                                <component
                                    :is='getIcon(period.shortForecast)'
                                    :size='24'
                                    stroke='1'
                                    class='mx-2'
                                />
                                <div
                                    class='flex-grow-1 small'
                                    v-text='period.shortForecast'
                                />
                                <div class='ms-auto font-weight-bold'>
                                    {{ period.temperature }}°
                                </div>
                            </div>
                        </template>
                    </div>
                </template>
            </TablerSlidedown>
        </div>
        <div
            v-else
            class='col-12 d-flex py-2 px-2'
        >
            <div
                class='mx-2'
                style='font-size: 20px;'
            >
                No Forecast Found
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import type { SearchReverse } from '../../../types.ts';
import moment from 'moment';
import {
    TablerSlidedown
} from '@tak-ps/vue-tabler';
import {
    IconSun,
    IconMoon,
    IconCloud,
    IconCloudRain,
    IconSnowflake,
    IconCloudStorm,
    IconCloudFog,
    IconWind,
    IconDroplet,
    IconTemperature,
    IconUmbrella
} from '@tabler/icons-vue';

const props = defineProps<{
    weather: SearchReverse["weather"]
}>();

const forecastPeriods = computed(() => {
    if (!props.weather) return [];
    return props.weather.properties.periods.slice(1);
});

function isSameDay(d1: string, d2: string) {
    return moment(d1).isSame(d2, 'day');
}

function getIcon(forecast: string) {
    const f = forecast.toLowerCase();
    if (f.includes('sunny')) return IconSun;
    if (f.includes('clear')) return IconMoon;
    if (f.includes('cloud')) return IconCloud;
    if (f.includes('rain') || f.includes('shower')) return IconCloudRain;
    if (f.includes('snow')) return IconSnowflake;
    if (f.includes('storm') || f.includes('thunder')) return IconCloudStorm;
    if (f.includes('fog')) return IconCloudFog;
    if (f.includes('wind')) return IconWind;
    return IconCloud;
}
</script>
