
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
* @apiSchema {jsonschema=../schema/layers.json} apiSuccess
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
* @apiSchema {jsonschema=../schema/layers.json} apiSuccess
*/


/**
* @api {post} /layer/:layerid Create Layer
* @apiVersion 1.0.0
* @apiName POST-/layer/:layerid
* @apiGroup Layer
* @apiPermission admin
*
* @apidescription
*   Register a new layer
*
* @apiParam {string} layerid param
*
*
*
* @apiSchema {jsonschema=../schema/layers.json} apiSuccess
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
