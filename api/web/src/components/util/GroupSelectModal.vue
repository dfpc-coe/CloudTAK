<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='close'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-header'>
            <div class='modal-title'>
                Channel Selection
            </div>
        </div>
        <div class='modal-body row'>
            <TablerLoading
                v-if='loading.groups'
                desc='Loading Channels'
            />
            <template v-else>
                <div
                    v-for='group in groups'
                    :key='group.name'
                    class='col-12 cursor-pointer'
                    @click='updateGroup(group)'
                >
                    <IconCircleFilled
                        v-if='selected.has(group.name)'
                        :size='32'
                        :stroke='1'
                        class='cursor-pointer'
                    />
                    <IconCircle
                        v-else
                        :size='32'
                        :stroke='1'
                        class='cursor-pointer'
                    />
                    <span
                        class='mx-2'
                        v-text='group.name'
                    />
                </div>
                <div class='col-12 mt-3'>
                    <button
                        :disabled='disabled'
                        class='cursor-pointer btn w-100'
                        @click='$emit("close")'
                    >
                        Done
                    </button>
                </div>
            </template>
        </div>
    </TablerModal>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerModal,
    TablerLoading
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
        TablerModal,
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
        'close',
        'update:modelValue'
    ],
    data: function() {
        return {
            loading: {
                groups: true,
                generate: false
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
        close: function() {
            this.$emit('close');
        },
    }
}
</script>
