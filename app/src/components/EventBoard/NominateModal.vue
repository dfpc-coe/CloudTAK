<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-blue' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-body'>
            <div class='modal-title'>
                Nominate Event
            </div>
        </div>
        <div class='modal-body text-body'>
            <TablerInlineAlert
                severity='info'
                title='Channel Scoped'
                :description='`Only Events shared with the ${channelName || "selected"} channel are shown.`'
                class='mb-2'
            />

            <!-- The filter stays mounted through an error so the user can
                 retry by typing instead of reopening the modal -->
            <SearchSortFilter
                v-model='filter'
                v-model:sort='sort'
                :sort-options='sortOptions'
                :active-filters='activeFilterCount'
                placeholder='Filter Events'
                class='mb-2'
            >
                <template #filters>
                    <div class='d-flex flex-column'>
                        <div class='d-flex align-items-center justify-content-between px-3 py-2'>
                            <strong class='small text-uppercase text-secondary'>Filters</strong>
                            <button
                                v-if='activeFilterCount > 0'
                                type='button'
                                class='btn btn-link btn-sm p-0'
                                @click='clearFilters'
                            >
                                Clear
                            </button>
                        </div>
                        <div class='px-3 pb-2 d-flex flex-column gap-2'>
                            <div>
                                <div class='small text-uppercase text-secondary mb-1'>
                                    Status
                                </div>
                                <label class='form-check mb-1'>
                                    <input
                                        v-model='activeOnly'
                                        class='form-check-input'
                                        type='checkbox'
                                    >
                                    <span class='form-check-label'>Active Events only</span>
                                </label>
                            </div>
                            <div>
                                <div class='small text-uppercase text-secondary mb-1'>
                                    Priority
                                </div>
                                <label
                                    v-for='opt in priorityOptions'
                                    :key='opt'
                                    class='form-check mb-1'
                                >
                                    <input
                                        class='form-check-input'
                                        type='checkbox'
                                        :checked='priorities.includes(opt)'
                                        @change='togglePriority(opt)'
                                    >
                                    <span class='form-check-label text-capitalize'>{{ opt }}</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </template>
            </SearchSortFilter>

            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerLoading
                v-else-if='loading'
                desc='Loading Events'
            />
            <TablerNone
                v-else-if='available.length === 0'
                :label='activeFilterCount > 0 ? "No Events match the current filters" : "No Events shared with this Channel available to Nominate"'
                :create='false'
            />
            <div
                v-else
                class='d-flex flex-column gap-2 overflow-auto'
                style='max-height: 50vh;'
            >
                <StandardCoreEntity
                    v-for='event in available'
                    :key='event.id'
                    :event='event'
                    @click='emit("nominate", event); emit("close")'
                />
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { server } from '../../std.ts';
import type { CoreEntity } from '../../types.ts';
import StandardCoreEntity from '../CloudTAK/util/StandardCoreEntity.vue';
import SearchSortFilter from '../CloudTAK/util/SearchSortFilter.vue';
import {
    TablerNone,
    TablerAlert,
    TablerModal,
    TablerLoading,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';

type CoreEntitySort = 'created' | 'updated' | 'name';

const props = defineProps<{
    channel: number;
    channelName?: string;
    placed: Set<string>;
}>();

const emit = defineEmits<{
    (e: 'nominate', event: CoreEntity): void;
    (e: 'close'): void;
}>();

const loading = ref(true);
const error = ref<Error | undefined>();
const filter = ref('');
const events = ref<Array<CoreEntity>>([]);

const sort = ref('');
const sortOptions = ['Newest → Oldest', 'Oldest → Newest', 'A → Z', 'Z → A'];
const apiSort = ref<{ sort: CoreEntitySort; order: 'asc' | 'desc' }>({ sort: 'created', order: 'desc' });

const priorityOptions = ['critical', 'high', 'medium', 'low', 'none'];
const activeOnly = ref(true);
const priorities = ref<Array<string>>([]);

const activeFilterCount = computed(() => (activeOnly.value ? 1 : 0) + priorities.value.length);

// Active & priority are not API filters - they narrow the fetched page locally
const available = computed<Array<CoreEntity>>(() => {
    return events.value.filter((event) => {
        if (props.placed.has(event.id)) return false;
        if (activeOnly.value && !event.active) return false;
        if (priorities.value.length && !priorities.value.includes(event.priority)) return false;
        return true;
    });
});

function togglePriority(priority: string): void {
    if (priorities.value.includes(priority)) {
        priorities.value = priorities.value.filter((p) => p !== priority);
    } else {
        priorities.value = [...priorities.value, priority];
    }
}

function clearFilters(): void {
    activeOnly.value = false;
    priorities.value = [];
}

watch(sort, async () => {
    if (sort.value === 'Oldest → Newest') {
        apiSort.value = { sort: 'created', order: 'asc' };
    } else if (sort.value === 'A → Z') {
        apiSort.value = { sort: 'name', order: 'asc' };
    } else if (sort.value === 'Z → A') {
        apiSort.value = { sort: 'name', order: 'desc' };
    } else {
        apiSort.value = { sort: 'created', order: 'desc' };
    }

    await listEvents();
});

// Typing shouldn't fire a request per keystroke, and a slow earlier response
// must never overwrite the results of the filter the user has since typed
let debounce: ReturnType<typeof setTimeout> | undefined;
let request = 0;

watch(filter, () => {
    if (debounce) clearTimeout(debounce);

    loading.value = true;

    debounce = setTimeout(() => {
        listEvents();
    }, 250);
});

onBeforeUnmount(() => {
    if (debounce) clearTimeout(debounce);
});

onMounted(async () => {
    await listEvents();
});

async function listEvents(): Promise<void> {
    const current = ++request;

    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/core/event', {
            params: {
                query: {
                    limit: 100,
                    page: 0,
                    order: apiSort.value.order,
                    sort: apiSort.value.sort,
                    filter: filter.value,
                    channel: props.channel,
                }
            }
        });

        if (current !== request) return;

        if (res.error) throw new Error(res.error.message);

        events.value = res.data.items as Array<CoreEntity>;

        loading.value = false;
    } catch (err) {
        if (current !== request) return;

        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
