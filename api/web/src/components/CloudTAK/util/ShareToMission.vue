<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-white'>
            <div class='d-flex align-items-center'>
                <IconAmbulance
                    :size='28'
                    stroke='1'
                />
                <span class='mx-2'>Add to Data Sync</span>
            </div>
        </div>

        <div class='modal-body text-white'>
            <TablerLoading v-if='loading' />
            <EmptyInfo
                v-else-if='!missions.length'
                type='Missions'
            />
            <template v-else>
                <div
                    class='col-12 overflow-auto'
                    style='
                        max-height: 20vh;
                    '
                >
                    <div v-for='mission in missions'>
                        <div
                            class='col-12 cursor-pointer hover py-2'
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
                                    v-text='mission.name'
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>
        <div class='modal-footer'>
            <TablerButton
                v-tooltip='"Cancel Share"'
                :style='compact ? "height: 30px" : ""'
                @click='emit("close")'
            >
                Cancel
            </TablerButton>

            <div class='ms-auto'>
                <TablerButton
                    v-tooltip='"Share to Selected"'
                    class='btn-primary'
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
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import type { PropType } from 'vue';
import EmptyInfo from './EmptyInfo.vue';
import {
    TablerModal,
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
import type { Feature, Mission } from '../../../types.ts';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

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

const emit = defineEmits(['close', 'done']);

const loading = ref(true);
const selected = ref<Set<Mission>>(new Set());
const missions = ref<Array<Mission>>([]);

onMounted(async () => {
    missions.value = (await mapStore.worker.db.subscriptionList())
        .filter((mission) => {
            return mission.role.permissions.includes("MISSION_WRITE")
        }).map((mission) => {
            return mission.meta;
        })

    loading.value = false;
});

async function share(): Promise<void> {
    const feats = [];
    for (const f of props.feats || []) {
        if (f.properties.type === 'b-f-t-r') {
            // FileShare is manually generated and won't exist in CoT Store
            feats.push(f);
        } else {
            const feat = await mapStore.worker.db.get(f.id);
            if (feat) feats.push(feat.as_feature());
        }
    }

    for (let feat of feats) {
        feat = JSON.parse(JSON.stringify(feat));

        feat.properties.dest = [];
        for (const mission of selected.value) {
            feat.properties.dest.push({
                mission: mission.name
            });
        }

        await mapStore.worker.conn.sendCOT(feat);
    }

    emit('done');
}
</script>
