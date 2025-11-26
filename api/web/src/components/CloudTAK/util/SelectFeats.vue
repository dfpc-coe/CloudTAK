<template>
    <div
        class='col-12'
        style='max-height: 400px'
    >
        <TablerLoading v-if='loading' />
        <template v-else-if='share === ShareType.NONE'>
            <div class='sticky-top col-12 d-flex align-items-center user-select-none'>
                <div class='subheader mx-2 my-2'>
                    Selected Features
                </div>
                <div class='ms-auto px-2'>
                    <TablerIconButton
                        title='Close'
                        @click='selected.clear()'
                    >
                        <IconX
                            :size='20'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>
            <div
                class='overflow-auto'
                style='
                    max-height: calc(400px - 36px);
                    margin-bottom: 36px;
                '
            >
                <div
                    v-for='select in selected.values()'
                    class='col-12'
                >
                    <DisplayFeature
                        :feature='select'
                        delete-action='emit'
                        @delete='selected.delete(select.id)'
                    />
                </div>
            </div>
            <div
                style='height: 36px; z-index: 2000;'
                class='position-absolute bottom-0 start-0 end-0 px-2 bg-dark'
            >
                <div class='d-flex align-items-center'>
                    <TablerButton
                        style='height: 30px; width: 200px;'
                        class='me-1 btn-sm'
                        @click='share = ShareType.USERS'
                    >
                        <IconPackageExport
                            :size='20'
                            stroke='1'
                        />
                        <span class='mx-2'>Share</span>
                    </TablerButton>
                    <TablerDropdown
                        position='top'
                    >
                        <TablerButton
                            title='More Options'
                            class='btn-sm'
                            style='height: 30px'
                        >
                            <IconDotsVertical
                                :size='20'
                                stroke='1'
                            />
                        </TablerButton>

                        <template #dropdown>
                            <div class='card'>
                                <div class='card-body'>
                                    <div
                                        class='cursor-pointer col-12 hover rounded d-flex align-items-center px-2'
                                        @click='share = ShareType.PACKAGE'
                                    >
                                        <IconPackages
                                            :size='32'
                                            stroke='1'
                                            class='me-2'
                                        />
                                        New Data Package
                                    </div>
                                    <div
                                        class='cursor-pointer col-12 hover rounded d-flex align-items-center px-2'
                                        @click='share = ShareType.MISSION'
                                    >
                                        <IconAmbulance
                                            :size='32'
                                            stroke='1'
                                            class='me-2'
                                        />
                                        Move to Data Sync
                                    </div>
                                    <div
                                        class='cursor-pointer col-12 hover rounded d-flex align-items-center px-2'
                                        @click='deleteFeatures'
                                    >
                                        <IconTrash
                                            :size='32'
                                            stroke='1'
                                            class='me-2'
                                        />
                                        Delete Features
                                    </div>
                                </div>
                            </div>
                        </template>
                    </TablerDropdown>
                </div>
            </div>
        </template>
        <template v-else-if='share === ShareType.USERS'>
            <Share
                :feats='Array.from(selected.values()).map((c) => c.as_feature())'
                @done='selected.clear()'
                @close='share = ShareType.NONE'
            />
        </template>
        <template v-else-if='share === ShareType.MISSION'>
            <ShareToMission
                action='move'
                :feats='Array.from(selected.values()).map((c) => c.as_feature())'
                @done='selected.clear()'
                @close='share = ShareType.NONE'
            />
        </template>
        <template v-else-if='share === ShareType.PACKAGE'>
            <ShareToPackage
                :feats='Array.from(selected.values()).map((c) => c.as_feature())'
                @done='selected.clear()'
                @close='share = ShareType.NONE'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import DisplayFeature from './FeatureRow.vue';
import COT from '../../../base/cot.ts';
import { useMapStore } from '../../../stores/map.ts';
import {
    IconPackageExport,
    IconDotsVertical,
    IconAmbulance,
    IconPackages,
    IconTrash,
    IconX,
} from '@tabler/icons-vue';
import {
    TablerButton,
    TablerLoading,
    TablerDropdown,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import Share from './Share.vue';
import ShareToMission from './ShareToMission.vue';
import ShareToPackage from './ShareToPackage.vue';

const mapStore = useMapStore();

const props = defineProps<{
    selected: Map<string, COT>
}>();

enum ShareType {
    NONE = 'none',
    MISSION = 'mission',
    PACKAGE = 'package',
    USERS = 'users'
}

const loading = ref(false);
const share = ref<ShareType>(ShareType.NONE);

async function deleteFeatures() {
    loading.value = true;

    for (const id of props.selected.keys()) {
        await mapStore.worker.db.remove(id);
    }

    props.selected.clear()

    loading.value = false;
}
</script>
