<template>
    <div class='h-full w-full cloudtak-page d-flex flex-column event-board'>
        <div class='d-flex align-items-center px-3 py-2 border-bottom event-board-header'>
            <img
                class='cloudtak-logo me-2'
                :src='headerLogo'
                alt='CloudTAK Logo'
                draggable='false'
            >
            <div class='fs-3 fw-bold user-select-none'>
                Event Board
            </div>

            <div class='d-flex align-items-center gap-2 ms-auto'>
                <select
                    v-model='channel'
                    class='form-select event-board-channel'
                    aria-label='Channel'
                >
                    <option
                        :value='undefined'
                        disabled
                    >
                        Select a Channel
                    </option>
                    <option
                        v-for='ch in channels'
                        :key='ch.bitpos'
                        :value='ch.bitpos'
                        v-text='ch.name'
                    />
                </select>

                <button
                    class='btn btn-primary flex-shrink-0'
                    :disabled='channel === undefined || loading'
                    @click='nominate = true'
                >
                    <IconPlus
                        :size='20'
                        stroke='2'
                        class='me-1'
                    />Nominate
                </button>

                <TablerIconButton
                    title='Refresh Boards'
                    @click='refresh'
                >
                    <IconRefresh
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>

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
            <div
                v-else
                ref='scroller'
                class='d-flex align-items-stretch gap-3 h-100 overflow-x-auto p-3'
            >
                <div
                    v-for='board in boards'
                    :key='board.id'
                    class='cloudtak-panel d-flex flex-column event-board-column flex-shrink-0'
                    :class='{ "event-board-column--target": dropTarget && dropTarget.board === board.id }'
                    :data-board='board.id'
                    @dragover='onColumnDragOver($event, board)'
                    @dragleave='onColumnDragLeave($event, board)'
                    @drop.prevent='onDrop(board)'
                >
                    <div class='d-flex align-items-center px-3 py-2 border-bottom event-board-column-header'>
                        <TablerBadge
                            v-if='board.color'
                            class='text-truncate user-select-none'
                            :background-color='board.color + "26"'
                            :border-color='board.color + "59"'
                            :text-color='board.color'
                            :title='board.description || undefined'
                        >
                            {{ board.name }}
                        </TablerBadge>
                        <span
                            v-else
                            class='fw-semibold text-truncate user-select-none'
                            :title='board.description || undefined'
                            v-text='board.name'
                        />
                        <span
                            class='badge bg-secondary text-secondary-fg ms-2 flex-shrink-0'
                            v-text='board.events.length'
                        />

                        <div class='ms-auto flex-shrink-0'>
                            <TablerDropdown>
                                <TablerIconButton title='Board Options'>
                                    <IconDotsVertical
                                        :size='18'
                                        stroke='1'
                                    />
                                </TablerIconButton>

                                <template #dropdown>
                                    <div
                                        class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                                        @click='editBoard = board'
                                    >
                                        <IconPencil
                                            :size='32'
                                            stroke='1'
                                        />
                                        <span class='mx-2'>Edit</span>
                                    </div>
                                    <!-- TablerDelete's confirm modal only closes on unmount -
                                         the key remounts it once the clear empties the Board -->
                                    <TablerDelete
                                        :key='`clear-${board.events.length}`'
                                        displaytype='menu'
                                        label='Clear'
                                        title='Clear Board'
                                        :disabled='board.events.length === 0'
                                        @delete='clearBoard(board)'
                                    />
                                    <TablerDelete
                                        v-if='board.type !== "nominated"'
                                        displaytype='menu'
                                        label='Delete'
                                        title='Delete Board'
                                        @delete='deleteBoard(board)'
                                    />
                                </template>
                            </TablerDropdown>
                        </div>
                    </div>

                    <div class='flex-grow-1 overflow-auto px-2 py-2 d-flex flex-column gap-2 event-board-column-body'>
                        <template
                            v-for='(placement, idx) in board.events'
                            :key='placement.event.id'
                        >
                            <div
                                v-if='showIndicator(board, idx)'
                                class='event-board-indicator'
                            />
                            <div
                                class='event-board-card'
                                :class='{ "event-board-card--dragging": drag && drag.placement.event.id === placement.event.id }'
                                :data-index='idx'
                                draggable='true'
                                @dragstart='onDragStart($event, board, placement)'
                                @dragend='onDragEnd'
                                @dragover='onCardDragOver($event, board, idx)'
                                @touchstart='onTouchStart($event, board, placement)'
                                @touchmove='onTouchMove'
                                @touchend='onTouchEnd'
                                @touchcancel='cancelTouchDrag'
                                @contextmenu='onCardContextMenu'
                            >
                                <StandardCoreEvent
                                    :event='placement.event'
                                    :icon='false'
                                    @click='openEvent(placement.event.id)'
                                >
                                    <template #actions>
                                        <TablerDelete
                                            displaytype='icon'
                                            :size='18'
                                            label='Remove'
                                            title='Remove from Board'
                                            class='mt-1'
                                            @delete='removeEvent(board, placement)'
                                        />
                                    </template>
                                </StandardCoreEvent>
                            </div>
                        </template>

                        <div
                            v-if='showIndicator(board, board.events.length)'
                            class='event-board-indicator'
                        />

                        <div
                            v-if='board.events.length === 0 && !dropTarget'
                            class='text-muted small text-center py-4 user-select-none'
                        >
                            No Events on this Board
                        </div>
                    </div>
                </div>

                <div
                    v-if='adding !== undefined'
                    class='event-board-column flex-shrink-0'
                >
                    <div class='cloudtak-panel px-3 py-2'>
                        <input
                            v-model='adding'
                            v-focus
                            class='form-control form-control-sm'
                            placeholder='Board Name'
                            @keyup.enter='createBoard'
                            @keyup.esc='adding = undefined'
                            @blur='createBoard'
                        >
                    </div>
                </div>
                <div
                    v-else
                    class='flex-shrink-0'
                >
                    <TablerIconButton
                        title='Add Board'
                        @click='adding = ""'
                    >
                        <IconPlus
                            :size='24'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>
        </div>

        <NominateModal
            v-if='nominate && channel !== undefined'
            :channel='channel'
            :placed='placedEvents'
            @nominate='nominateEvent($event)'
            @close='nominate = false'
        />

        <EditBoardModal
            v-if='editBoard'
            :board='editBoard'
            @save='saveBoard($event)'
            @close='editBoard = undefined'
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
 * EventBoard - KanBan style board of Core Events nominated to a TAK
 * Channel. Every Channel has an automatically managed "Nominated" Board
 * (renameable) that nominations land on and users can add further Boards
 * and drag Events between them.
 */

