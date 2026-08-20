<template>
    <TablerDropdown
        :width='menuWidth'
        position='bottom-start'
        class='board-select'
    >
        <template #default>
            <div
                ref='trigger'
                class='form-select d-flex align-items-center gap-2 w-100 board-select-trigger'
                :class='{ "cursor-pointer": !props.disabled }'
                role='button'
                :tabindex='props.disabled ? -1 : 0'
                :aria-label='props.placeholder'
            >
                <IconLayoutKanban
                    :size='18'
                    stroke='1.5'
                    class='flex-shrink-0 text-secondary'
                />
                <span
                    class='flex-grow-1 text-truncate user-select-none'
                    style='min-width: 0;'
                    :class='{ "text-secondary": !selected }'
                    v-text='selected ? selected.name : props.placeholder'
                />
            </div>
        </template>

        <template #dropdown>
            <!-- Sized to the trigger so the panel doesn't spill under whatever
                 control sits beside it -->
            <div
                class='board-select-menu'
                :style='{ width: `${menuWidth}px` }'
            >
                <div class='d-flex align-items-center px-3 py-2 border-bottom'>
                    <h3 class='m-0 fw-bold'>
                        Boards
                    </h3>
                    <div class='ms-auto btn-list'>
                        <TablerIconButton
                            title='Refresh Boards'
                            @click.stop='listBoards'
                        >
                            <IconRefresh
                                :size='20'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                </div>

                <div class='px-3 py-2'>
                    <!-- The dropdown autocloses on any click it sees - the
                         search field has to swallow its own -->
                    <TablerInput
                        v-model='search'
                        placeholder='Search...'
                        icon='search'
                        :autofocus='true'
                        class='mb-0'
                        @click.stop
                    />
                </div>

                <div class='px-2 pb-2 overflow-auto board-select-list'>
                    <TablerLoading
                        v-if='loading'
                        :compact='true'
                        desc='Loading Boards'
                    />
                    <TablerAlert
                        v-else-if='error'
                        :err='error'
                    />
                    <template v-else>
                        <div
                            v-for='board of filtered'
                            :key='board.id'
                            class='col-12 py-1 px-2 cloudtak-hover cursor-pointer user-select-none d-flex align-items-center gap-2'
                            @click='emit("update:modelValue", board.id)'
                        >
                            <IconCheck
                                v-if='board.id === props.modelValue'
                                :size='20'
                                stroke='1.5'
                                class='flex-shrink-0'
                            />
                            <span
                                v-else
                                class='flex-shrink-0 board-select-gutter'
                            />
                            <div style='min-width: 0;'>
                                <div
                                    class='text-truncate'
                                    v-text='board.name'
                                />
                                <div
                                    v-if='board.description'
                                    class='small text-secondary text-truncate'
                                    v-text='board.description'
                                />
                            </div>
                        </div>
                        <TablerNone
                            v-if='!filtered.length'
                            :compact='true'
                            :create='false'
                            :label='boards.length ? "No Matching Boards" : "No Boards"'
                        />
                    </template>
                </div>
            </div>
        </template>
    </TablerDropdown>
</template>

<script setup lang='ts'>
/**
 * BoardSelectDropdown - picker for the KanBan Boards of a single TAK Channel,
 * styled to match GroupSelectDropdown. The Board list is fetched here and
 * emitted so a parent can resolve a default selection and drive Board actions
 * against it; `refresh` is exposed for parents that create or delete Boards.
 */

import { ref, computed, watch } from 'vue';
import { server } from '../../../std.ts';
import type { CoreEventBoard } from '../../../types.ts';
import { useTriggerWidth } from '../../../utils/trigger-width.ts';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconCheck,
    IconRefresh,
    IconLayoutKanban,
} from '@tabler/icons-vue';

const props = withDefaults(defineProps<{
    /** Board id currently selected */
    modelValue?: string;
    /** TAK Channel bitpos to list Boards for */
    channel?: number;
    placeholder?: string;
    disabled?: boolean;
}>(), {
    modelValue: undefined,
    channel: undefined,
    placeholder: 'Select a Board',
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'boards', boards: Array<CoreEventBoard>): void;
    (e: 'error', error: Error): void;
}>();

const search = ref('');
const loading = ref(false);
const error = ref<Error | undefined>();
const boards = ref<Array<CoreEventBoard>>([]);

const trigger = ref<HTMLElement | undefined>();
const { width: menuWidth } = useTriggerWidth(trigger);

const selected = computed<CoreEventBoard | undefined>(() => {
    return boards.value.find((board) => board.id === props.modelValue);
});

const filtered = computed<Array<CoreEventBoard>>(() => {
    const term = search.value.trim().toLowerCase();

    if (!term) return boards.value;

    return boards.value.filter((board) => {
        return board.name.toLowerCase().includes(term)
            || board.description.toLowerCase().includes(term);
    });
});

watch(() => props.channel, async () => {
    await listBoards();
}, { immediate: true });

/**
 * Listing a Channel also materialises its automatically managed Board, so this
 * is the call that guarantees a Channel has something to select
 */
async function listBoards(): Promise<void> {
    if (props.channel === undefined) {
        boards.value = [];
        emit('boards', []);
        return;
    }

    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/board', {
            params: { query: { channel: props.channel } }
        });

        if (res.error) throw new Error(res.error.message);

        boards.value = res.data.items;
    } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err));

        boards.value = [];
        error.value = wrapped;
        emit('error', wrapped);
    }

    loading.value = false;

    // Emitted even on failure so a parent waiting to resolve its initial
    // selection isn't left hanging
    emit('boards', boards.value);
}

defineExpose({ refresh: listBoards });
</script>

<style>
.board-select {
    max-width: 100%;
}

/* The trigger borrows `form-select` so it lines up with the controls beside it -
   that class also draws the caret */
.board-select-trigger {
    min-width: 0;
}

.board-select-menu .board-select-list {
    max-height: 300px;
}

.board-select-menu .board-select-gutter {
    width: 20px;
}
</style>
