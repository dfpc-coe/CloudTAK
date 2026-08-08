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
            <!-- The filter stays mounted through an error so the user can
                 retry by typing instead of reopening the modal -->
            <TablerInput
                v-model='filter'
                placeholder='Filter Events'
                class='mb-2'
            />

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
                label='No Events shared with this Channel available to Nominate'
                :create='false'
            />
            <div
                v-else
                class='d-flex flex-column gap-2 overflow-auto'
                style='max-height: 50vh;'
            >
                <StandardCoreEvent
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
import type { CoreEvent } from '../../types.ts';
import StandardCoreEvent from '../CloudTAK/util/StandardCoreEvent.vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerModal,
    TablerLoading,
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    channel: number;
    placed: Set<string>;
}>();

const emit = defineEmits<{
    (e: 'nominate', event: CoreEvent): void;
    (e: 'close'): void;
}>();

const loading = ref(true);
const error = ref<Error | undefined>();
const filter = ref('');
const events = ref<Array<CoreEvent>>([]);

const available = computed<Array<CoreEvent>>(() => {
    return events.value.filter((event) => !props.placed.has(event.id));
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
                    order: 'desc',
                    sort: 'created',
                    filter: filter.value,
                    channel: props.channel,
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
