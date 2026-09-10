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
                <div
                    v-if='props.edit && props.channels && props.channels.length'
                    class='me-1'
                    @click.stop
                >
                    <TablerDropdown
                        :width='320'
                        position='bottom-end'
                    >
                        <template #default>
                            <TablerIconButton
                                title='Complete a Form'
                                @click='listForms'
                            >
                                <IconPlus
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </template>

                        <template #dropdown>
                            <div class='event-form-pick-menu'>
                                <div class='d-flex align-items-center px-3 py-2 border-bottom'>
                                    <h3 class='m-0 fw-bold'>
                                        Forms
                                    </h3>
                                    <div class='ms-auto btn-list'>
                                        <TablerIconButton
                                            title='Refresh Forms'
                                            @click.stop='listForms(true)'
                                        >
                                            <IconRefresh
                                                :size='20'
                                                stroke='1'
                                            />
                                        </TablerIconButton>
                                    </div>
                                </div>

                                <div class='px-3 py-2'>
                                    <!-- The dropdown autocloses on any click it sees - the
                                         search field has to swallow its own -->
                                    <TablerInput
                                        v-model='search'
                                        placeholder='Search...'
                                        icon='search'
                                        :autofocus='true'
                                        class='mb-0'
                                        @click.stop
                                    />
                                </div>

                                <div class='px-2 pb-2 overflow-auto event-form-pick-list'>
                                    <TablerLoading
                                        v-if='formsLoading'
                                        :compact='true'
                                        desc='Loading Forms'
                                    />
                                    <TablerAlert
                                        v-else-if='formsError'
                                        :err='formsError'
                                    />
                                    <template v-else>
                                        <div
                                            v-for='form of filtered'
                                            :key='form.id'
                                            class='col-12 py-1 px-2 cloudtak-hover cursor-pointer user-select-none d-flex align-items-center gap-2'
                                            @click='emit("add", form)'
                                        >
                                            <IconForms
                                                :size='20'
                                                stroke='1.5'
                                                class='flex-shrink-0'
                                            />
                                            <div style='min-width: 0;'>
                                                <div
                                                    class='text-truncate'
                                                    v-text='form.name'
                                                />
                                                <div
                                                    v-if='form.description'
                                                    class='small text-secondary text-truncate'
                                                    v-text='form.description'
                                                />
                                            </div>
                                        </div>
                                        <TablerNone
                                            v-if='!filtered.length'
                                            :compact='true'
                                            :create='false'
                                            :label='forms.length ? "No Matching Forms" : "No Forms shared with this Event"'
                                        />
                                    </template>
                                </div>
                            </div>
                        </template>
                    </TablerDropdown>
                </div>
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
 * render of the submitted values against the Form's schema. When editable,
 * a picker offers every Form shared with one of the Event's Channels so a
 * new Response can be completed for it
 */

import { ref, computed, watch } from 'vue';
import { server } from '../../../std.ts';
import type { CoreForm, CoreEventFormResponse } from '../../../types.ts';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import {
    TablerNone,
    TablerAlert,
    TablerBadge,
    TablerEpoch,
    TablerInput,
    TablerSchema,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconForms,
    IconRefresh,
    IconChevronUp,
    IconChevronDown,
} from '@tabler/icons-vue';

const props = defineProps<{
    /** Core Event to list completed Forms for */
    event: string;
    /** Bump to re-fetch after a Response is submitted elsewhere in the view */
    refresh?: number;
    /** TAK Channels the Event is shared with - the Forms offered for completion */
    channels?: Array<number>;
    edit?: boolean;
}>();

const emit = defineEmits<{
    /** A Form was picked for completion - the parent opens the FormWizard */
    (e: 'add', form: CoreForm): void;
}>();

const expanded = ref(true);
const loading = ref(true);
const error = ref<Error | undefined>();
const responses = ref<Array<CoreEventFormResponse>>([]);
const opened = ref<Set<string>>(new Set());

const search = ref('');
const forms = ref<Array<CoreForm>>([]);
const formsLoading = ref(false);
const formsError = ref<Error | undefined>();

// The Channels the current list was fetched for - a stale list is refetched
// when the picker next opens rather than on every share change
let formsChannels = '';

const filtered = computed<Array<CoreForm>>(() => {
    const term = search.value.trim().toLowerCase();

    if (!term) return forms.value;

    return forms.value.filter((form) => {
        return form.name.toLowerCase().includes(term)
            || form.description.toLowerCase().includes(term);
    });
});

watch(() => [props.event, props.refresh], async () => {
    await listResponses();
}, { immediate: true });

/** Fetched lazily when the picker opens - the list rarely changes so it is only refetched on demand */
async function listForms(force = false): Promise<void> {
    const channels = props.channels || [];
    const key = channels.join(',');

    if (!force && key === formsChannels && !formsError.value) return;

    formsLoading.value = true;
    formsError.value = undefined;

    try {
        const res = await server.GET('/api/core/form', {
            params: {
                query: {
                    limit: 100,
                    page: 0,
                    order: 'asc',
                    sort: 'name',
                    filter: '',
                    channel: channels,
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        forms.value = res.data.items;
        formsChannels = key;
    } catch (err) {
        forms.value = [];
        formsError.value = err instanceof Error ? err : new Error(String(err));
    }

    formsLoading.value = false;
}

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

<style>
.event-form-pick-menu .event-form-pick-list {
    max-height: 300px;
}
</style>
