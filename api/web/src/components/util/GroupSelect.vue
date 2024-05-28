<template>
<div class='modal-body'>
    <TablerInput
        label='Channel Selection'
        placeholder='Filter Channels...'
        v-model='filter'
    />

    <TablerLoading
        v-if='loading.groups'
        desc='Loading Channels'
    />
    <TablerNone
        v-else-if='!filtered.length'
        label='Groups'
        :create='false'
    />
    <template v-else>
        <div class='my-2'>
            <div
                v-for='group in filtered'
                :key='group.name'
                class='col-12 cursor-pointer'
                @click='updateGroup(group)'
            >
                <IconCircleFilled
                    v-if='selected.has(group.name)'
                    size='32'
                    class='cursor-pointer'
                />
                <IconCircle
                    v-else
                    size='32'
                    class='cursor-pointer'
                />
                <span
                    class='mx-2'
                    v-text='group.name'
                />
            </div>
        </div>
    </template>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerLoading,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    IconCircle,
    IconCircleFilled
} from '@tabler/icons-vue';

export default {
    name: 'GroupSelectModal',
    components: {
        IconCircle,
        IconCircleFilled,
        TablerNone,
        TablerInput,
        TablerLoading
    },
    props: {
        disabled: {
            type: Boolean
        },
        button: {
            type: Boolean,
            default: false
        },
        connection: {
            type: Number
        },
        modelValue: {
            type: Array,
            default: function() {
                return []
            }
        }
    },
    emits: [
        'update:modelValue'
    ],
    computed: {
        filtered: function() {
            return this.groups.filter((g) => {
                return g.includes(this.prefix);
            });
        }
    },
    data: function() {
        return {
            filter: '',
            loading: {
                groups: true,
            },
            selected: new Set(this.modelValue),
            groups: []
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        updateGroup: function(group) {
            this.selected.has(group.name) ? this.selected.delete(group.name) : this.selected.add(group.name)
            this.$emit('update:modelValue', Array.from(this.selected));
        },
        fetch: async function() {
            this.loading.groups = true;

            let list;
            if (this.connection) {
                const url = stdurl(`/api/connection/${this.connection}/channel`);
                list = await std(url);
            } else {
                const url = stdurl('/api/marti/group');
                list = await std(url);
            }

            const channels = {};

            JSON.parse(JSON.stringify(list.data)).sort((a, b) => {
                return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
            }).forEach((channel) => {
                if (channels[channel.name]) {
                    channels[channel.name].direction.push(channel.direction);
                } else {
                    channel.direction = [channel.direction];
                    channels[channel.name] = channel;
                }
            });

            this.groups = channels;

            this.loading.groups = false;
        },
    }
}
</script>
