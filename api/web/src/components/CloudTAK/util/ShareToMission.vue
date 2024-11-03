<template>
    <div class='mb-2'>
        <div class='sticky-top col-12 d-flex align-items-center user-select-none'>
            <span class='subheader mx-2'>Add to Mission</span>
            <div
                v-if='compact'
                class='ms-auto'
            >
                <TablerIconButton
                    title='Cancel Share'
                    class='mx-2 my-2'
                    @click='emit("cancel")'
                >
                    <IconX
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>


        <TablerLoading v-if='loading' />
        <EmptyInfo
            v-else-if='!missions.length'
            type='missions'
        />
        <template v-else>
            <div
                class='overflow-auto position-absolute'
                :style='`
                    height: calc(100% - 36px - ${compact ? "40px" : "100px"});
                    margin-bottom: ${compact ? "30px" : "100px"};
                    width: 100%;
                `'
            >
                <div v-for='mission in missions'>
                    <span v-text='mission'/>
                </div>
            </div>
            <div class='position-absolute row g-0 bottom-0 start-0 end-0 bg-dark'>
                <div class='col-6 px-1 py-1'>
                    <TablerButton
                        v-tooltip='"Share to Selected"'
                        class='w-100 btn-primary'
                        :style='compact ? "height: 30px" : ""'
                    >
                        <IconShare2
                            v-if='compact'
                            :size='20'
                            stroke='1'
                        />
                        <span v-else>Add to Mission</span>
                    </TablerButton>
                </div>
                <div class='col-6 px-1 py-1'>
                    <TablerButton
                        v-tooltip='"Cancel Share"'
                        class='w-100 btn-secondary'
                        :style='compact ? "height: 30px" : ""'
                        @click='emit("cancel")'
                    >
                        Cancel
                    </TablerButton>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { std, stdurl } from '../../../../src/std.ts';
import EmptyInfo from './EmptyInfo.vue';
import {
    TablerNone,
    TablerLoading,
    TablerButton,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconX,
    IconBroadcast,
    IconShare2
} from '@tabler/icons-vue';
import { useConnectionStore } from '../../../../src/stores/connection.ts';
import { useCOTStore } from '../../../../src/stores/cots.ts';

const cotStore = useCOTStore();
const connectionStore = useConnectionStore();

const missions = computed(() => Array.from(cotStore.subscriptions.values()) );

const props = defineProps({
    compact: {
        type: Boolean,
        default: false
    },
    maxheight: {
        type: String,
        default: '100%'
    }
});

const emit = defineEmits(['cancel', 'done']);

const loading = ref(false);
const selected = ref(new Set());
</script>
