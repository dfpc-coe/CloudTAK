<template>
    <div
        ref='scroller'
        class='d-flex align-items-stretch gap-3 h-100 overflow-x-auto p-3'
    >
        <div
            v-for='(column, columnIdx) in columns'
            :key='column.id'
            class='cloudtak-panel d-flex flex-column event-board-column flex-shrink-0'
            :class='{
                "event-board-column--target": dropTarget && dropTarget.column === column.id,
                "event-board-column--insert-before": columnDrag && columnDropIndex === columnIdx,
                "event-board-column--insert-after": columnDrag && columnDropIndex === columns.length && columnIdx === columns.length - 1,
            }'
            :data-column='column.id'
            @dragover='onColumnDragOver($event, column, columnIdx)'
            @dragleave='onColumnDragLeave($event, column)'
            @drop.prevent='onDrop(column)'
        >
            <div class='d-flex align-items-center px-3 py-2 border-bottom event-board-column-header'>
                <div
                    class='d-flex align-items-center flex-shrink-0 me-2 event-board-column-handle'
                    draggable='true'
                    title='Move Column'
                    @dragstart='onColumnDragStart($event, column)'
                    @dragend='onColumnDragEnd'
                >
                    <IconGripVertical
                        :size='18'
                        stroke='1'
                    />
                </div>
                <TablerBadge
                    v-if='column.color'
                    class='text-truncate user-select-none'
                    :background-color='column.color + "26"'
                    :border-color='column.color + "59"'
                    :text-color='column.color'
                    :title='column.description || undefined'
                >
                    {{ column.name }}
                </TablerBadge>
                <span
                    v-else
                    class='fw-semibold text-truncate user-select-none'
                    :title='column.description || undefined'
                    v-text='column.name'
                />
                <span
                    class='badge bg-secondary text-secondary-fg ms-2 flex-shrink-0'
                    v-text='column.events.length'
                />

                <div class='ms-auto flex-shrink-0'>
                    <TablerDropdown :width='170'>
                        <TablerIconButton title='Column Options'>
                            <IconDotsVertical
                                :size='18'
                                stroke='1'
                            />
                        </TablerIconButton>

                        <template #dropdown>
                            <div
                                class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                                @click='editColumn = column'
                            >
                                <IconPencil
                                    :size='20'
                                    stroke='1'
                                />
                                <span class='mx-2'>Edit</span>
                            </div>
                            <!-- TablerDelete's confirm modal only closes on unmount -
                                 the key remounts it once the clear empties the Column -->
                            <TablerDelete
                                :key='`clear-${column.events.length}`'
                                class='event-board-menu-delete'
                                :class='{ "cloudtak-hover": column.events.length > 0 }'
                                displaytype='menu'
                                label='Clear'
                                title='Clear Column'
                                :disabled='column.events.length === 0'
                                @delete='clearColumn(column)'
                            />
                            <TablerDelete
                                v-if='column.type !== "nominated"'
                                class='cloudtak-hover event-board-menu-delete'
                                displaytype='menu'
                                label='Delete Column'
                                title='Delete Column'
                                @delete='deleteColumn(column)'
                            />
                        </template>
                    </TablerDropdown>
                </div>
            </div>

            <div
                v-if='column.description'
                class='px-3 py-2 border-bottom event-board-column-desc'
            >
                <div
                    :ref='(el) => setDescEl(column.id, el)'
                    class='text-secondary event-board-desc'
                    :class='{ "event-board-desc--clamped": !expandedDesc.has(column.id) }'
                    v-text='column.description'
                />
                <div
                    v-if='descOverflow[column.id] || expandedDesc.has(column.id)'
                    class='d-flex align-items-center justify-content-center gap-1 cursor-pointer cloudtak-hover user-select-none mt-1 event-board-desc-toggle'
                    role='button'
                    tabindex='0'
                    @click='toggleDesc(column.id)'
                    @keydown.enter='toggleDesc(column.id)'
                >
                    <span v-text='expandedDesc.has(column.id) ? "Less" : "More"' />
                    <IconChevronUp
                        v-if='expandedDesc.has(column.id)'
                        :size='16'
                        stroke='1'
                    />
                    <IconChevronDown
                        v-else
                        :size='16'
                        stroke='1'
                    />
                </div>
            </div>

            <div class='flex-grow-1 overflow-auto px-2 py-2 d-flex flex-column gap-2 event-board-column-body'>
                <template
                    v-for='(placement, idx) in column.events'
                    :key='placement.event.id'
                >
                    <div
                        v-if='showIndicator(column, idx)'
                        class='event-board-indicator'
                    />
                    <div
                        class='event-board-card'
                        :class='{ "event-board-card--dragging": drag && drag.placement.event.id === placement.event.id }'
                        :data-index='idx'
                        draggable='true'
                        @dragstart='onDragStart($event, column, placement)'
                        @dragend='onDragEnd'
                        @dragover='onCardDragOver($event, column, idx)'
                        @touchstart='onTouchStart($event, column, placement)'
                        @touchmove='onTouchMove'
                        @touchend='onTouchEnd'
                        @touchcancel='cancelTouchDrag'
                        @contextmenu='onCardContextMenu'
                    >
                        <StandardCoreEvent
                            :event='placement.event'
                            :icon='false'
                            @click='emit("open-event", placement.event.id)'
                        >
                            <template #actions>
                                <TablerDelete
                                    displaytype='icon'
                                    :size='18'
                                    label='Remove'
                                    title='Remove from Board'
                                    class='mt-1'
                                    @delete='removeEvent(column, placement)'
                                />
                            </template>
                        </StandardCoreEvent>
                    </div>
                </template>

                <div
                    v-if='showIndicator(column, column.events.length)'
                    class='event-board-indicator'
                />

                <div
                    v-if='column.events.length === 0 && !dropTarget'
                    class='text-muted small text-center py-4 user-select-none'
                >
                    No Events in this Column
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
                    placeholder='Column Name'
                    @keyup.enter='createColumn'
                    @keyup.esc='adding = undefined'
                    @blur='createColumn'
                >
            </div>
        </div>
        <div
            v-else-if='board'
            class='flex-shrink-0'
        >
            <TablerIconButton
                title='Add Column'
                @click='adding = ""'
            >
                <IconPlus
                    :size='24'
                    stroke='1'
                />
            </TablerIconButton>
        </div>
    </div>

    <EditColumnModal
        v-if='editColumn'
        :column='editColumn'
        :channel='channel'
        @save='saveColumn($event)'
        @close='editColumn = undefined'
    />

    <FormWizard
        v-if='formWizard'
        :event-id='formWizard.eventId'
        :event-name='formWizard.eventName'
        :forms='formWizard.forms'
        @complete='completeFormWizard'
        @close='formWizard = undefined'
    />
