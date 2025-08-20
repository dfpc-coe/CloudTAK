<template>
    <div class='col-12'>
        <IconMountain
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label class='subheader user-select-none'>Distance</label>
        <div class='mx-2'>
            <CopyField
                v-model='inMode'
                :size='24'
            />
            <span
                v-tooltip='"Feet"'
                class='my-1 px-2 user-select-none'
                :class='{
                    "bg-gray-500 rounded-bottom text-blue": mode === "feet",
                    "cursor-pointer": mode !== "feet",
                }'
                role='menuitem'
                tabindex='0'
                @keyup.enter='mode = "feet"'
                @click='mode = "feet"'
            >Feet</span>
            <span
                v-tooltip='"Meters"'
                class='my-1 px-2 user-select-none'
                :class='{
                    "bg-gray-500 rounded-bottom text-blue": mode === "meter",
                    "cursor-pointer": mode !== "meter",
                }'
                role='menuitem'
                tabindex='0'
                @keyup.enter='mode = "meter"'
                @click='mode = "meter"'
            >Meters</span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import CopyField from './CopyField.vue';
import {
    IconMountain
} from '@tabler/icons-vue';

const props = defineProps({
    elevation: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        default: 'feet'
    }
})

const mode = ref(props.unit);

const inMode = computed(() => {
    if (mode.value === 'feet') {
        return Math.round(props.elevation * 3.28084 * 100) / 100;
    } else if (mode.value === 'meter') {
        return Math.round(props.elevation * 100) / 100;
    } else {
        return 'UNKNOWN';
    }
})
</script>
