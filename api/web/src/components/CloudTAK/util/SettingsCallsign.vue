<template>
    <TablerLoading v-if='loading || !profile' />
    <template v-else>
        <div class='col-12'>
            <TablerInput
                v-model='profile.tak_callsign'
                label='User Callsign'
            />
        </div>
        <div class='col-12'>
            <TablerEnum
                v-model='profile.tak_group'
                label='User Group'
                :options='tak_groups'
            />
        </div>
        <div class='col-12'>
            <TablerEnum
                v-model='profile.tak_role'
                label='User Role'
                :options='config.roles'
            />
        </div>
        <div v-if='mode === "router"' class='col-12'>
            <TablerInput
                label='Location Reporting Frequency'
                v-model='profile.tak_loc_freq'
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
    </template>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { Profile, Profile_Update, ConfigGroups } from '../../../../src/types.ts';
import { std } from '../../../../src/std.ts';
import {
    TablerInput,
    TablerEnum,
    TablerLoading
} from '@tak-ps/vue-tabler';
import { useProfileStore } from '../../../../src/stores/profile.ts';
const profileStore = useProfileStore();

const props = defineProps({
    mode: {
        type: String,
        default: 'router'
    }
})

const emit = defineEmits([ 'update' ]);

const loading = ref(true);
const profile = ref<Profile | undefined>();
const config = ref<ConfigGroups>({
    groups: {},
    roles: []
});

const router = useRouter();

const tak_groups = computed(() => {
    const groups = [];
    for (const g in config.value.groups) {
        if (config.value.groups[g]) {
            groups.push(`${g} - ${config.value.groups[g]}`);
        } else {
            groups.push(g);
        }
    }

    return groups;
});

onMounted(async () => {
    loading.value = true;
    await fetchConfig();
    await profileStore.load();
    const profile = JSON.parse(JSON.stringify(profileStore.profile));

    if (config.value.groups[profile.tak_group]) {
        profile.tak_group = `${profile.tak_group} - ${config.value.groups[profile.tak_group]}`;
    }

    profile.value = profile;
    loading.value = false;
});

async function fetchConfig() {
    const c = await std('/api/config/group') as ConfigGroups;
    const groups: Record<string, string> = {};
    for (const key in c.groups) {
        groups[key.replace('group::', '')] = c.groups[key];
    }

    config.value = {
        groups,
        roles: c.roles
    };
}

async function updateProfile() {
    const p = JSON.parse(JSON.stringify(profile.value)) as Profile;

    p.tak_group = p.tak_group.replace(/\s-\s.*$/, '');

    await profileStore.update(p);
    if (props.mode === 'router') {
        router.push("/menu/settings");
    } else {
        emit('update');
    }
}
</script>