</template>

<script setup lang='ts'>
/**
 * ViewBoard - KanBan style rendering of an Event Board: draggable Columns of
 * draggable Event cards. Owns the Column CRUD and drag & drop persistence -
 * the surrounding Board/Channel selection lives in Main.vue which re-lists
 * via the `refresh` emit when a mutation here needs a full resync.
 */

import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { server } from '../../std.ts';
import type { CoreForm, CoreEventBoardEvent } from '../../types.ts';
import type { BoardColumn } from './types.ts';
import { missingRequiredForms } from '../../utils/column-forms.ts';
import StandardCoreEvent from '../CloudTAK/util/StandardCoreEvent.vue';
import FormWizard from '../CloudTAK/util/FormWizard.vue';
import EditColumnModal from './EditColumnModal.vue';
import {
    IconPlus,
    IconPencil,
    IconChevronUp,
    IconChevronDown,
    IconDotsVertical,
    IconGripVertical,
} from '@tabler/icons-vue';
import {
    TablerBadge,
    TablerDelete,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

const vFocus = {
    mounted: (el: HTMLElement) => el.focus()
};

const props = defineProps<{
    board?: string;
    /** TAK Channel bitpos of the Board - scopes the Forms attachable to a Column */
    channel?: number;
}>();

const columns = defineModel<Array<BoardColumn>>('columns', { required: true });

const emit = defineEmits<{
    (e: 'error', err: Error): void;
    (e: 'refresh'): void;
    (e: 'open-event', id: string): void;
}>();

const adding = ref<string | undefined>();
const editColumn = ref<BoardColumn | undefined>();

/** A drop held back by required Forms - `apply` finishes the move once the wizard completes */
const formWizard = ref<{
    forms: Array<CoreForm>;
    eventId: string;
    eventName: string;
    apply: () => Promise<void>;
} | undefined>();

// Column descriptions clamp to 2 lines - the More/Less row only renders for
// Columns whose text actually overflows the clamp (measured, not guessed)
const expandedDesc = ref(new Set<string>());
const descOverflow = ref<Record<string, boolean>>({});
const descEls = new Map<string, HTMLElement>();

const drag = ref<{ placement: CoreEventBoardEvent; from: string } | undefined>();
const dropTarget = ref<{ column: string; index: number; precise: boolean } | undefined>();

// Dragging a column by its grip handle repositions the Column itself -
// kept apart from `drag`/`dropTarget` so card and column drags can't mix
const columnDrag = ref<{ column: string } | undefined>();
const columnDropIndex = ref<number | undefined>();

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

onMounted(() => {
    window.addEventListener('resize', measureDescs);
});

onUnmounted(() => {
    cleanupTouch();
    window.removeEventListener('resize', measureDescs);
});

function fail(err: unknown): void {
    emit('error', err instanceof Error ? err : new Error(String(err)));
}

function setDescEl(id: string, el: unknown): void {
    if (el instanceof HTMLElement) {
        descEls.set(id, el);
    } else {
        descEls.delete(id);
    }
}

function measureDescs(): void {
    for (const [id, el] of descEls) {
        if (expandedDesc.value.has(id)) continue;
        descOverflow.value[id] = el.scrollHeight > el.clientHeight + 1;
    }
}

function toggleDesc(id: string): void {
    if (expandedDesc.value.has(id)) {
        expandedDesc.value.delete(id);
        void nextTick().then(measureDescs);
    } else {
        expandedDesc.value.add(id);
    }
}

watch(columns, async () => {
    await nextTick();
    measureDescs();
}, { immediate: true });

async function createColumn(): Promise<void> {
    const name = (adding.value || '').trim();

    if (!name || !props.board) {
        adding.value = undefined;
        return;
    }

    adding.value = undefined;

    try {
        const res = await server.POST('/api/board/column', {
            body: {
                board: props.board,
                name,
            }
        });

        if (res.error) throw new Error(res.error.message);

        columns.value.push({ ...res.data, events: [] });
    } catch (err) {
        fail(err);
    }
}

async function saveColumn(update: {
    name: string;
    description: string;
    color: string;
    forms?: Array<{ form: string; required: boolean }>;
}): Promise<void> {
    const column = editColumn.value;
    editColumn.value = undefined;

    if (!column) return;

    try {
        const { forms, ...body } = update;

        const res = await server.PATCH('/api/board/column/{:column}', {
            params: { path: { ':column': column.id } },
            body
        });

        if (res.error) throw new Error(res.error.message);

        column.name = res.data.name;
        column.description = res.data.description;
        column.color = res.data.color;

        if (forms) await syncColumnForms(column.id, forms);

        await nextTick();
        measureDescs();
    } catch (err) {
        fail(err);
    }
}

/**
 * Bring the Column's Form attachments in line with the staged list from the
 * edit modal - the attach endpoint upserts so only removals need a diff
 */
async function syncColumnForms(column: string, forms: Array<{ form: string; required: boolean }>): Promise<void> {
    const existing = await server.GET('/api/board/column/{:column}/form', {
        params: { path: { ':column': column } }
    });

    if (existing.error) throw new Error(existing.error.message);

    const staged = new Map(forms.map((attachment) => [attachment.form, attachment.required]));

    for (const attachment of existing.data.items) {
        if (staged.has(attachment.form.id)) continue;

        const res = await server.DELETE('/api/board/column/{:column}/form/{:form}', {
            params: { path: { ':column': column, ':form': attachment.form.id } }
        });

        if (res.error) throw new Error(res.error.message);
    }

    for (const attachment of existing.data.items) {
        if (staged.get(attachment.form.id) === attachment.required) {
            // Attached with the right flag already - nothing to upsert
            staged.delete(attachment.form.id);
        }
    }

    for (const [form, required] of staged) {
        const res = await server.PUT('/api/board/column/{:column}/form', {
            params: { path: { ':column': column } },
            body: { form, required }
        });

        if (res.error) throw new Error(res.error.message);
    }
}

async function deleteColumn(column: BoardColumn): Promise<void> {
    try {
        const res = await server.DELETE('/api/board/column/{:column}', {
            params: { path: { ':column': column.id } }
        });

        if (res.error) throw new Error(res.error.message);

        // Events placed in the deleted Column are dropped from the Board
        // entirely - surface them again by re-nominating from the modal
        columns.value = columns.value.filter((c) => c.id !== column.id);
    } catch (err) {
        fail(err);
    }
}

async function removeEvent(column: BoardColumn, placement: CoreEventBoardEvent): Promise<void> {
    try {
        const res = await server.DELETE('/api/board/event/{:placement}', {
            params: { path: { ':placement': placement.id } }
        });

        if (res.error) throw new Error(res.error.message);

        column.events = column.events.filter((p) => p.id !== placement.id);
    } catch (err) {
        fail(err);
    }
}

async function clearColumn(column: BoardColumn): Promise<void> {
    try {
        for (const placement of [...column.events]) {
            const res = await server.DELETE('/api/board/event/{:placement}', {
                params: { path: { ':placement': placement.id } }
            });

            if (res.error) throw new Error(res.error.message);

            column.events = column.events.filter((p) => p.id !== placement.id);
        }
    } catch (err) {
        fail(err);
        emit('refresh');
    }
}

async function persistPositions(column: BoardColumn): Promise<void> {
    for (let i = 0; i < column.events.length; i++) {
        const placement = column.events[i];

        if (placement.column === column.id && placement.position === i) continue;

        const res = await server.PATCH('/api/board/event/{:placement}', {
            params: { path: { ':placement': placement.id } },
            body: { column: column.id, position: i }
        });

        if (res.error) throw new Error(res.error.message);

        placement.column = column.id;
        placement.position = i;
    }
}

function onDragStart(event: DragEvent, column: BoardColumn, placement: CoreEventBoardEvent): void {
    drag.value = { placement, from: column.id };

    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', placement.event.id);
    }
}

