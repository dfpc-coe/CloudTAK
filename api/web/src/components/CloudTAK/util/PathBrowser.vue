<template>
    <div :class='depth === 0 ? "d-flex flex-column gap-2" : ""'>
        <template
            v-for='node of nodes'
            :key='node.id'
        >
            <StandardItem
                :id='`foldertarget-${node.id}`'
                class='px-3 py-3 user-select-none'
                :style='hoverNode?.id === node.id ? "background-color: rgba(255, 255, 255, 0.1);" : ""'
                @drop.stop.prevent='emit("folder-drop", node)'
                @dragover.prevent='emit("folder-drag-over", node)'
                @dragleave='emit("folder-drag-leave")'
                @click='node.opened ? emit("close", node) : emit("open", node)'
            >
                <div class='d-flex align-items-center justify-content-between'>
                    <div class='d-flex align-items-center'>
                        <IconChevronRight
                            v-if='!node.opened'
                            :size='20'
                            stroke='1'
                        />
                        <IconChevronDown
                            v-else
                            :size='20'
                            stroke='1'
                        />
                        <IconFolder
                            class='mx-2'
                            :size='20'
                            stroke='2'
                        />
                        <span
                            class='fw-bold'
                            v-text='node.name'
                        />
                    </div>

                    <div class='ms-auto d-flex align-items-center gap-2'>
                        <TablerBadge
                            class='rounded-pill'
                            background-color='rgba(107, 114, 128, 0.15)'
                            border-color='rgba(107, 114, 128, 0.3)'
                            text-color='#6b7280'
                        >
                            {{ node.count }}
                        </TablerBadge>
                        <TablerIconButton
                            title='Rename Folder'
                            @click.stop='emit("rename", node)'
                        >
                            <IconPencil
                                :size='20'
                                stroke='1'
                            />
                        </TablerIconButton>
                        <TablerDelete
                            displaytype='icon'
                            :size='20'
                            @delete='emit("delete", node)'
                        />
                    </div>
                </div>

                <div
                    v-if='node.opened'
                    class='mt-3'
                    @click.stop
                >
                    <PathBrowser
                        v-if='node.children.length > 0'
                        :nodes='node.children'
                        :depth='depth + 1'
                        :hover-node='hoverNode'
                        @open='(n) => emit("open", n)'
                        @close='(n) => emit("close", n)'
                        @delete='(n) => emit("delete", n)'
                        @rename='(n) => emit("rename", n)'
                        @folder-drop='(n) => emit("folder-drop", n)'
                        @folder-drag-over='(n) => emit("folder-drag-over", n)'
                        @folder-drag-leave='emit("folder-drag-leave")'
                    >
                        <template #items='{ node: childNode }'>
                            <slot
                                name='items'
                                :node='childNode'
                            />
                        </template>
                    </PathBrowser>

                    <div
                        :id='`folder-${node.id}`'
                        class='folder w-100'
                        style='min-height: 40px;'
                    >
                        <TablerLoading v-if='node.loading' />
                        <template v-else>
                            <slot
                                name='items'
                                :node='node'
                            />
                        </template>
                    </div>
                </div>
            </StandardItem>
        </template>
    </div>
</template>

<script lang='ts'>
export default {
    name: 'PathBrowser'
};
</script>

<script setup lang='ts'>
import type { PathNode } from '../../../base/path-manager.ts';
import StandardItem from './StandardItem.vue';
import {
    TablerBadge,
    TablerIconButton,
    TablerDelete,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import {
    IconFolder,
    IconPencil,
    IconChevronRight,
    IconChevronDown
} from '@tabler/icons-vue';

withDefaults(defineProps<{
    nodes: PathNode[];
    depth?: number;
    hoverNode?: PathNode;
}>(), {
    depth: 0,
    hoverNode: undefined
});

const emit = defineEmits<{
    open: [node: PathNode];
    close: [node: PathNode];
    delete: [node: PathNode];
    rename: [node: PathNode];
    'folder-drop': [node: PathNode];
    'folder-drag-over': [node: PathNode];
    'folder-drag-leave': [];
}>();

defineSlots<{
    items: (props: { node: PathNode }) => void;
}>();
</script>
