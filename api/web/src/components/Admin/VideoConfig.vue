<template>
<div class='col-12 px-2 py-2 row g-2'>
    <TablerToggle
        :disabled='disabled'
        label='MediaMTX API Enabled'
        v-model='service.config.api'
    />

    <TablerToggle
        :disabled='disabled'
        label='MediaMTX Metrics Enabled'
        v-model='service.config.metrics'
    />


    <label class='subheader mx-2'>Server Paths</label>
    <TablerNone v-if='service.paths.length === 0' :create='false' :compact='true' label='Server Paths'/>
    <template v-else>
        <div v-for='path in service.paths'>
            <span v-text='path'/>
        </div>
    </template>
</div>
</template>

<script>
import {
    TablerNone,
    TablerToggle
} from '@tak-ps/vue-tabler';

export default {
    name: 'VideoConfig',
    components: {
        TablerNone,
        TablerToggle
    },
    props: {
        service: Object,
        disabled: {
            type: Boolean,
            default: true
        }
    }
}
</script>
