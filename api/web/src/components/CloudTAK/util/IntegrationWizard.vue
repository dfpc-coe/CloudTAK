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
            </div>
        </div>
        <div class='modal-body'>
            <template v-if='!connection'>
                <ConnectionSelect v-model='connection'/>
            </template>
            <template v-else-if='!template'>
                <TemplateSelect v-model='template'/>
            </template>
        </div>
        <div class='modal-footer'>
            <TablerProgress :percent='progress'/>
        </div>
    </TablerModal>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import ConnectionSelect from './Wizard/ConnectionSelect.vue';
import TemplateSelect from './Wizard/TemplateSelect.vue';
import {
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
    }
}
</script>
