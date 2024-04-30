<template>
<span v-tooltip='status' class="status-indicator status-indicator-animated" :class='{
    "status-yellow": ["running", "pending"].includes(normalizeStatus),
    "status-orange": ["warn"].includes(normalizeStatus),
    "status-green": ["success"].includes(normalizeStatus),
    "status-red": ["fail", "pending", "deprovisioning"].includes(normalizeStatus),
    "status-dark": ["unknown", "empty"].includes(normalizeStatus),
}'>
    <span class="status-indicator-circle"></span>
    <span class="status-indicator-circle"></span>
    <span class="status-indicator-circle"></span>
</span>
</template>

<script>
export default {
    name: 'StatusCircle',
    props: {
        status: {
            type: String,
            required: true
        }
    },
    computed: {
        normalizeStatus: function() {
            return (this.status ?? '').toLowerCase()
        }
    }
}
</script>
