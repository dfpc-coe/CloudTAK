<template>
    <MenuTemplate
        name='Mission Logs'
        :back='false'
        :border='false'
        :loading='loading.logs'
    >
        <div class='col-12 pb-2 px-2'>
            <TablerInput
                v-model='paging.filter'
                icon='search'
                placeholder='Filter'
            />
        </div>

        <TablerNone
            v-if='!filteredLogs.length'
            :create='false'
            label='Logs'
        />
        <div
            v-else
            class='rows px-2'
        >
            <div
                v-for='(log, logidx) in filteredLogs'
                :key='log.id'
                class='col-12 pb-2'
            >
                <TablerLoading
                    v-if='loading.ids.has(logidx)'
                    desc='Deleting Log'
                />
                <template v-else>
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
                        <TablerDelete
                            v-if='role.permissions.includes("MISSION_WRITE")'
                            displaytype='icon'
                            class='position-absolute cursor-pointer end-0 mx-2 my-2'
                            @delete='deleteLog(logidx)'
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
                            class='me-1 badge badge-outline bg-blue-lt'
                            v-text='keyword'
                        />
                    </div>
                </template>
            </div>
        </div>

        <TablerLoading
            v-if='loading.create'
            desc='Creating Log'
            :compact='true'
        />

        <template v-if='role.permissions.includes("MISSION_WRITE")'>
            <div class='mx-2'>
                <TablerInput
                    label='Create Log'
                    v-model='createLog.content'
                    :rows='4'
                    @keyup.enter='submitOnEnter ? submitLog() : undefined'
                >
                    <TablerDropdown>
                        <template #default>
                            <IconSettings :size='24' stroke='1'/>
                        </template>
                       <template #dropdown>
                            <TablerToggle
                                v-model='submitOnEnter'
                                label='Submit on Enter'
                            />
                        </template>
                    </TablerDropdown>
                </TablerInput>

                <TagEntry
                    :tags='createLog.keywords'
                    placeholder='Keyword Entry'
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
import { ref, computed, onMounted } from 'vue'
import type { ComputedRef } from 'vue';
import TagEntry from '../../util/TagEntry.vue';
import type { MissionLog } from '../../../../types.ts';
import {
    TablerInput,
    TablerDelete,
    TablerToggle,
    TablerLoading,
    TablerDropdown,
    TablerNone
} from '@tak-ps/vue-tabler';
import {
    IconSettings
} from '@tabler/icons-vue';
import MenuTemplate from '../../util/MenuTemplate.vue';
import Subscription from '../../../../stores/base/mission.ts';
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

const submitOnEnter = ref(true);
const sub = ref<Subscription | undefined>();
const paging = ref({ filter: '' });

const createLog = ref({
    content: '',
    keywords: []
});
const logs = ref<MissionLog[]>([]);
const loading = ref<{
    logs: boolean,
    create: boolean,
    ids: Set<number>
}> ({
    logs: false,
    create: false,
    ids: new Set()
});

onMounted(async () => {
    sub.value = cotStore.subscriptions.get(props.mission.guid);

    if (!sub.value) {
        await fetchLogs()
    } else {
        logs.value = sub.value.logs;
    }
});

const filteredLogs: ComputedRef<Array<MissionLog>> = computed(() => {
    if (paging.value.filter.trim() === '') {
        return logs.value;
    } else {
        const filter = paging.value.filter.toLowerCase();
        return logs.value.filter((log) => {
            return log.content.toLowerCase().includes(filter);
        })
    }
});

async function fetchLogs() {
    loading.value.logs = true;
    logs.value = (await Subscription.logList(props.mission.guid, props.token)).items;
    loading.value.logs = false;
}

async function deleteLog(logidx: number): Promise<void> {
    if (sub.value) {
        loading.value.ids.add(logidx);
        await Subscription.logDelete(props.mission.guid, props.token, logs.value[logidx].id);
        sub.value.logs.splice(logidx, 1);
        loading.value.ids.delete(logidx);
    } else {
        loading.value.logs = true;
        await Subscription.logDelete(props.mission.guid, props.token, logs.value[logidx].id);
        await fetchLogs();
    }
}

async function submitLog() {
    if (sub.value) {
        loading.value.create = true;
        const log = await Subscription.logCreate(props.mission.guid, props.token, {
            content: createLog.value
        });

        sub.value.logs.push(log);

        loading.value.create = false;
    } else {
        loading.value.logs = true;
        await Subscription.logCreate(props.mission.guid, props.token, {
            content: createLog.value
        });
        await fetchLogs();
    }

    createLog.value.keywords = [];
    createLog.value.content.value = '';
}
</script>
