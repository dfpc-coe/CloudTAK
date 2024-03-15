<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class="modal-body py-4">
            <template v-if='loading'>
                <TablerLoading/>
            </template>
            <template v-else-if='!newtask'>
                <h3 class='subtitle-header'>Available Tasks:</h3>
                <div class="list-group list-group-flush">
                    <a @click='newtask = image' :key='image' v-for='image in Object.keys(list.items)' class='list-group-item list-group-item-action cursor-pointer' v-text='image'/>
                </div>
            </template>
            <template v-else-if='!version'>
                <div class='d-flex'>
                    <IconArrowBack size='32' class='mx-3' @click='newtask=null'/>
                    <h3 class='subtitle-header'>Available Versions</h3>
                </div>

                <div class="list-group list-group-flush">
                    <a @click='version = v' :key='v' v-for='v in list.items[newtask]' class='list-group-item list-group-item-action cursor-pointer' v-text='v'/>
                </div>
            </template>
            <template v-else>
                <div class='d-flex'>
                    <IconArrowBack size='32' class='mx-3' @click='version=null'/>
                    <h3 class='subtitle-header'>Selected Task</h3>
                </div>

                <pre v-text='`${newtask}-v${version}`'></pre>

                <div class='d-flex'>
                    <div class='ms-auto'>
                        <div @click='$emit("task", `${newtask}-v${version}`)' class='btn btn-primary'>
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
    IconArrowBack
} from '@tabler/icons-vue'
import {
    TablerLoading,
    TablerModal,
} from '@tak-ps/vue-tabler';

export default {
    name: 'TaskModal',
    props: {
        task: {
            type: String,
            default: ''
        }
    },
    data: function() {
        return {
            loading: true,
            newtask: false,
            version: false,
            list: {
                total: 0,
                items: {}
            }
        }
    },
    mounted: async function() {
        await this.fetch();

        const task = this.task.replace(/-v[0-9]+\.[0-9]+\.[0-9]+$/, '');
        if (this.list.items[task]) this.newtask = task;
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
        IconArrowBack,
        TablerLoading,
        TablerModal
    }
}
</script>
