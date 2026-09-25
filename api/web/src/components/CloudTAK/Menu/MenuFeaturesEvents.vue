<template>
    <MenuTemplate
        name='Events'
    >
        <template #buttons>
            <TablerIconButton
                title='Create Event'
                @click='createModal = true'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
            <FeaturesTabs />

            <div class='my-2'>
                <SearchSortFilter
                    v-model='filter'
                    v-model:sort='sort'
                    :sort-options='sortOptions'
                    placeholder='Filter Events'
                >
                    <template #sort-icon>
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
                </SearchSortFilter>
            </div>

            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerLoading
                v-else-if='loading'
                desc='Loading Events'
            />
            <TablerNone
                v-else-if='events.length === 0'
                :create='false'
                label='No Events'
            />
            <div
                v-else
                class='d-flex flex-column gap-2 pb-2'
            >
                <StandardCoreEvent
                    v-for='event in events'
                    :key='event.id'
                    :event='event'
                    @click='router.push(`/event/${event.id}`)'
                />
            </div>
        </template>
    </MenuTemplate>

    <CreateCoreEvent
        v-if='createModal'
        @create='fetchList'
        @close='createModal = false'
    />
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { server } from '../../../std.ts';
import type { CoreEvent } from '../../../types.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import SearchSortFilter from '../util/SearchSortFilter.vue';
import StandardCoreEvent from '../util/StandardCoreEvent.vue';
import CreateCoreEvent from '../util/CreateCoreEvent.vue';
import FeaturesTabs from './Features/FeaturesTabs.vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconClock,
    IconLetterCase,
    IconArrowUp,
    IconArrowDown,
} from '@tabler/icons-vue';

const router = useRouter();

const loading = ref(true);
const error = ref<Error | undefined>();
const createModal = ref(false);
const filter = ref('');
const events = ref<Array<CoreEvent>>([]);

const sortOptions = ['Newest → Oldest', 'Oldest → Newest', 'Alphabetical A→Z', 'Alphabetical Z→A'];
const sort = ref('Newest → Oldest');

const sortTypeIcon = computed(() => sort.value.startsWith('Alphabetical') ? IconLetterCase : IconClock);
const sortDirectionIcon = computed(() => (sort.value === 'Oldest → Newest' || sort.value === 'Alphabetical A→Z') ? IconArrowUp : IconArrowDown);

const sortQuery = computed((): { sort: 'created' | 'name'; order: 'asc' | 'desc' } => {
    if (sort.value === 'Oldest → Newest') return { sort: 'created', order: 'asc' };
    if (sort.value === 'Alphabetical A→Z') return { sort: 'name', order: 'asc' };
    if (sort.value === 'Alphabetical Z→A') return { sort: 'name', order: 'desc' };
    return { sort: 'created', order: 'desc' };
});

let debounce: ReturnType<typeof setTimeout> | undefined;
let request = 0;

watch(filter, () => {
    if (debounce) clearTimeout(debounce);
    loading.value = true;
    debounce = setTimeout(() => {
        fetchList();
    }, 250);
});

watch(sort, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

onBeforeUnmount(() => {
    if (debounce) clearTimeout(debounce);
});

async function fetchList(): Promise<void> {
    const current = ++request;

    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/core/event', {
            params: {
                query: {
                    limit: 100,
                    page: 0,
                    filter: filter.value,
                    ...sortQuery.value,
                }
            }
        });

        if (current !== request) return;

        if (res.error) throw new Error(res.error.message);

        events.value = res.data.items as Array<CoreEvent>;
        loading.value = false;
    } catch (err) {
        if (current !== request) return;

        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
