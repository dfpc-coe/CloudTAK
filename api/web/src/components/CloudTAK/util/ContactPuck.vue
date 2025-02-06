<template>
    <IconCircleFilled
        :style='compact ? "margin-left: 8px" : "margin-left: 16px;"'
        :size='compact ? 20 : 32'
        stroke='1'
        :class='{
            "text-yellow": contact.team === "Yellow",
            "text-cyan": contact.team === "Cyan",
            "text-lime": contact.team === "Green",
            "text-red": contact.team === "Red",
            "text-purple": contact.team === "Purple",
            "text-orange": contact.team === "Orange",
            "text-azure": contact.team === "Blue",
            "text-dribble": contact.team === "Magenta",
            "text-white": contact.team === "White",
            "text-pinterest": contact.team === "Maroon",
            "text-blue": contact.team === "Dark Blue",
            "text-teal": contact.team === "Teal",
            "text-green": contact.team === "Dark Green",
            "text-google": contact.team === "Brown",
        }'
    />
</template>

<script>
import {
    IconCircleFilled,
} from '@tabler/icons-vue';

export default {
    name: 'TAKContactPuck',
    components: {
        IconCircleFilled,
    },
    props: {
        contact: {
            type: Object,
            required: true
        },
        compact: {
            type: Boolean,
            default: false
        }
    },
}
</script>
