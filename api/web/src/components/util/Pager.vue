<template>
<div class='pagination m-0 ms-auto'>
    <div>
        <template v-if='parseInt(total) <= parseInt(limit)'>
            <button @click='page(0)' class='btn mx-1' >
                <HomeIcon class='icon'/>Home
            </button>
        </template>
        <template v-else>
            <button @click='page(0)' class='btn mx-1' :class='{ "btn-primary": current === 0 }'>
                <HomeIcon class='icon'/>Home
            </button>

            <template v-if='end > 5 && current > 3'>
                <span class=''> ... </span>
            </template>

            <template v-if='parseInt(total) / parseInt(limit) > 2'>
                <button
                    :key=i
                    v-for='i in middle'
                    @click='page(i)'
                    class='btn mx-1'
                    v-text='i + 1'
                    :class='{ "btn-primary": current === i }'
                >
                </button>
            </template>

            <template v-if='end > 5 && current < end - spread'>
                <span class=''> ... </span>
            </template>
            <button
                @click='page(end - 1)'
                class='btn mx-1'
                v-text='end'
                :class='{ "btn-primary": current === end - 1 }'
            ></button>
        </template>
    </div>
</div>
</template>

<script>
import {
    HomeIcon
} from 'vue-tabler-icons';

export default {
    name: 'Pager',
    props: [ 'total', 'limit' ],
    data: function() {
        return this.create();
    },
    watch: {
        total: function() {
            const set = this.create();

            this.spread = set.spread;
            this.middle = set.middle;
            this.current = set.current;
            this.end = set.end;
        },
        limit: function() {
            const set = this.create();

            this.spread = set.spread;
            this.middle = set.middle;
            this.current = set.current;
            this.end = set.end;
        },
        current: function() {
            if (this.end < 5) return; // All buttons are shown already

            let start;
            if (this.current <= 3) {
                start = 0;
            } else if (this.current >= this.end - 4) {
                start = this.end - this.spread - 2;
            } else {
                start = this.current - 3;
            }

            this.middle = this.middle.map((ele, i) => {
                return start + i + 1;
            });
        }
    },
    methods: {
        create: function() {
            const end = Math.ceil(parseInt(this.total) / parseInt(this.limit));
            let spread; //Number of pages in between home button and last page
            if (end <= 2) {
                spread = 0;
            } else if (end >= 7) {
                spread = 5;
            } else {
                spread = end - 2;
            }

            // Array containing middle page number
            let middleAr = new Array(spread).fill(1, 0, spread).map((ele, i) => {
                return 1 + i;
            });

            return {
                spread: spread,
                middle: middleAr,
                current: 0,
                end: end
            };
        },
        page: function(page) {
            this.current = page;
            this.$emit('page', this.current);
        }
    },
    components: {
        HomeIcon
    }
}
</script>
