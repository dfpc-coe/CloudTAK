<template>
    <div>
        <!-- Compact single-selected display when limit=1 and a channel is chosen -->
        <template v-if='props.limit === 1 && selected.size === 1'>
            <div
                class='d-flex align-items-center gap-2 px-3 form-select'
                style='cursor: default;'
            >
                <span
                    class='flex-grow-1 user-select-none text-truncate'
                    v-text='Array.from(selected)[0]'
                />
                <IconX
                    v-if='!props.disabled'
                    :size='16'
                    stroke='1'
                    class='cursor-pointer flex-shrink-0 text-muted'
                    @click.stop='clearSelection'
                />
            </div>
        </template>

        <template v-else>
            <div
                class='sticky-top pb-2 border-bottom'
                style='background-color: var(--tblr-modal-bg, var(--tblr-bg-surface, var(--tblr-body-bg))); z-index: 1;'
            >
                <TablerInput
                    v-model='filter'
                    icon='search'
                    placeholder='Filter Channels...'
                />
            </div>

            <div
                v-if='props.limit && props.limit > 1'
                class='alert alert-info mt-2'
                role='alert'
            >
                <div class='d-flex align-items-center'>
                    <IconInfoCircle /><span class='mx-1'>Select up to&nbsp;<span v-text='props.limit' />&nbsp;Channels</span>
                </div>
            </div>

            <TablerLoading
                v-if='loading'
                desc='Loading Channels'
            />
            <TablerNone
                v-else-if='!filtered.length'
                label='No Groups'
                :create='false'
            />
            <template v-else>
                <div
                    class='my-2 mx-2 overflow-auto'
                >
                    <div
                        v-for='group in filtered'
                        :key='group'
                        class='col-12'
                        :style='{
                            "color": props.disabled ? "var(--tblr-gray-500)" : "var(--tblr-body-color)",
                        }'
                        :class='{
                            "cursor-pointer": !props.disabled,
                        }'
                        @click='props.disabled ? null : updateGroup(group)'
                    >
                        <IconCircleFilled
                            v-if='selected.has(group)'
                            :size='32'
                            stroke='1'
                        />
                        <IconCircle
                            v-else
                            :size='32'
                            stroke='1'
                        />
                        <span
                            class='mx-2 user-select-none'
                            v-text='group'
                        />
                    </div>
                </div>
            </template>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { std, stdurl } from '../../../src/std.ts';
import type { Group, GroupChannel } from '../../../src/types.ts';
import {
    TablerLoading,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    IconCircle,
    IconInfoCircle,
    IconCircleFilled,
    IconX
} from '@tabler/icons-vue';
import GroupManager from '../../base/group.ts';

const props = defineProps<{
    disabled?: boolean,
    connection?: number,
    limit?: number,
    active?: boolean,
    modelValue: Array<string>
}>();

const emit = defineEmits([
    'update:modelValue'
]);

const filter = ref('');
const loading = ref(true);
const selected = ref<Set<string>>(new Set(props.modelValue))
const groups = ref<Record<string, GroupChannel>>({});

const filtered = computed(() => {
    return Object.keys(groups.value).filter((g) => {
        return g.toLowerCase().includes(filter.value.toLowerCase());
    });
})

onMounted(async () => {
    await fetch();
});

function updateGroup(group: string) {
    if (selected.value.has(group)) {
        selected.value.delete(group)
    } else {
        if (props.limit && selected.value.size >= props.limit) {
            throw new Error(`Cannot select more than ${props.limit} Channels`);
        }

        selected.value.add(group)
    }

    emit('update:modelValue', Array.from(selected.value));
}

function clearSelection() {
    selected.value.clear();
    emit('update:modelValue', []);
}

async function fetch() {
    loading.value = true;

    let list: Group[];
    if (props.connection) {
        const url = stdurl(`/api/connection/${props.connection}/channel`);
        list = (await std(url) as {
            data: Group[]
        }).data;
    } else {
        list = GroupManager.explode(await GroupManager.list());
    }

    const channels: Record<string, GroupChannel> = {};

    GroupManager.merge(list).sort((a: GroupChannel, b: GroupChannel) => {
        return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
    }).forEach((channel: GroupChannel) => {
        if (props.active && !channel.active) {
            return;
        }

        channels[channel.name] = channel;
    });

    groups.value = channels;

    loading.value = false;
}
</script>
