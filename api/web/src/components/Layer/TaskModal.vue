<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class="modal-body py-4">
            <template v-if='loading'>
                <TablerLoading/>
            </template>
            <template v-else-if='!task'>
                <h3 class='subtitle-header'>Available Tasks:</h3>
                <div class="list-group list-group-flush">
                    <a @click='task = image' :key='image' v-for='image in Object.keys(list.tasks)' class='list-group-item list-group-item-action cursor-pointer' v-text='image'/>
                </div>
            </template>
            <template v-else-if='!version'>
                <h3 class='subtitle-header'>Available Versions</h3>

                <div class="list-group list-group-flush">
                    <a @click='version = v' :key='v' v-for='v in list.tasks[task]' class='list-group-item list-group-item-action cursor-pointer' v-text='v'/>
                </div>
            </template>
            <template v-else>
                <h3 class='subtitle-header'>Selected Task</h3>

                <pre v-text='`${task}-v${version}`'></pre>

                <div class='d-flex'>
                    <div class='ms-auto'>
                        <div @click='$emit("task", `${task}-v${version}`)' class='btn btn-primary'>
                            Select
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </TablerModal>
</template>

<script>
import {
    TablerLoading,
    TablerModal,
} from '@tak-ps/vue-tabler';

export default {
    name: 'TaskModal',
    data: function() {
        return {
            loading: true,
            task: false,
            version: false,
            list: {
                total: 0,
                tasks: []
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        close: function() {
            this.$emit('close');
        },
        fetch: async function() {
            this.loading = true;
            this.list = await window.std('/api/task');
            this.loading = false;
        }
    },
    components: {
        TablerLoading,
        TablerModal
    }
}
</script>
