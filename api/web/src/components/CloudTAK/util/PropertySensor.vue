<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Sensor'
        >
            <template #icon>
                <IconCone
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>

            <div class='mx-2 py-2 mt-2'>
                <div class='rounded px-2 cloudtak-accent pb-2'>
                    <div class='row g-2'>
                        <div class='col-6'>
                            <TablerInput
                                v-model='sensor.type'
                                label='Type'
                                placeholder='Unknown'
                            />
                        </div>
                        <div class='col-6'>
                            <TablerInput
                                v-model='sensor.model'
                                label='Model'
                                placeholder='Unknown'
                            />
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
        </SlideDownHeader>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { isEqual as deepEqual } from '@ver0/deep-equal';
import SlideDownHeader from './SlideDownHeader.vue';
import { IconCone } from '@tabler/icons-vue';
import { TablerRange, TablerInput } from '@tak-ps/vue-tabler';
import type COT from '../../../base/cot';

interface Sensor {
    type?: string;
    model?: string;
    range?: number;
    azimuth?: number;
    fov?: number;
    [key: string]: unknown;
}

interface Props {
    cot: COT;
}

const props = defineProps<Props>();

const expanded = ref(false);

function initSensor(raw?: Sensor): Sensor {
    const s = JSON.parse(JSON.stringify(raw || {})) as Sensor;
    if (!s.fov) s.fov = 0;
    if (!s.azimuth) s.azimuth = 0;
    if (!s.range) s.range = 0;
    return s;
}

const sensor = ref<Sensor>(initSensor(props.cot.properties.sensor as Sensor));

watch(sensor, (value) => {
    const next = initSensor(value);
    const current = initSensor(props.cot.properties.sensor as Sensor);

    if (deepEqual(next, current)) return;

    const properties = { ...props.cot.properties, sensor: next };
    props.cot.update({ properties });
}, { deep: true });

watch(() => props.cot.properties.sensor, (value) => {
    const next = initSensor(value);

    if (deepEqual(next, sensor.value)) return;

    sensor.value = next;
});
</script>


