<template>
    <MenuTemplate
        name='Mission Logs'
        :zindex='0'
        :back='false'
        :border='false'
        :loading='!logs'
        :standalone='false'
    >
        <template #buttons>
            <TablerIconButton title='Download Logs'>
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
                <SearchSortFilter
                    v-model='paging.filter'
                    v-model:sort='sort'
                    :sort-options='sortOptions'
                    :active-filters='selectedKeywords.length'
                    placeholder='Filter'
                >
                    <template #sort-icon>
                        <template v-if='sort'>
                            <component
                                :is='sortTypeIcon'
                                :size='20'
                                stroke='1'
                            />
                            <component
                                :is='sortDirectionIcon'
                                :size='20'
                                stroke='1'
                            />
                        </template>
                        <IconArrowsSort
                            v-else
                            :size='20'
                            stroke='1'
                        />
                    </template>
                    <template #filters>
                        <div class='d-flex flex-column'>
                            <div class='d-flex align-items-center justify-content-between px-3 py-2'>
                                <strong class='small text-uppercase text-white-50'>Filters</strong>
                                <button
                                    v-if='selectedKeywords.length'
                                    type='button'
                                    class='btn btn-link btn-sm p-0'
                                    @click='selectedKeywords = []'
                                >
                                    Clear
                                </button>
                            </div>
                            <div class='px-3 pb-2 d-flex flex-column gap-2'>
                                <div>
                                    <div class='small text-uppercase text-white-50 mb-1'>
                                        Keywords
                                    </div>
                                    <div
                                        v-if='!availableKeywords.length'
                                        class='small text-secondary'
                                    >
                                        No keywords available
                                    </div>
                                    <label
                                        v-for='keyword in availableKeywords'
                                        :key='keyword'
                                        class='form-check mb-1'
                                    >
                                        <input
                                            class='form-check-input'
                                            type='checkbox'
                                            :checked='selectedKeywords.includes(keyword)'
                                            @change='toggleKeyword(keyword)'
                                        >
                                        <span
                                            class='form-check-label'
                                            v-text='keyword'
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </template>
                </SearchSortFilter>
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
                    :relevant='availableKeywords'
                />
            </div>
            <template v-if='props.subscription.role.permissions.includes("MISSION_WRITE")'>
                <div
                    class='px-2 position-relative'
                    :aria-busy='loading.create'
                >
                    <div
                        v-if='loading.create'
                        class='position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center cloudtak-bg bg-opacity-75 rounded-4 z-3'
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
                                        @click.stop
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

                        <Keywords
                            v-model:keywords='createLog.keywords'
                            :relevant='availableKeywords'
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
import Keywords from '../../util/Keywords.vue';
import MissionLogItem from './MissionLog.vue';
import SearchSortFilter from '../../util/SearchSortFilter.vue';
import MissionTemplateLogs from '../../../../base/mission-template-logs.ts';
import type { DBMissionTemplateLog, DBSubscriptionLog } from '../../../../database.ts';
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
    IconLetterCase,
    IconClock,
    IconArrowUp,
    IconArrowDown,
    IconArrowsSort,
} from '@tabler/icons-vue';
import { liveQuery } from "dexie";
import MenuTemplate from '../../util/MenuTemplate.vue';
import Subscription from '../../../../base/subscription.ts';
import { useObservable } from "@vueuse/rxjs";
import { stringify } from 'yaml';

const props = defineProps<{
    subscription: Subscription
}>();

const logs: Ref<Array<DBSubscriptionLog>> = useObservable(
    from(liveQuery(async () => {
        return await props.subscription.log.list()
    }))
)

const submitOnEnter = ref(true);
const paging = ref({ filter: '' });
const sort = ref('');
const sortOptions = ['Newest \u2192 Oldest', 'Oldest \u2192 Newest', 'A \u2192 Z', 'Z \u2192 A'];
const selectedKeywords = ref<string[]>([]);
const sortTypeIcon = computed(() => (sort.value === 'A → Z' || sort.value === 'Z → A') ? IconLetterCase : IconClock);
const sortDirectionIcon = computed(() => (sort.value === 'Oldest → Newest' || sort.value === 'A → Z') ? IconArrowUp : IconArrowDown);
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

const availableKeywords = computed<string[]>(() => {
    const set = new Set<string>();
    for (const log of (logs.value || [])) {
        for (const k of (log.keywords || [])) {
            if (!k.startsWith('template:')) set.add(k);
        }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
});

function toggleKeyword(keyword: string): void {
    const idx = selectedKeywords.value.indexOf(keyword);
    if (idx === -1) selectedKeywords.value.push(keyword);
    else selectedKeywords.value.splice(idx, 1);
}

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

const filteredLogs: ComputedRef<Array<DBSubscriptionLog>> = computed(() => {
    const allLogs = logs.value || [];
    const filter = paging.value.filter.toLowerCase().trim();

    let result = allLogs.filter((log: DBSubscriptionLog) => {
        if (filter && !log.content.toLowerCase().includes(filter)) return false;

        if (selectedKeywords.value.length) {
            const logKeywords = log.keywords || [];
            if (!selectedKeywords.value.some((k) => logKeywords.includes(k))) return false;
        }

        return true;
    });

    result = [...result].sort((a, b) => {
        if (sort.value === 'Newest \u2192 Oldest') {
            return new Date(b.dtg ?? 0).getTime() - new Date(a.dtg ?? 0).getTime();
        } else if (sort.value === 'Oldest → Newest') {
            return new Date(a.dtg ?? 0).getTime() - new Date(b.dtg ?? 0).getTime();
        } else if (sort.value === 'A \u2192 Z') {
            return a.content.localeCompare(b.content);
        } else if (sort.value === 'Z \u2192 A') {
            return b.content.localeCompare(a.content);
        }
        return 0;
    });

    return result;
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
    await props.subscription.log.download(format);
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
