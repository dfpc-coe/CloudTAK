<template>
<div class='col-12 row g-0 hover-dark'>
    <div class='col-12 mt-2'>
        <label class='subheader mx-2'>National Weather Service</label>
    </div>
    <div class='col-12 d-flex py-2 px-2'>
        <IconSun v-if='weather.properties.periods[0].shortForecast.toLowerCase().includes("sunny")' size='40'/>
        <IconMoon v-else-if='weather.properties.periods[0].shortForecast.toLowerCase().includes("clear")' size='40'/>
        <IconCloud v-else-if='weather.properties.periods[0].shortForecast.toLowerCase().includes("cloud")' size='40'/>
        <IconCloudRain v-else-if='weather.properties.periods[0].shortForecast.toLowerCase().includes("rain")' size='40'/>
        <IconSnowflake v-else-if='weather.properties.periods[0].shortForecast.toLowerCase().includes("snow")' size='40'/>
        <IconCloudStorm v-else-if='weather.properties.periods[0].shortForecast.toLowerCase().includes("storm")' size='40'/>
        <IconCloudFog v-else-if='weather.properties.periods[0].shortForecast.toLowerCase().includes("fog")' size='40'/>
        <IconWind v-else-if='weather.properties.periods[0].shortForecast.toLowerCase().includes("wind")' size='40'/>

        <div class='d-flex mx-2'>
            <div style='font-size: 30px;' v-text='weather.properties.periods[0].temperature'></div>
            <div class='mx-1 my-1' v-text='"°" + weather.properties.periods[0].temperatureUnit'></div>
        </div>
        <div class='d-flex ms-auto'>
            <div style='font-size: 20px;' v-text='weather.properties.periods[0].shortForecast'></div>
        </div>
    </div>
</div>
</template>

<script>
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

export default {
    name: 'QueryWeather',
    props: {
        weather: Object,
        required: true
    },
    components: {
        IconSun,
        IconMoon,
        IconCloud,
        IconCloudRain,
        IconSnowflake,
        IconCloudStorm,
        IconCloudFog,
        IconWind
    }
}
</script>
