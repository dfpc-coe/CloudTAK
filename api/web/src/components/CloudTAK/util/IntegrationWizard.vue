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
                    <IconInfoHexagon :stroke='1' :size='20' class='me-2'/>
                    Select Connection
                </template>
                <template v-else-if='!template'>
                    <IconInfoHexagon :stroke='1' :size='20' class='me-2'/>
                    Select an Integration Template
                </template>
                <template v-else-if='!layer'>
                    <IconInfoHexagon :stroke='1' :size='20' class='me-2'/>
                    Integration Template Installation
                </template>
            </div>
        </div>
        <div class='modal-body overflow-auto' style='height: 60vh;'>
            <template v-if='!connection'>
                <ConnectionSelect v-model='connection'/>
            </template>
            <template v-else-if='!template'>
                <TemplateSelect v-model='template'/>
            </template>
        </div>
        <div class='modal-footer'>
            <div class='d-flex align-items-center w-100'>
                <div
                    v-if='connection'
                    style='width: 32px;'
                    class='hover-dark'
                    :class='{
                        "cursor-pointer": connection
                    }'
                    v-tooltip='"Back"'
                    @click='back'
                >
                    <IconCaretLeft size='32'/>
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
import { std, stdurl } from '/src/std.ts';
import ConnectionSelect from './Wizard/ConnectionSelect.vue';
import TemplateSelect from './Wizard/TemplateSelect.vue';
import {
    IconCaretLeft,
    IconInfoHexagon
} from '@tabler/icons-vue';
import {
    TablerProgress,
    TablerModal,
    TablerLoading,
    TablerSchema
} from '@tak-ps/vue-tabler';

export default {
    name: 'IntegrationWizard',
    components: {
        IconCaretLeft,
        IconInfoHexagon,
        TablerModal,
        TablerLoading,
        TablerProgress,
        ConnectionSelect,
        TemplateSelect,
        TablerSchema,
    },
    emits: [ 'close' ],
    computed: {
        progress: function() {
            if (this.connection) {
                return 0.2
            } else {
                return 0.01
            }
        }
    },
    data: function() {
        return {
            connection: null,
            template: null,
            loading: {
            },
        }
    },
    mounted: async function() {
    },
    methods: {
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
