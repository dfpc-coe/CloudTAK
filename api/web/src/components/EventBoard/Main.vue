<template>
    <div class='h-full w-full cloudtak-page d-flex flex-column event-board'>
        <NavHeader>
            <template #left>
                <TablerDropdown
                    v-if='selectedBoard'
                    :width='170'
                >
                    <TablerIconButton title='Board Options'>
                        <IconDotsVertical
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <template #dropdown>
                        <div
                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                            @click='editBoard = selectedBoard'
                        >
                            <IconPencil
                                :size='20'
                                stroke='1'
                            />
                            <span class='mx-2'>Edit Board</span>
                        </div>
                        <div
                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                            @click='addBoard = true'
                        >
                            <IconPlus
                                :size='20'
                                stroke='1'
                            />
                            <span class='mx-2'>New Board</span>
                        </div>
                        <TablerDelete
                            v-if='boards.length > 1'
                            class='cloudtak-hover event-board-menu-delete'
                            displaytype='menu'
                            label='Delete Board'
                            title='Delete Board'
                            @delete='deleteBoard(selectedBoard)'
                        />
                    </template>
                </TablerDropdown>

                <GroupSelectDropdown
                    v-model='channel'
                    class='event-board-select'
                    :active='true'
                    @channels='onChannels'
                />

                <BoardSelectDropdown
                    v-if='channel !== undefined'
                    ref='boardSelect'
                    v-model='board'
                    class='event-board-select'
                    :channel='channel'
                    @boards='onBoards'
                    @error='error = $event'
                    @update:model-value='onBoardChange'
                />
            </template>

            <TablerIconButton
                title='Create Event'
                :disabled='channel === undefined || loading'
                @click='openCreate'
            >
                <IconPlus
                    :size='24'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                title='Nominate Event'
                :disabled='!nominatedColumn || loading'
                @click='openNominate'
            >
                <IconStackPush
                    :size='24'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                title='Refresh Board'
                @click='refresh'
            >
                <IconRefresh
                    :size='24'
                    stroke='1'
                />
            </TablerIconButton>

            <div
                class='btn-group flex-shrink-0'
                role='group'
                aria-label='View Mode'
            >
                <button
                    type='button'
                    class='btn btn-icon'
                    :class='mode === "board" ? "btn-secondary" : "btn-outline-secondary"'
                    title='Board View'
                    @click='setMode("board")'
                >
                    <IconLayoutKanban
                        :size='20'
                        stroke='1'
                    />
                </button>
                <button
                    type='button'
                    class='btn btn-icon'
                    :class='mode === "list" ? "btn-secondary" : "btn-outline-secondary"'
                    title='List View'
                    @click='setMode("list")'
                >
                    <IconList
                        :size='20'
                        stroke='1'
                    />
                </button>
            </div>
        </NavHeader>

        <div class='flex-grow-1 overflow-hidden'>
            <div
                v-if='loading'
                class='d-flex align-items-center justify-content-center h-100'
            >
                <TablerLoading desc='Loading Event Board' />
            </div>
            <div
                v-else-if='error'
                class='d-flex align-items-center justify-content-center h-100'
            >
                <TablerAlert
                    title='Event Board Error'
                    :err='error'
                />
            </div>
            <div
                v-else-if='channel === undefined'
                class='d-flex align-items-center justify-content-center h-100'
            >
                <TablerNone
                    label='Select a Channel to view its Event Board'
                    :create='false'
                />
            </div>
            <ViewBoard
                v-else-if='mode === "board"'
                v-model:columns='columns'
                :board='board'
                :channel='channel'
                @error='error = $event'
                @refresh='listColumns'
                @open-event='openEvent'
            />
            <ViewList
                v-else
                v-model:columns='columns'
                @error='error = $event'
                @open-event='openEvent'
            />
        </div>

        <NominateModal
            v-if='nominate && channel !== undefined'
            :channel='channel'
            :placed='placedEvents'
            @nominate='nominateEvent($event)'
            @close='nominate = false'
        />

        <CreateCoreEvent
            v-if='createEvent && channel !== undefined'
            :channel='channel'
            :navigate='false'
            @create='onEventCreated($event)'
            @close='createEvent = false'
        />

        <FormWizard
            v-if='formWizard'
            :event-id='formWizard.event.id'
            :event-name='formWizard.event.name'
            :forms='formWizard.forms'
            @complete='completeFormWizard'
            @close='formWizard = undefined'
        />

        <EditBoardModal
            v-if='editBoard || addBoard'
            :board='addBoard ? undefined : editBoard'
            @save='addBoard ? createBoard($event) : saveBoard($event)'
            @close='editBoard = undefined; addBoard = false'
        />

        <TablerModal
            v-if='viewEvent'
            size='xl'
        >
            <div
                class='d-flex flex-column overflow-hidden px-2 py-2 event-board-event-modal'
            >
                <CoreEventView
                    :event-id='viewEvent'
                    @close='closeEvent'
                />
            </div>
        </TablerModal>
    </div>
