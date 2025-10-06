<template>
    <div>
        <div class='sticky-top py-2 border-bottom'>
            <TablerInput
                v-model='filter'
                icon='search'
                placeholder='Filter Channels...'
            />
        </div>

        <div
            v-if='props.limit'
            class='alert alert-info mt-2'
            role='alert'
        >
            <div class='d-flex align-items-center'>
                <IconInfoCircle /><span class='mx-1'>Select up to&nbsp;<span v-text='props.limit' />&nbsp;Channel<span v-text='props.limit > 1 ? "s" : ""' /></span>
            </div>
        </div>

        <TablerLoading
            v-if='loading'
            desc='Loading Channels'
        />
        <TablerNone
            v-else-if='!filtered.length'
            label='Groups'
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
                        troke='1'
                    />
                    <span
                        class='mx-2 user-select-none'
                        v-text='group'
                    />
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { std, stdurl } from '../../../src/std.ts';
import type { Group } from '../../../src/types.ts';
import {
    TablerLoading,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    IconCircle,
    IconInfoCircle,
    IconCircleFilled
} from '@tabler/icons-vue';

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
const groups = ref<Record<string, Group>>({});

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

async function fetch() {
    loading.value = true;

    let list: Group[];
    if (props.connection) {
        const url = stdurl(`/api/connection/${props.connection}/channel`);
        list = (await std(url) as {
            data: Group[]
        }).data;
    } else {
        const url = stdurl('/api/marti/group');
        url.searchParams.append('useCache', 'true');
        list = ((await std(url)) as {
            data: Group[]
        }).data
    }

    const channels: Record<string, Group> = {};

    JSON.parse(JSON.stringify(list)).sort((a: Group, b: Group) => {
        return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
    }).forEach((channel: Group) => {
        if (props.active && !channel.active) {
            return;
        }

        if (channels[channel.name]) {
            // @ts-expect-error Need to make these human readable strings instead of array to sync with type
            channels[channel.name].direction.push(channel.direction);
        } else {
            // @ts-expect-error Need to make these human readable strings instead of array to sync with type
            channel.direction = [channel.direction];
            channels[channel.name] = channel;
        }
    });

    groups.value = channels;

    loading.value = false;
}
</script>
