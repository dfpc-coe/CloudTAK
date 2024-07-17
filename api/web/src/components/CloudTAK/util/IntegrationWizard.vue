<template>
    <TablerModal size='xl'>
        <div class='modal-status bg-blue' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />

        <div class='modal-header'>
            <div class='strong d-flex align-items-center'>
                <template v-if='!connection'>
                    <IconInfoHexagon
                        :stroke='1'
                        :size='20'
                        class='me-2'
                    />
                    Select Connection
                </template>
                <template v-else-if='!template'>
                    <IconInfoHexagon
                        :stroke='1'
                        :size='20'
                        class='me-2'
                    />
                    Select an Integration Template
                </template>
                <template v-else-if='!layer'>
                    <IconInfoHexagon
                        :stroke='1'
                        :size='20'
                        class='me-2'
                    />
                    Integration Template Installation
                </template>
                <template v-else-if='!stack'>
                    <IconInfoHexagon
                        :stroke='1'
                        :size='20'
                        class='me-2'
                    />
                    Integration Template Installation
                </template>
                <template v-else-if='stack'>
                    <IconInfoHexagon
                        :stroke='1'
                        :size='20'
                        class='me-2'
                    />
                    Installing Integration
                </template>
            </div>
        </div>
        <div
            class='modal-body overflow-auto position-relative'
            style='height: 60vh;'
        >
            <TablerLoading
                v-if='loading'
                :desc='loading'
            />
            <template v-else-if='!connection'>
                <ConnectionSelect v-model='connection' />
            </template>
            <template v-else-if='!template'>
                <TemplateSelect v-model='template' />
            </template>
            <template v-else-if='template && !stack'>
                <div class='row g-2'>
                    <div class='col-12'>
                        <TablerInput
                            v-model='integration.name'
                            label='Name'
                            :placeholder='`${template.name} 2024-01-01 Lost Hiker`'
                        />
                    </div>
                    <div class='col-12'>
                        <TablerInput
                            v-model='integration.description'
                            label='Description'
                            :placeholder='`${template.name} 2024-01-01 Lost Hiker`'
                            :rows='2'
                        />
                    </div>
                    <div v-if='template.datasync'>
                        <ChannelSelect
                            v-model='integration.channels'
                            :connection='connection'
                        />
                    </div>
                    <div class='col-12 d-flex'>
                        <div class='ms-auto'>
                            <button
                                :disabled='isIntegrationNextable'
                                class='btn btn-primary'
                                @click='createIntegration'
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else-if='stack && !complete'>
                <LayerEnvironment
                    :editing='true'
                    :layer='layer'
                    @layer='complete = true'
                />
            </template>
            <template v-else-if='complete'>
                <div class='d-flex justify-content-center py-4'>
                    <IconCircleCheck
                        :size='48'
                        :stroke='1'
                    />
                </div>
                <div class='d-flex justify-content-center'>
                    Integration Creation Complete
                </div>
                <div class='position-absolute bottom-0 mb-3 mx-3 start-0 end-0'>
                    <div class='d-flex'>
                        <div class='ms-auto'>
                            <button
                                class='btn btn-primary'
                                @click='$emit("close")'
                            >
                                Done
                            </button> 
                        </div>
                    </div>
                </div>
            </template>
        </div>
        <div class='modal-footer'>
            <div class='d-flex align-items-center w-100'>
                <div
                    v-if='connection && !stack'
                    v-tooltip='"Back"'
                    style='width: 32px;'
                    class='hover-dark'
                    :class='{
                        "cursor-pointer": connection
                    }'
                    @click='back'
                >
                    <IconCaretLeft size='32' />
                </div>
                <div
                    style='
                        width: calc(100% - 32px);
                        margin-left: 12px;
                    '
                >
                    <TablerProgress
                        v-tooltip='`${Math.floor(progress * 100)}% Complete`'
                        :percent='progress'
                    />
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script>
import { std } from '/src/std.ts';
import ConnectionSelect from './Wizard/ConnectionSelect.vue';
import ChannelSelect from './Wizard/ChannelSelect.vue';
import TemplateSelect from './Wizard/TemplateSelect.vue';
import LayerEnvironment from '../../Layer/LayerEnvironment.vue';
import {
    IconCircleCheck,
    IconCaretLeft,
    IconInfoHexagon
} from '@tabler/icons-vue';
import {
    TablerInput,
    TablerProgress,
    TablerModal,
    TablerLoading,
} from '@tak-ps/vue-tabler';

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    }); 
}

export default {
    name: 'IntegrationWizard',
    components: {
        IconCircleCheck,
        IconCaretLeft,
        IconInfoHexagon,
        TablerInput,
        TablerModal,
        TablerLoading,
        TablerProgress,
        ConnectionSelect,
        ChannelSelect,
        TemplateSelect,
        LayerEnvironment
    },
    emits: [ 'close' ],
    data: function() {
        return {
            loading: false,
            connection: null,
            template: null,
            integration: {
                name: '',
                description: '',
                channels: []
            },
            datasync: null,
            layer: null,
            stack: null,
            complete: false
        }
    },
    computed: {
        isIntegrationNextable: function() {
            return !(this.integration.name.trim().length > 4
                && this.integration.description.trim().length > 4)
        },
        progress: function() {
            if (this.complete) {
                return 1
            } else if (this.layer) {
                return 0.8
            } else if (this.datasync) {
                return 0.6
            } else if (this.template) {
                return 0.4
            } else if (this.connection) {
                return 0.2
            } else {
                return 0.01
            }
        }
    },
    methods: {
        createIntegration: async function() {
            if (this.template.datasync) {
                this.loading = `Creating DataSync "${this.integration.name}"...`;
                this.datasync = await std(`/api/connection/${this.connection.id}/data`, {
                    method: 'POST',
                    body: {
                        name: this.integration.name,
                        mission_sync: true,
                        auto_transform: true,
                        mission_groups: this.integration.channels.map((ch) => {
                            return ch.name;
                        }),
                        mission_role: 'MISSION_READONLY_SUBSCRIBER',
                        mission_diff: true,
                        description: this.integration.description
                    }
                });
            }

            this.loading = `Creating Layer "${this.integration.name}"...`;

            this.layer = await std(`/api/connection/${this.connection.id}/layer`, {
                method: 'POST',
                body: {
                    ...this.template,
                    name: this.integration.name,
                    data: this.datasync ? this.datasync.id : undefined,
                    description: this.integration.description
                }
            });

            this.loading = `Creating Stack`;
            do { 
                this.stack = await std(`/api/connection/${this.connection.id}/layer/${this.layer.id}/task`);
                this.loading = `Creating Stack: ${this.stack.status}`;
                await sleep(750);
            } while (!this.stack.status.includes('COMPLETE'));

            this.loading = `Loading Integration Config`;
            do { 
                this.stack = await std(`/api/connection/${this.connection.id}/layer/${this.layer.id}/task`);
                this.loading = `Creating Stack: ${this.stack.status}`;
                await sleep(750);
            } while (!this.stack.status.includes('COMPLETE'));

            this.loading = false;
        },
        back: function() {
            if (this.template) {
                this.template = null;
            } else if (this.connection) {
                this.connection = null;
            }
        }
    }
}
</script>
