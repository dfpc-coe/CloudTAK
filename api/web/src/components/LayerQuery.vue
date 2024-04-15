<template>
  <div>
    <div class='page-wrapper'>
      <div class='page-header d-print-none'>
        <div class='container-xl'>
          <div class='row g-2 align-items-center'>
            <div class='col d-flex'>
              <TablerBreadCrumb />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class='page-body'>
      <div class='container-xl'>
        <div class='row row-deck row-cards'>
          <div class='col-lg-12'>
            <div class='card'>
              <div class='card-body'>
                <label class='form-label'>ID Prefix</label>
                <div class='input-icon mb-3'>
                  <input
                    v-model='params.filter'
                    type='text'
                    class='form-control'
                    placeholder='Search…'
                    @keyup.enter='query'
                  >
                  <span class='input-icon-addon'>
                    <IconSearch />
                  </span>
                </div>

                <div class='d-flex'>
                  <div class='ms-auto'>
                    <button
                      class='cursor-pointer btn btn-primary'
                      @click='query'
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class='col-lg-12'>
            <div class='card'>
              <TablerLoading
                v-if='loading.query'
                desc='Loading Query'
              />
              <div v-else-if='error'>
                <div class='text-center py-4'>
                  <Alert
                    title='Query Error'
                    :err='error.message'
                    :compact='true'
                  />
                  <div class='d-flex justify-content-center my-3'>
                    <div
                      class='btn btn-secondary'
                      @click='query'
                    >
                      Refresh
                    </div>
                  </div>
                </div>
              </div>
              <TablerNone
                v-else-if='!list.features.length'
                :create='false'
              />
              <div
                v-else
                class='table-responsive'
              >
                <table class='table card-table table-vcenter'>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Properties</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for='feature in list.features'
                      :key='feature.id'
                    >
                      <td>
                        <a
                          class='cursor-pointer'
                          @click='$router.push(`/layer/${$route.params.layerid}/query/${feature.id}`)'
                          v-text='feature.id'
                        />
                      </td>
                      <td v-text='feature.geometry.type' />
                      <td v-text='JSON.stringify(feature.properties)' />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <PageFooter />
  </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import Alert from './util/Alert.vue';
import {
    IconSearch
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerBreadCrumb, 
    TablerLoading
} from '@tak-ps/vue-tabler'

export default {
    name: 'LayerQuery',
    components: {
        TablerNone,
        Alert,
        PageFooter,
        IconSearch,
        TablerBreadCrumb, 
        TablerLoading,
    },
    data: function() {
        return {
            error: false,
            params: {
                filter: ''
            },
            loading: {
                query: true
            },
            list: {
                type: 'FeatureCollection',
                features: []
            }
        }
    },
    mounted: async function() {
        await this.query();
    },
    methods: {
        query: async function() {
            this.error = false;
            this.loading.query = true;
            try {
                const url = stdurl(`/api/layer/${this.$route.params.layerid}/query`);
                url.searchParams.append('filter', this.params.filter);
                this.list = await std(url);
            } catch (err) {
                this.error = err;
            }
            this.loading.query = false;
        }
    }
}
</script>
