<template>
    <IconCar
        v-if='props.sourceType === "vehicle"'
        title='Vehicle'
        :size='32'
        stroke='1'
    />
    <IconWalk
        v-else-if='props.sourceType === "personal"'
        title='Body Camera'
        :size='32'
        stroke='1'
    />
    <IconDrone
        v-else-if='props.sourceType === "uas-rotor"'
        title='UAS Rotorcraft'
        :size='32'
        stroke='1'
    />
    <IconHelicopter
        v-else-if='props.sourceType === "rotor"'
        title='Manned Rotorcraft'
        :size='32'
        stroke='1'
    />
    <IconPlane
        v-else-if='props.sourceType === "fixedwing"'
        title='Fixed Wing'
        :size='32'
        stroke='1'
    />
    <IconPlane
        v-else-if='props.sourceType === "uas-fixedwing"'
        title='UAS Fixed Wing'
        :size='32'
        stroke='1'
    />
    <IconDeviceDesktop
        v-else-if='props.sourceType === "screenshare"'
        title='Screenshare'
        :size='32'
        stroke='1'
    />
    <IconVideo
        v-else
        title='Unknown Source'
        :size='32'
        stroke='1'
    />
</template>

<script setup lang='ts'>
import {
    IconVideo,
    IconCar,
    IconWalk,
    IconDrone,
    IconPlane,
    IconHelicopter,
    IconDeviceDesktop,
} from '@tabler/icons-vue';

const props = defineProps<{
    sourceType: string
}>();
</script>
