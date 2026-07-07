/**
 * Port of @tmcw/togeojson v7.1.2 (BSD-2-Clause, Copyright (c) 2016 Mapbox)
 * to @tak-ps/xml-js element trees instead of browser-compatible DOM parsing.
 *
 * Unlike the upstream library, the exported converters take the source
 * document as an XML *string* (or a tree from parseXml) rather than a DOM
 * Document. Because xml-js treats namespace prefixes as part of the node
 * name, documents with undeclared prefixes (e.g. ArcGIS KML exports that use
 * xsi:schemaLocation without declaring xmlns:xsi) convert successfully where
 * DOM parsers reject them as malformed.
 */
export { kml, kmlGen, kmlWithFolders } from './kml.ts';
export { gpx, gpxGen } from './gpx.ts';
export { tcx, tcxGen } from './tcx.ts';
export { parseXml } from './xml.ts';
export type { F, FC, Folder, KmlOptions, Root } from './types.ts';
