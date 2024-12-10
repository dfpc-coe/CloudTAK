<template>
    <div class='col-12'>
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
                                v-tooltip='"User has Channel Enabled"'
                                :size='32'
                                stroke='1'
                            />
                            <IconEyeOff
                                v-else
                                v-tooltip='"User has Channel Disabled"'
                                :size='32'
                                stroke='1'
                            />
                            <span
                                v-tooltip='"Show Details"'
                                class='mx-2 cursor-pointer'
                                @click='shown[ch.name] = !shown[ch.name]'
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
                            v-if='shown[ch.name]'
                            class='col-12 pb-2 user-select-none'
                            style='margin-left: 40px;'
                        >
                            <span v-text='ch.description || "No Description"' />
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import type { Group } from '../../../../src/types.ts';
import type COT from '../../../../src/stores/base/cot.ts';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconLocation,
    IconLocationOff,
    IconEye,
    IconEyeOff,
} from '@tabler/icons-vue';

const props = defineProps<{
    cot: COT
}>();

const error = ref<Error | undefined>();
const loading = ref(true)
const shown = ref<Record<string, boolean>>({});
const channels = ref<Group[]>([]);
const paging = ref({
    filter: ''
});

onMounted(async () => {
    try {
        const sub = await props.cot.subscription();
        channels.value = sub.groups.sort((a, b) => {
            return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
        });
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
});

const processChannels = computed(() => {
    const channelsFiltered: Record<string, Group> = {};

    channels.value
        .forEach((channel: Group) => {
            if (channelsFiltered[channel.name]) {
                // @ts-expect-error Change to string eventually
                channelsFiltered[channel.name].direction.push(channel.direction);
            } else {
                // @ts-expect-error Change to string eventually
                channel.direction = [channel.direction];
                channelsFiltered[channel.name] = channel;
            }
        })

    for (const key of Object.keys(channelsFiltered)) {
        if (!key.toLowerCase().includes(paging.value.filter.toLowerCase())) {
            delete channelsFiltered[key];
        }
    }

    return channelsFiltered;
});
</script>
