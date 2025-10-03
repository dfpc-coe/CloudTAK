<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                User Groups
            </h3>

            <div class='ms-auto btn-list'>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetch'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 60px'>
            <div class='col-12 px-2 py-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!Object.keys(processChannels).length'
                :create='false'
                label='Channels'
            />
            <div
                v-else
                class='table-responsive'
            >
                <table class='table card-table table-hover table-vcenter'>
                    <thead>
                        <tr>
                            <th>Group Name</th>
                            <th>Description</th>
                            <th>Attributes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='group in processChannels'
                            :key='group.name'
                        >
                            <td>
                                <div class='d-flex align-items-center'>
                                    <IconEye
                                        v-if='group.active'
                                        v-tooltip='"Disable"'
                                        :size='32'
                                        stroke='1'
                                        class='cursor-pointer'
                                        @click='setStatus(group, false)'
                                    />
                                    <IconEyeOff
                                        v-else
                                        v-tooltip='"Enable"'
                                        :size='32'
                                        stroke='1'
                                        class='cursor-pointer'
                                        @click='setStatus(group, true)'
                                    />
                                    <span
                                        class='mx-2'
                                        v-text='group.name'
                                    />
                                </div>
                            </td>
                            <td v-text='group.description' />
                            <td>
                                <IconLocation
                                    v-if='group.direction.length === 2'
                                    v-tooltip='"Bi-Directional"'
                                    :size='32'
                                    stroke='1'
                                />
                                <IconLocation
                                    v-else-if='group.direction.includes("IN")'
                                    v-tooltip='"Location Sharing"'
                                    :size='32'
                                    stroke='1'
                                />
                                <IconLocationOff
                                    v-else-if='group.direction.includes("OUT")'
                                    v-tooltip='"No Location Sharing"'
                                    :size='32'
                                    stroke='1'
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router';
import { std, stdurl } from '../../../std.ts';
import {
    IconEye,
    IconEyeOff,
    IconLocation,
    IconLocationOff,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerLoading,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';

const route = useRoute();

const error = ref();
const loading = ref(true);
const rawChannels = ref([]);

const paging = ref({
    filter: ''
})

const processChannels = computed(() => {
    const channels = {};

    JSON.parse(JSON.stringify(rawChannels.value)).sort((a, b) => {
        return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
    }).forEach((channel) => {
        if (channel.name.toLowerCase().includes(paging.value.filter.toLowerCase())) {
            if (channels[channel.name]) {
                channels[channel.name].direction.push(channel.direction);
            } else {
                channel.direction = [channel.direction];
                channels[channel.name] = channel;
            }
        }
    });

    return channels;
});

onMounted(async () => {
    await fetch();
});

async function fetch() {
    loading.value = true;
    error.value = undefined;

    try {
        rawChannels.value = (await std(`/api/connection/${route.params.connectionid}/channel`)).data;
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}

async function setStatus(channel, active=false) {
    rawChannels.value = rawChannels.value.map((ch) => {
        if (ch.name === channel.name) ch.active = active;
        return ch;
    });

    const url = stdurl('/api/marti/group');
    url.searchParams.append('connection', route.params.connectionid);
    await std(url, {
        method: 'PUT',
        body: rawChannels.value
    });
}
</script>
