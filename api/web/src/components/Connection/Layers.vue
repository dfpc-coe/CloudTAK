<template>
<div class="card">
    <div class='card-header'>Layers</div>

    <div class='table-resposive'>
        <table class='table table-hover'>
            <thead>
                <tr>
                    <th>Name</th>
                </tr>
            </thead>
            <tbody class='table-tbody'>
                <tr @click='$router.push(`/layer/${layer.id}`)' :key='layer.id' v-for='layer of layers.layers' class='cursor-pointer'>
                    <td>
                        <div class='d-flex'>
                            <span class='mt-2' v-text='layer.name'/>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

</template>

<script>
export default {
    name: 'ConnectionLayers',
    props: {
        connection: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            layers: {
                list: []
            },
        }
    },
    mounted: async function() {
        await this.listLayers();
    },
    methods: {
        listLayers: async function() {
            const url = window.stdurl('/api/layer');
            url.searchParams.append('connection', this.connection.id);
            this.layers = await window.std(url);
        }
    }
}
</script>
