<template>
    <div class='col-12'>
        <div
            class='d-flex align-items-center cursor-pointer user-select-none py-2 px-2 rounded transition-all mx-2'
            :class='{ "bg-accent": expanded, "hover": !expanded }'
            @click='expanded = !expanded'
        >
            <IconCone
                :size='18'
                stroke='1'
                color='#6b7990'
                class='ms-2 me-1'
            />
            <label class='subheader cursor-pointer m-0'>Sensor</label>
            <div class='ms-auto d-flex align-items-center'>
                <IconChevronDown
                    class='transition-transform'
                    :class='{ "rotate-180": !expanded }'
                    :size='18'
                />
            </div>
        </div>

        <div
            class='grid-transition pt-2'
            :class='{ expanded: expanded }'
        >
            <div class='overflow-hidden'>
                <div class='mx-2 py-2'>
                    <div class='rounded px-2 bg-accent pb-2'>
                        <div class='row g-2'>
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
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import {
    IconCone,
    IconChevronDown
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

const expanded = ref(false);
const sensor = ref(JSON.parse(JSON.stringify(props.modelValue)));
if (!sensor.value.fov) sensor.value.fov = 0;
if (!sensor.value.azimuth) sensor.value.azimuth = 0;
if (!sensor.value.range) sensor.value.range = 0;

watch(sensor.value, () => {
    emit('update:modelValue', sensor.value);
})

watch(() => props.modelValue, () => {
    sensor.value = props.modelValue;
    if (!sensor.value.fov) sensor.value.fov = 0;
    if (!sensor.value.azimuth) sensor.value.azimuth = 0;
    if (!sensor.value.range) sensor.value.range = 0;
});
</script>

<style scoped>
.grid-transition {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease-out;
}

.grid-transition.expanded {
    grid-template-rows: 1fr;
}

.rotate-180 {
    transform: rotate(-90deg);
}

.transition-transform {
    transition: transform 0.3s ease-out;
}
</style>
