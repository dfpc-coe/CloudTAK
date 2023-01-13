
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
* @api {post} /login Create Login
* @apiVersion 1.0.0
* @apiName POST-/login
* @apiGroup Login
* @apiPermission Unknown
*
* @apidescription
*   No Description
*

*
*
*
*
*/


/**
* @api {get} /login Get Login
* @apiVersion 1.0.0
* @apiName GET-/login
* @apiGroup Login
* @apiPermission Unknown
*
* @apidescription
*   No Description
*

*
*
*
*
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
* @api {delete} /layer/:layerid Delete Layer
* @apiVersion 1.0.0
* @apiName DELETE-/layer/:layerid
* @apiGroup Layer
* @apiPermission user
*
* @apidescription
*   Delete a layer
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


/**
* @api {get} /connection/:connectionid/mission List Data
* @apiVersion 1.0.0
* @apiName GET-/connection/:connectionid/mission
* @apiGroup MissionData
* @apiPermission user
*
* @apidescription
*   List Mission Data
*
* @apiParam {integer} connectionid param
*
*
*
*
*/


/**
* @api {get} /server Get Server
* @apiVersion 1.0.0
* @apiName GET-/server
* @apiGroup Server
* @apiPermission user
*
* @apidescription
*   Get Server
*

*
*
*
* @apiSchema {jsonschema=../schema/res.Server.json} apiSuccess
*/


/**
* @api {post} /server Post Server
* @apiVersion 1.0.0
* @apiName POST-/server
* @apiGroup Server
* @apiPermission user
*
* @apidescription
*   Post Server
*

*
*
* @apiSchema (Body) {jsonschema=../schema/req.body.Server.json} apiParam
* @apiSchema {jsonschema=../schema/res.Server.json} apiSuccess
*/


/**
* @api {patch} /server Patch Server
* @apiVersion 1.0.0
* @apiName PATCH-/server
* @apiGroup Server
* @apiPermission user
*
* @apidescription
*   Patch Server
*

*
*
* @apiSchema (Body) {jsonschema=../schema/req.body.Server.json} apiParam
* @apiSchema {jsonschema=../schema/res.Server.json} apiSuccess
*/


/**
* @api {get} /task List Tasks
* @apiVersion 1.0.0
* @apiName GET-/task
* @apiGroup Task
* @apiPermission user
*
* @apidescription
*   List Tasks
*

*
*
*
* @apiSchema {jsonschema=../schema/res.ListTasks.json} apiSuccess
*/


/**
* @api {get} /layer/:layerid/task Task Status
* @apiVersion 1.0.0
* @apiName GET-/layer/:layerid/task
* @apiGroup Task
* @apiPermission user
*
* @apidescription
*   Get the status of a task stack in relation to a given layer
*
* @apiParam {integer} layerid param
*
*
*
* @apiSchema {jsonschema=../schema/res.TaskStatus.json} apiSuccess
*/


/**
* @api {post} /layer/:layerid/task Task Deploy
* @apiVersion 1.0.0
* @apiName POST-/layer/:layerid/task
* @apiGroup Task
* @apiPermission user
*
* @apidescription
*   Deploy a task stack
*
* @apiParam {integer} layerid param
*
*
*
* @apiSchema {jsonschema=../schema/res.TaskStatus.json} apiSuccess
*/
