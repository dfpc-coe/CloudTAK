<template>
<div class='position-absolute end-0 bottom-0 text-white py-2 bg-dark' style='z-index: 1; width: 400px; top: 50px;'>
    <div class='row'>
        <div class='col-12 d-flex'>
            <span class='subheader' v-text='"Type: " + cot.properties.type'/>
            <span class='subheader ms-auto' v-text='"How: " + cot.properties.how'/>
        </div>
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
