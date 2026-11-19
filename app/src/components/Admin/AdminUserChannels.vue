<template>
    <div
        class='col-lg-12 cloudtak-hover py-2 mt-2 cursor-pointer d-flex align-items-center'
        @click='toggle'
    >
        <IconChevronDown v-if='isOpen' />
        <IconChevronRight v-else />

        <span class='mx-2 user-select-none'>Channels</span>

        <span
            v-if='loaded'
            class='badge bg-blue-lt'
            v-text='`${activeCount} / ${channels.length} Active`'
        />
    </div>
    <div
        v-if='isOpen'
        class='col-lg-12 card-body border rounded'
    >
        <div class='d-flex align-items-center pb-2'>
            <div class='flex-grow-1 me-2'>
                <TablerInput
                    v-model='filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchChannels'
            />
        </div>

        <TablerLoading v-if='loading' />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <TablerNone
            v-else-if='!visibleChannels.length'
            :create='false'
            label='No Channels'
        />
        <div
            v-else
            class='row row-cards'
        >
            <div
                v-for='channel in visibleChannels'
                :key='channel.name'
                class='col-12 col-md-6'
            >
                <StandardItemChannel
                    :channel='channel'
                    :class='{ "opacity-50": saving }'
                    @click='setStatus(channel, !channel.active)'
                >
                    <template #actions>
                        <span
                            v-if='channel.partial'
                            class='badge bg-yellow-lt flex-shrink-0'
                            :title='`Only the ${channel.partial} direction is active`'
                            v-text='`${channel.partial} only`'
                        />
                    </template>
                </StandardItemChannel>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { server } from '../../std.ts';
import GroupManager from '../../base/group.ts';
import type { Group, GroupChannel } from '../../types.ts';
import StandardItemChannel from '../CloudTAK/util/StandardItemChannel.vue';
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerLoading,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import {
    IconChevronDown,
    IconChevronRight,
} from '@tabler/icons-vue';

const props = defineProps<{
    username: string;
}>();

type AdminChannel = GroupChannel & { partial?: string };

const isOpen = ref(false);
const loaded = ref(false);
const loading = ref(false);
const saving = ref(false);
const error = ref<Error | undefined>();
const filter = ref('');
const groups = ref<Group[]>([]);

const channels = computed<AdminChannel[]>(() => {
    return GroupManager.merge(groups.value).map((channel) => {
        const active = groups.value.filter((g) => g.name === channel.name && g.active);

        return {
            ...channel,
            active: active.length > 0,
            partial: active.length && active.length < channel.direction.length
                ? active.map((g) => g.direction).join(', ')
                : undefined
        };
    }).sort((a, b) => a.name.localeCompare(b.name));
});

const activeCount = computed(() => channels.value.filter((c) => c.active).length);

const visibleChannels = computed(() => {
    const term = filter.value.toLowerCase();
    return channels.value.filter((c) => c.name.toLowerCase().includes(term));
});

async function toggle(): Promise<void> {
    isOpen.value = !isOpen.value;
    if (isOpen.value && !loaded.value) await fetchChannels();
}

async function fetchChannels(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    const res = await server.GET('/api/marti/group', {
        params: {
            query: {
                impersonate: props.username,
                useCache: true
            }
        }
    });

    if (res.error) {
        error.value = new Error(res.error.message);
    } else {
        groups.value = res.data.data;
        loaded.value = true;
    }

    loading.value = false;
}

async function setStatus(channel: AdminChannel, active: boolean): Promise<void> {
    if (saving.value) return;
    saving.value = true;
    error.value = undefined;

    const body = groups.value.map((g) => {
        return g.name === channel.name ? { ...g, active } : g;
    });

    const res = await server.PUT('/api/marti/group', {
        params: {
            query: {
                impersonate: props.username
            }
        },
        body
    });

    saving.value = false;

    if (res.error) {
        error.value = new Error(res.error.message);
        return;
    }

    await fetchChannels();
}
</script>