</template>

<script setup lang='ts'>
/**
 * EventBoard - Board of Core Events nominated to a TAK Channel. Every Channel
 * has an automatically managed Board and every Board an automatically managed
 * "Nominated" Column (renameable) that nominations land in - users can add
 * further Boards & Columns and move Events between them.
 *
 * This shell owns Channel/Board selection and the Column data - rendering is
 * delegated to ViewBoard (KanBan) or ViewList (spreadsheet) via the view mode
 * switcher in the header.
 */

import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { server } from '../../std.ts';
import type { CoreForm, CoreEvent, CoreEventBoard, CoreEventBoardEvent } from '../../types.ts';
import type { BoardColumn } from './types.ts';
import { missingRequiredForms } from '../../utils/column-forms.ts';
import FormWizard from '../CloudTAK/util/FormWizard.vue';
import NavHeader from '../util/NavHeader.vue';
import GroupSelectDropdown from '../CloudTAK/util/GroupSelectDropdown.vue';
import type { GroupSelectChannel } from '../CloudTAK/util/GroupSelectDropdown.vue';
import BoardSelectDropdown from '../CloudTAK/util/BoardSelectDropdown.vue';
import CoreEventView from '../CloudTAK/CoreEventView.vue';
import CreateCoreEvent from '../CloudTAK/util/CreateCoreEvent.vue';
import NominateModal from './NominateModal.vue';
import EditBoardModal from './EditBoardModal.vue';
import ViewBoard from './ViewBoard.vue';
import ViewList from './ViewList.vue';
import {
    IconPlus,
    IconList,
    IconPencil,
    IconRefresh,
    IconStackPush,
    IconDotsVertical,
    IconLayoutKanban,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerModal,
    TablerDelete,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref<Error | undefined>();

const channel = ref<number | undefined>();

const boards = ref<Array<CoreEventBoard>>([]);
const board = ref<string | undefined>();
const boardSelect = ref<InstanceType<typeof BoardSelectDropdown> | null>(null);
const columns = ref<Array<BoardColumn>>([]);

const mode = ref<'board' | 'list'>(route.query.view === 'list' ? 'list' : 'board');

const nominate = ref(false);
const createEvent = ref(false);

/** A nomination held back by required Forms - completed by the FormWizard */
const formWizard = ref<{
    forms: Array<CoreForm>;
    event: CoreEvent;
} | undefined>();
const addBoard = ref(false);
const editBoard = ref<CoreEventBoard | undefined>();
const viewEvent = ref<string | undefined>();

const selectedBoard = computed<CoreEventBoard | undefined>(() => {
    return boards.value.find((b) => b.id === board.value);
});

const placedEvents = computed<Set<string>>(() => {
    const placed = new Set<string>();
    for (const column of columns.value) {
        for (const placement of column.events) {
            placed.add(placement.event.id);
        }
    }
    return placed;
});

const nominatedColumn = computed<BoardColumn | undefined>(() => {
    return columns.value.find((column) => column.type === 'nominated');
});

/**
 * The Channel selector owns the Channel fetch - the initial selection can only
 * be resolved once it hands the list over
 */
function onChannels(list: Array<GroupSelectChannel>): void {
    if (channel.value !== undefined) return;

    const query = parseInt(String(route.query.channel), 10);

    if (!isNaN(query) && list.some((ch) => ch.bitpos === query)) {
        channel.value = query;
    } else if (list.length === 1) {
        channel.value = list[0].bitpos;
    } else {
        loading.value = false;
    }
}

// The Board selector watches the Channel itself and calls back through
// `onBoards` once it has re-listed
watch(channel, () => {
    loading.value = true;
});

/**
 * Listing Boards is owned by the selector - resolving which one is shown stays
 * here since the URL and a freshly created Board both feed into it
 */
function onBoards(list: Array<CoreEventBoard>): void {
    boards.value = list;

    const query = String(route.query.board || '');

    if (board.value && list.some((b) => b.id === board.value)) {
        // The current selection survived the re-list
    } else if (list.some((b) => b.id === query)) {
        board.value = query;
    } else {
        board.value = list.length ? list[0].id : undefined;
    }

    syncQuery();

    void listColumns();
}

async function onBoardChange(id: string): Promise<void> {
    board.value = id;

    syncQuery();

    loading.value = true;

    await listColumns();
}

function setMode(update: 'board' | 'list'): void {
    mode.value = update;

    syncQuery();
}

function syncQuery(): void {
    const query: Record<string, string> = {};

    if (channel.value !== undefined) query.channel = String(channel.value);
    if (board.value !== undefined) query.board = board.value;
    if (mode.value !== 'board') query.view = mode.value;

    void router.replace({ query });
}

/** Re-listing the Boards cascades into the Columns via `onBoards` */
async function refresh(): Promise<void> {
    if (channel.value === undefined) return;

    loading.value = true;
    error.value = undefined;

    await boardSelect.value?.refresh();
}

async function listColumns(): Promise<void> {
    if (!board.value) {
        columns.value = [];
        loading.value = false;
        return;
    }

    try {
        error.value = undefined;

        const [cols, placements] = await Promise.all([
            server.GET('/api/board/column', {
                params: { query: { board: board.value } }
            }),
            server.GET('/api/board/event', {
                params: { query: { board: board.value } }
            }),
        ]);

        if (cols.error) throw new Error(cols.error.message);
        if (placements.error) throw new Error(placements.error.message);

        const byColumn = new Map<string, Array<CoreEventBoardEvent>>();
        for (const placement of placements.data.items as Array<CoreEventBoardEvent>) {
            const arr = byColumn.get(placement.column) || [];
            arr.push(placement);
            byColumn.set(placement.column, arr);
        }

        columns.value = cols.data.items.map((column) => {
            return { ...column, events: byColumn.get(column.id) || [] };
        });

        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function createBoard(update: { name: string; description: string }): Promise<void> {
    addBoard.value = false;

    if (channel.value === undefined) return;

    try {
        const res = await server.POST('/api/board', {
            body: {
                channel: channel.value,
                ...update,
            }
        });

        if (res.error) throw new Error(res.error.message);

        // Selecting before the re-list means `onBoards` keeps the new Board
        board.value = res.data.id;

        await refresh();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function saveBoard(update: { name: string; description: string }): Promise<void> {
    const existing = editBoard.value;
    editBoard.value = undefined;

    if (!existing) return;

    try {
        const res = await server.PATCH('/api/board/{:board}', {
            params: { path: { ':board': existing.id } },
            body: update
        });

        if (res.error) throw new Error(res.error.message);

        // The selector holds the Board list - re-list so the rename shows
        await boardSelect.value?.refresh();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function deleteBoard(existing?: CoreEventBoard): Promise<void> {
    if (!existing) return;

    try {
        const res = await server.DELETE('/api/board/{:board}', {
            params: { path: { ':board': existing.id } }
        });

        if (res.error) throw new Error(res.error.message);

        // Dropping the selection lets `onBoards` fall through to the first
        // remaining Board of the Channel
        board.value = undefined;

        await refresh();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

// TablerIconButton doesn't block clicks while disabled - guard here
function openNominate(): void {
    if (!nominatedColumn.value || loading.value) return;
    nominate.value = true;
}

function openCreate(): void {
    if (channel.value === undefined || loading.value) return;
    createEvent.value = true;
}

/**
 * Events created from the Board are nominated straight onto it - unless the
 * user unshared the Board's Channel in the create modal
 */
async function onEventCreated(event: CoreEvent): Promise<void> {
    if (channel.value === undefined || !event.channels.includes(channel.value)) return;

    await nominateEvent(event);
}

async function nominateEvent(event: CoreEvent): Promise<void> {
    const column = nominatedColumn.value;

    if (!column) return;

    try {
        // Nomination is blocked until the Nominated Column's required Forms
        // have a Response for the Event - the wizard collects them first
        const missing = await missingRequiredForms(column.id, event.id);

        if (missing.length) {
            formWizard.value = { forms: missing, event };
            return;
        }

        await placeEvent(event);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function placeEvent(event: CoreEvent): Promise<void> {
    const column = nominatedColumn.value;

    if (!column) return;

    const res = await server.PUT('/api/board/event', {
        body: {
            column: column.id,
            event: event.id,
            position: column.events.length,
        }
    });

    if (res.error) throw new Error(res.error.message);

    column.events.push(res.data as CoreEventBoardEvent);
}

async function completeFormWizard(): Promise<void> {
    const pending = formWizard.value;
    formWizard.value = undefined;

    if (!pending) return;

    try {
        await placeEvent(pending.event);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

function openEvent(id: string): void {
    viewEvent.value = id;
}

/** Changes made in the Event modal should reflect on the Board behind it */
async function closeEvent(): Promise<void> {
    viewEvent.value = undefined;

    await listColumns();
}
</script>

<style>
/* Both header selectors size their dropdown panel to their own width - wide
   enough that neither panel spills under its neighbour */
.event-board .event-board-select {
    width: 250px;
}

.event-board-event-modal {
    height: calc(100dvh - 4rem);
    max-height: 800px;
}

/* The board options dropdown teleports to body so these can't nest under
   .event-board - direct-child selectors keep the confirm modal's icon full
   size while the menu row icon matches the Edit row's 20px */
.event-board-menu-delete > .col-12 > svg {
    width: 20px;
    height: 20px;
}
</style>
