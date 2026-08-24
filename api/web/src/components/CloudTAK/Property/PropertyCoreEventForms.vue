<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Forms'
        >
            <template #icon>
                <IconForms
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <TablerBadge
                    class='me-2'
                    background-color='rgba(59, 130, 246, 0.15)'
                    border-color='rgba(59, 130, 246, 0.4)'
                    text-color='#3b82f6'
                >
                    {{ responses.length }}
                </TablerBadge>
            </template>

            <div class='overflow-hidden mb-2'>
                <div class='rounded mx-2 mt-2 px-2 py-2'>
                    <TablerLoading
                        v-if='loading'
                        :compact='true'
                        desc='Loading Forms'
                    />
                    <TablerAlert
                        v-else-if='error'
                        :err='error'
                    />
                    <template v-else>
                        <TablerNone
                            v-if='!responses.length'
                            label='No Completed Forms'
                            :compact='true'
                            :create='false'
                        />

                        <div
                            v-for='item of responses'
                            :key='item.id'
                            class='rounded'
                        >
                            <div
                                class='d-flex align-items-center rounded px-1 py-1 cloudtak-hover-fill cursor-pointer'
                                @click='toggle(item.id)'
                            >
                                <div
                                    class='flex-grow-1'
                                    style='min-width: 0;'
                                >
                                    <div
                                        class='text-truncate'
                                        v-text='item.form.name'
                                    />
                                    <div class='small text-muted text-truncate'>
                                        <span v-text='item.username || "Unknown User"' />
                                        <span class='mx-1'>&middot;</span>
                                        <TablerEpoch :date='item.created' />
                                    </div>
                                </div>
                                <IconChevronUp
                                    v-if='opened.has(item.id)'
                                    :size='18'
                                    stroke='1'
                                    class='flex-shrink-0 mx-1'
                                />
                                <IconChevronDown
                                    v-else
                                    :size='18'
                                    stroke='1'
                                    class='flex-shrink-0 mx-1'
                                />
                            </div>

                            <div
                                v-if='opened.has(item.id)'
                                class='border border-secondary border-opacity-25 rounded mb-2'
                            >
                                <TablerSchema
                                    :schema='responseSchema(item)'
                                    :model-value='item.response'
                                    :disabled='true'
                                />
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
/**
 * PropertyCoreEventForms - the Forms that have been completed for a Core
 * Event: every Form Response linked to it, expandable into a read-only
 * render of the submitted values against the Form's schema
 */

import { ref, watch } from 'vue';
import { server } from '../../../std.ts';
import type { CoreEventFormResponse } from '../../../types.ts';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import {
    TablerNone,
    TablerAlert,
    TablerBadge,
    TablerEpoch,
    TablerSchema,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import {
    IconForms,
    IconChevronUp,
    IconChevronDown,
} from '@tabler/icons-vue';

const props = defineProps<{
    /** Core Event to list completed Forms for */
    event: string;
    /** Bump to re-fetch after a Response is submitted elsewhere in the view */
    refresh?: number;
}>();

const expanded = ref(true);
const loading = ref(true);
const error = ref<Error | undefined>();
const responses = ref<Array<CoreEventFormResponse>>([]);
const opened = ref<Set<string>>(new Set());

watch(() => [props.event, props.refresh], async () => {
    await listResponses();
}, { immediate: true });

async function listResponses(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/core/event/{:event}/response', {
            params: {
                path: { ':event': props.event },
                query: {
                    limit: 100,
                    page: 0,
                    order: 'desc',
                    sort: 'created',
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        responses.value = res.data.items;
    } catch (err) {
        responses.value = [];
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

function toggle(id: string): void {
    if (opened.value.has(id)) {
        opened.value.delete(id);
    } else {
        opened.value.add(id);
    }
}

/** TablerSchema iterates `properties` - normalise so a bare schema can't crash it */
function responseSchema(item: CoreEventFormResponse): Record<string, unknown> {
    return {
        type: 'object',
        properties: {},
        ...item.form.schema,
    };
}
</script>
