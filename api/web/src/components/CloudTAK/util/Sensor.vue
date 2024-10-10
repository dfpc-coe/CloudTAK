<template>
    <div class='px-1 pb-2 col-12'>
        <label class='mx-1 subheader'>Sensor FOV</label>

        <div class='mx-2 py-3'>
            <div class='row g-2 rounded px-2 bg-gray-500 pb-2'>
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

<script>
import { defineComponent } from 'vue'
import {
    TablerRange,
    TablerInput
} from '@tak-ps/vue-tabler';

export default defineComponent({
    name: 'CoTSensor',
    components: {
        TablerInput,
        TablerRange
    },
    props: {
        modelValue: {
            type: Object,
            required: true
        }
    },
    emits: [
        'update:modelValue'
    ],
    data: function() {
        let sensor = JSON.parse(JSON.stringify(this.modelValue));
        if (!sensor.fov) sensor.fov = 0;
        if (!sensor.azimuth) sensor.azimuth = 0;
        if (!sensor.range) sensor.range = 0;

        return { sensor }
    },
    watch: {
        sensor: {
            deep: true,
            handler: function() {
                this.$emit('update:modelValue', this.sensor);
            }
        }
    },
})
</script>
