<template>
<div class='col-12 row g-0 hover-dark'>
    <div class='col-12 mt-2'>
        <label class='subheader mx-2'>National Weather Service</label>
    </div>
    <div class='col-12 d-flex py-2 px-2'>
        <img :src='weather.properties.periods[0].icon'/>
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
export default {
    name: 'QueryWeather',
    props: {
        weather: Object,
        required: true
    },
}
</script>
