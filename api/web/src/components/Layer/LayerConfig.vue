<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Config
            </h3>
            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='disabled'
                    title='Edit Layer Config'
                    @click='disabled = false'
                ><IconPencil :size='32' stroke='1'/></TablerIconButton>
            </div>
        </div>

        <TablerLoading
            v-if='loading.save'
            desc='Saving Config'
        />
        <TablerLoading
            v-else-if='loading.init'
            desc='Loading Config'
        />
        <div
            v-else
            class='card-body'
        >
            <div class='row g-2'>
                <div class='col-md-12'>
                    <div class='d-flex'>
                        <label class='form-label'>Schedule Task</label>
                        <div class='ms-auto'>
                            <div class='btn-list'>
                                <div>
                                    <IconRefresh
                                        v-if='!newTaskVersion && !loading.version'
                                        v-tooltip='"Check for new version"'
                                        :size='16'
                                        stroke='1'
                                        class='cursor-pointer'
                                        @click='latestVersion'
                                    />
                                    <div
                                        v-else-if='loading.version'
                                        class='d-flex justify-content-center'
                                    >
                                        <div
                                            class='spinner-border'
                                            role='status'
                                        />
                                    </div>
                                    <span v-else>
                                        New Task Version
                                        <span
                                            v-if='disabled'
                                            v-text='newTaskVersion'
                                        />
                                        <span
                                            v-else
                                            class='cursor-pointer text-blue'
                                            @click='updateTask'
                                            v-text='newTaskVersion'
                                        />
                                    </span>
                                </div>
                                <div v-if='!disabled'>
                                    <IconSettings
                                        :size='16'
                                        stroke='1'
                                        class='cursor-pointer'
                                        @click='taskmodal = true'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <input
                        v-model='config.task'
                        :disabled='disabled'
                        :class='{
                            "is-invalid": errors.task
                        }'
                        class='form-control'
                        placeholder='Schedule Task'
                    >
                    <div
                        v-if='errors.task'
                        class='invalid-feedback'
                        v-text='errors.task'
                    />
                </div>

                <div class='col-md-12'>
                    <div class='d-flex'>
                        <IconCalendarClock :size='20' stroke='1'/>
                        <div style='width: calc(100% - 20px);'>
                            <TablerToggle
                                v-model='cronEnabled'
                                :disabled='disabled'
                                label='Scheduled Runs'
                            />
                        </div>
                    </div>

                    <div
                        v-if='cronEnabled'
                        class='col-12 border rounded px-2 py-2'
                    >
                        <div class='d-flex'>
                            <label>Cron Expression</label>
                            <div
                                v-if='!disabled'
                                class='ms-auto'
                            >
                                <div class='dropdown'>
                                    <div
                                        id='dropdownCron'
                                        class='dropdown-toggle'
                                        type='button'
                                        data-bs-toggle='dropdown'
                                        aria-expanded='false'
                                    >
                                        <IconSettings
                                            :size='16'
                                            stroke='1'
                                            class='cursor-pointer dropdown-toggle'
                                        />
                                    </div>
                                    <ul
                                        class='dropdown-menu px-1 py-1'
                                        aria-labelledby='dropdownCron'
                                    >
                                        <li
                                            class='py-1'
                                            @click='config.cron = "rate(1 minute)"'
                                        >
                                            rate(1 minute)
                                        </li>
                                        <li
                                            class='py-1'
                                            @click='config.cron = "rate(5 minutes)"'
                                        >
                                            rate(5 minutes)
                                        </li>
                                        <li
                                            class='py-1'
                                            @click='config.cron = "cron(15 10 * * ? *)"'
                                        >
                                            cron(15 10 * * ? *)
                                        </li>
                                        <li
                                            class='py-1'
                                            @click='config.cron = "cron(0/5 8-17 ? * MON-FRI *)"'
                                        >
                                            cron(0/5 8-17 ? * MON-FRI *)
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <input
                            v-model='config.cron'
                            :disabled='disabled'
                            :class='{
                                "is-invalid": errors.cron
                            }'
                            class='form-control'
                            placeholder='Cron Expression'
                        >
                        <div
                            v-if='errors.cron'
                            class='invalid-feedback'
                            v-text='errors.cron'
                        />
                        <label
                            v-if='config.cron'
                            v-text='cronstr(config.cron)'
                        />
                    </div>
                </div>
                <div class='col-md-12'>
                    <div class='d-flex'>
                        <IconWebhook :size='20' stroke='1'/>
                        <div style='width: calc(100% - 20px);'>
                            <TablerToggle
                                v-model='config.webhooks'
                                :disabled='disabled'
                                label='Webhooks Delivery'
                            />
                        </div>
                    </div>

                    <div
                        v-if='config.webhooks'
                        class='col-12 border rounded px-2 py-2'
                    >
                        <label>Webhook URL</label>
                        <CopyField
                            v-model='config.uuid'
                        />
                    </div>
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='config.stale'
                        label='Stale Value (seconds)'
                        :disabled='disabled'
                        type='number'
                        min='1'
                        step='1'
                    />
                    <label
                        v-if='config.stale'
                        v-text='humanSeconds(config.stale)'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='config.memory'
                        label='Memory (Mb)'
                        :disabled='disabled'
                        type='number'
                        min='1'
                        step='1'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='config.timeout'
                        label='Timeout (s)'
                        :disabled='disabled'
                        type='number'
                        min='1'
                        step='1'
                    />
                </div>
                <div class='col-md-12'>
                    <div class='row'>
                        <div class='col-12'>
                            <label>Optional Data Sync</label>
                        </div>
                        <div class='col-12 d-flex align-items-center my-1'>
                            <IconDatabase
                                :size='32'
                                stroke='1'
                            />
                            <DataSelect
                                v-model='config.data'
                                :disabled='disabled'
                                :connection='layer.connection'
                            />
                        </div>
                    </div>
                </div>

                <div class='col-md-12'>
                    <TablerEnum
                        v-model='config.priority'
                        label='Alarm Urgency'
                        :disabled='disabled'
                        class='w-100'
                        :options='["off", "high", "low"]'
                    />
                </div>

                <label
                    v-if='config.priority !== "off"'
                    class='subheader mt-3 cursor-pointer'
                >
                    <TablerIconButton
                        v-if='!advanced'
                        title='Open Advanced Settings'
                        @click='advanced = true'
                    ><IconSquareChevronRight :size='32' stroke='1' /></TablerIconButton>
                    <TablerIconButton
                        v-else
                        title='Close Advanced Settings'
                        @click='advanced = false'
                    ><IconChevronDown :size='32' stroke='1'/></TablerIconButton>
                    Advanced Alarm Options
                </label>

                <div
                    v-if='advanced && config.priority !== "off"'
                    class='border rounded col-12 mt-0'
                >
                    <div class='row py-2'>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='config.alarm_period'
                                label='Alarm Period (s)'
                                :disabled='disabled'
                                class='w-100'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='config.alarm_evals'
                                label='Alarm Evals'
                                :disabled='disabled'
                                class='w-100'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='config.alarm_points'
                                label='Alarm Points to Alarm'
                                :disabled='disabled'
                                class='w-100'
                            />
                        </div>
                        <div class='col-md-3'>
                            <TablerInput
                                v-model='config.alarm_threshold'
                                label='Alarm Threshold'
                                :disabled='disabled'
                                class='w-100'
                            />
                        </div>
                    </div>
                </div>

                <div
                    v-if='!disabled'
                    class='col-12 pt-3 d-flex'
                >
                    <button
                        class='btn'
                        @click='reload'
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
        </div>

        <TaskModal
            v-if='taskmodal'
            :task='config.task'
            @close='taskmodal = false'
            @task='taskmodal = false; config.task = $event'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { std, humanSeconds } from '../../../src/std.ts';
