<template>
    <div class='pt-2'>
        <div
            v-if='edit'
            class='px-2 pb-2'
        >
            <MessageComposer
                ref='composer'
                placeholder='Add to the timeline…'
                :avatar='initials'
                :avatar-title='profile.username || "You"'
                :busy='posting'
                @send='post'
            />
        </div>

        <div
            v-if='saveError'
            class='px-2 pb-2'
        >
            <TablerInlineAlert
                severity='danger'
                title='Change Not Saved'
                :description='saveError.message'
            />
        </div>

        <TablerLoading
            v-if='loading'
            :compact='true'
            desc='Loading Timeline'
        />
        <template v-else>
            <TablerAlert
                v-if='error'
                :err='error'
            />

            <TablerNone
                v-else-if='!items.length'
                label='No Timeline Events'
                class='pb-2'
                :compact='true'
                :create='false'
            />

            <template v-else>
                <template
                    v-for='group of groups'
                    :key='group.label'
                >
                    <div class='d-flex align-items-center gap-2 px-3 pt-1 pb-2'>
                        <span
                            class='subheader'
                            v-text='group.label'
                        />
                        <span class='timeline-divider flex-grow-1' />
                    </div>

                    <TimelineEntry
                        v-for='(entry, index) of group.entries'
                        :key='entry.id'
                        :entry='entry'
                        :own='isOwn(entry)'
                        :edit='canEdit(entry)'
                        :editing='editing === entry.id'
                        :saving='saving === entry.id'
                        :last='index === group.entries.length - 1 && group === groups[groups.length - 1]'
                        @edit='editing = entry.id'
                        @cancel='editing = null'
                        @save='saveEntry(entry, $event)'
                        @delete='deleteEntry(entry)'
                    />
                </template>

                <div
                    v-if='remaining > 0'
                    class='px-2 pt-1 pb-3'
                >
                    <button
                        type='button'
                        class='btn btn-sm w-100'
                        :disabled='loadingMore'
                        @click='loadMore'
                        v-text='loadingMore ? "Loading…" : `Show ${remaining} older ${remaining === 1 ? "entry" : "entries"}`'
                    />
                </div>
            </template>
        </template>
    </div>
</template>

<script setup lang='ts'>
/**
 * PropertyCoreEntityTimeline - the dated narrative of a Core Event: a
 * composer for comments and the entries newest first
 * grouped by day. Each entry is its own API resource so edits save
 * immediately rather than through the parent's PATCH
 */

import { ref, computed, watch } from 'vue';
import { server } from '../../../std.ts';
import { loadProfileIdentity, type ProfileIdentity } from '../../../utils/entity-access.ts';
import type { CoreEntityTimelineList, CoreEntityTimelineEntry } from '../../../types.ts';
import TimelineEntry from './PropertyCoreEntityTimelineEntry.vue';
import MessageComposer from '../util/MessageComposer.vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';

const PAGE = 25;

const props = defineProps<{
    /** Core Entity to list the Timeline of */
    entity: string;
    /** The viewer may add entries and change their own */
    edit?: boolean;
}>();

const emit = defineEmits<{
    /** Entries were added or removed - carries the new total */
    (e: 'change', total: number): void;
}>();

const profile = ref<ProfileIdentity>({});

const loading = ref(true);
const loadingMore = ref(false);
const error = ref<Error | undefined>();
const saveError = ref<Error | undefined>();

const items = ref<Array<CoreEntityTimelineEntry>>([]);
const total = ref(0);
const page = ref(0);

const composer = ref<InstanceType<typeof MessageComposer>>();
const posting = ref(false);

const editing = ref<string | null>(null);
const saving = ref<string | null>(null);

watch(() => props.entity, async () => {
    editing.value = null;
    profile.value = await loadProfileIdentity();
    await list();
}, { immediate: true });

const initials = computed(() => {
    const name = profile.value.username || '';
    return name.slice(0, 2).toUpperCase() || '?';
});

/** Entries not yet loaded */
const remaining = computed(() => Math.max(0, total.value - items.value.length));

