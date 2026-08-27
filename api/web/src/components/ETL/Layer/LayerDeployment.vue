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
                        <LayerTaskSelect
                            v-model='config.task'
                            :disabled='disabled'
                            :updates='true'
                            @update='taskUpdate = $event'
                        />
                        <div
                            v-if='errors.task'
                            class='invalid-feedback d-block'
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

        <LayerTaskUpdateModal
            v-if='taskUpdate'
            :layer='layer'
            :update='taskUpdate'
            @close='taskUpdate = undefined'
            @updated='taskUpdated'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import LayerTaskSelect from '../../util/LayerTaskSelect.vue';
import type { TaskUpdate } from '../../util/LayerTaskSelect.vue';
import LayerTaskUpdateModal from '../../util/LayerTaskUpdateModal.vue';
import { server } from '../../../std.ts';
import type { ETLLayer, ETLLayerTask } from '../../../types.ts';
import {
    TablerAlert,
    TablerIconButton,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconRefresh,
    IconCloudUpload,
} from '@tabler/icons-vue';

const props = defineProps<{
    stack: ETLLayerTask;
    layer: ETLLayer;
}>();

const emit = defineEmits<{
    (e: 'stack'): void;
    (e: 'refresh'): void;
}>();

const route = useRoute();

const disabled = ref(true);
const looping = ref<ReturnType<typeof setInterval> | false>(false);
const config = ref<ETLLayer>(JSON.parse(JSON.stringify(props.layer)));
const taskUpdate = ref<TaskUpdate>();
const errors = ref<Record<string, { message: string } | false>>({
    cloudwatch: false
});

const loading = ref({
    full: true,
    small: true,
    version: false
});

const logs = ref<string>('');

onMounted(async () => {
    looping.value = setInterval(async () => {
        await fetchLogs(false);
    }, 10 * 1000);

    await fetchLogs();
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

async function redeploy(showLoading = true) {
    if (showLoading) {
        loading.value.full = true;
    } else {
        loading.value.small = true;
    }

    errors.value.cloudformation = false;

    try {
        const res = await server.POST('/api/connection/{:connectionid}/layer/{:layerid}/redeploy', {
            params: {
                path: {
                    ':connectionid': Number(route.params.connectionid),
                    ':layerid': Number(route.params.layerid)
                }
            }
        });
        if (res.error) throw new Error(res.error.message);

        emit('stack');
    } catch (err) {
        errors.value.cloudformation = { message: err instanceof Error ? err.message : String(err) };
    }

    loading.value.full = false;
    loading.value.small = false;
}

async function fetchLogs(showLoading = true) {
    if (showLoading) {
        loading.value.full = true;
    } else {
        loading.value.small = true;
    }

    errors.value.cloudwatch = false;

    try {
        const res = await server.GET('/api/connection/{:connectionid}/layer/{:layerid}/task/logs', {
            params: {
                path: {
                    ':connectionid': Number(route.params.connectionid),
                    ':layerid': Number(route.params.layerid)
                }
            }
        });
        if (res.error) throw new Error(res.error.message);
        logs.value = res.data.logs
            .map((log) => { return log.message })
            .reverse()
            .join('\n');
    } catch (err) {
        errors.value.cloudwatch = { message: err instanceof Error ? err.message : String(err) };
    }

    loading.value.full = false;
    loading.value.small = false;
}

async function postStack() {
    loading.value.full = true;
    const res = await server.POST('/api/connection/{:connectionid}/layer/{:layerid}/task', {
        params: {
            path: {
                ':connectionid': Number(route.params.connectionid),
                ':layerid': Number(route.params.layerid)
            }
        }
    });
    if (res.error) throw new Error(res.error.message);

    emit('stack');

    loading.value.full = false;
}

async function saveLayer() {
    loading.value.full = true;

    try {
        const res = await server.PATCH('/api/connection/{:connectionid}/layer/{:layerid}', {
            params: {
                query: { alarms: true },
                path: {
                    ':connectionid': Number(route.params.connectionid),
                    ':layerid': Number(route.params.layerid)
                }
            },
            body: config.value
        });
        if (res.error) throw new Error(res.error.message);

        disabled.value = true;
        loading.value.full = false;

        emit('refresh');
        emit('stack');
    } catch (err) {
        loading.value.full = false;
        throw err;
    }
}

function taskUpdated(layer: ETLLayer) {
    taskUpdate.value = undefined;
    config.value = JSON.parse(JSON.stringify(layer));
    disabled.value = true;

    emit('refresh');
    emit('stack');
}

</script>
