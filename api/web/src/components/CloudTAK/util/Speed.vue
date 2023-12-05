<template>
<div class='col-12'>
    <label class='subheader'>Speed</label>
    <div class='mx-2'>
        <div
            v-text='inMode'
            class='bg-gray-500 rounded-top py-2 px-2'
        />
        <span
            @click='mode = "ms"'
            class='my-1 px-2'
            :class='{
                "bg-gray-500 rounded-bottom": mode === "ms",
                "cursor-pointer": mode !== "ms",
            }'
            v-tooltip='"Meters Per Second"'
        >M/S</span>
        <span
            @click='mode = "mph"'
            class='my-1 px-2'
            :class='{
                "bg-gray-500 rounded-bottom": mode === "mph",
                "cursor-pointer": mode !== "mph",
            }'
            v-tooltip='"Miles Per Hour"'
        >MPH</span>
        <span
            @click='mode = "kph"'
            class='my-1 px-2'
            :class='{
                "bg-gray-500 rounded-bottom": mode === "kph",
                "cursor-pointer": mode !== "kph",
            }'
            v-tooltip='"Kilometers Per Hour"'
        >KM/H</span>
    </div>
</div>
</template>

<script>
export default {
    name: 'Speed',
    props: {
        speed: {
            type: Number,
            required: true
        }
    },
    computed: {
        inMode: function() {
            if (this.mode === 'ms') return Math.round(this.speed * 1000) / 1000;
            else if (this.mode === 'mph') return Math.round(this.speed * 2.23694 * 100) / 100;
            else if (this.mode === 'kph') return Math.round(this.speed * 3.6 * 100) / 100;
        }
    },
    data: function() {
        return {
            mode: 'ms',
        }
    }
}
</script>
