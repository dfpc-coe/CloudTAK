<template>
    <div class='d-flex align-items-center gap-2'>
        <span
            :class='{ "drop-target": droppable && hoverDepth === 0 }'
            class='d-inline-flex rounded'
            @dragover='onDragOver(0, $event)'
            @dragleave='hoverDepth = undefined'
            @drop.stop.prevent='onDrop(0)'
        >
            <TablerIconButton
                title='Home'
                @click='navigateTo(0)'
            >
                <IconFolder
                    :size='20'
                    stroke='1'
                />
            </TablerIconButton>
        </span>

        <template
            v-for='(segment, idx) in displaySegments'
            :key='`${idx}-${segment}`'
        >
            <IconChevronRight
                :size='20'
                stroke='1'
                class='text-white-50'
            />

            <span
                class='fw-semibold cursor-pointer hover-opacity rounded px-1'
                :class='{ "drop-target": droppable && hoverDepth === idx + 1 }'
                @dragover='onDragOver(idx + 1, $event)'
                @dragleave='hoverDepth = undefined'
                @drop.stop.prevent='onDrop(idx + 1)'
                @click='navigateTo(idx + 1)'
            >{{ segment }}</span>
        </template>

        <span
            v-if='!displaySegments.length'
            class='small text-white-50'
        >/</span>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { IconFolder, IconChevronRight } from '@tabler/icons-vue';

const props = withDefaults(defineProps<{
    /** Explicit segment labels - when provided navigation is emitted as a depth instead of writing to the collection model */
    segments?: string[];
    /** Allow segments (and Home) to act as drag & drop targets, emitting segment-drop with the depth */
    droppable?: boolean;
}>(), {
    segments: undefined,
    droppable: false
});

const collection = defineModel<string>('collection');

const emit = defineEmits<{
    /** Number of segments retained - 0 is Home */
    navigate: [depth: number];
    /** Item dropped on the segment at the given depth - 0 is Home */
    'segment-drop': [depth: number];
}>();

const hoverDepth = ref<number | undefined>();

const displaySegments = computed<string[]>(() => {
    if (props.segments) return props.segments;

    return String(collection.value || '')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean);
});

function navigateTo(depth: number): void {
    emit('navigate', depth);

    if (!props.segments) {
        collection.value = joinSegments(displaySegments.value.slice(0, depth));
    }
}

function onDragOver(depth: number, event: DragEvent): void {
    if (!props.droppable) return;
    event.preventDefault();
    hoverDepth.value = depth;
}

function onDrop(depth: number): void {
    if (!props.droppable) return;
    hoverDepth.value = undefined;
    emit('segment-drop', depth);
}

function joinSegments(parts: string[]): string {
    return parts
        .map((part) => part.trim())
        .filter(Boolean)
        .join('/');
}
</script>

<style scoped>
.drop-target {
    background-color: rgba(255, 255, 255, 0.1);
    outline: 1px dashed rgba(255, 255, 255, 0.5);
}
</style>
