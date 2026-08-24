<template>
    <div class='h-100 overflow-auto'>
        <table class='table table-hover table-vcenter event-board-list'>
            <thead>
                <tr>
                    <th>Event</th>
                    <th class='event-board-list-col'>
                        Column
                    </th>
                    <th class='event-board-list-priority'>
                        Priority
                    </th>
                    <th class='d-none d-lg-table-cell'>
                        Location
                    </th>
                    <th class='d-none d-md-table-cell'>
                        Creator
                    </th>
                    <th class='event-board-list-date'>
                        Created
                    </th>
                    <th class='event-board-list-actions' />
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for='row in rows'
                    :key='row.placement.event.id'
                    class='cursor-pointer'
                    @click='emit("open-event", row.placement.event.id)'
                >
                    <td>
                        <div class='d-flex align-items-center gap-2'>
                            <StatusDot
                                class='flex-shrink-0'
                                :status='row.placement.event.ended ? "Unknown" : "Success"'
                                :title='row.placement.event.ended ? "Ended" : "Active"'
                            />
                            <span
                                class='fw-semibold text-truncate event-board-list-name'
                                v-text='row.placement.event.name'
                            />
                        </div>
                    </td>
                    <td @click.stop>
                        <!-- TablerSelect only reads its model on mount - the key
                             remounts it when the Column changes under it -->
                        <TablerSelect
                            :key='`${row.placement.event.id}-${row.column.id}-${selectEpoch}`'
                            :model-value='row.column.name'
                            :options='columnNames'
                            :title='row.column.description || undefined'
                            @update:model-value='moveEvent(row, $event)'
                        />
                    </td>
                    <td>
                        <span
                            v-if='row.placement.event.priority !== "none"'
                            class='badge text-uppercase'
                            :class='priorityBadgeClass(row.placement.event)'
                        >{{ row.placement.event.priority }}</span>
                        <span
                            v-else
                            class='text-muted'
                        >&mdash;</span>
                    </td>
                    <td class='d-none d-lg-table-cell'>
                        <span
                            v-if='row.placement.event.location'
                            class='text-muted d-flex align-items-center'
                        >
                            <IconMapPin
                                :size='14'
                                stroke='1.5'
                                class='me-1 flex-shrink-0'
                            />
                            <span
                                class='text-truncate event-board-list-location'
                                v-text='row.placement.event.location'
                            />
                        </span>
                        <span
                            v-else
                            class='text-muted'
                        >&mdash;</span>
                    </td>
                    <td class='d-none d-md-table-cell'>
                        <span
                            class='text-muted text-truncate'
                            v-text='creator(row.placement.event)'
                        />
                    </td>
                    <td>
                        <span
                            class='text-muted'
                            v-text='new Date(row.placement.event.created).toLocaleString()'
                        />
                    </td>
                    <td @click.stop>
                        <TablerDelete
                            displaytype='icon'
                            :size='18'
                            label='Remove'
                            title='Remove from Board'
                            @delete='removeEvent(row.column, row.placement)'
                        />
                    </td>
                </tr>
                <tr v-if='rows.length === 0'>
                    <td
                        colspan='7'
                        class='text-muted text-center py-4 user-select-none'
                    >
                        No Events on this Board
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <FormWizard
        v-if='formWizard'
        :event-id='formWizard.eventId'
        :event-name='formWizard.eventName'
        :forms='formWizard.forms'
        @complete='completeFormWizard'
        @close='closeFormWizard'
    />
</template>

<script setup lang='ts'>
/**
 * ViewList - spreadsheet rendering of an Event Board: every placed Event is a
 * row, ordered by its progression through the Board (Column order, then
 * position within the Column), with the Board Column it sits in as a cell
 */

import { ref, computed } from 'vue';
import { server } from '../../std.ts';
import type { CoreForm, CoreEvent, CoreEventBoardEvent } from '../../types.ts';
import type { BoardColumn } from './types.ts';
import { missingRequiredForms } from '../../utils/column-forms.ts';
import FormWizard from '../CloudTAK/util/FormWizard.vue';
import StatusDot from '../util/StatusDot.vue';
import { IconMapPin } from '@tabler/icons-vue';
import {
    TablerDelete,
    TablerSelect,
} from '@tak-ps/vue-tabler';

