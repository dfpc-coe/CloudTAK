<template>
    <MenuTemplate
        name='Mission Logs'
        :zindex='0'
        :back='false'
        :border='false'
        :loading='!logs'
    >
        <template #buttons>
            <TablerIconButton>
                <IconDownload
                    :size='24'
                    stroke='1'
                    @click='exportLogs("csv")'
                />
            </TablerIconButton>
        </template>
        <template #default>
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
                <MissionLogItem
                    v-for='log in filteredLogs'
                    :key='log.id'
                    :log='log'
                    :subscription='props.subscription'
                />
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
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue'
import { from } from 'rxjs';
import type { Ref, ComputedRef } from 'vue';
import type { MissionLog } from '../../../../types.ts';
import { std } from '../../../../std.ts';
import TagEntry from '../../util/TagEntry.vue';
import MissionLogItem from './MissionLog.vue';
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
    IconDownload,
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
}> ({
    logs: false,
    create: false,
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

async function exportLogs(format: string): Promise<void> {
    await std(`/api/marti/missions/${encodeURIComponent(props.subscription.guid)}/log?download=true&format=${format}`, {
        download: true
    })
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
