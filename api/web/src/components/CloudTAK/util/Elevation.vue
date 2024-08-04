<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Elevation</label>
        <div class='mx-2'>
            <div
                class='bg-gray-500 rounded-top py-2 px-2'
                v-text='inMode'
            />
            <span
                v-tooltip='"Feet"'
                class='my-1 px-2'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "feet",
                    "cursor-pointer": mode !== "feet",
                }'
                @click='mode = "feet"'
            >Feet</span>
            <span
                v-tooltip='"Meters"'
                class='my-1 px-2'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "meter",
                    "cursor-pointer": mode !== "meter",
                }'
                @click='mode = "meter"'
            >Meters</span>
        </div>
    </div>
</template>

<script>
export default {
    name: 'COTElevation',
    props: {
        elevation: {
            type: Number,
            required: true
        },
        unit: {
            type: String,
            default: 'feet'
        }
    },
    data: function() {
        return {
            mode: this.unit,
        }
    },
    computed: {
        inMode: function() {
            if (this.mode === 'feet') {
                return Math.round(this.elevation * 3.28084 * 1000) / 1000;
            } else if (this.mode === 'meter') {
                return Math.round(this.elevation * 100) / 100;
            } else {
                return 'UNKNOWN';
            }
        }
    }
}
</script>
