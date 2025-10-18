import mapgl from 'maplibre-gl'
import type {
    LayerSpecification,
    CircleLayerSpecification,
    SymbolLayerSpecification,
    LineLayerSpecification,
    FillLayerSpecification,
}  from 'maplibre-gl';

const MinMaxFilter: Array<mapgl.ExpressionSpecification> = [
    [ 'any',
        ["!", ['has', 'maxzoom']],
        ['>=', ["zoom"], ['get', 'maxzoom']]
    ],
    ['any',
        ["!", ['has', 'minzoom']],
        ['<=', ['get', 'minzoom'], ['zoom']]
    ],
]

export default function styles(id: string, opts: {
    sourceLayer?: string;
    group?: boolean;
    course?: boolean;
    labels?: {
        size: number
    };
    icons?: boolean;
    rotateIcons?: boolean;
} = {}): Array<LayerSpecification> {
    const styles: Array<LayerSpecification> = [];

    const poly: FillLayerSpecification = {
        id: `${id}-poly`,
        type: 'fill',
        source: id,
        filter: [
            'all',
                ['==', ["geometry-type"], 'Polygon'],
                ['!=', ['get', 'fill-opacity'], 0],
                ...MinMaxFilter
        ],
        layout: {},
        paint: {
            'fill-opacity': ["number", ["get", "fill-opacity"], 1],
            'fill-color': ["string", ["get", "fill"], "#00FF00"]
        }
    }

    if (opts.sourceLayer) {
        poly['source-layer'] = opts.sourceLayer;
    }

    styles.push(poly);

    const polyline: LineLayerSpecification = {
        id: `${id}-polyline`,
        type: 'line',
        source: id,
        filter:
            ['all',
                ["==", ["geometry-type"], "Polygon"],
                ...MinMaxFilter
            ],
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': ["string", ["get", "stroke"], "#00FF00"],
            'line-width': ["number", ["get", "stroke-width"], 3],
            'line-dasharray': [
                "case",
                    ['==', ['get', "stroke-style"], 'dashed'], ['literal', [2,3]],
                    ['==', ['get', "stroke-style"], 'dotted'], ['literal', [0.1, 3]],
                    ['literal', [1,0]]
            ],
            'line-opacity': ["number", ["get", "stroke-opacity"], 1],
        }
    }

    if (opts.sourceLayer) {
        polyline['source-layer'] = opts.sourceLayer;
    }

    styles.push(polyline);

    const line: LineLayerSpecification = {
        id: `${id}-line`,
        type: 'line',
        source: id,
        filter:
            ['all',
                ["==", ["geometry-type"], "LineString"],
                ...MinMaxFilter
            ],
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': ["string", ["get", "stroke"], "#00FF00"],
            'line-dasharray': [
                "case",
                    ['==', ['get', "stroke-style"], 'dashed'], ['literal', [2,3]],
                    ['==', ['get', "stroke-style"], 'dotted'], ['literal', [0.1, 3]],
                    ['literal', [1,0]]
            ],
            'line-width': ["number", ["get", "stroke-width"], 3],
            'line-opacity': ["number", ["get", "stroke-opacity"], 1],
        }
    };

    if (opts.sourceLayer) {
        line['source-layer'] = opts.sourceLayer;
    }

    styles.push(line);

    const circle: CircleLayerSpecification = {
        id: id,
        type: 'circle',
        source: id,
        layout: {},
        paint: {
            'circle-color': ["string", ["get", "marker-color"], "#00FF00"],
            'circle-radius': ["number", ["get", "marker-radius"], 8],
            'circle-opacity': ["number", ["get", "marker-opacity"], 1],
        }
    }

    if (opts.icons) {
        circle.filter = ['all',
            ["==", ["geometry-type"], "Point"], ["!", ['has', 'icon']],
            ...MinMaxFilter
        ];
    } else {
        circle.filter = ['all',
            ["==", ["geometry-type"], "Point"],
            ...MinMaxFilter
        ];
    }


    if (opts.sourceLayer) {
        circle['source-layer'] = opts.sourceLayer;
    }

    if (opts.group) {
        circle.filter.push(["!", ['has', 'group']]);
    }

    styles.push(circle);

    if (opts.icons) {
        const icon: SymbolLayerSpecification = {
            id: `${id}-icon`,
            type: 'symbol',
            source: id,
            filter: [
                'all',
                ['==', ["geometry-type"], 'Point'],
                ['has', 'icon'],
                ...MinMaxFilter
            ],
            paint: {
                'icon-opacity': ["number", ["get", "marker-opacity"], 1],
                'icon-halo-color': '#ffffff',
                'icon-halo-width': 4
            },
            layout: {
                'icon-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    4, 0.8,
                    8, 1,
                    18, 1.2,
                ],
                'icon-rotate': (opts.rotateIcons ?? true) ? ['get', 'course'] : 0,
                'icon-allow-overlap': true,
                'icon-image': [
                    'case',
                    ['all', ['has', 'marker-color'], ['!=', ['slice', ['get', 'icon'], 0, 6], '2525D:']],
                    ['concat', ['get', 'icon'], '-colored-', ['slice', ['get', 'marker-color'], 1]],
                    ['get', 'icon']
                ],
                'icon-anchor': 'center',
            }
        }

        if (opts.sourceLayer) {
            icon['source-layer'] = opts.sourceLayer;
        }

        styles.push(icon);
    }

    if (opts.course) {
        const course: SymbolLayerSpecification = {
            id: `${id}-course`,
            type: 'symbol',
            source: id,
            filter: (opts.rotateIcons ?? true) ? [
                'all',
                ['==', ["geometry-type"], 'Point'],
                ['has', 'course'],
                ['has', 'group'],
                ...MinMaxFilter
            ] : [
                'all',
                ['==', ["geometry-type"], 'Point'],
                ['has', 'course'],
                ...MinMaxFilter
            ],
            paint: {
                'icon-opacity': ["number", ["get", "marker-opacity"], 1]
            },
            layout: {
                'icon-size': 0.33,
                'icon-offset': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, [
                        'case',
                        ['has', 'icon'],
                        ['literal', [0, -28]],
                        ['literal', [0, -18]]
                    ],
                    12, [
                        'case',
                        ['has', 'icon'],
                        ['literal', [0, -42]],
                        ['literal', [0, -32]]
                    ],
                    16, [
                        'case',
                        ['has', 'icon'],
                        ['literal', [0, -58]],
                        ['literal', [0, -42]]
                    ]
                ],
                'icon-rotate': ['get', 'course'],
                'icon-allow-overlap': true,
                'icon-image': 'course',
                'icon-anchor': 'bottom',
            }
        }

        if (opts.sourceLayer) {
            course['source-layer'] = opts.sourceLayer;
        }

        styles.push(course);
    }

    if (opts.group) {
        const groupFilter: mapgl.FilterSpecification = [
            'all',
            ['==', ["geometry-type"], 'Point'],
            ['has', 'group'],
            ...MinMaxFilter
        ]

        const group: CircleLayerSpecification = {
            id: `${id}-group`,
            type: 'circle',
            source: id,
            filter: groupFilter,
            paint: {
                'circle-color': ['get', 'marker-color'],
                'circle-opacity': ["number", ["get", "marker-opacity"], 1],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, 1,
                    15, 2
                ],
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, 5,
                    15, 10
                ]
            },
        }

        if (opts.sourceLayer) {
            group['source-layer'] = opts.sourceLayer;
        }

        styles.push(group);
    }

    if (opts.labels) {
        const MIN_LABEL_ZOOM = 7;

        const labels: SymbolLayerSpecification = {
            id: `${id}-text-point`,
            type: 'symbol',
            source: id,
            filter:
                [ 'all',
                    ['==', ["geometry-type"], 'Point'],
                    ...MinMaxFilter
                ],
            minzoom: MIN_LABEL_ZOOM,
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 2,
            },
            layout: {
                'text-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, opts.labels.size,
                    15, opts.labels.size + 7
                ],
                'text-offset': [0, (opts.rotateIcons ?? true) ? 2 : 2.5],
                'text-font': ['Open Sans Bold'],
                'text-field':  [
                    "coalesce",
                    ["get", "callsign"],
                    ["get", "name"],
                    ""
                ]
            }
        }

        if (opts.sourceLayer) {
            labels['source-layer'] = opts.sourceLayer;
        }

        styles.push(labels);

        const labelsLine: SymbolLayerSpecification = {
            id: `${id}-text-line`,
            type: 'symbol',
            source: id,
            filter: [ 'any',
                ['all',
                    ['==', ["geometry-type"], 'LineString'],
                    ...MinMaxFilter
                ],
                ['all',
                    ['==', ["geometry-type"], 'Polygon'],
                    ['==', ['get', 'fill-opacity'], 0],
                    ...MinMaxFilter
                ]
            ],
            minzoom: MIN_LABEL_ZOOM,
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 2,
            },
            layout: {
                "symbol-placement": "line",
                'text-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, 8,
                    15, 15
                ],
                'text-font': ['Open Sans Bold'],
                'text-field':  [
                    "coalesce",
                    ["get", "callsign"],
                    ["get", "name"],
                    ""
                ]
            }
        }

        if (opts.sourceLayer) {
            labelsLine['source-layer'] = opts.sourceLayer;
        }

        styles.push(labelsLine);

        const labelsPoly: SymbolLayerSpecification = {
            id: `${id}-text-poly`,
            type: 'symbol',
            source: id,
            filter: [
                'all',
                    ['==', ["geometry-type"], 'Polygon'],
                    ['!=', ['get', 'fill-opacity'], 0],
                    ...MinMaxFilter
            ],
            minzoom: MIN_LABEL_ZOOM,
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 2,
            },
            layout: {
                'text-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, 8,
                    15, 15
                ],
                'text-font': ['Open Sans Bold'],
                'text-field':  [
                    "coalesce",
                    ["get", "callsign"],
                    ["get", "name"],
                    ""
                ]
            }
        }

        if (opts.sourceLayer) {
            labelsPoly['source-layer'] = opts.sourceLayer;
        }

        styles.push(labelsPoly);
    }

    return styles;
}
