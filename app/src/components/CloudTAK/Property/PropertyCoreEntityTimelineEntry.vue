<template>
    <div
        class='timeline-entry d-flex gap-2 px-2 rounded'
        :class='{ "timeline-entry--editing": editing }'
    >
        <div class='d-flex flex-column align-items-center flex-shrink-0 pt-1'>
            <TimelineTypeIcon :type='entry.type' />
            <div
                v-if='!last'
                class='timeline-entry-line flex-grow-1'
            />
        </div>

        <div
            class='flex-grow-1 pb-2'
            style='min-width: 0;'
        >
            <div
                class='d-flex align-items-center gap-2'
                style='min-height: 28px;'
            >
                <span
                    class='fw-semibold text-truncate'
                    v-text='entry.author'
                />
                <span
                    v-if='own'
                    class='badge bg-secondary-lt flex-shrink-0'
                >you</span>
                <span
                    v-if='entry.layer'
                    class='small text-secondary text-truncate flex-shrink-1'
                    :title='`Written by the ${entry.layer.name} Layer`'
                    v-text='`via ${entry.layer.name}`'
                />
                <span
                    class='small text-secondary ms-auto flex-shrink-0'
                    :title='new Date(entry.occurred).toLocaleString()'
                >
                    <span v-text='time' />
                    <span
                        v-if='edited'
                        class='ms-1'
                        title='This entry has been edited'
                    >&middot; edited</span>
                </span>
            </div>

            <template v-if='editing'>
                <textarea
                    ref='editor'
                    v-model='draft'
                    class='form-control'
                    rows='3'
                    :disabled='saving'
                    @keydown.enter.meta.prevent='save'
                    @keydown.enter.ctrl.prevent='save'
                    @keydown.esc.prevent='emit("cancel")'
                />
                <div class='d-flex align-items-center gap-2 mt-2'>
                    <span class='small text-secondary flex-grow-1'>Markdown &middot; Ctrl+Enter to save</span>
                    <button
                        type='button'
                        class='btn btn-sm'
                        :disabled='saving'
                        @click='emit("cancel")'
                    >
                        Cancel
                    </button>
                    <button
                        type='button'
                        class='btn btn-sm btn-primary'
                        :disabled='saving || !draft.trim()'
                        @click='save'
                    >
                        Save
                    </button>
                </div>
            </template>
            <div
                v-else
                class='d-flex align-items-start gap-2'
            >
                <div
                    class='flex-grow-1'
                    style='min-width: 0;'
                >
                    <TablerMarkdown
                        v-if='entry.body'
                        class='timeline-entry-body'
                        :autowrap='false'
                        :breaks='true'
                        :markdown='rendered'
                    />
                    <div
                        v-else
                        class='small text-secondary fst-italic'
                        v-text='`${label} entry`'
                    />
                </div>

                <div
                    v-if='edit'
                    class='timeline-entry-actions btn-list flex-nowrap flex-shrink-0'
                >
                    <TablerIconButton
                        v-if='entry.type === "comment"'
                        title='Edit Entry'
                        @click='emit("edit")'
                    >
                        <IconPencil
                            :size='20'
                            stroke='1.5'
                        />
                    </TablerIconButton>
                    <TablerDelete
                        displaytype='icon'
                        :size='20'
                        @delete='emit("delete")'
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
/** PropertyCoreEntityTimelineEntry - one dated row of a Core Event's Timeline */
import { ref, computed, watch, nextTick } from 'vue';
import { TablerMarkdown, TablerIconButton, TablerDelete } from '@tak-ps/vue-tabler';
import { IconPencil } from '@tabler/icons-vue';
import TimelineTypeIcon from './PropertyCoreEntityTimelineIcon.vue';
import { textToMarkdown } from '../../../utils/text-markdown.ts';
import type { CoreEntityTimelineEntry } from '../../../types.ts';

const props = defineProps<{
    entry: CoreEntityTimelineEntry;
    /** The viewer wrote the entry */
    own?: boolean;
    /** The viewer may edit & delete the entry */
    edit?: boolean;
    editing?: boolean;
    saving?: boolean;
    /** Last row of the list - no rail line below the icon */
    last?: boolean;
}>();

const emit = defineEmits<{
    (e: 'edit'): void;
    (e: 'cancel'): void;
    (e: 'save', body: string): void;
    (e: 'delete'): void;
}>();

const editor = ref<HTMLTextAreaElement>();
const draft = ref(props.entry.body);

watch(() => props.editing, async (editing) => {
    if (!editing) return;
    draft.value = props.entry.body;
    await nextTick();
    editor.value?.focus();
});

const LABELS: Record<string, string> = {
    comment: 'Comment',
    status: 'Status',
    unit: 'Unit',
    location: 'Location',
    attachment: 'Attachment',
    external: 'External',
};

const label = computed(() => LABELS[props.entry.type] || 'Timeline');

const rendered = computed(() => textToMarkdown(props.entry.body));

const edited = computed(() => new Date(props.entry.updated).getTime() > new Date(props.entry.created).getTime());

const time = computed(() => new Date(props.entry.occurred).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

function save(): void {
    if (!draft.value.trim()) return;
    emit('save', draft.value);
}
</script>

<style scoped>
.timeline-entry:hover:not(.timeline-entry--editing) {
    background: var(--cloudtak-hover-bg);
}

.timeline-entry-line {
    width: 2px;
    min-height: 12px;
    margin-top: 4px;
    background: var(--cloudtak-inset-border);
}

.timeline-entry-body {
    font-size: 13px;
    line-height: 1.45;
    overflow-wrap: anywhere;
}

.timeline-entry-body :deep(p:last-child) {
    margin-bottom: 0;
}

.timeline-entry-actions {
    visibility: hidden;
}

.timeline-entry:hover .timeline-entry-actions,
.timeline-entry:focus-within .timeline-entry-actions {
    visibility: visible;
}
</style>
