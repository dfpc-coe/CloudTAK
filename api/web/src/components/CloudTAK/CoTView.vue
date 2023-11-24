<template>
<div class='position-absolute end-0 bottom-0 text-white py-2 bg-dark' style='z-index: 1; width: 400px; top: 50px;'>
    <div class='row g-2'>
        <div class='col-12 row border-light border-bottom'>
            <div class='col-auto row card-header my-2'>
                <div class='card-title mx-2' v-text='cot.properties.callsign'></div>
                <div class='subheader mx-2'>
                    <span class='subheader' v-text='cot.properties.type'/>
                    <span class='subheader ms-auto' v-text='" (" + cot.properties.how + ")"'/>
                </div>
            </div>
            <div class='col-auto my-2 ms-auto d-flex align-items-center mx-2'>
                <CodeIcon v-if='mode === "default"' @click='mode = "raw"' class='cursor-pointer'/>
                <XIcon v-if='mode === "raw"' @click='mode = "default"' class='cursor-pointer'/>
            </div>
        </div>

        <template v-if='mode === "default"'>
            <div v-if='cot.geometry.type === "Point"' class='col-12'>
                <label class='subheader'>Centroid</label>
                <div
                    v-text='cot.geometry.coordinates.join(", ")'
                    class='bg-gray-500 rounded mx-2 py-2 px-2'
                />
            </div>
            <div v-if='!isNaN(cot.properties.speed)' class='col-12 row'>
                <div class='col-6'>
                    <label class='subheader'>Speed</label>
                    <div v-text='cot.properties.speed' class='bg-gray-500 rounded mx-2 py-2 px-2'/>
                </div>
                <div class='col-6'>
                    <label class='subheader'>Course</label>
                    <div v-text='cot.properties.course' class='bg-gray-500 rounded mx-2 py-2 px-2'/>
                </div>
            </div>
            <div class='col-12'>
                <label class='subheader'>Remarks</label>
                <div v-text='cot.properties.remarks || "None"' class='bg-gray-500 rounded mx-2 py-2 px-2'/>
            </div>
        </template>
        <template v-else-if='mode === "raw"'>
            <pre v-text='cot'/>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerInput,
    TablerEnum
} from '@tak-ps/vue-tabler';
import {
    XIcon,
    CodeIcon
} from 'vue-tabler-icons';

export default {
    name: 'CloudTAKCoTView',
    props: {
        cot: {
            type: Object,
            required: true
        },
        map: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            mode: 'default',
            icon: null
        }
    },
    mounted: function() {
    },
    components: {
        XIcon,
        CodeIcon,
        TablerInput,
        TablerEnum
    }
}
</script>