function onDragEnd(): void {
    drag.value = undefined;
    dropTarget.value = undefined;
}

function onCardDragOver(event: DragEvent, column: BoardColumn, index: number): void {
    if (!drag.value) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;

    dropTarget.value = { column: column.id, index: index + (after ? 1 : 0), precise: true };
}

function onColumnDragOver(event: DragEvent, column: BoardColumn, idx: number): void {
    if (columnDrag.value) {
        event.preventDefault();

        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const after = event.clientX > rect.left + rect.width / 2;

        columnDropIndex.value = idx + (after ? 1 : 0);
        return;
    }

    if (!drag.value) return;

    event.preventDefault();

    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

    if (!dropTarget.value || dropTarget.value.column !== column.id) {
        dropTarget.value = { column: column.id, index: column.events.length, precise: false };
    }
}

function onColumnDragStart(event: DragEvent, column: BoardColumn): void {
    columnDrag.value = { column: column.id };

    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', column.id);

        // Drag the whole column as the ghost rather than just the grip icon
        const el = (event.currentTarget as HTMLElement).closest<HTMLElement>('.event-board-column');
        if (el) {
            const rect = el.getBoundingClientRect();
            event.dataTransfer.setDragImage(el, event.clientX - rect.left, event.clientY - rect.top);
        }
    }
}

