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
            <TablerAlert
                v-if='error'
                :err='error'
            />
            <template v-else>
                <TablerInput
                    v-model='filter'
                    placeholder='Filter Events'
                    class='mb-2'
                />

                <TablerLoading
                    v-if='loading'
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
            </template>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
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

watch(filter, async () => {
    await listEvents();
});

onMounted(async () => {
    await listEvents();
});

async function listEvents(): Promise<void> {
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

        if (res.error) throw new Error(res.error.message);

        events.value = res.data.items as Array<CoreEvent>;

        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
