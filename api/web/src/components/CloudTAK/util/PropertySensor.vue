<template>
    <div class='px-1 pb-2 col-12'>
        <IconCone
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label class='subheader user-select-none'>Sensor</label>

        <div class='mx-2 py-3'>
            <div class='row g-2 rounded px-2 bg-accent pb-2'>
                <div class='col-6'>
                    <label class='subheader user-select-none'>Type</label>

                    <div v-text='sensor.type || "Unknown"' />
                </div>
                <div class='col-6'>
                    <label class='subheader user-select-none'>Model</label>
                    <div v-text='sensor.model || "Unknown"' />
                </div>

                <TablerRange
                    v-if='sensor.range !== undefined'
                    v-model='sensor.range'
                    label='Sensor Range Length'
                    :min='0'
                    :max='60000'
                >
                    <div class='d-flex align-items-center'>
                        <TablerInput
                            v-model='sensor.range'
                            style='width: 82px'
                        />
                        <div class='ms-1'>
                            m
                        </div>
                    </div>
                </TablerRange>

                <TablerRange
                    v-if='sensor.azimuth !== undefined'
                    v-model='sensor.azimuth'
                    label='Sensor Direction'
                    :min='0'
                    :max='360'
                >
                    <div class='d-flex align-items-center'>
                        <TablerInput
                            v-model='sensor.azimuth'
                            style='width: 82px'
                        />
                        <div class='ms-1'>
                            deg
                        </div>
                    </div>
                </TablerRange>

                <TablerRange
                    v-if='sensor.fov !== undefined'
                    v-model='sensor.fov'
                    label='Sensor FOV'
                    :min='0'
                    :max='360'
                >
                    <div class='d-flex align-items-center'>
                        <TablerInput
                            v-model='sensor.fov'
                            style='width: 82px'
                        />
                        <div class='ms-1'>
                            deg
                        </div>
                    </div>
                </TablerRange>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import {
    IconCone,
} from '@tabler/icons-vue';
import {
    TablerRange,
    TablerInput
} from '@tak-ps/vue-tabler';

const props = defineProps({
    modelValue: {
        type: Object,
        required: true
    }
});

const emit = defineEmits([
    'update:modelValue'
]);

const sensor = ref(JSON.parse(JSON.stringify(props.modelValue)));
if (!sensor.value.fov) sensor.value.fov = 0;
if (!sensor.value.azimuth) sensor.value.azimuth = 0;
if (!sensor.value.range) sensor.value.range = 0;

watch(sensor.value, () => {
    emit('update:modelValue', sensor.value);
})

watch(props.sensor, () => {
    sensor.value = props.modelValue;
    if (!sensor.value.fov) sensor.value.fov = 0;
    if (!sensor.value.azimuth) sensor.value.azimuth = 0;
    if (!sensor.value.range) sensor.value.range = 0;
});
</script>
