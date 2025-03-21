<template>
    <div
        class='card-footer'
        style='height: 60px;'
    >
        <div class='row'>
            <div class='col-sm-12 col-md-6'>
                <p
                    v-if='total === 0'
                    class='m-0 text-muted'
                >
                    Showing 0 of 0 entries
                </p>
                <p
                    v-else
                    class='m-0 text-muted'
                >
                    Showing <span v-text='limit * page + 1' /> to <span v-text='total < limit ? total : (page * limit + limit > total ? total : page * limit + limit)' /> of <span v-text='total' /> entries
                </p>
            </div>
            <div
                v-if='total > limit'
                class='col-sm-12 col-md-6 d-flex'
            >
                <div class='ms-auto'>
                    <TablerPager
                        :page='page'
                        :total='total'
                        :limit='limit'
                        @page='page = $event'
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import {
    TablerPager
} from '@tak-ps/vue-tabler';

export default {
    name: 'TableFooter',
    components: {
        TablerPager
    },
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
    emits: [
        'page'
    ],
    data: function() {
        return {
            page: 0
        }
    },
    watch: {
        page: function() {
            this.$emit("page", this.page);
        }
    }
}
</script>
