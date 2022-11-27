
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
* @api {post} /layer/cot Post COT
* @apiVersion 1.0.0
* @apiName POST-/layer/cot
* @apiGroup Layer
* @apiPermission admin
*
* @apidescription
*   Post CoT data to a given layer
*
* @apiParam {string} layer param
*
*
*
*
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
* @apiParam {string} layer param
*
*
*
*
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
* @apiParam {string} layer param
*
*
*
*
*/


/**
* @api {get} /layer/:layer Create Layer
* @apiVersion 1.0.0
* @apiName GET-/layer/:layer
* @apiGroup Layer
* @apiPermission admin
*
* @apidescription
*   Register a new layer
*
* @apiParam {string} layer param
*
*
*
*
*/
