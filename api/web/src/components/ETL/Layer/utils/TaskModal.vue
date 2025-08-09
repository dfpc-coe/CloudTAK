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
            <div class='row g-0'>
                <div class='col-12 col-md-3 border-end'>
                    <div class='card-header'>
                        <div class='card-title subheader'>
                            Task Selection
                        </div>
                    </div>

                    <div class='pb-2'>
                        <TablerInput
                            v-model='paging.filter'
                            placeholder='Filter Tasks'
                        />
                    </div>

                    <TablerLoading
                        v-if='loading.tasks'
                        desc='Loading Tasks'
                    />
                    <template v-else>
                        <div class='card-body'>
                            <div
                                role='menu'
                                class='list-group'
                            >
                                <span
                                    v-for='t of list.items'
                                    :key='t.prefix'
                                    tabindex='0'
                                    role='menuitem'
                                    class='list-group-item list-group-item-action d-flex align-items-center'
                                    :class='{
                                        "active": current.prefix === t.prefix,
                                        "cursor-pointer": current.prefix !== t.prefix
                                    }'
                                    @click='current = t'
                                >
                                    <span
                                        class='mx-3'
                                        v-text='t.name'
                                    />
                                </span>
                            </div>
                        </div>
                    </template>

                    <div class='col-lg-12 py-2 d-flex'>
                        <div class='ms-auto'>
                            <TablerPager
                                v-if='list.total > paging.limit'
                                :page='paging.page'
                                :total='list.total'
                                :limit='paging.limit'
                                @page='paging.page = $event'
                            />
                        </div>
                    </div>
                </div>
                <div class='col-12 col-md-9 position-relative px-4'>
                    <TablerLoading
                        v-if='loading.task'
                        desc='Loading Task'
                    />
                    <TablerNone
                        v-else-if='!current'
                        :create='false'
                    />
                    <div v-else>
                        <div class='card-header d-flex align-items-center'>
                            <div
                                class='card-title subheader'
                                v-text='`${current.name} (${current.prefix})`'
                            />
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
                                        <TablerEnum
                                            v-model='version'
                                            :options='versions'
                                        />
                                    </div>
                                    <div class='col-md-4'>
                                        <button
                                            class='btn btn-primary w-100'
                                            style='margin-top: 8px;'
                                            @click='$emit("task", `${current.prefix}-v${version}`)'
                                        >
                                            Select
                                        </button>
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
        </div>
    </TablerModal>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerMarkdown,
    TablerLoading,
    TablerInput,
    TablerPager,
    TablerModal,
    TablerNone,
    TablerEnum,
} from '@tak-ps/vue-tabler';

export default {
    name: 'TaskModal',
    components: {
        TablerLoading,
        TablerMarkdown,
        TablerPager,
        TablerInput,
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
            paging: {
                filter: '',
                limit: 10,
                page: 0
            },
            list: {
                total: 0,
                items: {}
            }
        }
    },
    watch: {
        current: async function() {
            await this.fetchTask();
        },
        paging: {
            deep: true,
            handler: async function() {
                await this.fetchTasks();
            },
        }
    },
    mounted: async function() {
        await this.fetchTasks();
    },
    methods: {
        fetchTask: async function() {
            if (!this.current) {
                this.versions = [];
            } else {
                this.loading.task = true;
                const task = await std(`/api/task/raw/${this.current.prefix}`);

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
            const url = stdurl('/api/task');

            url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);

            this.list = await std(url);

            if (this.list.total) {
                this.current = this.list.items[0];
            }

            this.loading.tasks = false;
        }
    }
}
</script>
