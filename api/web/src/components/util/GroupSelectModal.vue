<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class='modal-header'>
            <div class='modal-title'>Channel Selection</div>
        </div>
        <div class="modal-body row">
            <TablerLoading v-if='loading.groups'  desc='Loading Channels'/>
            <template v-else>
                <div @click='updateGroup(group)' :key='group.name' v-for='group in list.data' class='col-12 cursor-pointer'>
                    <CircleFilledIcon  v-if='selected.has(group.name)' class='cursor-pointer'/>
                    <CircleIcon v-else class='cursor-pointer'/>
                    <span v-text='group.name' class='mx-2'/>
                </div>
                <div class="col-12 mt-3">
                    <button :disabled='disabled' @click='$emit("close")' class="cursor-pointer btn w-100">Done</button>
                </div>
            </template>
        </div>
    </TablerModal>
</template>

<script>
import {
    TablerModal,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    CircleIcon,
    CircleFilledIcon
} from 'vue-tabler-icons';

export default {
    name: 'GroupSelectModal',
    props: {
        disabled: {
            type: Boolean
        },
        button: {
            type: Boolean,
            default: false
        },
        modelValue: {
            type: Array,
            default: []
        }
    },
    data: function() {
        return {
            loading: {
                groups: true,
                generate: false
            },
            selected: new Set(this.modelValue),
            list: {
                data: []
            }
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
            this.list = await window.std('/api/marti/group');
            this.loading.groups = false;
        },
        close: function() {
            this.$emit('close');
        },
    },
    components: {
        CircleIcon,
        CircleFilledIcon,
        TablerModal,
        TablerInput,
        TablerLoading
    }
}
</script>
