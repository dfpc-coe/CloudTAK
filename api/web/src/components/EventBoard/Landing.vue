<template>
    <div class='h-100 overflow-auto px-4 py-4 event-board-landing'>
        <div class='mx-auto event-board-landing-body'>
            <div class='d-flex align-items-center gap-2 mb-1'>
                <IconLayoutKanban
                    :size='28'
                    stroke='1'
                />
                <h2 class='mb-0'>
                    Event Boards
                </h2>
            </div>
            <p class='text-secondary mb-4'>
                Every Channel has an Event Board where Events nominated to it
                are tracked. Pick a Channel to open its Board - or nominate an
                Event to a Channel from the Event itself.
            </p>

            <template v-if='props.channels.length'>
                <div class='d-flex align-items-center mb-3'>
                    <h3 class='mb-0 me-auto'>
                        Your Channels
                    </h3>
                    <TablerInput
                        v-if='props.channels.length > 6'
                        v-model='search'
                        class='event-board-landing-search'
                        placeholder='Filter Channels'
                        icon='search'
                    />
                </div>

                <div
                    v-if='filtered.length'
                    class='row g-3'
                >
                    <div
                        v-for='channel in filtered'
                        :key='channel.bitpos'
                        class='col-12 col-sm-6 col-lg-4'
                    >
                        <StandardItemChannel
                            :channel='channel'
                            :title='`Open the ${channel.name} Event Board`'
                            @click='emit("select", channel.bitpos)'
                        >
                            <template #actions>
                                <IconChevronRight
                                    :size='18'
                                    stroke='1'
                                    class='flex-shrink-0 text-secondary'
                                />
                            </template>
                        </StandardItemChannel>
                    </div>
                </div>
                <TablerNone
                    v-else
                    label='No Channels match your filter'
                    :create='false'
                />
            </template>

            <StandardItem
                v-else
                class='d-flex align-items-center gap-3 p-3'
                :hover='false'
            >
                <IconAlertCircle
                    :size='32'
                    stroke='1'
                    class='text-red flex-shrink-0'
                />
                <div class='me-auto'>
                    <div class='fw-bold'>
                        No Channels are active
                    </div>
                    <div class='text-secondary'>
                        Event Boards belong to Channels - activate one to see its Board.
                    </div>
                </div>
                <button
                    class='btn btn-primary flex-shrink-0'
                    @click='router.push("/menu/channels")'
                >
                    Manage Channels
                </button>
            </StandardItem>
        </div>
    </div>
</template>

<script setup lang='ts'>
/**
 * Landing shown by the Event Board shell until a Channel is picked - lists the
 * user's active Channels as a shortcut into their Boards
 */

import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import type { GroupSelectChannel } from '../CloudTAK/util/GroupSelectDropdown.vue';
import StandardItem from '../CloudTAK/util/StandardItem.vue';
import StandardItemChannel from '../CloudTAK/util/StandardItemChannel.vue';
import {
    IconAlertCircle,
    IconChevronRight,
    IconLayoutKanban,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerInput,
} from '@tak-ps/vue-tabler';

const router = useRouter();

const props = defineProps<{
    channels: Array<GroupSelectChannel>;
}>();

const emit = defineEmits<{
    (e: 'select', channel: number): void;
}>();

const search = ref('');

const filtered = computed<Array<GroupSelectChannel>>(() => {
    const term = search.value.trim().toLowerCase();

    if (!term) return props.channels;

    return props.channels.filter((channel) => channel.name.toLowerCase().includes(term));
});
</script>

<style>
.event-board-landing-body {
    max-width: 960px;
}

.event-board-landing-search {
    width: 220px;
}
</style>