const columns = defineModel<Array<BoardColumn>>('columns', { required: true });

const emit = defineEmits<{
    (e: 'error', err: Error): void;
    (e: 'open-event', id: string): void;
}>();

/** Placements flattened in Board order - Columns are already position sorted */
const rows = computed<Array<{ column: BoardColumn; placement: CoreEventBoardEvent }>>(() => {
    return columns.value.flatMap((column) => {
        return column.events.map((placement) => {
            return { column, placement };
        });
    });
});

const columnNames = computed<Array<string>>(() => {
    return columns.value.map((column) => column.name);
});

/** A move held back by required Forms - `apply` finishes it once the wizard completes */
const formWizard = ref<{
    forms: Array<CoreForm>;
    eventId: string;
    eventName: string;
    apply: () => Promise<void>;
} | undefined>();

/** Re-keying the Column selects snaps a cancelled move's select back to the real Column */
const selectEpoch = ref(0);

async function moveEvent(row: { column: BoardColumn; placement: CoreEventBoardEvent }, name: string): Promise<void> {
    const target = columns.value.find((column) => column.name === name);

    if (!target || target.id === row.column.id) return;

    try {
        const missing = await missingRequiredForms(target.id, row.placement.event.id);

        if (missing.length) {
            formWizard.value = {
                forms: missing,
                eventId: row.placement.event.id,
                eventName: row.placement.event.name,
                apply: () => applyMove(row, target),
            };
            return;
        }

        await applyMove(row, target);
    } catch (err) {
        emit('error', err instanceof Error ? err : new Error(String(err)));
    }
}

async function applyMove(row: { column: BoardColumn; placement: CoreEventBoardEvent }, target: BoardColumn): Promise<void> {
    const position = target.events.length;

    const res = await server.PATCH('/api/board/event/{:placement}', {
        params: { path: { ':placement': row.placement.id } },
        body: { column: target.id, position }
    });

    if (res.error) throw new Error(res.error.message);

    row.column.events = row.column.events.filter((p) => p.id !== row.placement.id);
    row.placement.column = target.id;
    row.placement.position = position;
    target.events.push(row.placement);
}

async function completeFormWizard(): Promise<void> {
    const pending = formWizard.value;
    formWizard.value = undefined;

    if (!pending) return;

    try {
        await pending.apply();
    } catch (err) {
        emit('error', err instanceof Error ? err : new Error(String(err)));
    }
}

function closeFormWizard(): void {
    formWizard.value = undefined;
    selectEpoch.value += 1;
}

function creator(event: CoreEvent): string {
    if (event.username) return event.username;
    if (event.connection !== null) return `Connection #${event.connection}`;
    return 'Unknown Creator';
}

function priorityBadgeClass(event: CoreEvent): string {
    return {
        critical: 'bg-red text-red-fg',
        high: 'bg-orange text-orange-fg',
        medium: 'bg-yellow text-yellow-fg',
        low: 'bg-blue text-blue-fg',
        none: 'bg-secondary text-secondary-fg',
    }[event.priority] || 'bg-secondary text-secondary-fg';
}

async function removeEvent(column: BoardColumn, placement: CoreEventBoardEvent): Promise<void> {
    try {
        const res = await server.DELETE('/api/board/event/{:placement}', {
            params: { path: { ':placement': placement.id } }
        });

        if (res.error) throw new Error(res.error.message);

        column.events = column.events.filter((p) => p.id !== placement.id);
    } catch (err) {
        emit('error', err instanceof Error ? err : new Error(String(err)));
    }
}
</script>

<style>
.event-board .event-board-list thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--tblr-bg-surface);
}

.event-board .event-board-list-name {
    max-width: 400px;
    display: inline-block;
}

.event-board .event-board-list-location {
    max-width: 220px;
}

.event-board .event-board-list-col {
    min-width: 140px;
}

.event-board .event-board-list-priority {
    min-width: 100px;
}

.event-board .event-board-list-date {
    min-width: 170px;
}

.event-board .event-board-list-actions {
    width: 44px;
}
</style>
