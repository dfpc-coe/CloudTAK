<template>
<div class='px-1 pb-2 col-12'>
    <label class='mx-1 subheader'>Sensor FOV</label>

    <div class='mx-2 py-3'>
        <div class='row g-2 rounded px-2 bg-gray-500 pb-2'>
            <TablerRange
                v-if='sensor.range !== undefined'
                label='Sensor Range Length'
                :min='0'
                :max='60000'
                v-model='sensor.range'
            >
                <div class='d-flex align-items-center'>
                    <TablerInput
                        style='width: 82px'
                        v-model='sensor.range'
                    />
                    <div class='ms-1'>m</div>
                </div>
            </TablerRange>

            <TablerRange
                v-if='sensor.azimuth !== undefined'
                label='Sensor Direction'
                :min='0'
                :max='360'
                v-model='sensor.azimuth'
            >
                <div class='d-flex align-items-center'>
                    <TablerInput
                        style='width: 82px'
                        v-model='sensor.azimuth'
                    />
                    <div class='ms-1'>deg</div>
                </div>
            </TablerRange>

            <TablerRange
                v-if='sensor.fov !== undefined'
                label='Sensor FOV'
                :min='0'
                :max='360'
                v-model='sensor.fov'
            >
                <div class='d-flex align-items-center'>
                    <TablerInput
                        style='width: 82px'
                        v-model='sensor.fov'
                    />
                    <div class='ms-1'>deg</div>
                </div>
            </TablerRange>
        </div>
    </div>
</div>
</template>

<script lang='ts'>
import { defineComponent } from 'vue'
import { std } from '../../../../src/std.ts';
import type { Feature } from '../../../types.ts';
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
    watch: {
        sensor: {
            deep: true,
            handler: function() {
                this.$emit('update:modelValue', this.sensor);
            }
        }
    },
    data: function(): {
        sensor: Required<Feature["properties"]["sensor"]>
    } {
        const sensor = JSON.parse(JSON.stringify(this.modelValue)) as Required<Feature["properties"]["sensor"]>
        if (!sensor.fov) sensor.fov = 0;
        if (!sensor.azimuth) sensor.azimuth = 0;
        if (!sensor.range) sensor.range = 0;

        return { sensor }
    },
})
</script>
