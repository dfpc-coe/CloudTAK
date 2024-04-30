<template>
<span v-tooltip='status' class="status-indicator status-indicator-animated" :class='{
    "status-yellow": ["running", "pending"].includes(status.toLowerCase()),
    "status-orange": ["warn"].includes(status.toLowerCase()),
    "status-green": ["success"].includes(status.toLowerCase()),
    "status-red": ["fail", "pending"].includes(status.toLowerCase()),
    "status-dark": ["unknown", "empty"].includes(status.toLowerCase()),
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
    }
}
</script>
