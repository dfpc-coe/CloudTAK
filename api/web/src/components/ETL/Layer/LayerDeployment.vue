<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Deployment
            </h3>
            <div class='ms-auto'>
                <div class='btn-list'>
                    <TablerIconButton
                        title='Redeploy'
                        @click='redeploy'
                    >
                        <IconCloudUpload
                            :size='24'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <TablerIconButton
                        title='Refresh'
                        @click='emit("stack")'
                    >
                        <IconRefresh
                            :size='24'
                            stroke='1'
                        />
                    </TablerIconButton>

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
            <template v-if='loading.full'>
                <TablerLoading />
            </template>
            <template v-else-if='errors.cloudformation'>
                <TablerAlert
                    title='AWS CloudFormation Error'
                    :err='new Error(errors.cloudformation.message)'
                    :compact='true'
                />

                <div class='d-flex justify-content-center my-3'>
                    <div
                        class='btn btn-secondary'
                        @click='refresh'
                    >
                        Refresh
                    </div>
                </div>
            </template>
            <template v-else-if='errors.cloudwatch'>
                <TablerAlert
                    title='AWS CloudWatch Error'
                    :err='new Error(errors.cloudwatch.message)'
                    :compact='true'
                />

                <div class='d-flex justify-content-center my-3'>
                    <div
                        class='btn btn-secondary'
                        @click='refresh'
                    >
                        Refresh
                    </div>
                </div>
            </template>
            <template v-else-if='stack.status === "DOES_NOT_EXIST_COMPLETE"'>
                <div class='d-flex justify-content-center mb-4'>
                    Stack Hasn't Deployed
                </div>
                <div class='d-flex justify-content-center mb-4'>
                    <div
                        class='btn btn-primary'
                        @click='postStack'
                    >
                        Deploy Stack
                    </div>
                </div>
            </template>
            <template v-else>
                <div class='row g-2'>
                    <div class='col-md-12'>
                        <div class='d-flex'>
                            <label class='form-label'>Layer Task</label>
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

                    <div class='col-md-6'>
                        <TablerInput
                            v-model='config.memory'
                            label='Memory (Mb)'
                            :disabled='disabled'
                            type='number'
                            min='1'
                            step='1'
                        />
                    </div>
                    <div class='col-md-6'>
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
                        <TablerEnum
                            v-model='config.priority'
                            label='Alarm Urgency'
                            :disabled='disabled'
                            :options='["off", "high", "low"]'
                        />
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
                    <div v-else>
                        <label class='subheader'>Stack Status</label>
                        <pre v-text='stack.status' />
                        <label class='subheader'>Layer Runtime Logs</label>
                        <pre v-text='logs' />
                    </div>
                </div>
            </template>
        </div>

        <TaskModal
            v-if='taskmodal'
            :task='config.task'
            @close='taskmodal = false'
            @task='taskmodal = false; config.task = $event'
        />
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import TaskModal from './utils/TaskModal.vue';
import { std } from '../../../std.ts';
import {
    TablerAlert,
    TablerEnum,
    TablerIconButton,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconRefresh,
    IconSettings,
    IconCloudUpload,
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
]);

const route = useRoute();

const disabled = ref(true);
const looping = ref(false);
const config = ref(JSON.parse(JSON.stringify(props.layer)));
const newTaskVersion = ref();
const taskmodal = ref(false);
const errors = ref({
    cloudwatch: false
});

const loading = ref({
    full: true,
    small: true,
    version: false
});

const logs = ref({});

onMounted(async () => {
    await fetchLogs();
    looping.value = setInterval(async () => {
        await fetchLogs(false);
    }, 10 * 1000);
});

onUnmounted(() => {
    if (looping.value) {
        clearInterval(looping.value);
    }
});

async function refresh() {
    config.value = JSON.parse(JSON.stringify(props.layer));
    disabled.value = true;

    await fetchLogs();
}

async function redeploy(showLoading=true) {
    if (showLoading) {
        loading.value.full = true;
    } else {
        loading.value.small = true;
    }

    errors.value.cloudformation = false;

    try {
        await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}/redeploy`, {
            method: 'POST'
        });

        emit('stack');
    } catch (err) {
        errors.value.cloudformation = err;
    }

    loading.value.full = false;
    loading.value.small = false;
}

async function fetchLogs(showLoading=true) {
    if (showLoading) {
        loading.value.full = true;
    } else {
        loading.value.small = true;
    }

    errors.value.cloudwatch = false;

    try {
        logs.value = (await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}/task/logs`))
            .logs
            .map((log) => { return log.message })
            .reverse()
            .join('\n');
    } catch (err) {
        errors.value.cloudwatch = err;
    }

    loading.value.full = false;
    loading.value.small = false;
}

async function postStack() {
    loading.value.full = true;
    await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}/task`, {
        method: 'POST'
    });

    emit('stack');

    loading.value.full = false;
}

async function saveLayer() {
    loading.value.full = true;

    try {
        await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}`, {
            method: 'PATCH',
            body: config.value
        });

        disabled.value = true;
        loading.value.full = false;

        emit('refresh');
        emit('stack');
    } catch (err) {
        loading.value.full = false;
        throw err;
    }
}

function updateTask() {
    config.value.task = config.value.task.replace(/-v[0-9]+\.[0-9]+\.[0-9]+$/, `-v${newTaskVersion.value}`);
    newTaskVersion.value = undefined;
}

async function latestVersion() {
    loading.value.version = true;
    const match = config.value.task.match(/^(.*)-v([0-9]+\.[0-9]+\.[0-9]+)$/)
    if (!match) return;
    const task = match[1];
    const version = match[2];

    const list = await std(`/api/task/raw/${task}`);

    if (list.versions.indexOf(version) !== 0) {
        newTaskVersion.value = list.versions[0];
    }

    loading.value.version = false;
}

</script>
