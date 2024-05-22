<template>
    <span
        v-tooltip='status'
        class='status-indicator status-indicator-animated'
        :class='{
            "status-yellow": ["running", "pending"].includes(normalizeStatus),
            "status-orange": ["warn", "provisioning"].includes(normalizeStatus),
            "status-green": ["success"].includes(normalizeStatus),
            "status-red": ["fail", "pending", "deprovisioning"].includes(normalizeStatus),
            "status-dark": !dark && ["unknown", "empty"].includes(normalizeStatus),
            "status-light": dark && ["unknown", "empty"].includes(normalizeStatus),
        }'
    >
        <span class='status-indicator-circle' />
        <span class='status-indicator-circle' />
        <span class='status-indicator-circle' />
    </span>
</template>

<script>
export default {
    name: 'StatusCircle',
    props: {
        status: {
            type: String,
            required: true
        },
        dark: {
            type: Boolean,
            default: false
        }
    },
    computed: {
        normalizeStatus: function() {
            return (this.status ?? '').toLowerCase()
        }
    }
}
</script>
