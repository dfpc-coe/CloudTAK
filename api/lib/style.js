export class Style {
    constructor(layer) {
        this.layer
    }

    feat(feat) {
        if (this.layer.data.stale) {
            feature.properties.stale = this.layer.data.stale;
        }

        if (!this.layer.enabled_styles) return feat;

        if (this.layer.styles.queries) {
            for (const q of this.layer.styles.queries) {
                const expression = jsonata(q.query);

                if (await expression.evaluate(feature) === true) {
                    this.by_geom(feature);
                }
            }
        } else {
            this.by_geom(this.layer.styles, feature);
        }
    }

    by_geom(style, feature) {
        if (feature.geometry.type === 'Point' && style.point) {
            Object.assign(feature.properties, style.point);
        } else if (feature.geometry.type === 'LineString' && style.line) {
            Object.assign(feature.properties, style.line);
        } else if (feature.geometry.type === 'Polygon' && style.polygon) {
            Object.assign(feature.properties, style.polygon);
        }
    }
}