function onColumnDragEnd(): void {
    columnDrag.value = undefined;
    columnDropIndex.value = undefined;
}

async function onColumnDrop(): Promise<void> {
    const dragging = columnDrag.value;
    const to = columnDropIndex.value;

    onColumnDragEnd();

    if (!dragging || to === undefined) return;

    const from = columns.value.findIndex((c) => c.id === dragging.column);
    if (from === -1) return;

    let index = to;
    if (index > from) index -= 1;
    if (index === from) return;

    const [moved] = columns.value.splice(from, 1);
    columns.value.splice(index, 0, moved);

    try {
        await persistColumnPositions();
    } catch (err) {
        fail(err);
        emit('refresh');
    }
}

async function persistColumnPositions(): Promise<void> {
    for (let i = 0; i < columns.value.length; i++) {
        const column = columns.value[i];

        if (column.position === i) continue;

        const res = await server.PATCH('/api/board/column/{:column}', {
            params: { path: { ':column': column.id } },
            body: { position: i }
        });

        if (res.error) throw new Error(res.error.message);

        column.position = i;
    }
}

function onColumnDragLeave(event: DragEvent, column: BoardColumn): void {
    const related = event.relatedTarget as HTMLElement | null;
    const el = event.currentTarget as HTMLElement;

    if (related && el.contains(related)) return;

    if (dropTarget.value && dropTarget.value.column === column.id) {
        dropTarget.value = undefined;
    }
}

