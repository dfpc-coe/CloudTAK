<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Alarms
            </h3>
            <div class='ms-auto'>
                <div class='btn-list'>
                    <TablerRefreshButton
                        title='Refresh'
                        :loading='loading'
                        @click='emit("stack")'
                    />

                    <TablerIconButton
                        title='Edit'
                        @click='disabled = false'
                    >
                        <IconPencil
                            :size='24'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>
        </div>

        <div class='card-body'>
            <template v-if='loading'>
                <TablerLoading />
            </template>
            <template v-else>
                <div class='row g-2'>
                    <div class='col-md-12'>
                        <TablerEnum
                            v-model='config.priority'
                            label='Alarm Urgency'
                            :disabled='disabled'
                            :options='["off", "high", "low"]'
                        />
                    </div>

                    <TablerInlineAlert
                        v-if='config.priority === "high"'
                        severity='danger'
                        title='High Urgency Alarms'
                        description='Use only for mission-critical layers that require immediate attention'
                        :dismissable='false'
                    />
                    <TablerInlineAlert
                        v-else-if='config.priority === "low"'
                        severity='info'
                        title='Low Urgency Alarms'
                        description='Use for layers that are important but not mission-critical'
                        :dismissable='false'
                    />

                    <div
                        v-if='config.priority !== "off"'
                        class='row g-3 mb-4 align-items-end'
                    >
                        <div class='col-md'>
                            <TablerRange
                                v-model='config.alarm_evals'
                                label='Evaluation Periods'
                                :disabled='disabled'
                                :min='1'
                                :max='10'
                                @change='periods = generatePeriodData()'
                            >
                                <span>{{ config.alarm_evals }}</span>
                            </TablerRange>
                        </div>
                        <div class='col-md'>
                            <TablerRange
                                v-model='config.alarm_points'
                                label='Data Points to Alarm'
                                :disabled='disabled'
                                :min='1'
                                :max='config.alarm_evals'
                            >
                                <span>{{ config.alarm_points }}</span>
                            </TablerRange>
                        </div>
                        <div class='col-md'>
                            <TablerRange
                                v-model='config.alarm_period'
                                label='Period (seconds)'
                                :disabled='disabled'
                                :min='2'
                                :max='300'
                                @change='periods = generatePeriodData()'
                            >
                                <span>{{ config.alarm_period }}s</span>
                            </TablerRange>
                        </div>
                    </div>

                    <div
                        v-if='config.priority !== "off"'
                        class='card text-center mb-4'
                    >
                        <div class='card-body'>
                            <p class='card-text fs-5'>
                                Alarm State:
                                <span
                                    class='fw-bold'
                                    :class='{
                                        "text-success": alarmState === "OK",
                                        "text-danger": alarmState === "ALARM",
                                        "text-muted": alarmState === "OFF"
                                    }'
                                >{{ alarmState }}</span>
                            </p>
                            <p class='card-text text-muted'>
                                {{ periods.filter(p => p).length }} out of {{ config.alarm_evals }} recent periods are breaching the threshold.
                            </p>
                        </div>

                        <div class='d-flex align-items-center px-3 pb-2'>
                            <div class='subheader'>
                                <span v-text='`${periods.length * config.alarm_period} Seconds Ago`' />
                            </div>
                            <div class='ms-auto subheader'>
                                Current Time
                            </div>
                        </div>
                        <div
                            class='d-flex align-items-stretch gap-1 ps-3 pe-3 pb-3'
                            style='height: 250px;'
                        >
                            <div
                                v-for='(periodData, periodIndex) in periods.slice(0, EXTRA_PERIODS)'
                                :key='periodIndex'
                                class='h-100 d-flex flex-column justify-content-end p-1 border rounded'
                                :style='`width: calc(${100 / periods.length}%)`'
                            >
                                <div class='text-center small fw-bold mt-1 text-body-secondary'>
                                    Ignored
                                </div>
                            </div>
                            <div
                                v-for='(periodData, periodIndex) in periods.slice(EXTRA_PERIODS)'
                                :key='periodIndex'
                                class='cursor-pointer hover h-100 d-flex flex-column justify-content-end p-1 border rounded'
                                :class='{
                                    "border-danger bg-danger-subtle": periodData,
                                    "border-success bd-success-suble": !periodData
                                }'
                                style='transition: all 0.3s ease-in-out'
                                :style='`width: calc(${100 / periods.length}%)`'
                                @click='periods[periodIndex + EXTRA_PERIODS] = !periods[periodIndex + EXTRA_PERIODS]'
                            >
                                <div class='small fw-bold text-body-secondary'>
                                    {{ periodData ? "ALARM" : "OK" }}
                                </div>
                            </div>
                        </div>
                        <div class='d-flex justify-content-center gap-4 mt-3 small text-muted pb-3'>
                            <div class='d-flex align-items-center gap-2'>
                                <span
                                    class='d-inline-block rounded border'
                                    style='width: 14px; height: 14px;'
                                /> Outside Evaluation
                            </div>
                            <div class='d-flex align-items-center gap-2'>
                                <span
                                    class='d-inline-block rounded border border-success bg-success-subtle'
                                    style='width: 14px; height: 14px;'
                                /> OK Period
                            </div>
                            <div class='d-flex align-items-center gap-2'>
                                <span
                                    class='d-inline-block rounded border border-danger bg-danger-subtle'
                                    style='width: 14px; height: 14px;'
                                /> Alarming Period
                            </div>
                        </div>
                    </div>

                    <div
                        v-if='!disabled'
                        class='col-12 pt-3 d-flex'
                    >
                        <button
                            class='btn'
                            @click='refresh'
                        >
                            Cancel
                        </button>
                        <div class='ms-auto'>
                            <button
                                class='btn btn-primary'
                                @click='saveLayer'
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { std } from '../../../std.ts';
import {
    TablerInlineAlert,
    TablerRange,
    TablerEnum,
    TablerIconButton,
    TablerRefreshButton,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
} from '@tabler/icons-vue';

const props = defineProps({
    stack: {
        type: Object,
        required: true
    },
    layer: {
        type: Object,
        required: true
    }
});

const emit = defineEmits([
    'stack',
    'refresh'
]);

const route = useRoute();

const disabled = ref(true);
const config = ref(JSON.parse(JSON.stringify(props.layer)));
const loading = ref(false);

async function refresh() {
    config.value = JSON.parse(JSON.stringify(props.layer));
    disabled.value = true;
}

async function saveLayer() {
    loading.value = true;

    try {
        await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}`, {
            method: 'PATCH',
            body: config.value
        });

        disabled.value = true;
        loading.value = false;

        emit('refresh');
        emit('stack');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

// Padd the playground with a few extra periods to make for better viz
const EXTRA_PERIODS = ref(0);
const periods = ref(generatePeriodData());

watch(config, (newVal, oldVal) => {
    if (
        newVal.alarm_period !== oldVal.alarm_period
        || newVal.alarm_evals !== oldVal.alarm_evals
    ) {
        console.error('REGEN');
        periods.value = generatePeriodData();
    }
}, {
    deep: true
});

const alarmState = computed(() => {
    const breachingPeriods = periods.value.slice(EXTRA_PERIODS.value).filter(p => p).length;

    if (breachingPeriods >= config.value.alarm_points) {
        return 'ALARM';
    }

    return 'OK';
});

function generatePeriodData() {
    const data = [];

    EXTRA_PERIODS.value = Math.ceil(config.value.alarm_evals / 2);

    for (let i = 0; i < config.value.alarm_evals + EXTRA_PERIODS.value; i++) {
        data.push(false);
    }

    return data;
}

</script>
