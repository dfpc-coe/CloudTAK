<template>
    <div class='col-12 row g-0 hover-dark'>
        <div class='col-12'>
            <label class='subheader mx-2'>ArcGIS Reverse Geocode</label>
        </div>
        <div
            v-if='reverse'
            class='col-12 d-flex py-2 px-2'
        >
            <IconMapPin
                :size='40'
                :stroke='1'
            />

            <div class='mx-2'>
                <div
                    style='font-size: 30px;'
                    v-text='reverse.ShortLabel'
                />
                <div
                    class='mx-1 my-1'
                    v-text='reverse.LongLabel.replace(new RegExp(`^.*${reverse.ShortLabel}, `), "")'
                />
            </div>
        </div>
        <div
            v-else
            class='col-12 d-flex py-2 px-2'
        >
            <div
                class='mx-2'
                style='font-size: 20px;'
            >
                No Features Found
            </div>
        </div>
    </div>
</template>

<script>
import {
    IconMapPin,
} from '@tabler/icons-vue';

export default {
    name: 'QueryReverse',
    components: {
        IconMapPin
    },
    props: {
        reverse: {
            type: Object,
        }
    }
}
</script>
