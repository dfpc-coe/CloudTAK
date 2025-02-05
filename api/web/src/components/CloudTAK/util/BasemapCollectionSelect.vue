<template>
    <div>
        <div class='col-12 d-flex align-items-center'>
            <TablerIconButton
                :title='opened ? "Open Selection" : "Close Selection"'
                @click='opened = !opened'
            >
                <IconChevronRight
                    v-if='!opened'
                    :size='32'
                    stroke='1'
                />
                <IconChevronDown
                    v-else
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <label>Basemap Collection</label>
        </div>

        <template v-if='opened'>
            <TablerInput
                v-model='filter'
                label='Collection Selection'
                placeholder='Filter Collections...'
            />

            <TablerLoading
                v-if='loading'
                desc='Loading Collections'
            />
            <TablerNone
                v-else-if='!filtered.length'
                label='Groups'
                :create='false'
            />
            <template v-else>
                <div
                    class='my-2 overflow-auto'
                    style='height: 25vh;'
                >
                    <div
                        v-for='group in filtered'
                        :key='group'
                        class='col-12 cursor-pointer'
                        @click='updateGroup(group)'
                    >
                        <IconCircleFilled
                            v-if='selected.has(group)'
                            :size='32'
                            stroke='1'
                            class='cursor-pointer'
                        />
                        <IconCircle
                            v-else
                            :size='32'
                            troke='1'
                            class='cursor-pointer'
                        />
                        <span
                            class='mx-2'
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
import { std, stdurl } from '../../../std.ts';
import { useProfileStore } from '../../../stores/profile.ts';
import type { Group } from '../../../types.ts';
import {
    TablerIconButton,
    TablerLoading,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    IconCircle,
    IconChevronRight,
    IconChevronDown,
    IconInfoCircle,
    IconCircleFilled
} from '@tabler/icons-vue';

const props = defineProps<{
    connection?: number,
    limit?: number,
    modelValue: Array<string>
}>();

const emit = defineEmits([
    'update:modelValue'
]);

const opened = ref(false);

const profile = useProfileStore();
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
        list = await profile.loadChannels();
    }

    const channels: Record<string, Group> = {};

    JSON.parse(JSON.stringify(list)).sort((a: Group, b: Group) => {
        return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
    }).forEach((channel: Group) => {
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
