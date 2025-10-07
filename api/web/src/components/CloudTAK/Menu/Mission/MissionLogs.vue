<template>
    <MenuTemplate
        name='Mission Logs'
        :zindex='0'
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
                    desc='Updating Log'
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
                            :size='24'
                            class='position-absolute cursor-pointer end-0 mx-2 my-2'
                            @delete='deleteLog(logidx)'
                        />

                        <CopyField
                            mode='text'
                            :edit='role.permissions.includes("MISSION_WRITE")'
                            :deletable='role.permissions.includes("MISSION_WRITE")'
                            :hover='role.permissions.includes("MISSION_WRITE")'
                            :rows='Math.max(4, log.content.split("\n").length)'
                            :model-value='log.content || ""'
                            style='background-color: var(--tblr-body-bg)'
                            @submit='updateLog(logidx, $event)'
                            @delete='deleteLog(logidx)'
                        />
                    </div>

                    <div
                        v-if='log.keywords.length'
                        class='col-12 pt-1'
                    >
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
                    v-model='createLog.content'
                    label='Create Log'
                    :rows='4'
                    @keyup.enter='submitOnEnter ? submitLog() : undefined'
                >
                    <TablerDropdown>
                        <template #default>
                            <TablerIconButton
                                title='Options'
                            >
                                <IconSettings
                                    :size='24'
                                    stroke='1'
                                />
                            </TablerIconButton>
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
                    placeholder='Keyword Entry'
                    @tags='createLog.keywords = $event'
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
import CopyField from '../../util/CopyField.vue';
import {
    TablerNone,
    TablerInput,
    TablerDelete,
    TablerToggle,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconSettings
} from '@tabler/icons-vue';
import MenuTemplate from '../../util/MenuTemplate.vue';
import Subscription from '../../../../base/subscription.ts';
import { useMapStore } from '../../../../stores/map.ts';
const mapStore = useMapStore();

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
    sub.value = await mapStore.worker.db.subscriptionGet(props.mission.guid);

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
    logs.value = (await Subscription.logList(props.mission.guid, {
        missionToken: props.token
    })).items;
    loading.value.logs = false;
}

async function updateLog(logidx: number, content: string) {
    if (sub.value) {
        loading.value.ids.add(logidx);
        const log = await Subscription.logUpdate(
            props.mission.guid,
            logs.value[logidx].id,
            {
                content,
                keywords: logs.value[logidx].keywords
            },{
                missionToken: props.token
            }
        );
        sub.value.logs[logidx] = log;
        loading.value.ids.delete(logidx);
    } else {
        loading.value.logs = true;
        await Subscription.logUpdate(
            props.mission.guid,
            logs.value[logidx].id,
            {
                content,
                keywords: logs.value[logidx].keywords
            },{
                missionToken: props.token
            }
        );
        await fetchLogs();
    }
}

async function deleteLog(logidx: number): Promise<void> {
    if (sub.value) {
        loading.value.ids.add(logidx);
        await Subscription.logDelete(props.mission.guid, logs.value[logidx].id, {
            missionToken: props.token
        });
        sub.value.logs.splice(logidx, 1);
        loading.value.ids.delete(logidx);
    } else {
        loading.value.logs = true;
        await Subscription.logDelete(props.mission.guid, logs.value[logidx].id, {
            missionToken: props.token
        });
        await fetchLogs();
    }
}

async function submitLog() {
    try {
        if (sub.value) {
            loading.value.create = true;
            const log = await Subscription.logCreate(props.mission.guid, createLog.value, {
                missionToken: props.token
            })

            sub.value.logs.push(log);

            loading.value.create = false;
        } else {
            loading.value.logs = true;
            await Subscription.logCreate(props.mission.guid, createLog.value, {
                missionToken: props.token
            })
            await fetchLogs();
        }

        createLog.value.content = '';
    } catch (err) {
        loading.value.create = false;

        throw err;
    }
}
</script>
