<template>
    <FloatingPane
        :uid='uid'
        @close='emit("close")'
    >
        <template #header>
            <div
                class='mx-2 text-sm text-truncate'
                style='max-width: calc(100% - 100px);'
                v-text='pane?.name || "Panel"'
            />
        </template>

        <template
            v-if='pane?.config._actions'
            #actions
        >
            <component
                :is='pane.config._actions'
                v-bind='pane.config._props || {}'
            />
        </template>

        <div class='h-100 w-100 overflow-auto'>
            <component
                :is='pane.config._component'
                v-if='pane'
                v-bind='pane.config._props || {}'
            />
        </div>
    </FloatingPane>
</template>

<script setup lang='ts'>
import { ref } from 'vue'
import { useFloatStore } from '../../../stores/float.ts';
import type { Pane } from '../../../stores/float.ts';
import FloatingPane from './FloatingPane.vue';

const floatStore = useFloatStore();

const props = defineProps({
    uid: {
        type: String,
        required: true
    }
});

const emit = defineEmits(['close']);

const pane = ref(floatStore.panes.get(props.uid) as Pane);
</script>
