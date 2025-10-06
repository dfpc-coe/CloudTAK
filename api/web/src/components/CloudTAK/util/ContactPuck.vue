<template>
    <IconCircleFilled
        v-if='props.team'
        :size='props.size ? props.size : 32'
        stroke='1'
        :class='{
            "text-yellow": props.team === "Yellow",
            "text-cyan": props.team === "Cyan",
            "text-lime": props.team === "Green",
            "text-red": props.team === "Red",
            "text-purple": props.team === "Purple",
            "text-orange": props.team === "Orange",
            "text-azure": props.team === "Blue",
            "text-dribble": props.team === "Magenta",
            "text-white": props.team === "White",
            "text-pinterest": props.team === "Maroon",
            "text-blue": props.team === "Dark Blue",
            "text-teal": props.team === "Teal",
            "text-green": props.team === "Dark Green",
            "text-google": props.team === "Brown",
        }'
    />
    <IconUserQuestion
        v-else
        :size='size ? 20 : 32'
        stroke='1'
    />
</template>

<script setup lang='ts'>
import {
    IconUserQuestion,
    IconCircleFilled,
} from '@tabler/icons-vue';

const props = defineProps<{
    team?: string,
    size?: number
}>();
</script>
