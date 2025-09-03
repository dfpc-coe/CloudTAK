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
                        <TablerInput
                            v-model='incoming.cron'
                            label='Cron Expression'
                            :disabled='disabled'
                            placeholder='Cron Expression'
                        >
                            <TablerDropdown v-if='!disabled'>
                                <template #default>
                                    <TablerIconButton
                                        title='Samples'
                                    >
                                        <IconSettings
                                            :size='16'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                </template>
                                <template #dropdown>
                                    <ul
                                        class='px-1 py-1'
                                    >
                                        <li
                                            class='py-1 px-1 cursor-pointer hover'
                                            @click='incoming.cron = "rate(1 minute)"'
                                        >
                                            rate(1 minute)
                                        </li>
                                        <li
                                            class='py-1 px-1 cursor-pointer hover'
                                            @click='incoming.cron = "rate(5 minutes)"'
                                        >
                                            rate(5 minutes)
                                        </li>
                                        <li
                                            class='py-1 px-1 cursor-pointer hover'
                                            @click='incoming.cron = "cron(15 10 * * ? *)"'
                                        >
                                            cron(15 10 * * ? *)
                                        </li>
                                        <li
                                            class='py-1 px-1 cursor-pointer hover'
                                            @click='incoming.cron = "cron(0/5 8-17 ? * MON-FRI *)"'
                                        >
                                            cron(0/5 8-17 ? * MON-FRI *)
                                        </li>
                                    </ul>
                                </template>
                            </TablerDropdown>
                        </TablerInput>
                        <label
                            v-if='incoming.cron'
                            v-text='cronstr(incoming.cron)'
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
                            :model-value='props.layer.uuid'
                        />
                    </div>
                </div>
                <div class='col-md-12'>
                    <TablerInput
                        v-model='incoming.stale'
                        label='Stale Value (seconds)'
                        :disabled='disabled'
                        type='number'
                        min='1'
                        step='1'
                    />
                    <label
                        v-if='incoming.stale'
                        v-text='humanSeconds(incoming.stale)'
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
import { ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { std, humanSeconds } from '../../../std.ts';
import type { ETLLayerIncoming } from '../../../types.ts';
import cronstrue from 'cronstrue';
import DataSelect from '../../util/DataSelect.vue';
import CopyField from '../../CloudTAK/util/CopyField.vue';
import {
    TablerIconButton,
    TablerDropdown,
    TablerInput,
    TablerToggle,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconCalendarClock,
    IconPlayerPlay,
    IconWebhook,
    IconPencil,
    IconSettings,
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

watch(incoming, () => {
    if (cronEnabled.value) {
        incoming.value.cron = '0/15 * * * ? *';
    } else {
        incoming.value.cron = null;
    }
});

onMounted(() => {
    reload();
    loading.value.init = false;
})

function reload() {
    incoming.value = props.layer.incoming;
    cronEnabled.value = !!incoming.value.cron
    disabled.value = true;
}

async function invoke() {
    loading.value.init = true;
    try {
        await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}/task/invoke`, {
            method: 'POST'
        });

        loading.value.init = false;
    } catch (err) {
        loading.value.init = false;
        throw err;
    }
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

async function saveIncoming() {
    loading.value.save = true;

    try {
        if (!cronEnabled.value) {
            incoming.value.cron = null;
        }

        await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}/incoming`, {
            method: 'PATCH',
            body: incoming.value
        });

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
