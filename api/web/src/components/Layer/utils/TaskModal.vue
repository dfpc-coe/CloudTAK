<template>
    <TablerModal size='xl'>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-body py-4'>
            <TablerLoading v-if='loading.tasks' desc='Loading Tasks'/>
            <template v-else>
                <div class='row g-0'>
                    <div class='col-12 col-md-3 border-end'>
                        <div class='card-header'>
                            <div class='card-title subheader'>
                                Task Selection
                            </div>
                        </div>
                        <div class='card-body'>
                            <div class='list-group list-group-transparent'>
                                <span
                                    :key='t.prefix'
                                    v-for='t of list.items'
                                    class='list-group-item list-group-item-action d-flex align-items-center'
                                    :class='{
                                        "active": current.prefix === t.prefix,
                                        "cursor-pointer": current.prefix !== t.prefix
                                    }'
                                    @click='current = t'
                                >
                                    <IconServer :size='32'/>

                                    <span class='mx-3' v-text='t.name'/>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class='col-12 col-md-9 position-relative'>
                        <TablerLoading v-if='loading.task' desc='Loading Task'/>
                        <TablerNone v-else-if='!current' :create='false'/>
                        <div v-else>
                            <div class='card-header d-flex align-items-center'>
                                <div class='card-title subheader' v-text='current.name'></div>

                                <div class='ms-auto btn-list'>
                                    <div class='subheader' v-text='`(${current.prefix})`'></div>

                                    <IconCode v-if='current.repo' :size='32' @click='external(current.repo)'/>
                                </div>
                            </div>
                            <div class='card-body'>
                                <TablerMarkdown
                                    class='card-body'
                                    :markdown='current.readme'
                                />
                            </div>
                            <div class='card-footer'>
                                <div class='row g-2'>
                                    <template v-if='versions.length'>
                                        <div class='col-md-8'>
                                            <TablerEnum :options='versions' v-model='version'/>
                                        </div>
                                        <div class='col-md-4'>
                                            <button @click='$emit("task", `${current.prefix}-v${version}`)' class='btn btn-primary w-100' style='margin-top: 8px;'>Select</button>
                                        </div>
                                    </template>
                                    <template v-else>
                                        Task is registered but contains no active versions
                                    </template>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </TablerModal>
</template>

<script>
import { std } from '/src/std.ts';
import {
    IconCode,
} from '@tabler/icons-vue'
import {
    TablerMarkdown,
    TablerLoading,
    TablerModal,
    TablerNone,
    TablerEnum,
} from '@tak-ps/vue-tabler';

export default {
    name: 'TaskModal',
    components: {
        IconCode,
        TablerLoading,
        TablerMarkdown,
        TablerModal,
        TablerNone,
        TablerEnum,
    },
    props: {
        task: {
            type: String,
            default: ''
        }
    },
    emits: [
        'task',
        'close'
    ],
    data: function() {
        return {
            loading: {
                version: false,
                tasks: true
            },
            current: false,
            version: '',
            versions: [],
            list: {
                total: 0,
                items: {}
            }
        }
    },
    watch: {
        current: async function() {
            await this.fetchTask();
        }
    },
    mounted: async function() {
        await this.fetchTasks();
    },
    methods: {
        external: function(repo) {
            window.open(repo, '_blank');
        },
        fetchTask: async function() {
            if (!this.current) {
                this.versions = [];
            } else {
                this.loading.task = true;
                const task = await std(`/api/task/raw/${this.current.prefix}`);

                console.error(task);

                this.versions = task.versions;

                if (this.versions.length) {
                    this.version = this.versions[0];
                }
            }

            if (this.current.readme) {
                const readme = await std(`/api/task/${this.current.id}/readme`);
                this.current.readme = readme.body;
            }

            this.loading.task = false;
        },
        fetchTasks: async function() {
            this.loading.tasks = true;
            this.list = await std('/api/task');

            if (this.list.total) {
                this.current = this.list.items[0];
            }

            this.loading.tasks = false;
        }
    }
}
</script>