/**
 * Touch devices don't fire HTML5 drag events - a 200ms hold on a card lifts
 * it into the same drag/dropTarget state the mouse path uses, with a fixed
 * position ghost following the finger and elementFromPoint hit-testing
 */
function onTouchStart(event: TouchEvent, column: BoardColumn, placement: CoreEventBoardEvent): void {
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
        drag.value = { placement, from: column.id };
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
        ? columns.value.find((c) => c.id === dropTarget.value?.column)
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
    const columnEl = el ? el.closest<HTMLElement>('.event-board-column[data-column]') : null;
    const columnId = columnEl ? columnEl.dataset.column : undefined;

    if (!columnId) {
        dropTarget.value = undefined;
        return;
    }

    if (cardEl) {
        const rect = cardEl.getBoundingClientRect();
        const index = Number(cardEl.dataset.index);
        const after = y > rect.top + rect.height / 2;

        dropTarget.value = { column: columnId, index: index + (after ? 1 : 0), precise: true };
    } else {
        const column = columns.value.find((c) => c.id === columnId);
        if (column) dropTarget.value = { column: column.id, index: column.events.length, precise: false };
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
function showIndicator(column: BoardColumn, index: number): boolean {
    if (!drag.value || !dropTarget.value) return false;
    if (dropTarget.value.column !== column.id || !dropTarget.value.precise) return false;

    return dropTarget.value.index === index;
}

async function onDrop(target: BoardColumn): Promise<void> {
    if (columnDrag.value) {
        await onColumnDrop();
        return;
    }

    if (!drag.value || !dropTarget.value || dropTarget.value.column !== target.id) {
        onDragEnd();
        return;
    }

    const { placement, from } = drag.value;
    const index = dropTarget.value.index;

    onDragEnd();

    const source = columns.value.find((c) => c.id === from);
    if (!source) return;

    // A cross-column move is blocked until the target's required Forms have
    // a Response for the Event - the wizard collects them, then re-applies
    if (source.id !== target.id) {
        try {
            const missing = await missingRequiredForms(target.id, placement.event.id);

            if (missing.length) {
                formWizard.value = {
                    forms: missing,
                    eventId: placement.event.id,
                    eventName: placement.event.name,
                    apply: () => applyDrop(placement, source, target, index),
                };
                return;
            }
        } catch (err) {
            fail(err);
            return;
        }
    }

    await applyDrop(placement, source, target, index);
}

async function applyDrop(placement: CoreEventBoardEvent, source: BoardColumn, target: BoardColumn, index: number): Promise<void> {
    const current = source.events.findIndex((p) => p.event.id === placement.event.id);
    if (current === -1) return;

    let insert = index;
    if (source.id === target.id) {
        if (insert > current) insert -= 1;
        if (insert === current) return;
    }

    source.events.splice(current, 1);
    target.events.splice(Math.min(insert, target.events.length), 0, placement);

    try {
        await persistPositions(target);
        if (source.id !== target.id) await persistPositions(source);
    } catch (err) {
        fail(err);
        emit('refresh');
    }
}

async function completeFormWizard(): Promise<void> {
    const pending = formWizard.value;
    formWizard.value = undefined;

    if (pending) await pending.apply();
}
</script>

<style>
.event-board .event-board-column {
    width: 340px;
}

.event-board .event-board-column--target {
    outline: 2px solid rgba(0, 132, 255, 0.6);
    outline-offset: -2px;
}

.event-board .event-board-column-handle {
    cursor: grab;
    opacity: 0.6;
}

.event-board .event-board-column-handle:hover {
    opacity: 1;
}

.event-board .event-board-column--insert-before {
    box-shadow: -4px 0 0 0 rgba(0, 132, 255, 0.9);
}

.event-board .event-board-column--insert-after {
    box-shadow: 4px 0 0 0 rgba(0, 132, 255, 0.9);
}

.event-board .event-board-column-body {
    min-height: 100px;
}

.event-board .event-board-desc {
    font-size: 0.85rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.event-board .event-board-desc--clamped {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.event-board .event-board-desc-toggle {
    font-size: 0.75rem;
    border-radius: 4px;
    padding: 2px 0;
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

.event-board .event-board-indicator {
    height: 3px;
    border-radius: 2px;
    background: rgba(0, 132, 255, 0.9);
    flex-shrink: 0;
}
</style>
