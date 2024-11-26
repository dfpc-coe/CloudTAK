<template>
    <div class='mb-2'>
        <div class='sticky-top col-12 d-flex align-items-center user-select-none'>
            <span class='subheader mx-2'>Add to Data Sync</span>
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
            type='Missions'
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
                    <div
                        class='col-12 cursor-pointer hover-dark py-2'
                        @click='selected.has(mission) ? selected.delete(mission) : selected.add(mission)'
                    >
                        <div class='d-flex align-items-center'>
                            <div class='col-auto'>
                                <IconCheck
                                    v-if='selected.has(mission)'
                                    :size='compact ? 20 : 32'
                                    stroke='1'
                                    :style='compact ? "margin-left: 8px" : "margin-left: 16px;"'
                                />
                                <IconAmbulance
                                    v-else
                                    :size='compact ? 20 : 32'
                                    stroke='1'
                                    :style='compact ? "margin-left: 8px" : "margin-left: 16px;"'
                                />
                            </div>
                            <span
                                class='mx-2'
                                v-text='mission.meta.name'
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div class='position-absolute row g-0 bottom-0 start-0 end-0 bg-dark'>
                <div class='col-6 px-1 py-1'>
                    <TablerButton
                        v-tooltip='"Share to Selected"'
                        class='w-100 btn-primary'
                        :disabled='selected.size === 0'
                        :style='compact ? "height: 30px" : ""'
                        @click='share'
                    >
                        <IconShare2
                            v-if='compact'
                            :size='20'
                            stroke='1'
                        />
                        <span v-else>Add to Data Sync</span>
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
import type { PropType } from 'vue';
import EmptyInfo from './EmptyInfo.vue';
import {
    TablerLoading,
    TablerButton,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconX,
    IconCheck,
    IconAmbulance,
    IconShare2
} from '@tabler/icons-vue';
import type { Feature } from '../../../../src/types.ts';
import COT from '../../../../src/stores/base/cot.ts'
import { useCOTStore } from '../../../../src/stores/cots.ts';
import { useConnectionStore } from '../../../../src/stores/connection.ts';
import Subscription from '../../../../src/stores/base/mission.ts'

const cotStore = useCOTStore();
const connectionStore = useConnectionStore();

const missions = computed(() => {
    return Array.from(cotStore.subscriptions.values())
        .filter((mission) => {
            return mission.role.permissions.includes("MISSION_WRITE")
        })
});

const props = defineProps({
    feats: {
        type: Array as PropType<Array<Feature>>,
        required: true
    },
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
const selected = ref<Set<Subscription>>(new Set());

/** Feats often come from Vector Tiles which don't contain the full feature */
function currentFeats(): Array<Feature> {
    return (props.feats || []).map((f) => {
        if (f.properties.type === 'b-f-t-r') {
            // FileShare is manually generated and won't exist in CoT Store
            return f;
        } else {
            return cotStore.get(f.id);
        }
    }).filter((f) => {
        return !!f;
    }).map((f) => {
        if (f instanceof COT) {
            return f.as_feature();
        } else {
            return f;
        }
    })
}

async function share() {
    const feats = currentFeats();

    for (let feat of feats) {
        feat = JSON.parse(JSON.stringify(feat));

        feat.properties.dest = [];
        for (const mission of selected.value) {
            feat.properties.dest.push({
                mission: mission.meta.name
            });
        }

        connectionStore.sendCOT(feat);
    }

    emit('done');
}
</script>
