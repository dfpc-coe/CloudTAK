<template>
    <MenuTemplate name='Channels'>
        <template #buttons>
            <TablerIconButton
                v-if='!loading && hasChannelsOn'
                title='All Channels On'
                @click='setAllStatus(true)'
            ><IconEyePlus :size='32' stroke='1'/></TablerIconButton>
            <TablerIconButton
                v-if='!loading && !hasChannelsOn'
                title='All Channels Off'
                @click='setAllStatus(false)'
            ><IconEyeX :size='32' stroke='1'/></TablerIconButton>

            <TablerIconButton
                v-if='!loading'
                title='Refresh'
                @click='profileStore.loadChannels'
            ><IconRefresh :size='32' stroke='1'/></TablerIconButton>
        </template>
        <template #default>
            <div
                v-if='!loading'
                class='col-12 px-2 pb-2 pt-2'
            >
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <EmptyInfo v-if='profileStore.hasNoChannels' />

            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!Object.keys(processChannels).length'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='ch in processChannels'
                    :key='ch.name'
                    class='col-lg-12 hover-dark'
                >
                    <div class='hover-dark'>
                        <div class='px-2'>
                            <div class='col-12 py-2 px-2 d-flex align-items-center'>
                                <IconEye
                                    v-if='ch.active'
                                    v-tooltip='"Disable"'
                                    :size='32'
                                    stroke='1'
                                    class='cursor-pointer'
                                    @click='setStatus(ch, false)'
                                />
                                <IconEyeOff
                                    v-else
                                    v-tooltip='"Enable"'
                                    :size='32'
                                    stroke='1'
                                    class='cursor-pointer'
                                    @click='setStatus(ch, true)'
                                />
                                <span
                                    v-tooltip='"Show Details"'
                                    class='mx-2 cursor-pointer'
                                    @click='shown.has(ch.name) ? shown.delete(ch.name) : shown.add(ch.name)'
                                    v-text='ch.name'
                                />

                                <div class='ms-auto'>
                                    <IconLocation
                                        v-if='ch.direction.length === 2'
                                        v-tooltip='"Bi-Directional"'
                                        :size='32'
                                        stroke='1'
                                    />
                                    <IconLocation
                                        v-else-if='ch.direction.includes("IN")'
                                        v-tooltip='"Location Sharing"'
                                        :size='32'
                                        stroke='1'
                                    />
                                    <IconLocationOff
                                        v-else-if='ch.direction.includes("OUT")'
                                        v-tooltip='"No Location Sharing"'
                                        :size='32'
                                        stroke='1'
                                    />
                                </div>
                            </div>
                            <div
                                v-if='shown.has(ch.name)'
                                class='col-12 pb-2 user-select-none'
                                style='margin-left: 40px;'
                            >
                                <span v-text='ch.description || "No Description"' />
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { std, stdurl } from '../../../../src/std.ts';
import type { Group } from '../../../../src/types.ts';
import {
    TablerNone,
    TablerIconButton,
    TablerInput,
    TablerAlert,
    TablerLoading
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import EmptyInfo from '../util/EmptyInfo.vue';
import {
    IconLocation,
    IconLocationOff,
    IconRefresh,
    IconEye,
    IconEyeX,
    IconEyePlus,
    IconEyeOff,
} from '@tabler/icons-vue';
import { useProfileStore } from '../../../../src/stores/profile.ts';
import { useCOTStore } from '../../../../src/stores/cots.ts';
const cotStore = useCOTStore();
const profileStore = useProfileStore();

const error = ref<Error | undefined>();
const loading = ref(true);
const shown = ref<Set<string>>(new Set());
const paging = ref({
    filter: ''
});

onMounted(async () => {
    await refresh();
});

const hasChannelsOn = computed<boolean>(() => {
    return profileStore.channels.some((ch) => {
        return !ch.active;
    })
});

const processChannels = computed<Record<string, Group>>(() => {
    const channels: Record<string, Group> = {};

    JSON.parse(JSON.stringify(profileStore.channels))
        .sort((a: Group, b: Group) => {
            return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
        }).forEach((channel: Group) => {
            if (channels[channel.name]) {
                // @ts-expect-error Type as an array eventually
                channels[channel.name].direction.push(channel.direction);
            } else {
                // @ts-expect-error Type as an array eventually
                channel.direction = [channel.direction];
                channels[channel.name] = channel;
            }
        })

    for (const key of Object.keys(channels)) {
        if (!key.toLowerCase().includes(paging.value.filter.toLowerCase())) {
            delete channels[key];
        }
    }

    return channels;
});

async function refresh() {
    loading.value = true;

    try {
        await profileStore.loadChannels();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

async function setAllStatus(active=true) {
    profileStore.channels = profileStore.channels.map((ch) => {
        ch.active = active;
        return ch;
    });

    await cotStore.clear({
        ignoreArchived: true,
        skipNetwork: false
    })

    const url = stdurl('/api/marti/group');
    await std(url, {
        method: 'PUT',
        body: profileStore.channels
    });
}

async function setStatus(channel: Group, active=false) {
    profileStore.channels = profileStore.channels.map((ch) => {
        if (ch.name === channel.name) ch.active = active;
        return ch;
    });

    await cotStore.clear({
        ignoreArchived: true,
        skipNetwork: false
    })

    const url = stdurl('/api/marti/group');
    await std(url, {
        method: 'PUT',
        body: profileStore.channels
    });
}
</script>
