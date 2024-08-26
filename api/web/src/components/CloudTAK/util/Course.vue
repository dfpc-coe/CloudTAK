<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Course</label>
        <div class='mx-2'>
            <CopyField
                :text='inMode'
                :size='24'
            />
            <span
                v-tooltip='"Degrees"'
                class='my-1 px-2'
                :class='{
                    "bg-gray-500 rounded-bottom": mode === "deg",
                    "cursor-pointer": mode !== "deg",
                }'
                @click='mode = "deg"'
            >Deg</span>
        </div>
    </div>
</template>

<script>
import CopyField from './CopyField.vue';

export default {
    name: 'COTCourse',
    components: {
        CopyField
    },
    props: {
        course: {
            type: Number,
            required: true
        },
        unit: {
            type: String,
            default: 'deg'
        }
    },
    data: function() {
        return {
            mode: this.unit,
        }
    },
    computed: {
        inMode: function() {
            if (this.mode === 'deg') return Math.round((this.course) * 1000) / 1000;
            return 'UNKNOWN';
        }
    }
}
</script>
