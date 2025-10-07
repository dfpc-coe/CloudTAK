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
                <span
                    v-if='props.action === "add"'
                    class='mx-2'
                >Add to Data Sync</span>
                <span
                    v-if='props.action === "move"'
                    class='mx-2'
                >Move to Data Sync</span>
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
                            class='col-12 cursor-pointer hover py-2 rounded'
                            @click='selected.has(mission) ? selected.delete(mission) : selected.add(mission)'
                        >
                            <div class='d-flex align-items-center'>
                                <div class='col-auto'>
                                    <IconCheck
                                        v-if='selected.has(mission)'
                                        :size='32'
                                        stroke='1'
                                        style='margin-left: 16px;'
                                    />
                                    <IconAmbulance
                                        v-else
                                        :size='32'
                                        stroke='1'
                                        style='margin-left: 16px;'
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
                @click='emit("close")'
            >
                Cancel
            </TablerButton>

            <div class='ms-auto'>
                <TablerButton
                    v-tooltip='"Share to Selected"'
                    class='btn-primary'
                    :disabled='selected.size === 0'
                    @click='share'
                >
                    <IconShare2
                        :size='20'
                        stroke='1'
                        class='me-2'
                    />

                    <span v-if='props.action === "add"'>Add to Data Sync</span>
                    <span v-else-if='props.action === "move"'>Move to Data Sync</span>
                </TablerButton>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { OriginMode } from '../../../base/cot.ts';
import type { PropType } from 'vue';
import EmptyInfo from './EmptyInfo.vue';
import { v4 as randomUUID } from 'uuid';
import {
    TablerModal,
    TablerLoading,
    TablerButton,
} from '@tak-ps/vue-tabler';
import {
    IconCheck,
    IconAmbulance,
    IconShare2
} from '@tabler/icons-vue';
import type { Feature, Mission } from '../../../types.ts';
import { server } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

const props = defineProps({
    action: {
        type: String,
        default: 'add' // or "move"
    },
    feats: {
        type: Array as PropType<Array<Feature>>,
        default: () => []
    },
    assets: {
        type: Array as PropType<Array<{
            type: 'profile';
            id: string;
            name: string;
        }>>,
        default: () => []
    },
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
    loading.value = true;

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

        for (const mission of selected.value) {
            await mapStore.worker.db.remove(feat.properties.id);

            // Missions should never share IDs
            const id = randomUUID();
            feat.id = id;
            feat.properties.uid = id;

            feat.origin = {
                mode: OriginMode.MISSION,
                mode_id: mission.guid
            }

            await mapStore.worker.db.add(feat, {
                authored: true
            });
        }
    }

    if (props.assets.length) {
        for (const mission of selected.value) {
            const res = await server.PUT('/api/marti/missions/{:name}/upload', {
                params: {
                    path: {
                        ':name': mission.name
                    }
                },
                body: {
                    assets: props.assets
                }
            });

            if (res.error) {
                loading.value = false;
                throw new Error(res.error.message);
            }
        }
    }

    loading.value = false;

    emit('done');
    emit('close');
}
</script>
