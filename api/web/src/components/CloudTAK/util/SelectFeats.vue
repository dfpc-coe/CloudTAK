<template>
    <div
        v-if='share === ShareType.NONE'
        class='cloudtak-panel d-flex flex-column overflow-hidden'
        style='width: 250px; max-height: 400px;'
    >
        <TablerLoading v-if='loading' />
        <template v-else>
            <div class='d-flex align-items-center user-select-none border-bottom'>
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
            <div class='overflow-auto flex-grow-1'>
                <div
                    v-for='select in selected.values()'
                    class='col-12 px-1'
                >
                    <DisplayFeature
                        :feature='select'
                        delete-action='emit'
                        @delete='selected.delete(select.id)'
                    />
                </div>
            </div>
            <div class='d-flex align-items-center border-top px-2 py-1'>
                <TablerButton
                    style='height: 30px;'
                    class='me-1 btn-sm flex-grow-1'
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
                        <div class='py-1'>
                            <div
                                class='cursor-pointer col-12 cloudtak-hover rounded d-flex align-items-center px-2'
                                @click.stop='share = ShareType.PACKAGE'
                            >
                                <IconPackages
                                    :size='32'
                                    stroke='1'
                                    class='me-2'
                                />
                                New Data Package
                            </div>
                            <div
                                class='cursor-pointer col-12 cloudtak-hover rounded d-flex align-items-center px-2'
                                @click.stop='share = ShareType.MISSION'
                            >
                                <IconAmbulance
                                    :size='32'
                                    stroke='1'
                                    class='me-2'
                                />
                                Move to Data Sync
                            </div>
                            <div
                                class='cursor-pointer col-12 cloudtak-hover rounded d-flex align-items-center px-2'
                                @click.stop='deleteFeatures'
                            >
                                <IconTrash
                                    :size='32'
                                    stroke='1'
                                    class='me-2'
                                />
                                Delete Features
                            </div>
                        </div>
                    </template>
                </TablerDropdown>
            </div>
        </template>
    </div>
    <Share
        v-else-if='share === ShareType.USERS'
        :feats='Array.from(selected.values()).map((c) => c.as_feature())'
        @done='selected.clear()'
        @close='share = ShareType.NONE'
    />
    <ShareToMission
        v-else-if='share === ShareType.MISSION'
        action='move'
        :feats='Array.from(selected.values()).map((c) => c.as_feature())'
        @done='selected.clear()'
        @close='share = ShareType.NONE'
    />
    <ShareToPackage
        v-else-if='share === ShareType.PACKAGE'
        :feats='Array.from(selected.values()).map((c) => c.as_feature())'
        @done='selected.clear()'
        @close='share = ShareType.NONE'
    />
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
