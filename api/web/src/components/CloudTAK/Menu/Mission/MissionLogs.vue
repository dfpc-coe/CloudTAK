<template>
    <MenuTemplate
        name='Mission Logs'
        :back='false'
        :border='false'
        :loading='loading.logs'
    >
        <TablerNone
            v-if='!logs.length'
            :create='false'
            :compact='true'
            label='Logs'
        />
        <div
            v-else
            class='rows px-2'
        >
            <div
                v-for='(log, logidx) in logs'
                :key='log.id'
                class='col-12 pb-2'
            >
                <div class='d-flex'>
                    <label
                        class='subheader'
                        v-text='log.creatorUid'
                    />
                    <label
                        class='subheader ms-auto'
                        v-text='log.created'
                    />
                </div>
                <div class='col-12 position-relative'>
                    <IconTrash
                        v-if='role.permissions.includes("MISSION_WRITE")'
                        :size='32'
                        stroke='1'
                        class='position-absolute cursor-pointer end-0 mx-2 my-2'
                        @click='deleteLog(logidx)'
                    />
                    <pre
                        class='rounded mb-1'
                        v-text='log.content || "None"'
                    />
                </div>

                <div class='col-12'>
                    <span
                        v-for='keyword in log.keywords'
                        :key='keyword'
                        v-text='keyword'
                        class='me-1 badge badge-outline bg-blue-lt'
                    />
                </div>
            </div>
        </div>

        <template v-if='role.permissions.includes("MISSION_WRITE")'>
            <div class='mx-2'>
                <TablerInput
                    v-model='createLog'
                    label='Create Log'
                    :rows='4'
                />

                <div class='d-flex my-2'>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='submitLog'
                        >
                            Save Log
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, defineProps, onMounted } from 'vue'
import { std } from '../../../../../src/std.ts';
import type { MissionLog } from '../../../../types.ts';
import {
    IconTrash,
} from '@tabler/icons-vue';
import {
    TablerInput,
    TablerNone
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import { useCOTStore } from '../../../../stores/cots.ts';
const cotStore = useCOTStore();

const props = defineProps({
    mission: {
        type: Object,
        required: true
    },
    token: String,
    role: {
        type: Object,
        required: true
    }
})

const createLog = ref('');
const logs = ref<MissionLog[]>([]);
const loading = ref({ logs: false });

onMounted(async () => {
    const sub = cotStore.subscriptions.get(props.mission.guid);

    if (!sub) {
        await fetchLogs()
    } else {
        logs.value = sub.logs;
    }
});

function headers(): Record<string, string> {
    if (props.token) {
        return {
            MissionAuthorization: props.token
        }
    } else {
        return {};
    }
}

async function fetchLogs() {
    loading.value.logs = true;
    const list = await std(`/api/marti/missions/${props.mission.guid}/log`, {
        method: 'GET',
        headers: headers()
    }) as { items: Array<MissionLog> };

    logs.value = list.items;

    loading.value.logs = false;
}

async function deleteLog(logidx: number): Promise<void> {
    loading.value.logs = true;
    await std(`/api/marti/missions/${props.mission.guid}/log/${logs.value[logidx].id}`, {
        method: 'DELETE',
        headers: headers()
    });

    await fetchLogs();
}

async function submitLog() {
    loading.value.logs = true;

    await std(`/api/marti/missions/${props.mission.guid}/log`, {
        method: 'POST',
        headers: headers(),
        body: {
            content: createLog.value
        }
    });

    createLog.value = '';

    await fetchLogs();
}
</script>
