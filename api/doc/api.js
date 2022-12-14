
/**
* @api {get} /schema GET /schema
* @apiVersion 1.0.0
* @apiName GET-/schema
* @apiGroup Default
* @apiPermission Unknown
*
* @apidescription
*   No Description
*

*
* @apiSchema (Query) {jsonschema=../schema/req.query.ListSchema.json} apiParam
*
* @apiSchema {jsonschema=../schema/res.ListSchema.json} apiSuccess
*/


/**
* @api {get} /asset List Assets
* @apiVersion 1.0.0
* @apiName GET-/asset
* @apiGroup Assets
* @apiPermission user
*
* @apidescription
*   List Assets
*

*
* @apiSchema (Query) {jsonschema=../schema/req.query.ListAssets.json} apiParam
*
* @apiSchema {jsonschema=../schema/res.ListAssets.json} apiSuccess
*/


/**
* @api {get} /asset/:assetid Get Asset
* @apiVersion 1.0.0
* @apiName GET-/asset/:assetid
* @apiGroup Assets
* @apiPermission user
*
* @apidescription
*   Get single asset
*
* @apiParam {integer} assetid param
*
*
*
* @apiSchema {jsonschema=../schema/assets.json} apiSuccess
*/


/**
* @api {post} /asset Create Asset
* @apiVersion 1.0.0
* @apiName POST-/asset
* @apiGroup Assets
* @apiPermission user
*
* @apidescription
*   Create a new asset
*
* @apiParam {integer} assetid param
*
*
*
* @apiSchema {jsonschema=../schema/assets.json} apiSuccess
*/


/**
* @api {patch} /asset/:assetid Update Asset
* @apiVersion 1.0.0
* @apiName PATCH-/asset/:assetid
* @apiGroup Assets
* @apiPermission user
*
* @apidescription
*   Update Asset
*
* @apiParam {integer} assetid param
*
*
*
* @apiSchema {jsonschema=../schema/assets.json} apiSuccess
*/


/**
* @api {delete} /asset/:assetid Delete Asset
* @apiVersion 1.0.0
* @apiName DELETE-/asset/:assetid
* @apiGroup Assets
* @apiPermission user
*
* @apidescription
*   Delete Asset
*
* @apiParam {integer} assetid param
*
*
*
* @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
*/


/**
* @api {get} /asset/:assetid/raw Raw Asset
* @apiVersion 1.0.0
* @apiName GET-/asset/:assetid/raw
* @apiGroup Assets
* @apiPermission user
*
* @apidescription
*   Get single raw asset
*
* @apiParam {integer} assetid param
*
*
*
*
*/


/**
* @api {get} /connection List Connections
* @apiVersion 1.0.0
* @apiName GET-/connection
* @apiGroup Connection
* @apiPermission user
*
* @apidescription
*   List Connections
*

*
* @apiSchema (Query) {jsonschema=../schema/req.query.ListConnections.json} apiParam
*
* @apiSchema {jsonschema=../schema/res.ListConnections.json} apiSuccess
*/


/**
* @api {post} /connection Create Connection
* @apiVersion 1.0.0
* @apiName POST-/connection
* @apiGroup Connection
* @apiPermission admin
*
* @apidescription
*   Register a new connection
*

*
*
* @apiSchema (Body) {jsonschema=../schema/req.body.CreateConnection.json} apiParam
* @apiSchema {jsonschema=../schema/res.Connection.json} apiSuccess
*/


/**
* @api {patch} /connection/:connectionid Update Connection
* @apiVersion 1.0.0
* @apiName PATCH-/connection/:connectionid
* @apiGroup Connection
* @apiPermission admin
*
* @apidescription
*   Update a connection
*
* @apiParam {string} connectionid param
*
*
* @apiSchema (Body) {jsonschema=../schema/req.body.PatchConnection.json} apiParam
* @apiSchema {jsonschema=../schema/res.Connection.json} apiSuccess
*/


/**
* @api {get} /connection/:connectionid Get Connection
* @apiVersion 1.0.0
* @apiName GET-/connection/:connectionid
* @apiGroup Connection
* @apiPermission user
*
* @apidescription
*   Get a connection
*
* @apiParam {string} connectionid param
*
*
*
* @apiSchema {jsonschema=../schema/res.Connection.json} apiSuccess
*/


/**
* @api {delete} /connection/:connectionid Delete Connection
* @apiVersion 1.0.0
* @apiName DELETE-/connection/:connectionid
* @apiGroup Connection
* @apiPermission user
*
* @apidescription
*   Delete a connection
*
* @apiParam {string} connectionid param
*
*
*
* @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
*/


/**
* @api {get} /layer List Layers
* @apiVersion 1.0.0
* @apiName GET-/layer
* @apiGroup Layer
* @apiPermission user
*
* @apidescription
*   List layers
*

*
* @apiSchema (Query) {jsonschema=../schema/req.query.ListLayers.json} apiParam
*
* @apiSchema {jsonschema=../schema/res.ListLayers.json} apiSuccess
*/


/**
* @api {post} /layer Create Layer
* @apiVersion 1.0.0
* @apiName POST-/layer
* @apiGroup Layer
* @apiPermission admin
*
* @apidescription
*   Register a new layer
*

*
*
* @apiSchema (Body) {jsonschema=../schema/req.body.CreateLayer.json} apiParam
* @apiSchema {jsonschema=../schema/res.Layer.json} apiSuccess
*/


/**
* @api {patch} /layer/:layerid Update Layer
* @apiVersion 1.0.0
* @apiName PATCH-/layer/:layerid
* @apiGroup Layer
* @apiPermission admin
*
* @apidescription
*   Update a layer
*
* @apiParam {string} layerid param
*
*
* @apiSchema (Body) {jsonschema=../schema/req.body.PatchLayer.json} apiParam
* @apiSchema {jsonschema=../schema/res.Layer.json} apiSuccess
*/


/**
* @api {get} /layer/:layerid Get Layer
* @apiVersion 1.0.0
* @apiName GET-/layer/:layerid
* @apiGroup Layer
* @apiPermission user
*
* @apidescription
*   Get a layer
*
* @apiParam {string} layerid param
*
*
*
* @apiSchema {jsonschema=../schema/res.Layer.json} apiSuccess
*/


/**
* @api {post} /layer/:layerid/cot Post COT
* @apiVersion 1.0.0
* @apiName POST-/layer/:layerid/cot
* @apiGroup Layer
* @apiPermission admin
*
* @apidescription
*   Post CoT data to a given layer
*
* @apiParam {string} layerid param
*
*
*
* @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
*/
