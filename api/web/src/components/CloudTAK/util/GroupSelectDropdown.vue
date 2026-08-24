<template>
    <TablerDropdown
        :width='menuWidth'
        position='bottom-start'
        class='group-select'
    >
        <template #default>
            <div
                ref='trigger'
                class='form-select d-flex align-items-center gap-2 w-100 group-select-trigger'
                :class='{ "cursor-pointer": !props.disabled }'
                role='button'
                :tabindex='props.disabled ? -1 : 0'
                :aria-label='props.placeholder'
            >
                <IconUsersGroup
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
                class='group-select-menu'
                :style='{ width: `${menuWidth}px` }'
            >
                <div class='d-flex align-items-center px-3 py-2 border-bottom'>
                    <h3 class='m-0 fw-bold'>
                        Channels
                    </h3>
                    <div class='ms-auto btn-list'>
                        <TablerIconButton
                            title='Refresh Channels'
                            @click.stop='listChannels'
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

                <div
                    class='px-2 pb-2 overflow-auto group-select-list'
                >
                    <TablerLoading
                        v-if='loading'
                        :compact='true'
                        desc='Loading Channels'
                    />
                    <TablerAlert
                        v-else-if='error'
                        :err='error'
                    />
                    <template v-else>
                        <div
                            v-for='channel of filtered'
                            :key='channel.bitpos'
                            class='col-12 py-1 px-2 cloudtak-hover cursor-pointer user-select-none d-flex align-items-center gap-2'
                            @click='emit("update:modelValue", channel.bitpos)'
                        >
                            <IconCheck
                                v-if='channel.bitpos === props.modelValue'
                                :size='20'
                                stroke='1.5'
                                class='flex-shrink-0'
                            />
                            <span
                                v-else
                                class='flex-shrink-0 group-select-gutter'
                            />
                            <span
                                class='text-truncate'
                                v-text='channel.name'
                            />
                        </div>
                        <TablerNone
                            v-if='!filtered.length'
                            :compact='true'
                            :create='false'
                            :label='channels.length ? "No Matching Channels" : "No Channels"'
                        />
                    </template>
                </div>
            </div>
        </template>
    </TablerDropdown>
</template>

<script setup lang='ts'>
/**
 * GroupSelectDropdown - single TAK Channel picker rendered as a searchable
 * dropdown, styled after the Drawing Tools dropdown. Unlike the multi-select
 * `GroupSelect` this owns the Channel fetch rather than the caller; the list is
 * emitted once loaded so a parent can resolve a default selection against it.
 */

import { ref, computed, onMounted } from 'vue';
import GroupManager from '../../../base/group.ts';
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
    IconUsersGroup,
} from '@tabler/icons-vue';

export type GroupSelectChannel = {
    name: string;
    bitpos: number;
};

const props = withDefaults(defineProps<{
    /** TAK Channel bitpos currently selected */
    modelValue?: number;
    /** Only offer Channels the user currently has active */
    active?: boolean;
    placeholder?: string;
    disabled?: boolean;
}>(), {
    modelValue: undefined,
    active: false,
    placeholder: 'Select a Channel',
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: number): void;
    (e: 'channels', channels: Array<GroupSelectChannel>): void;
}>();

const search = ref('');
const loading = ref(true);
const error = ref<Error | undefined>();
const channels = ref<Array<GroupSelectChannel>>([]);

const trigger = ref<HTMLElement | undefined>();
const { width: menuWidth } = useTriggerWidth(trigger);

const selected = computed<GroupSelectChannel | undefined>(() => {
    return channels.value.find((channel) => channel.bitpos === props.modelValue);
});

const filtered = computed<Array<GroupSelectChannel>>(() => {
    const term = search.value.trim().toLowerCase();

    if (!term) return channels.value;

    return channels.value.filter((channel) => channel.name.toLowerCase().includes(term));
});

onMounted(async () => {
    await listChannels();
});

async function listChannels(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    try {
        const groups = await GroupManager.list(props.active ? { active: true } : {});

        channels.value = groups
            .map((group) => ({ name: group.name, bitpos: group.bitpos }))
            .sort((a, b) => a.name.localeCompare(b.name));

        emit('channels', channels.value);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));

        // A failed list still has to unblock a parent waiting to resolve its
        // initial selection
        emit('channels', []);
    }

    loading.value = false;
}
</script>

<style>
.group-select {
    max-width: 100%;
}

/* The trigger borrows `form-select` so it lines up with the native selects it
   sits beside - that class also draws the caret */
.group-select-trigger {
    min-width: 0;
}

.group-select-menu .group-select-list {
    max-height: 300px;
}

.group-select-menu .group-select-gutter {
    width: 20px;
}
</style>
