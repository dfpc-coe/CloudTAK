<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Config
            </h3>
            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='disabled && cronEnabled'
                    title='Manual Run'
                    @click='invoke'
                >
                    <IconPlayerPlay
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    v-if='disabled'
                    title='Edit Layer Config'
                    @click='disabled = false'
                >
                    <IconPencil
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
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
                <div
                    v-if='props.capabilities ? props.capabilities.incoming.invocation.includes("schedule") : true'
                    class='col-md-12'
                >
                    <div class='d-flex align-items-center'>
                        <IconCalendarClock
                            :size='20'
                            stroke='1'
                        />
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
                        <ScheduleInput
                            v-model='incoming.cron'
                            :disabled='disabled'
                        />
                    </div>
                </div>
                <div
                    v-if='props.capabilities ? props.capabilities.incoming.invocation.includes("webhook") : true'
                    class='col-md-12'
                >
                    <div class='d-flex align-items-center'>
                        <IconWebhook
                            :size='20'
                            stroke='1'
                        />
                        <div style='width: calc(100% - 20px);'>
                            <TablerToggle
                                v-model='incoming.webhooks'
                                :disabled='disabled'
                                label='Webhooks Delivery'
                            />
                        </div>
                    </div>

                    <div
                        v-if='incoming.webhooks'
                        class='col-12 border rounded px-2 py-2'
                    >
                        <label>Webhook URL</label>
                        <CopyField
                            :model-value='webhookUrl'
                        />
                    </div>
                </div>
                <div class='col-md-12'>
                    <div class='row'>
                        <div class='col-12'>
                            <label>Data Destination</label>
                        </div>
                        <div class='col-12 d-flex align-items-center my-1'>
                            <IconDatabase
                                :size='32'
                                stroke='1'
                            />
                            <DataSelect
                                v-model='incoming.data'
                                :disabled='disabled'
                                :connection='layer.connection'
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
                            @click='saveIncoming'
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { server } from '../../../std.ts';
import type { ETLLayerIncoming } from '../../../types.ts';
import { validateSchedule } from '../../../utils/schedule.ts';
import DataSelect from '../../util/DataSelect.vue';
import ScheduleInput from '../../util/ScheduleInput.vue';
import CopyField from '../../CloudTAK/util/CopyField.vue';
import {
    TablerIconButton,
    TablerToggle,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconCalendarClock,
    IconPlayerPlay,
    IconWebhook,
    IconPencil,
    IconDatabase,
} from '@tabler/icons-vue'

const props = defineProps({
    layer: {
        type: Object,
        required: true
    },
    capabilities: {
        type: Object,
        required: true
    }
})

const route = useRoute();
const emit = defineEmits([
    'refresh',
    'stack'
]);

const disabled = ref(true);
const cronEnabled = ref(true);

const loading = ref({
    init: true,
    version: false,
    save: false
});

const incoming = ref<ETLLayerIncoming>(props.layer.incoming);

const webhookBase = ref<string | undefined>();

const webhookUrl = computed(() => {
    // Until the base resolves, fall back to the Layer UUID so the field is never empty
    if (!webhookBase.value) return props.layer.uuid;
    return `${webhookBase.value.replace(/\/$/, '')}/${props.layer.uuid}`;
});

watch(cronEnabled, () => {
    if (cronEnabled.value && !incoming.value.cron) {
        incoming.value.cron = 'rate(5 minutes)';
    } else if (!cronEnabled.value) {
        incoming.value.cron = null;
    }
});

onMounted(async () => {
    reload();
    loading.value.init = false;

    const { data, error } = await server.GET('/api/config/webhooks');
    if (error) throw new Error(String(error));
    webhookBase.value = data.url;
})

function reload() {
    incoming.value = props.layer.incoming;
    cronEnabled.value = !!incoming.value.cron
    disabled.value = true;
}

async function invoke() {
    loading.value.init = true;
    try {
        await server.POST('/api/connection/{:connectionid}/layer/{:layerid}/task/invoke', {
            params: {
                path: {
                    ':connectionid': Number(route.params.connectionid),
                    ':layerid': Number(String(route.params.layerid))
                }
            }
        });

        loading.value.init = false;
    } catch (err) {
        loading.value.init = false;
        throw err;
    }
}


async function saveIncoming() {
    if (!cronEnabled.value) {
        incoming.value.cron = null;
    } else if (validateSchedule(incoming.value.cron)) {
        // The ScheduleInput displays the validation error inline
        return;
    }

    loading.value.save = true;

    try {

        const res = await server.PATCH(`/api/connection/{:connectionid}/layer/{:layerid}/incoming`, {
            params: {
                path: {
                    ':connectionid': Number(route.params.connectionid),
                    ':layerid': Number(String(route.params.layerid))
                }
            },
            body: incoming.value
        });

        if (res.error) throw new Error(res.error.message);

        disabled.value = true;
        loading.value.save = false;

        emit('refresh');
        emit('stack');
    } catch (err) {
        loading.value.save = false;
        throw err;
    }
}
</script>
