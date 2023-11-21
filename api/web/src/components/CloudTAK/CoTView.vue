<template>
<div class='position-absolute end-0 bottom-0 text-white py-2 bg-dark' style='z-index: 1; width: 400px; top: 50px;'>
    <div class='row'>
        <TablerInput label='Name' v-model='cot.properties.callsign'/>
        <TablerInput label='Remarks' v-model='cot.properties.remarks'/>
    </div>
</div>
</template>

<script>
import {
    TablerInput,
    TablerEnum
} from '@tak-ps/vue-tabler';

export default {
    name: 'CloudTAKCoTView',
    props: {
        cot: {
            type: Object,
            required: true
        }
    },
    components: {
        TablerInput,
        TablerEnum
    }
}
</script>
