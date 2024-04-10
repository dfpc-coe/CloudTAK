<template>
<div class='col-12'>
    <label class='subheader mx-2'>Speed</label>
    <div class='mx-2'>
        <div
            v-text='inMode'
            class='bg-gray-500 rounded-top py-2 px-2'
        />
        <span
            @click='mode = "m/s"'
            class='my-1 px-2'
            :class='{
                "bg-gray-500 rounded-bottom": mode === "m/s",
                "cursor-pointer": mode !== "m/s",
            }'
            v-tooltip='"Meters Per Second"'
        >M/S</span>
        <span
            @click='mode = "mi/h"'
            class='my-1 px-2'
            :class='{
                "bg-gray-500 rounded-bottom": mode === "mi/h",
                "cursor-pointer": mode !== "mi/h",
            }'
            v-tooltip='"Miles Per Hour"'
        >MPH</span>
        <span
            @click='mode = "km/h"'
            class='my-1 px-2'
            :class='{
                "bg-gray-500 rounded-bottom": mode === "km/h",
                "cursor-pointer": mode !== "km/h",
            }'
            v-tooltip='"Kilometers Per Hour"'
        >KM/H</span>
    </div>
</div>
</template>

<script>
export default {
    name: 'COTSpeed',
    props: {
        speed: {
            type: Number,
            required: true
        },
        unit: {
            type: String,
            default: 'mi/h'
        }
    },
    computed: {
        inMode: function() {
            if (this.mode === 'm/s') return Math.round(this.speed * 1000) / 1000;
            else if (this.mode === 'mi/h') return Math.round(this.speed * 2.23694 * 100) / 100;
            else if (this.mode === 'km/h') return Math.round(this.speed * 3.6 * 100) / 100;
            return 'UNKNOWN';
        }
    },
    data: function() {
        return {
            mode: this.unit,
        }
    }
}
</script>
