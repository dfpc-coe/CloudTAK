<template>
    <TablerModal
        style='height: 80vh;'
    >
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
        <div
            class='modal-body overflow-auto'
            style='height: 50vh;'
        >
            <GroupSelect
                :model-value='modelValue'
                :disabled='disabled'
                :button='button'
                :connection='connection'
                @update:model-value='$emit("update:modelValue", $event)'
            />
        </div>
        <div class='modal-footer'>
            <TablerButton
                class='btn btn-primary'
                @click='$emit("close")'
            >Submit</TablerButton>
        </div>
    </TablerModal>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerModal,
    TablerButton
} from '@tak-ps/vue-tabler';
import GroupSelect from './GroupSelect.vue';

export default {
    name: 'GroupSelectModal',
    components: {
        GroupSelect,
        TablerModal,
        TablerButton
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
            if (this.selected.has(group.name)) {
                this.selected.delete(group.name)
            } else {
                this.selected.add(group.name)
            }

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
