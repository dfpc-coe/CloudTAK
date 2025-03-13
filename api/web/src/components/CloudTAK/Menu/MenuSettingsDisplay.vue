<template>
    <MenuTemplate
        name='Display Preferences'
        :loading='loading'
    >
        <div class='mx-2'>
            <div class='col-12' >
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
    </MenuTemplate>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { ref, computed, toRaw, onMounted } from 'vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import { std } from '/src/std.ts';
import {
    TablerEnum,
} from '@tak-ps/vue-tabler';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

const router = useRouter();
const loading = ref(false);
const profile = ref({});
const profileSchema = ref({});

const tak_groups = computed(() => {
    return profileSchema.value.properties.tak_group.anyOf.map((a) => { return a.const });
})

const tak_roles = computed(() => {
    return profileSchema.value.properties.tak_role.anyOf.map((a) => { return a.const });
})

onMounted(async () => {
    loading.value = true;
    await fetchProfileSchema();
    profile.value = await mapStore.worker.profile.load();
    loading.value = false;
});

async function fetchProfileSchema() {
    profileSchema.value = (await std('/api/schema?method=PATCH&url=/profile')).body
}

async function updateProfile() {
    await mapStore.worker.profile.update(toRaw(profile.value));
    router.push("/menu/settings");
}
</script>
