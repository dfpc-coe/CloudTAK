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
            class='rows px-2'
        >
            <div
                v-for='log in filteredLogs'
                :key='log.id'
                class='col-12 pb-2'
            >
                <TablerLoading
                    v-if='loading.ids.has(log.id)'
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
                            v-text='log.dtg'
                        />
                    </div>
                    <div class='col-12 position-relative'>
                        <CopyField
                            mode='text'
                            :edit='props.subscription.role.permissions.includes("MISSION_WRITE")'
                            :deletable='props.subscription.role.permissions.includes("MISSION_WRITE")'
                            :hover='props.subscription.role.permissions.includes("MISSION_WRITE")'
                            :rows='Math.max(4, log.content.split("\n").length)'
                            :model-value='log.content || ""'
                            style='background-color: var(--tblr-body-bg)'
                            @submit='updateLog(log.id, $event)'
                            @delete='props.subscription.log.delete(log.id)'
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

        <template v-if='props.subscription.role.permissions.includes("MISSION_WRITE")'>
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
    IconSettings
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
    if (paging.value.filter.trim() === '') {
        return logs.value;
    } else {
        const filter = paging.value.filter.toLowerCase();

        return logs.value.filter((log: MissionLog) => {
            return log.content.toLowerCase().includes(filter);
        })
    }
});

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
    try {
        loading.value.logs = true;

        await props.subscription.log.create(
            createLog.value
        );

        createLog.value.content = '';
    } catch (err) {
        loading.value.create = false;
        throw err;
    }
}
</script>
