<template>
    <div class='col-12 row g-0 hover'>
        <div class='col-12'>
            <label class='subheader mx-2'>National Weather Service</label>
        </div>
        <div
            v-if='props.weather'
            class='col-12 d-flex py-2 px-2'
        >
            <IconSun
                v-if='props.weather.properties.periods[0].shortForecast.toLowerCase().includes("sunny")'
                size='40'
                stroke='1'
            />
            <IconMoon
                v-else-if='props.weather.properties.periods[0].shortForecast.toLowerCase().includes("clear")'
                size='40'
                stroke='1'
            />
            <IconCloud
                v-else-if='props.weather.properties.periods[0].shortForecast.toLowerCase().includes("cloud")'
                size='40'
                stroke='1'
            />
            <IconCloudRain
                v-else-if='props.weather.properties.periods[0].shortForecast.toLowerCase().includes("rain")'
                size='40'
                stroke='1'
            />
            <IconSnowflake
                v-else-if='props.weather.properties.periods[0].shortForecast.toLowerCase().includes("snow")'
                size='40'
                stroke='1'
            />
            <IconCloudStorm
                v-else-if='props.weather.properties.periods[0].shortForecast.toLowerCase().includes("storm")'
                size='40'
                stroke='1'
            />
            <IconCloudFog
                v-else-if='props.weather.properties.periods[0].shortForecast.toLowerCase().includes("fog")'
                size='40'
                stroke='1'
            />
            <IconWind
                v-else-if='props.weather.properties.periods[0].shortForecast.toLowerCase().includes("wind")'
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
import type { SearchReverse } from '../../../types.ts';
import {
    IconSun,
    IconMoon,
    IconCloud,
    IconCloudRain,
    IconSnowflake,
    IconCloudStorm,
    IconCloudFog,
    IconWind
} from '@tabler/icons-vue';

const props = defineProps<{
    weather: SearchReverse["weather"]
}>();
</script>
