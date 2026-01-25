<template>
    <MenuTemplate
        name='Display Preferences'
        :loading='loading || !profile'
    >
        <template v-if='profile'>
            <div class='mx-2'>
                <div class='col-12'>
                    <TablerEnum
                        v-model='profile.display_stale'
                        label='Remove Stale Elements'
                        :options='[
                            "Immediate",
                            "10 Minutes",
                            "30 Minutes",
                            "1 Hour",
                            "Never"
                        ]'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-model='profile.display_text'
                        label='Text Size'
                        :options='[
                            "Small",
                            "Medium",
                            "Large"
                        ]'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-model='profile.display_distance'
                        label='Distance Unit'
                        :options='[
                            "meter",
                            "kilometer",
                            "mile"
                        ]'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-model='profile.display_elevation'
                        label='Elevation Unit'
                        :options='[
                            "meter",
                            "feet"
                        ]'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-model='profile.display_speed'
                        label='Speed Unit'
                        :options='[
                            "m/s",
                            "km/h",
                            "mi/h"
                        ]'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-model='profile.display_projection'
                        label='Display Projection'
                        :options='[
                            "globe",
                            "mercator"
                        ]'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-model='profile.display_zoom'
                        label='Display Zoom Controls'
                        :options='[
                            "always",
                            "conditional",
                            "never"
                        ]'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-model='profile.display_icon_rotation'
                        label='Rotate Icons with Course'
                        :options='[true, false]'
                    />
                </div>
                <div class='col-12 d-flex py-3'>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='updateProfile'
                        >
                            Update
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import { ref, toRaw, onMounted } from 'vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import type { Profile } from '../../../types.ts';
import {
    TablerEnum,
} from '@tak-ps/vue-tabler';
import { useMapStore } from '../../../stores/map.ts';
import ProfileConfig from '../../../base/profile.ts';
const mapStore = useMapStore();

const router = useRouter();
const loading = ref(false);
const profile = ref<Profile | undefined>();

async function getProfile() {
    return {
        display_stale: (await ProfileConfig.get('display_stale'))?.value,
        display_text: (await ProfileConfig.get('display_text'))?.value,
        display_distance: (await ProfileConfig.get('display_distance'))?.value,
        display_elevation: (await ProfileConfig.get('display_elevation'))?.value,
        display_speed: (await ProfileConfig.get('display_speed'))?.value,
        display_projection: (await ProfileConfig.get('display_projection'))?.value,
        display_zoom: (await ProfileConfig.get('display_zoom'))?.value,
        display_icon_rotation: (await ProfileConfig.get('display_icon_rotation'))?.value,
    } as Profile;
}

onMounted(async () => {
    loading.value = true;
    profile.value = await getProfile();
    loading.value = false;
});

async function updateProfile() {
    if (!profile.value) return;

    await mapStore.worker.profile.update(toRaw(profile.value));

    // Update distance unit
    mapStore.updateDistanceUnit(profile.value.display_distance);

    // Immediately update icon rotation to avoid requiring page reload
    mapStore.updateIconRotation(profile.value.display_icon_rotation as unknown as boolean);

    // Refresh profile data to reflect persisted changes
    profile.value = await getProfile();

    router.push("/menu/settings");
}
</script>
