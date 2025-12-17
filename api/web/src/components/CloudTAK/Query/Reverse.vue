<template>
    <div class='col-12 row g-0'>
        <div class='col-12'>
            <label class='subheader mx-2'>Location</label>
        </div>
        <div
            v-if='props.reverse'
            class='col-12 d-flex align-items-center py-2 px-2 rounded'
            style='border: 1px solid var(--tblr-border-color);'
        >
            <IconMapPin
                size='32'
                stroke='1'
            />

            <div class='mx-2'>
                <div
                    class='h3 mb-0'
                    v-text='props.reverse.ShortLabel'
                />
                <div
                    class='text-muted small'
                    v-text='props.reverse.LongLabel.replace(new RegExp(`^.*${props.reverse.ShortLabel}, `), "")'
                />
            </div>
            <div
                v-if='props.elevation'
                class='ms-auto text-end'
            >
                <div class='d-flex align-items-center text-muted'>
                    <IconMountain
                        size='16'
                        stroke='1'
                        class='me-1'
                    />
                    <span class='small'>{{ props.elevation }}m</span>
                </div>
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

<script setup lang='ts'>
import type { SearchReverse } from '../../../types.ts';
import {
    IconMapPin,
    IconMountain
} from '@tabler/icons-vue';

const props = defineProps<{
    reverse: SearchReverse["reverse"],
    elevation?: SearchReverse["elevation"]
}>()
</script>