import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Config from '../../base/config.ts';
import { server } from '../../std.ts';
import GroupManager from '../../base/group.ts';
import type { CoreEvent, CoreEventBoard, CoreEventBoardEvent } from '../../types.ts';
import StandardCoreEvent from '../CloudTAK/util/StandardCoreEvent.vue';
import CoreEventView from '../CloudTAK/CoreEventView.vue';
import NominateModal from './NominateModal.vue';
import EditBoardModal from './EditBoardModal.vue';
import {
    IconPlus,
    IconPencil,
    IconRefresh,
    IconDotsVertical,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerBadge,
    TablerModal,
    TablerDelete,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

const vFocus = {
    mounted: (el: HTMLElement) => el.focus()
};

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref<Error | undefined>();

const channels = ref<Array<{ name: string; bitpos: number }>>([]);
const channel = ref<number | undefined>();

const boards = ref<Array<CoreEventBoard>>([]);

const nominate = ref(false);
const adding = ref<string | undefined>();
const editBoard = ref<CoreEventBoard | undefined>();
const viewEvent = ref<string | undefined>();

const drag = ref<{ placement: CoreEventBoardEvent; from: string } | undefined>();
const dropTarget = ref<{ board: string; index: number; precise: boolean } | undefined>();

const scroller = ref<HTMLElement | undefined>();

let touch: {
    timer: ReturnType<typeof setTimeout> | undefined;
    started: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    offsetX: number;
    offsetY: number;
    cardEl: HTMLElement;
    ghost: HTMLElement | undefined;
    raf: number | undefined;
} | undefined;

const brandStore = reactive<{
    login: {
        logo?: string;
    } | undefined;
}>({
    login: undefined,
});

const headerLogo = computed(() => {
    if (brandStore.login && brandStore.login.logo) {
        return brandStore.login.logo;
    }
    return '/CloudTAKLogo.svg';
});

const placedEvents = computed<Set<string>>(() => {
    const placed = new Set<string>();
    for (const board of boards.value) {
        for (const placement of board.events) {
            placed.add(placement.event.id);
        }
    }
    return placed;
});

const nominatedBoard = computed<CoreEventBoard | undefined>(() => {
    return boards.value.find((board) => board.type === 'nominated');
});

onMounted(async () => {
    try {
        const config = await Config.list([
            'login::logo',
        ]);

        brandStore.login = {
            logo: config['login::logo'],
        };
    } catch (err) {
        // Non-fatal - fall through to the default logo so the board still loads
        console.error('Failed to load login logo', err);
    }

    await listChannels();

    const query = parseInt(String(route.query.channel), 10);
    if (!isNaN(query) && channels.value.some((ch) => ch.bitpos === query)) {
        channel.value = query;
    } else if (channels.value.length === 1) {
        channel.value = channels.value[0].bitpos;
    } else {
        loading.value = false;
    }
});

onUnmounted(() => {
    cleanupTouch();
});

watch(channel, async () => {
    void router.replace({
        query: channel.value === undefined ? {} : { channel: String(channel.value) },
    });

    await refresh();
});

async function refresh(): Promise<void> {
    if (channel.value === undefined) return;

    loading.value = true;
    await listBoards();
}

async function listChannels(): Promise<void> {
    try {
        const groups = await GroupManager.list({ active: true });

        channels.value = groups
            .map((group) => ({ name: group.name, bitpos: group.bitpos }))
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function listBoards(): Promise<void> {
    if (channel.value === undefined) return;

    try {
        error.value = undefined;

        const res = await server.GET('/api/board', {
            params: { query: { channel: channel.value } }
        });

        if (res.error) throw new Error(res.error.message);

        boards.value = res.data.items as Array<CoreEventBoard>;

        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function createBoard(): Promise<void> {
    const name = (adding.value || '').trim();

    if (!name || channel.value === undefined) {
        adding.value = undefined;
        return;
    }

    adding.value = undefined;

    try {
        const res = await server.POST('/api/board', {
            body: {
                channel: channel.value,
                name,
            }
        });

        if (res.error) throw new Error(res.error.message);

        boards.value.push(res.data as CoreEventBoard);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function saveBoard(update: { name: string; description: string; color: string }): Promise<void> {
    const board = editBoard.value;
    editBoard.value = undefined;

    if (!board) return;

    try {
        const res = await server.PATCH('/api/board/{:board}', {
            params: { path: { ':board': board.id } },
            body: update
        });

        if (res.error) throw new Error(res.error.message);

        board.name = res.data.name;
        board.description = res.data.description;
        board.color = res.data.color;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function deleteBoard(board: CoreEventBoard): Promise<void> {
    try {
        const res = await server.DELETE('/api/board/{:board}', {
            params: { path: { ':board': board.id } }
        });

        if (res.error) throw new Error(res.error.message);

        // Events placed on the deleted Board are dropped from the Board
        // entirely - surface them again by re-nominating from the modal
        boards.value = boards.value.filter((b) => b.id !== board.id);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function nominateEvent(event: CoreEvent): Promise<void> {
    const board = nominatedBoard.value;

    if (!board) return;

    try {
        const res = await server.PUT('/api/board/{:board}/event/{:event}', {
            params: { path: { ':board': board.id, ':event': event.id } },
            body: { position: board.events.length }
        });

        if (res.error) throw new Error(res.error.message);

        board.events.push(res.data as CoreEventBoardEvent);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function removeEvent(board: CoreEventBoard, placement: CoreEventBoardEvent): Promise<void> {
    try {
        const res = await server.DELETE('/api/board/{:board}/event/{:event}', {
            params: { path: { ':board': board.id, ':event': placement.event.id } }
        });

        if (res.error) throw new Error(res.error.message);

        board.events = board.events.filter((p) => p.event.id !== placement.event.id);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

/** Remove every Event placement from the given Board */
async function clearBoard(board: CoreEventBoard): Promise<void> {
    try {
        for (const placement of [...board.events]) {
            const res = await server.DELETE('/api/board/{:board}/event/{:event}', {
                params: { path: { ':board': board.id, ':event': placement.event.id } }
            });

            if (res.error) throw new Error(res.error.message);

            board.events = board.events.filter((p) => p.event.id !== placement.event.id);
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        await listBoards();
    }
}

function openEvent(id: string): void {
    viewEvent.value = id;
}

/** Changes made in the Event modal should reflect on the Boards behind it */
async function closeEvent(): Promise<void> {
    viewEvent.value = undefined;

    await listBoards();
}

/** Persist board positions for any placement whose Board or index changed */
async function persistPositions(board: CoreEventBoard): Promise<void> {
    for (let i = 0; i < board.events.length; i++) {
        const placement = board.events[i];

        if (placement.board === board.id && placement.position === i) continue;

        const res = await server.PUT('/api/board/{:board}/event/{:event}', {
            params: { path: { ':board': board.id, ':event': placement.event.id } },
            body: { position: i }
        });

        if (res.error) throw new Error(res.error.message);

        placement.board = board.id;
        placement.position = i;
    }
}

function onDragStart(event: DragEvent, board: CoreEventBoard, placement: CoreEventBoardEvent): void {
    drag.value = { placement, from: board.id };

    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', placement.event.id);
    }
}

function onDragEnd(): void {
    drag.value = undefined;
    dropTarget.value = undefined;
}

function onCardDragOver(event: DragEvent, board: CoreEventBoard, index: number): void {
    if (!drag.value) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;

    dropTarget.value = { board: board.id, index: index + (after ? 1 : 0), precise: true };
}

function onColumnDragOver(event: DragEvent, board: CoreEventBoard): void {
    if (!drag.value) return;

    event.preventDefault();

    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

    if (!dropTarget.value || dropTarget.value.board !== board.id) {
        dropTarget.value = { board: board.id, index: board.events.length, precise: false };
    }
}

function onColumnDragLeave(event: DragEvent, board: CoreEventBoard): void {
    const related = event.relatedTarget as HTMLElement | null;
    const column = event.currentTarget as HTMLElement;

    if (related && column.contains(related)) return;

    if (dropTarget.value && dropTarget.value.board === board.id) {
        dropTarget.value = undefined;
    }
}

/**
 * Touch devices don't fire HTML5 drag events - a 200ms hold on a card lifts
 * it into the same drag/dropTarget state the mouse path uses, with a fixed
 * position ghost following the finger and elementFromPoint hit-testing
 */
function onTouchStart(event: TouchEvent, board: CoreEventBoard, placement: CoreEventBoardEvent): void {
    if (event.touches.length !== 1) return;

    cancelTouchDrag();

    const cardEl = event.currentTarget as HTMLElement;
    const point = event.touches[0];
    const rect = cardEl.getBoundingClientRect();

    touch = {
        timer: undefined,
        started: false,
        startX: point.clientX,
        startY: point.clientY,
        lastX: point.clientX,
        lastY: point.clientY,
        offsetX: point.clientX - rect.left,
        offsetY: point.clientY - rect.top,
        cardEl,
        ghost: undefined,
        raf: undefined,
    };

    touch.timer = setTimeout(() => {
        if (!touch || touch.started) return;

        touch.started = true;
        drag.value = { placement, from: board.id };
        createTouchGhost();
        touch.raf = requestAnimationFrame(touchAutoScroll);
    }, 200);
}

function onTouchMove(event: TouchEvent): void {
    if (!touch) return;

    const point = event.touches[0];
    touch.lastX = point.clientX;
    touch.lastY = point.clientY;

    if (!touch.started) {
        // Movement before the hold timer fires means the user is scrolling
        if (Math.hypot(point.clientX - touch.startX, point.clientY - touch.startY) > 8) {
            cancelTouchDrag();
        }

        return;
    }

    event.preventDefault();

    if (touch.ghost) {
        touch.ghost.style.left = `${point.clientX - touch.offsetX}px`;
        touch.ghost.style.top = `${point.clientY - touch.offsetY}px`;
    }

    updateTouchTarget(point.clientX, point.clientY);
}

function onTouchEnd(event: TouchEvent): void {
    if (!touch) return;

    if (!touch.started) {
        cancelTouchDrag();
        return;
    }

    // Suppress the synthetic click that would open the Event
    event.preventDefault();

    const target = dropTarget.value
        ? boards.value.find((b) => b.id === dropTarget.value?.board)
        : undefined;

    cleanupTouch();

    if (target) {
        void onDrop(target);
    } else {
        onDragEnd();
    }
}

function onCardContextMenu(event: Event): void {
    // Long-press fires contextmenu on some platforms - only block it mid-touch
    if (touch) event.preventDefault();
}

function cancelTouchDrag(): void {
    if (!touch) return;

    cleanupTouch();
    onDragEnd();
}

function cleanupTouch(): void {
    if (!touch) return;

    if (touch.timer !== undefined) clearTimeout(touch.timer);
    if (touch.raf !== undefined) cancelAnimationFrame(touch.raf);
    if (touch.ghost) touch.ghost.remove();

    touch = undefined;
}

function createTouchGhost(): void {
    if (!touch) return;

    const rect = touch.cardEl.getBoundingClientRect();
    const ghost = touch.cardEl.cloneNode(true) as HTMLElement;

    ghost.classList.remove('event-board-card--dragging');
    ghost.style.position = 'fixed';
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.margin = '0';
    ghost.style.opacity = '0.9';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '1000';

    (touch.cardEl.closest('.event-board') || document.body).appendChild(ghost);
    touch.ghost = ghost;
}

function updateTouchTarget(x: number, y: number): void {
    const el = document.elementFromPoint(x, y);
    const cardEl = el ? el.closest<HTMLElement>('.event-board-card[data-index]') : null;
    const columnEl = el ? el.closest<HTMLElement>('.event-board-column[data-board]') : null;
    const boardId = columnEl ? columnEl.dataset.board : undefined;

    if (!boardId) {
        dropTarget.value = undefined;
        return;
    }

    if (cardEl) {
        const rect = cardEl.getBoundingClientRect();
        const index = Number(cardEl.dataset.index);
        const after = y > rect.top + rect.height / 2;

        dropTarget.value = { board: boardId, index: index + (after ? 1 : 0), precise: true };
    } else {
        const board = boards.value.find((b) => b.id === boardId);
        if (board) dropTarget.value = { board: board.id, index: board.events.length, precise: false };
    }
}

/** Holding a card near an edge scrolls the board (and column) it hovers */
function touchAutoScroll(): void {
    if (!touch || !touch.started) return;

    const EDGE = 48;
    const SPEED = 8;
    let scrolled = false;

    if (scroller.value) {
        const rect = scroller.value.getBoundingClientRect();

        if (touch.lastX < rect.left + EDGE) {
            scroller.value.scrollLeft -= SPEED;
            scrolled = true;
        } else if (touch.lastX > rect.right - EDGE) {
            scroller.value.scrollLeft += SPEED;
            scrolled = true;
        }
    }

    const el = document.elementFromPoint(touch.lastX, touch.lastY);
    const body = el ? el.closest<HTMLElement>('.event-board-column-body') : null;

    if (body) {
        const rect = body.getBoundingClientRect();

        if (touch.lastY < rect.top + EDGE) {
            body.scrollTop -= SPEED;
            scrolled = true;
        } else if (touch.lastY > rect.bottom - EDGE) {
            body.scrollTop += SPEED;
            scrolled = true;
        }
    }

    if (scrolled) updateTouchTarget(touch.lastX, touch.lastY);

    touch.raf = requestAnimationFrame(touchAutoScroll);
}

/**
 * The drop indicator renders above the card at the given index - only when
 * the position was chosen by hovering a specific card; column-level hover
 * highlights via the column border alone
 */
function showIndicator(board: CoreEventBoard, index: number): boolean {
    if (!drag.value || !dropTarget.value) return false;
    if (dropTarget.value.board !== board.id || !dropTarget.value.precise) return false;

    return dropTarget.value.index === index;
}

async function onDrop(target: CoreEventBoard): Promise<void> {
    if (!drag.value || !dropTarget.value || dropTarget.value.board !== target.id) {
        onDragEnd();
        return;
    }

    const { placement, from } = drag.value;
    let index = dropTarget.value.index;

    onDragEnd();

    const source = boards.value.find((b) => b.id === from);
    if (!source) return;

    const current = source.events.findIndex((p) => p.event.id === placement.event.id);
    if (current === -1) return;

    if (source.id === target.id) {
        if (index > current) index -= 1;
        if (index === current) return;
    }

    source.events.splice(current, 1);
    target.events.splice(Math.min(index, target.events.length), 0, placement);

    try {
        await persistPositions(target);
        if (source.id !== target.id) await persistPositions(source);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        await listBoards();
    }
}
</script>

<style>
.event-board .cloudtak-logo {
    height: 32px;
    width: 32px;
}

.event-board .event-board-channel {
    width: 250px;
}

.event-board .event-board-column {
    width: 340px;
}

.event-board .event-board-column--target {
    outline: 2px solid rgba(0, 132, 255, 0.6);
    outline-offset: -2px;
}

.event-board .event-board-column-body {
    min-height: 100px;
}

.event-board .event-board-card {
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
}

.event-board .event-board-card--dragging {
    opacity: 0.4;
}

.event-board-event-modal {
    height: calc(100dvh - 4rem);
    max-height: 800px;
}

.event-board .event-board-indicator {
    height: 3px;
    border-radius: 2px;
    background: rgba(0, 132, 255, 0.9);
    flex-shrink: 0;
}
</style>
