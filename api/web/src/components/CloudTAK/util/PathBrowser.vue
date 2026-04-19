<template>
    <div class='d-flex flex-column gap-2'>
        <template
            v-for='node of nodes'
            :key='node.id'
        >
            <StandardItem
                :id='`foldertarget-${node.id}`'
                class='px-3 py-3 user-select-none'
                :style='hoverNodeId === node.id ? "background-color: rgba(255, 255, 255, 0.1);" : ""'
                @drop.stop.prevent='onDrop(node)'
                @dragover.prevent='hoverNodeId = node.id'
                @dragleave='hoverNodeId = undefined'
                @click='emit("navigate", node)'
            >
                <div class='d-flex align-items-center justify-content-between'>
                    <div class='d-flex align-items-center'>
                        <IconFolder
                            class='me-2'
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
import { ref } from 'vue';
import type { PathNode } from '../../../base/path-manager.ts';
import StandardItem from './StandardItem.vue';
import {
    TablerBadge,
    TablerIconButton,
    TablerDelete,
} from '@tak-ps/vue-tabler';
import {
    IconFolder,
    IconPencil,
} from '@tabler/icons-vue';

defineProps<{
    nodes: PathNode[];
}>();

const hoverNodeId = ref<string | undefined>();

const emit = defineEmits<{
    navigate: [node: PathNode];
    delete: [node: PathNode];
    rename: [node: PathNode];
    'folder-drop': [node: PathNode];
}>();

function onDrop(node: PathNode) {
    hoverNodeId.value = undefined;
    emit('folder-drop', node);
}
</script>
