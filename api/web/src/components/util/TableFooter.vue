<template>
<div class="card-footer d-flex align-items-center">
    <p v-if='total === 0' class='m-0 text-muted'>Showing 0 of 0 entries</p>
    <p v-else class="m-0 text-muted">Showing <span v-text='limit * page + 1'/> to <span v-text='total < limit ? total : (page * limit + limit > total ? total : page * limit + limit)'/> of <span v-text='total'/> entries</p>

    <Pager @page='page = $event' :total='total' :limit='limit'/>
</div>
</template>

<script>
import Pager from './Pager.vue'

export default {
    name: 'TableFooter',
    props: {
        limit: {
            type: Number,
            required: true
        },
        total: {
            type: Number,
            required: true
        }
    },
    watch: {
        page: function() {
            this.$emit("page", this.page);
        }
    },
    data: function() {
        return {
            page: 0
        }
    },
    components: {
        Pager
    }
}
</script>
