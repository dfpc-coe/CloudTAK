<template>
<div class="card">
    <div class="card-body">
        <div class="d-flex">
            <h3 class="card-title">User Locations</h3>
        </div>
        <div class="row">
            <div id="map" style='height: 350px;'></div>
        </div>
    </div>
</div>
</template>

<script>
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css';

export default {
    name: 'LocationCard',
    data: function() {
        return {
            tilejson: {},
            map: false,
            aggs: []
        }
    },
    mounted: async function() {
        await this.fetch();
        await this.fetchJson();
        this.$nextTick(() => { this.mountMap(); });
    },
    methods: {
        mountMap: function() {
            mapboxgl.accessToken = 'pk.eyJ1IjoiaW5nYWxscyIsImEiOiJsUDF2STRrIn0.S0c3ZNH4HmseIdPXY-CTlA';
            this.map = new mapboxgl.Map({
                container: 'map',
                center: [ -105.477959, 39.116007 ],
                zoom: 5.5,
                projection: 'globe'
            });

            this.map.on('load', () => {
                this.map.addSource('zipcodes', {
                    type: 'vector',
                    tiles: this.tilejson.tiles,
                    minzoom: this.tilejson.minzoom,
                    maxzoom: this.tilejson.maxzoom
                });

                this.map.addLayer({
                    'id': 'zipcodes',
                    'type': 'line',
                    'source': 'zipcodes',
                    'source-layer': 'tl_2022_us_zcta520',
                    'layout': {
                        'line-cap': 'round',
                        'line-join': 'round'
                    },
                    'paint': {
                        'line-opacity': 0.5,
                        'line-color': 'rgb(83, 83, 83)',
                        'line-width': 0.5
                    }
                });

                this.map.addLayer({
                    'id': 'zipcodes-poly',
                    'type': 'fill',
                    'source': 'zipcodes',
                    'source-layer': 'tl_2022_us_zcta520',
                    'paint': {
                        'fill-color': '#0080ff',
                        'fill-opacity': this.aggs
                    }
                });
            });
        },
        fetchJson: async function() {
            this.tilejson = await window.std('/api/zipcodes');
            this.tilejson.tiles.push(String(window.stdurl('/api/zipcodes')) + '/{z}/{x}/{y}');
        },
        fetch: async function() {
            const agg = await window.std(`/api/aggregate/postalcode`);

            let aggs = [];
            let total = 0;
            for (const name in agg) {
                total += agg[name];
                aggs.push({ name, count: agg[name] });
            }

            this.aggs = [ 'case' ]

            for (const agg of aggs) {
                const percent = agg.count / total;
                this.aggs.push(['==', ['get', 'ZCTA5CE20'], agg.name]);
                this.aggs.push(percent);
            }

            this.aggs.push(0.05);
        }
    }
}
</script>
