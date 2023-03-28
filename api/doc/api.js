
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
* @apiParam {integer} connectionid param
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
* @apiParam {integer} connectionid param
*
*
*
* @apiSchema {jsonschema=../schema/res.Connection.json} apiSuccess
*/


/**
* @api {post} /connection/:connectionid/refresh Refresh Connection
* @apiVersion 1.0.0
* @apiName POST-/connection/:connectionid/refresh
* @apiGroup Connection
* @apiPermission admin
*
* @apidescription
*   Refresh a connection
*
* @apiParam {integer} connectionid param
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
* @apiParam {integer} connectionid param
*
*
*
* @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
*/


/**
* @api {get} /data/:dataid/asset List Assets
* @apiVersion 1.0.0
* @apiName GET-/data/:dataid/asset
* @apiGroup DataAssets
* @apiPermission user
*
* @apidescription
*   List Assets
*
* @apiParam {integer} dataid param
*
*
*
* @apiSchema {jsonschema=../schema/res.ListAssets.json} apiSuccess
*/


/**
* @api {post} /data/:dataid/asset Create Asset
* @apiVersion 1.0.0
* @apiName POST-/data/:dataid/asset
* @apiGroup DataAssets
* @apiPermission user
*
* @apidescription
*   Create a new asset
*
* @apiParam {integer} dataid param
*
*
*
* @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
*/


/**
* @api {post} /data/:dataid/asset/:asset.:ext Convert Asset
* @apiVersion 1.0.0
* @apiName POST-/data/:dataid/asset/:asset.:ext
* @apiGroup DataAssets
* @apiPermission user
*
* @apidescription
*   Convert Asset
*
* @apiParam {integer} dataid param
* @apiParam {string} asset param
* @apiParam {string} ext param
*
*
* @apiSchema (Body) {jsonschema=../schema/req.ConvertAsset.json} apiParam
* @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
*/


/**
* @api {delete} /data/:dataid/asset/:asset.:ext Delete Asset
* @apiVersion 1.0.0
* @apiName DELETE-/data/:dataid/asset/:asset.:ext
* @apiGroup DataAssets
* @apiPermission user
*
* @apidescription
*   Delete Asset
*
* @apiParam {integer} dataid param
* @apiParam {string} asset param
* @apiParam {string} ext param
*
*
*
* @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
*/


/**
* @api {get} /data/:dataid/asset/:asset Raw Asset
* @apiVersion 1.0.0
* @apiName GET-/data/:dataid/asset/:asset
* @apiGroup DataAssets
* @apiPermission user
*
* @apidescription
*   Get single raw asset
*
* @apiParam {integer} dataid param
* @apiParam {string} asset param
*
*
*
*
*/


/**
* @api {get} /data List Data
* @apiVersion 1.0.0
* @apiName GET-/data
* @apiGroup Data
* @apiPermission user
*
* @apidescription
*   List data
*

*
* @apiSchema (Query) {jsonschema=../schema/req.query.ListData.json} apiParam
*
* @apiSchema {jsonschema=../schema/res.ListData.json} apiSuccess
*/


/**
* @api {post} /data Create data
* @apiVersion 1.0.0
* @apiName POST-/data
* @apiGroup Data
* @apiPermission admin
*
* @apidescription
*   Register a new data source
*

*
*
* @apiSchema (Body) {jsonschema=../schema/req.body.CreateData.json} apiParam
* @apiSchema {jsonschema=../schema/data.json} apiSuccess
*/


/**
* @api {patch} /data/:dataid Update Layer
* @apiVersion 1.0.0
* @apiName PATCH-/data/:dataid
* @apiGroup Data
* @apiPermission admin
*
* @apidescription
*   Update a data source
*
* @apiParam {integer} dataid param
*
*
* @apiSchema (Body) {jsonschema=../schema/req.body.PatchData.json} apiParam
* @apiSchema {jsonschema=../schema/data.json} apiSuccess
*/


