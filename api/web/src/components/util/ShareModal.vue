<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class='modal-header'>
            <div class='modal-title'>Share in TAK</div>
        </div>
        <div class="modal-body row">
            <TablerLoading v-if='loading.groups'  desc='Loading Channels'/>
            <template v-else>
                <div :key='group.name' v-for='group in list.data' class='col-12'>
                    <CircleFilledIcon @click='selected.remove(group.name)' v-if='selected.has(group.name)' class='cursor-pointer'/>
                    <CircleIcon @click='selected.add(group.name)' v-else class='cursor-pointer'/>
                    <span v-text='group.name' class='mx-2'/>
                </div>
                <div class="col-12 mt-3">
                    <button disabled @click='share' class="cursor-pointer btn w-100">Sharing Disabled</button>
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
    name: 'ShareModal',
    data: function() {
        return {
            loading: {
                groups: true,
                generate: false
            },
            selected: new Set(),
            list: {
                data: []
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        share: async function() {
            this.loading.generate = true;
            const res = await window.std('/api/marti/signClient', {
                method: 'POST',
                body: this.body
            });

            this.$emit('certs', res);
            this.$emit('close');
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
