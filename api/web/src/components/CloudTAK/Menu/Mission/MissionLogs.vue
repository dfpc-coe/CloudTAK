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
            <div
                v-if='logs && logs.length'
                class='col-12 pb-2 px-2'
            >
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <TablerNone
                v-if='!filteredLogs.length'
                :create='false'
                label='No Logs'
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

                    <div class='d-flex justify-content-between align-items-center mb-2 pt-2'>
                        <label class='form-label mb-0'>Create Log</label>
                        <div class='d-flex align-items-center gap-2'>
                            <TablerSelect
                                v-if='templateLogs.length'
                                v-model='selectedLogType'
                                :options='logTypeOptions'
                            />
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
                        </div>
                    </div>

                    <div v-if='!selectedTemplateLog'>
                        <TablerInput
                            v-model='createLog.content'
                            :rows='4'
                            @keyup.enter='submitOnEnter ? submitLog() : undefined'
                        />

                        <TagEntry
                            placeholder='Keyword Entry'
                            :model-value='createLog.keywords'
                            @update:model-value='createLog.keywords = $event'
                        />

                        <div class='d-flex my-2'>
                            <div class='ms-auto'>
                                <TablerButton
                                    :loading='loading.create'
                                    @click='submitLog'
                                >
                                    Save Log
                                </TablerButton>
                            </div>
                        </div>
                    </div>
                    <div v-else>
                        <TablerSchema
                            v-model='createLog.schema'
                            :schema='selectedTemplateLog.schema'
                        />

                        <div class='d-flex my-2'>
                            <div class='ms-auto'>
                                <TablerButton
                                    :loading='loading.create'
                                    @click='submitLog'
                                >
                                    Save Log
                                </TablerButton>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, watch } from 'vue'
import { from } from 'rxjs';
import type { Ref, ComputedRef } from 'vue';
import type { MissionLog } from '../../../../types.ts';
import { std } from '../../../../std.ts';
import TagEntry from '../../util/TagEntry.vue';
import MissionLogItem from './MissionLog.vue';
import MissionTemplateLogs from '../../../../base/mission-template-logs.ts';
import type { DBMissionTemplateLog } from '../../../../base/database.ts';
import {
    TablerNone,
    TablerInput,
    TablerToggle,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
    TablerSelect,
    TablerSchema,
    TablerButton
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
    IconDownload,
} from '@tabler/icons-vue';
import { liveQuery } from "dexie";
import MenuTemplate from '../../util/MenuTemplate.vue';
import Subscription from '../../../../base/subscription.ts';
import { useObservable } from "@vueuse/rxjs";
import { stringify } from 'yaml';

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

const createLog = ref<{
    content: string;
    keywords: string[];
    schema: Record<string, unknown>;
}>({
    content: '',
    keywords: [],
    schema: {}
});

const loading = ref<{
    logs: boolean,
    create: boolean,
}> ({
    logs: false,
    create: false,
});

const templateLogs = ref<DBMissionTemplateLog[]>([]);
const selectedLogType = ref('Default');

const selectedTemplateLog = computed(() => {
    return templateLogs.value.find((l: DBMissionTemplateLog) => {
        return l.name === selectedLogType.value
    });
});

onMounted(async () => {
    await props.subscription?.log.read();

    if (props.subscription.templateid) {
        try {
            const tLogs = new MissionTemplateLogs(props.subscription.templateid);
            templateLogs.value = await tLogs.list({ refresh: true });
        } catch (e) {
            console.error(e);
        }
    }
});

const logTypeOptions = computed<Array<string>>(() => {
    return ['Default', ...templateLogs.value.map(l => l.name)];
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

watch(selectedTemplateLog, (log) => {
    createLog.value.keywords = [];

    if (log && log.keywords && log.keywords.length) {
        for (const keyword of log.keywords) {
            if (!createLog.value.keywords.includes(keyword)) {
                createLog.value.keywords.push(keyword);
            }
        }
    }
});

async function exportLogs(format: string): Promise<void> {
    await std(`/api/marti/missions/${encodeURIComponent(props.subscription.guid)}/log?download=true&format=${format}`, {
        download: true
    })
}

async function submitLog() {
    if (loading.value.create) return;
    if (!selectedTemplateLog.value && !createLog.value.content.trim()) return;

    loading.value.logs = true;
    loading.value.create = true;

    try {
        if (selectedTemplateLog.value) {
            await props.subscription.log.create({
                content: stringify(createLog.value.schema),
                keywords: [...createLog.value.keywords, `template:${selectedTemplateLog.value.id}`]
            });
        } else {
            await props.subscription.log.create(
                createLog.value
            );
        }

        createLog.value.content = '';
        createLog.value.keywords = [];
        createLog.value.schema = {};
    } finally {
        loading.value.create = false;
        loading.value.logs = false;
    }
}
</script>
