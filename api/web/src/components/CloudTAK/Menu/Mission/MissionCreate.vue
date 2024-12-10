<template>
    <div class='col-12'>
        <div class='modal-header'>
            <div class='row'>
                <div class='col-auto'>
                    <IconLock
                        v-if='mission.passwordProtected'
                        :size='32'
                        stroke='1'
                    />
                    <IconLockOpen
                        v-else
                        :size='32'
                        stroke='1'
                    />
                </div>
                <div class='col-auto row'>
                    <div class='col-12'>
                        <span>Create Mission</span>
                    </div>
                </div>
            </div>
        </div>
        <TablerLoading
            v-if='loading'
            desc='Saving Mission'
        />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <template v-else>
            <div class='modal-body row g-2'>
                <div class='col-12'>
                    <TablerInput
                        v-model='mission.name'
                        label='Name'
                    />
                </div>

                <div class='col-12'>
                    <label class='px-2 w-100'>Groups (Channels)</label>
                    <div
                        class='mx-1 d-flex'
                        style='padding-right: 15px;'
                    >
                        <input
                            type='text'
                            class='form-control'
                            disabled
                            :value='mission.groups.length ? mission.groups.join(", ") : "All Channels"'
                        >
                        <button
                            class='btn btn-sm'
                            @click='modal.groups = true'
                        >
                            <IconListSearch
                                :size='32'
                                stroke='1'
                                class='cursor-pointer mx-2'
                            />
                        </button>
                    </div>
                </div>

                <div class='col-12'>
                    <TablerInput
                        v-model='mission.description'
                        label='Description'
                    />
                </div>

                <label
                    class='subheader mt-3 cursor-pointer'
                    @click='advanced = !advanced'
                >
                    <IconSquareChevronRight
                        v-if='!advanced'
                        :size='32'
                        stroke='1'
                    />
                    <IconChevronDown
                        v-else
                        :size='32'
                        stroke='1'
                    />
                    Advanced Options
                </label>

                <div
                    v-if='advanced'
                    class='col-12'
                >
                    <div class='row g-2'>
                        <div class='col-12'>
                            <TablerToggle
                                v-model='mission.passwordProtected'
                                label='Password Protected'
                            />
                            <TablerInput
                                v-if='mission.passwordProtected'
                                v-model='mission.password'
                                :disabled='!mission.passwordProtected'
                                type='password'
                                label='Password'
                            />
                        </div>

                        <div class='col-12'>
                            <TablerEnum
                                v-model='mission.role'
                                label='Default Role'
                                :options='["Read-Only", "Subscriber", "Owner"]'
                            />
                        </div>
                    </div>
                </div>

                <div class='col-12 d-flex'>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='createMission'
                        >
                            Create Mission
                        </button>
                    </div>
                </div>
            </div>
        </template>

        <GroupSelect
            v-if='modal.groups'
            v-model='mission.groups'
            @close='modal.groups = false'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { std, stdurl } from '../../../../std.ts';
import type { Mission, Mission_Create } from '../../../../types.ts';
import { useMapStore } from '../../../../stores/map.ts'
import {
    IconLock,
    IconLockOpen,
    IconListSearch,
    IconSquareChevronRight,
    IconChevronDown,
} from '@tabler/icons-vue';
import GroupSelect from '../../../util/GroupSelectModal.vue';
import Overlay from '../../../../stores/base/overlay.ts';
import {
    TablerAlert,
    TablerInput,
    TablerEnum,
    TablerToggle,
    TablerLoading
} from '@tak-ps/vue-tabler';

const mapStore = useMapStore();
const emit = defineEmits(['mission']);

const error = ref<Error | undefined>();
const loading = ref(false);
const modal = ref({
    groups: false
});
const advanced = ref(false);
const mission = ref({
    name: '',
    password: '',
    passwordProtected: false,
    role: 'Subscriber',
    description: '',
    groups: [],
    hashtags: ''
});

async function createMission() {
    loading.value = true;
    try {
        loading.value = true;

        const url = stdurl(`/api/marti/missions/${mission.value.name}`);

        const body: Mission_Create = {
            group: mission.value.groups,
            description: mission.value.description || ''
        };

        if (mission.value.role === 'Subscriber') body.defaultRole = 'MISSION_SUBSCRIBER';
        if (mission.value.role === 'Read-Only') body.defaultRole = 'MISSION_READONLY_SUBSCRIBER';
        if (mission.value.role === 'Owner') body.defaultRole = 'MISSION_OWNER';

        if (mission.value.passwordProtected) body.password = mission.value.password;

        const res = await std(url, {
            method: 'POST',
            body
        }) as Mission;

        const missionOverlay = await Overlay.create(mapStore.map, {
            name: res.name,
            url: `/mission/${encodeURIComponent(res.name)}`,
            type: 'geojson',
            mode: 'mission',
            token: res.token,
            mode_id: res.guid,
        })

        mapStore.overlays.push(missionOverlay);

        await mapStore.loadMission(res.guid);

        emit('mission', res);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
    loading.value = false;
}
</script>