import type { ETLTaskVersions } from '../../../src/types.ts';
import DataSelect from '../util/DataSelect.vue';
import cronstrue from 'cronstrue';
import TaskModal from './utils/TaskModal.vue';
import CopyField from '../CloudTAK/util/CopyField.vue';
import {
    TablerIconButton,
    TablerInput,
    TablerToggle,
    TablerEnum,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconSquareChevronRight,
    IconCalendarClock,
    IconChevronDown,
    IconWebhook,
    IconRefresh,
    IconPencil,
    IconSettings,
    IconDatabase,
} from '@tabler/icons-vue'

const props = defineProps({
    layer: {
        type: Object,
        required: true
    },
    errors: {
        type: Object,
        default: function () {
            return {}
        }
    }
})

const route = useRoute();
const emit = defineEmits([
    'layer',
    'stack'
]);

const disabled = ref(true);
const cronEnabled = ref(true);
const taskmodal = ref(false);
const newTaskVersion = ref<string | undefined>();
const advanced = ref(false);
const loading = ref({
    init: true,
    version: false,
    save: false
});

const config = ref({
    uuid: '',
    connection: null,
    webhooks: false,
    priority: 'off',
    data: null,
    task: '',
    timeout: 60,
    memory: 512,
    cron: '0/15 * * * ? *',
    stale: 60 * 1000,
    alarm_period: '30',
    alarm_evals: '5',
    alarm_points: '4',
    alarm_threshold: '0'
});

onMounted(() => {
    reload();
    loading.value.init = false;
})

function reload() {
    config.value.webhooks = props.layer.webhooks;
    config.value.connection = props.layer.connection;
    config.value.data = props.layer.data;
    config.value.task = props.layer.task;
    config.value.timeout = props.layer.timeout;
    config.value.memory = props.layer.memory;
    config.value.cron = props.layer.cron;
    config.value.stale = props.layer.stale;
    config.value.priority = props.layer.priority;
    config.value.alarm_period = props.layer.alarm_period;
    config.value.alarm_evals = props.layer.alarm_evals;
    config.value.alarm_points = props.layer.alarm_points;
    config.value.alarm_threshold = props.layer.alarm_threshold;
    config.value.uuid = props.layer.uuid;

    disabled.value = true;
}

async function saveLayer() {
    loading.value.save = true;

    const layer = await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}`, {
        method: 'PATCH',
        body: config.value
    });

    disabled.value = true;
    loading.value.save = false;

    emit('layer', layer);
    emit('stack');
}

function updateTask() {
    config.value.task = config.value.task.replace(/-v[0-9]+\.[0-9]+\.[0-9]+$/, `-v${newTaskVersion.value}`);
    newTaskVersion.value = undefined;
}

function cronstr(cron?: string) {
    if (!cron) return;

    if (cron.includes('cron(')) {
        return cronstrue.toString(cron.replace('cron(', '').replace(')', ''));
    } else {
        const rate = cron.replace('rate(', '').replace(')', '');
        return `Once every ${rate}`;
    }
}

async function latestVersion() {
    loading.value.version = true;
    const match = config.value.task.match(/^(.*)-v([0-9]+\.[0-9]+\.[0-9]+)$/)
    if (!match) return;
    const task = match[1];
    const version = match[2];

    const list = await std(`/api/task/raw/${task}`) as ETLTaskVersions;

    if (list.versions.indexOf(version) !== 0) {
        newTaskVersion.value = list.versions[0];
    }

    loading.value.version = false;
}
</script>
