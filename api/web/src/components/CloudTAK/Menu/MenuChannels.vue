<template>
    <MenuTemplate name='Channels'>
        <template #buttons>
            <TablerIconButton
                v-if='channels.length && mapStore.hasNoChannels'
                title='All Channels On'
                @click='setAllStatus(true)'
            >
                <IconEyePlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                v-if='channels.length && !mapStore.hasNoChannels'
                title='All Channels Off'
                @click='setAllStatus(false)'
            >
                <IconEyeX
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerRefreshButton
                :loading='syncing'
                @click='refresh'
            />
        </template>
        <template #default>
            <div class='col-12 pb-2 pt-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <EmptyInfo
                v-if='mapStore.hasNoChannels'
                :button='false'
            />

            <TablerNone
                v-if='!Object.keys(processChannels).length'
                :create='false'
            />
            <div
                v-else
                class='col-12 d-flex flex-column gap-2 py-3'
            >
                <StandardItem
                    v-for='ch in processChannels'
                    :key='ch.name'
                    class='d-flex align-items-center gap-3 p-2'
                    @click='setStatus(ch, !ch.active)'
                >
                    <div
                        class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'
                        style='width: 3rem; height: 3rem; min-width: 3rem;'
                    >
                        <component
                            :is='ch.active ? IconEye : IconEyeOff'
                            :size='24'
                            stroke='1'
                        />
                    </div>

                    <div class='d-flex flex-column'>
                        <div class='fw-bold'>
                            {{ ch.name }}
                        </div>
                        <div class='text-secondary small'>
                            {{ ch.description || "No Description" }}
                        </div>
                    </div>

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
                </StandardItem>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import type { Ref } from 'vue';
import { from } from 'rxjs';
import { useObservable } from '@vueuse/rxjs';
import type { GroupChannel } from '../../../../src/types.ts';
import GroupManager from '../../../base/group.ts';
import {
    TablerNone,
    TablerIconButton,
    TablerRefreshButton,
    TablerInput,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import EmptyInfo from '../util/EmptyInfo.vue';
import {
    IconLocation,
    IconLocationOff,
    IconEye,
    IconEyeX,
    IconEyePlus,
    IconEyeOff,
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();

const syncing = ref(false);
const paging = ref({
    filter: ''
});

const channels = useObservable(
    from(GroupManager.live()),
    { initialValue: [] }
) as Ref<GroupChannel[]>;

onMounted(async () => {
    await refresh();
});

const processChannels = computed<Record<string, GroupChannel>>(() => {
    const filteredChannels: Record<string, GroupChannel> = {};

    JSON.parse(JSON.stringify(channels.value))
        .sort((a: GroupChannel, b: GroupChannel) => {
            return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
        }).forEach((channel: GroupChannel) => {
            filteredChannels[channel.name] = channel;
        })

    for (const key of Object.keys(filteredChannels)) {
        if (!key.toLowerCase().includes(paging.value.filter.toLowerCase())) {
            delete filteredChannels[key];
        }
    }

    return filteredChannels;
});

async function refresh() {
    syncing.value = true;
    try {
        await GroupManager.sync();
    } finally {
        syncing.value = false;
    }
}

async function setAllStatus(active=true) {
    // Updating the API takes a perceptable amount of time so
    // we update the UI state to provide immediate feedback
    const updates = channels.value.map((ch) => {
        const char = JSON.parse(JSON.stringify(ch));
        char.active = active;
        return char;
    });

    await GroupManager.put(updates);

    await mapStore.worker.profile.setAllChannels(active);
}

async function setStatus(channel: GroupChannel, active=false) {
    const update: GroupChannel = { ...channel, active };
    await GroupManager.put(update);

    await mapStore.worker.profile.setChannel(channel.name, active);
}
</script>
