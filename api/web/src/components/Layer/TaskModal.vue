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
                <div class='d-flex'>
                    <ArrowBackIcon class='mx-3' @click='task=null'/>
                    <h3 class='subtitle-header'>Available Versions</h3>
                </div>

                <div class="list-group list-group-flush">
                    <a @click='version = v' :key='v' v-for='v in list.tasks[task]' class='list-group-item list-group-item-action cursor-pointer' v-text='v'/>
                </div>
            </template>
            <template v-else>
                <div class='d-flex'>
                    <ArrowBackIcon class='mx-3' @click='version=null'/>
                    <h3 class='subtitle-header'>Selected Task</h3>
                </div>

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
    ArrowBackIcon
} from 'vue-tabler-icons'
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
        ArrowBackIcon,
        TablerLoading,
        TablerModal
    }
}
</script>
