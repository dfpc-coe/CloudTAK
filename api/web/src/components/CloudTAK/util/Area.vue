<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Area</label>
        <div class='mx-2'>
            <CopyField
                v-model='area'
                :size='24'
            >
                <IconPolygon
                    :size='24'
                    stroke='1'
                />
            </CopyField>
        </div>
                <div role='menu'>
                    <span
                        v-if='modes.includes("dd")'
                        v-tooltip='"Decimal Degrees"'
                        role='menuitem'
                        tabindex='0'
                        class='my-1 px-2'
                        :class='{
                            "bg-gray-500 rounded-bottom": mode === "dd",
                            "cursor-pointer": mode !== "dd",
                        }'
                        @click='mode = "dd"'
                    >DD</span>
                    <span
                        v-if='modes.includes("dms")'
                        v-tooltip='"Decimal Minutes Seconds"'
                        class='my-1 px-2'
                        role='menuitem'
                        tabindex='0'
                        :class='{
                            "bg-gray-500 rounded-bottom": mode === "dms",
                            "cursor-pointer": mode !== "dms",
                        }'
                        @click='mode = "dms"'
                    >DMS</span>
                    <span
                        v-if='modes.includes("mgrs")'
                        v-tooltip='"Military Grid Reference System"'
                        class='my-1 px-2'
                        role='menuitem'
                        tabindex='0'
                        :class='{
                            "bg-gray-500 rounded-bottom": mode === "mgrs",
                            "cursor-pointer": mode !== "mgrs",
                        }'
                        @click='mode = "mgrs"'
                    >MGRS</span>
                    <span
                        v-if='modes.includes("utm")'
                        v-tooltip='"Universal Transverse Mercator"'
                        class='my-1 px-2'
                        role='menuitem'
                        tabindex='0'
                        :class='{
                            "bg-gray-500 rounded-bottom": mode === "utm",
                            "cursor-pointer": mode !== "utm",
                        }'
                        @click='mode = "utm"'
                    >UTM</span>
                </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { area } from '@turf/area';
import CopyField from './CopyField.vue';
import COT from '../../../stores/base/cot.ts';
import {
    IconPolygon
} from '@tabler/icons-vue';

const props = defineProps<{
    cot: COT
}>();

const mode = ref('m');
const modes = ['m'];

const area = computed(() => {
    return area(props.cot);
});
</script>
