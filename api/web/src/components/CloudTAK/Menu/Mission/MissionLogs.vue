<template>
    <MenuTemplate
        name='Mission Logs'
        :zindex='0'
        :back='false'
        :border='false'
        :loading='!logs'
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
            class='rows px-2 d-flex flex-column gap-3'
        >
            <div
                v-for='log in filteredLogs'
                :key='log.id'
                class='col-12'
            >
                <TablerLoading
                    v-if='loading.ids.has(log.id)'
                    desc='Updating Log'
                />
                <template v-else>
                    <div
                        class='card bg-dark bg-opacity-50 border border-white border-opacity-25 rounded text-white w-100 p-2 d-flex gap-3 align-items-start flex-row shadow-sm'
                        role='menuitem'
                        tabindex='0'
                    >
                        <div class='d-flex flex-column w-100'>
                            <div class='d-flex align-items-center flex-wrap w-100 gap-2'>
                                <div class='fw-semibold'>
                                    {{ log.creatorUid || 'Unknown Author' }}
                                </div>
                                <span class='ms-auto text-white-50 small text-nowrap'>{{ formatDtg(log.dtg) }}</span>
                            </div>
                            <CopyField
                                class='w-100'
                                mode='text'
                                :edit='props.subscription.role.permissions.includes("MISSION_WRITE")'
                                :deletable='props.subscription.role.permissions.includes("MISSION_WRITE")'
                                :hover='props.subscription.role.permissions.includes("MISSION_WRITE")'
                                :rows='Math.max(4, log.content.split("\n").length)'
                                :model-value='log.content || ""'
                                @submit='updateLog(log.id, $event)'
                                @delete='props.subscription.log.delete(log.id)'
                            />

                            <div
                                v-if='log.keywords.length'
                                class='d-flex flex-wrap gap-2'
                            >
                                <span
                                    v-for='keyword in log.keywords'
                                    :key='keyword'
                                    class='badge text-bg-primary text-uppercase rounded-pill px-3 py-1 small'
                                    v-text='keyword'
                                />
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>
        <template v-if='props.subscription.role.permissions.includes("MISSION_WRITE")'>
            <div
                class='px-2 position-relative'
                :aria-busy='loading.create'
            >
                <div
                    v-if='loading.create'
                    class='position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75 rounded-4 z-3'
                >
                    <TablerLoading
                        desc='Creating Log'
                        :compact='true'
                    />
                </div>
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
                            :disabled='loading.create'
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
import { ref, computed } from 'vue'
import { from } from 'rxjs';
import type { Ref, ComputedRef } from 'vue';
import type { MissionLog } from '../../../../types.ts';
import TagEntry from '../../util/TagEntry.vue';
import CopyField from '../../util/CopyField.vue';
import {
    TablerNone,
    TablerInput,
    TablerToggle,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
} from '@tabler/icons-vue';
import { liveQuery } from "dexie";
import MenuTemplate from '../../util/MenuTemplate.vue';
import Subscription from '../../../../base/subscription.ts';
import { useObservable } from "@vueuse/rxjs";

const props = defineProps<{
    subscription: Subscription
}>();

const logs: Ref<Array<MissionLog>> = useObservable(
    from(liveQuery(async () => {
        return await props.subscription.log.list()
    }))
)

const submitOnEnter = ref(true);
const paging = ref({ filter: '' });

const createLog = ref({
    content: '',
    keywords: []
});

const loading = ref<{
    logs: boolean,
    create: boolean,
    ids: Set<string>
}> ({
    logs: false,
    create: false,
    ids: new Set()
});

const filteredLogs: ComputedRef<Array<MissionLog>> = computed(() => {
    const allLogs = logs.value || [];

    if (paging.value.filter.trim() === '') {
        return allLogs;
    } else {
        const filter = paging.value.filter.toLowerCase();

        return allLogs.filter((log: MissionLog) => {
            return log.content.toLowerCase().includes(filter);
        })
    }
});

function formatDtg(dtg?: string) {
    if (!dtg) return 'No DTG';

    const parsed = new Date(dtg);

    if (Number.isNaN(parsed.getTime())) {
        return dtg;
    }

    return parsed.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

async function updateLog(logid: string, content: string) {
    loading.value.ids.add(logid);

    await props.subscription.log.update(
        logid,
        {
            content,
            dtg: logs.value.find(l => l.id === logid)?.dtg || new Date().toISOString(),
            keywords: logs.value.find(l => l.id === logid)?.keywords || []
        }
    );

    loading.value.ids.delete(logid);
}

async function submitLog() {
    if (loading.value.create || !createLog.value.content.trim()) return;

    loading.value.logs = true;
    loading.value.create = true;

    try {
        await props.subscription.log.create(
            createLog.value
        );

        createLog.value.content = '';
        createLog.value.keywords = [];
    } finally {
        loading.value.create = false;
        loading.value.logs = false;
    }
}
</script>