type Group = { label: string, entries: Array<CoreEntityTimelineEntry> };

/** Entries by calendar day, newest first, as the list is sorted */
const groups = computed<Array<Group>>(() => {
    const result: Array<Group> = [];

    for (const entry of items.value) {
        const label = dayLabel(entry.occurred);
        const last = result[result.length - 1];

        if (last && last.label === label) {
            last.entries.push(entry);
        } else {
            result.push({ label, entries: [entry] });
        }
    }

    return result;
});

function dayLabel(iso: string): string {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    });
}

function isOwn(entry: CoreEntityTimelineEntry): boolean {
    return !!entry.username && entry.username === profile.value.username;
}

/** The API lets the author or an admin change an entry, and only while the Event is editable */
function canEdit(entry: CoreEntityTimelineEntry): boolean {
    return !!props.edit && (isOwn(entry) || !!profile.value.system_admin);
}

async function fetchPage(pageNumber: number): Promise<CoreEntityTimelineList> {
    const res = await server.GET('/api/core/entity/{:entity}/timeline', {
        params: {
            path: { ':entity': props.entity },
            query: {
                limit: PAGE,
                page: pageNumber,
                order: 'desc',
                sort: 'occurred',
                filter: '',
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    return res.data;
}

async function list(): Promise<void> {
    loading.value = true;
    error.value = undefined;
    page.value = 0;

    try {
        const res = await fetchPage(0);
        items.value = res.items;
        total.value = res.total;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

async function loadMore(): Promise<void> {
    loadingMore.value = true;
    saveError.value = undefined;

    try {
        const res = await fetchPage(page.value + 1);
        page.value += 1;

        const seen = new Set(items.value.map((i) => i.id));
        items.value.push(...res.items.filter((i) => !seen.has(i.id)));
        total.value = res.total;
    } catch (err) {
        saveError.value = err instanceof Error ? err : new Error(String(err));
    }

    loadingMore.value = false;
}

async function post(body: string): Promise<void> {
    if (posting.value) return;

    posting.value = true;
    saveError.value = undefined;

    try {
        const res = await server.POST('/api/core/entity/{:entity}/timeline', {
            params: {
                path: { ':entity': props.entity }
            },
            body: {
                type: 'comment',
                author: '',
                body,
                metadata: {},
            }
        });

        if (res.error) throw new Error(res.error.message);

        await composer.value?.reset();

        // A fresh entry has the newest occurred time so it heads the list
        items.value.unshift(res.data);
        total.value += 1;

        emit('change', total.value);
    } catch (err) {
        saveError.value = err instanceof Error ? err : new Error(String(err));
    }

    posting.value = false;
}

async function saveEntry(entry: CoreEntityTimelineEntry, body: string): Promise<void> {
    saving.value = entry.id;
    saveError.value = undefined;

    try {
        const res = await server.PATCH('/api/core/entity/{:entity}/timeline/{:entry}', {
            params: {
                path: { ':entity': props.entity, ':entry': entry.id }
            },
            body: { body }
        });

        if (res.error) throw new Error(res.error.message);

        const index = items.value.findIndex((i) => i.id === entry.id);
        if (index !== -1) items.value[index] = res.data;

        editing.value = null;
    } catch (err) {
        saveError.value = err instanceof Error ? err : new Error(String(err));
    }

    saving.value = null;
}

async function deleteEntry(entry: CoreEntityTimelineEntry): Promise<void> {
    saveError.value = undefined;

    try {
        const res = await server.DELETE('/api/core/entity/{:entity}/timeline/{:entry}', {
            params: {
                path: { ':entity': props.entity, ':entry': entry.id }
            }
        });

        if (res.error) throw new Error(res.error.message);

        items.value = items.value.filter((i) => i.id !== entry.id);
        total.value = Math.max(0, total.value - 1);

        if (editing.value === entry.id) editing.value = null;

        emit('change', total.value);
    } catch (err) {
        saveError.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>

<style scoped>
.timeline-divider {
    height: 1px;
    background: var(--cloudtak-inset-border);
}
</style>
