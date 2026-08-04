<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Channels'
        >
            <template #icon>
                <IconAffiliate
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <TablerIconButton
                    v-if='props.edit && !editing'
                    title='Edit Channels'
                    class='me-2'
                    @click.stop='startEditing'
                >
                    <IconPencil
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    v-else-if='props.edit'
                    title='Save Channels'
                    class='me-2'
                    @click.stop='save'
                >
                    <IconCheck
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerBadge
                    class='me-2'
                    background-color='rgba(59, 130, 246, 0.15)'
                    border-color='rgba(59, 130, 246, 0.4)'
                    text-color='#3b82f6'
                >
                    {{ props.modelValue.length }}
                </TablerBadge>
            </template>

            <!-- SlideDownHeader owns the section's surface & bottom padding -
                 rows sit directly on it rather than in a second box -->
            <div class='px-2 pt-2'>
                <TablerLoading
                    v-if='loading'
                    :compact='true'
                    desc='Loading Channels'
                />
                <div
                    v-else-if='editing'
                    class='overflow-auto'
                    style='max-height: 250px;'
                >
                    <GroupSelect v-model='selected' />
                </div>
                <template v-else>
                    <TablerNone
                        v-if='!shared.length'
                        label='Not shared with any Channels'
                        :compact='true'
                        :create='false'
                    />

                    <div
                        v-for='channel of shared'
                        :key='channel.bitpos'
                        class='mb-2'
                    >
                        <div class='d-flex align-items-center gap-2 px-2 py-1'>
                            <IconUsersGroup
                                :size='18'
                                stroke='1.5'
                                class='flex-shrink-0 text-secondary'
                            />
                            <span
                                class='fw-medium text-truncate user-select-none'
                                :title='channel.name'
                                v-text='channel.name'
                            />
                        </div>

                        <!-- Boards the Channel carries & where this Event sits on each -->
                        <div
                            v-if='channel.boards.length'
                            class='d-flex flex-column'
                        >
                            <div
                                v-for='board of channel.boards'
                                :key='board.id'
                                class='d-flex align-items-center gap-2 ps-4 pe-2 py-1 cursor-pointer cloudtak-hover'
                                role='button'
                                tabindex='0'
                                :title='`Open ${board.name} in the Event Board`'
                                @click='openBoard(board)'
                                @keydown.enter='openBoard(board)'
                            >
                                <IconLayoutKanban
                                    :size='18'
                                    stroke='1.5'
                                    class='flex-shrink-0 text-secondary'
                                />
                                <span
                                    class='text-truncate'
                                    style='min-width: 0;'
                                    v-text='board.name'
                                />
                                <IconExternalLink
                                    :size='14'
                                    stroke='1'
                                    class='flex-shrink-0 text-secondary cloudtak-hover-hidden'
                                />
                                <div class='ms-auto ps-2 flex-shrink-0'>
                                    <TablerBadge
                                        v-if='columnOf(board)'
                                        :background-color='badge(columnOf(board)).background'
                                        :border-color='badge(columnOf(board)).border'
                                        :text-color='badge(columnOf(board)).text'
                                    >
                                        {{ columnOf(board)?.name }}
                                    </TablerBadge>
                                    <span
                                        v-else
                                        class='small text-secondary user-select-none'
                                    >Not Nominated</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, watch } from 'vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import GroupSelect from '../../util/GroupSelect.vue';
import GroupManager from '../../../base/group.ts';
import { openSecondaryView } from '../../../base/capacitor.ts';
import type { GroupChannel, CoreEventBoardSummary, CoreEventBoardColumnSummary } from '../../../types.ts';
import { TablerNone, TablerBadge, TablerLoading, TablerIconButton } from '@tak-ps/vue-tabler';
import {
    IconAffiliate,
    IconPencil,
    IconCheck,
    IconUsersGroup,
    IconExternalLink,
    IconLayoutKanban,
} from '@tabler/icons-vue';

const props = defineProps<{
    /** TAK Server Channel bitpositions the Event is shared with */
    modelValue: Array<number>;
    /** Boards of the Event's Channels & the Column the Event sits in on each */
    boards?: Array<CoreEventBoardSummary>;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: Array<number>): void
}>();

const expanded = ref(true);
const editing = ref(false);
const loading = ref(true);
const channels = ref<Array<GroupChannel>>([]);
const selected = ref<Array<string>>([]);

// A Channel the user can't see resolves to no name - the bitpos is shown so
// the Event doesn't appear to be shared with fewer Channels than it is
const shared = computed(() => {
    return props.modelValue.map((bitpos) => {
        const channel = channels.value.find((c) => c.bitpos === bitpos);

        return {
            bitpos,
            name: channel ? channel.name : `Channel ${bitpos}`,
            boards: (props.boards || []).filter((board) => board.channel === bitpos),
        };
    });
});

onMounted(async () => {
    channels.value = await GroupManager.list();
    loading.value = false;
});

watch(() => props.modelValue, () => {
    editing.value = false;
});

/** Open the Event Board page focused on the given Board in a new tab */
function openBoard(board: CoreEventBoardSummary): void {
    const url = new URL('/board', window.location.origin);

    url.searchParams.append('channel', String(board.channel));
    url.searchParams.append('board', board.id);

    void openSecondaryView(url);
}

/** The Column of the Board this Event is currently placed in, if any */
function columnOf(board: CoreEventBoardSummary): CoreEventBoardColumnSummary | undefined {
    if (!board.column) return undefined;

    return board.columns.find((column) => column.id === board.column);
}

function badge(column?: CoreEventBoardColumnSummary): { background: string, border: string, text: string } {
    const base = (column && column.color) || '#667382';

    return {
        background: `color-mix(in srgb, ${base} 18%, transparent)`,
        border: `color-mix(in srgb, ${base} 45%, transparent)`,
        // Pulling the label toward the body colour keeps a dark Column colour
        // legible on the dark theme and a light one legible on the light theme
        text: `color-mix(in srgb, ${base} 65%, var(--tblr-body-color))`,
    };
}

function startEditing(): void {
    selected.value = channels.value
        .filter((channel) => props.modelValue.includes(channel.bitpos))
        .map((channel) => channel.name);
    editing.value = true;
    expanded.value = true;
}

function save(): void {
    const bitpos = channels.value
        .filter((channel) => selected.value.includes(channel.name))
        .map((channel) => channel.bitpos);

    // Channels the user can't see aren't in the selector - preserve them or
    // saving would silently unshare the Event from them
    const hidden = props.modelValue.filter((channel) => {
        return !channels.value.some((c) => c.bitpos === channel);
    });

    editing.value = false;

    emit('update:modelValue', [...new Set([...bitpos, ...hidden])].sort((a, b) => a - b));
}
</script>