/**
* @api {get} /data/:dataid Get Data
* @apiVersion 1.0.0
* @apiName GET-/data/:dataid
* @apiGroup Data
* @apiPermission user
*
* @apidescription
*   Get a data source
*
* @apiParam {integer} dataid param
*
*
*
* @apiSchema {jsonschema=../schema/data.json} apiSuccess
*/


/**
* @api {delete} /data/:dataid Delete Data
* @apiVersion 1.0.0
* @apiName DELETE-/data/:dataid
* @apiGroup Data
* @apiPermission user
*
* @apidescription
*   Delete a data source
*
* @apiParam {integer} dataid param
*
*
*
* @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
*/


/**
* @api {get} /icon List Icons
* @apiVersion 1.0.0
* @apiName GET-/icon
* @apiGroup Icons
* @apiPermission user
*
* @apidescription
*   List Icons
*

*
* @apiSchema (Query) {jsonschema=../schema/req.query.ListIcons.json} apiParam
*
* @apiSchema {jsonschema=../schema/res.ListIcons.json} apiSuccess
*/


/**
* @api {get} /icon/:cot List Icons
* @apiVersion 1.0.0
* @apiName GET-/icon/:cot
* @apiGroup Icons
* @apiPermission user
*
* @apidescription
*   Icon Metadata
*
* @apiParam {string} cot param
*
*
*
* @apiSchema {jsonschema=../schema/res.Icon.json} apiSuccess
*/


/**
* @api {get} /layer/:layerid/query Get Layer
* @apiVersion 1.0.0
* @apiName GET-/layer/:layerid/query
* @apiGroup LayerQuery
* @apiPermission user
*
* @apidescription
*   Get the latest feature from a layer
*
* @apiParam {integer} layerid param
*
* @apiSchema (Query) {jsonschema=../schema/req.query.LayerQuery.json} apiParam
*
* @apiSchema {jsonschema=../schema/res.LayerQuery.json} apiSuccess
*/


/**
* @api {get} /layer/:layerid/query/:featid Get Layer
* @apiVersion 1.0.0
* @apiName GET-/layer/:layerid/query/:featid
* @apiGroup LayerQuery
* @apiPermission user
*
* @apidescription
*   Get the latest feature from a layer
*
* @apiParam {integer} layerid param
* @apiParam {string} featid param
*
*
*
* @apiSchema {jsonschema=../schema/res.LayerQueryFeature.json} apiSuccess
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
* @apiParam {integer} layerid param
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
* @apiParam {integer} layerid param
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
* @apiParam {integer} layerid param
*
*
*
* @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
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
* @apiParam {integer} layerid param
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
* @api {get} /task/:task List Tasks
* @apiVersion 1.0.0
* @apiName GET-/task/:task
* @apiGroup Task
* @apiPermission user
*
* @apidescription
*   List Version for a specific task
*
* @apiParam {string} task param
*
*
*
* @apiSchema {jsonschema=../schema/res.ListTaskVersions.json} apiSuccess
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
* @api {post} /layer/:layerid/task Run Task
* @apiVersion 1.0.0
* @apiName POST-/layer/:layerid/task
* @apiGroup Task
* @apiPermission user
*
* @apidescription
*   Manually invoke a Task
*
* @apiParam {integer} layerid param
*
*
*
* @apiSchema {jsonschema=../schema/res.Standard.json} apiSuccess
*/


/**
* @api {get} /layer/:layerid/task/logs Task Logs
* @apiVersion 1.0.0
* @apiName GET-/layer/:layerid/task/logs
* @apiGroup Task
* @apiPermission user
*
* @apidescription
*   Get the logs related to the given task
*
* @apiParam {integer} layerid param
*
*
*
* @apiSchema {jsonschema=../schema/res.TaskLogs.json} apiSuccess
*/


/**
* @api {get} /layer/:layerid/task/schema Task Schema
* @apiVersion 1.0.0
* @apiName GET-/layer/:layerid/task/schema
* @apiGroup Task
* @apiPermission user
*
* @apidescription
*   Get the JSONSchema for the expected environment variables
*
* @apiParam {integer} layerid param
*
*
*
* @apiSchema {jsonschema=../schema/res.TaskSchema.json} apiSuccess
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
