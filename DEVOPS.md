<h1 align='center'>CloudTAK DevOps</h1>
<p align='center'><strong>Operational Guide for a deployed CloudTAK Instance</strong></p>
<p align='center'>Update: 2024-04-21 by @ingalls</p>

This document is designed as a recipe book for common operational issues that an ops
group may run into and how to triage and fix them.

## Restarting CloudTAK

CloudTAK run on [AWS ECS](https://aws.amazon.com/ecs/) which provides compute, scaling, healthchecks, and runtime
to the CloudTAK Server application.

Restarting CloudTAK can be done by following these steps:

1. Signin to the AWS Console via the AWS SSO signin page provided by your AWS Administrator
2. Select the AWS Partition (Commercial or GovCloud) and Account for the stack you wish to restart

> [!TIP]
> COTAK &amp; WFTAK production services are hosted in US-GovCloud, be sure to login to the GovCloud SSO App

3. Ensure you are in the correct region by selecting the desired region in the upper right-hand corner next to your username

> [!TIP]
> CloudTAK's default region is typically `us-east-1` if in a Commercial account or `us-gov-east-1` if in GovCloud

4. In the Search Bar at the top, search `Elastic Container Service` and click the result labelled `Run and Manage Docker Containers`

5. The default view will be the `ECS Clusters` list. If you do not see any clustered listed - IE a message with `No clusters` you are likely in the wrong
   region, return to step 3. Clusters represent a group of server(s) that power one or more ECS services that have been deployed onto them. A DFPC
   TAK deployment will have 1 cluster per environment. IE: 1 for COTAK, 1 for WFTAK, etc. Click on the cluster relevant to the environment you with to restart.

> [!TIP]
> CloudTAK Production for the COTAK Environment would have a cluster named `coe-ecs-prod`

6. Clicking on the Cluster will bring you to the Service Page. Services are "applications" that can contain one or more "Tasks" (A single emulated "server")
   For CloudTAK, click on the service named: `tak-cloudtak-<environment>-Service`
   
> [!TIP]
> CloudTAK Production for the COTAK Environment would have a cluster named `tak-cloudtak-prod-Service`

7. Clicking on the Cluster will bring you to the Service Health Page. This page will list stats about CPU & Memory usage
   as well as information about the last deployment to the service and the health of specific ports on the Server. CloudTAK
   as of this writing only uses a single Load Balancer Port on 443 for all API & UI operations.

8. Task can be updated one of two ways
    - The recommended way to restart the server is to force a new deployment. This will tell ECS to attempt to bring a new CloudTAK instanec online BEFORE terminating the problematic task. This will not result in downtime.
    - The second way is to terminate the CloudTAK Task.
  
### 8.1: Creating a new Deployment

> [!NOTE]
> Creating a new deployment is the recommended way to force a CloudTAK Restart

1. From the Health and Metrics tab, click the `Update Service` button in the upper right-hand corner. This will take you to the `Deployment configuration` page.
2. Under deployment Configuration set the following and leave all other settings unchanged.
    - `Force new deployment = True/Checked`
    - `Desired Tasks = 1`
   Click the `Update Service` button at the bottom of the page
3. The button will take you to the `Deployments` tab of the ECS Service you updated. Continue to refresh this page while the service
   deploys. The deployment status can be found under `Deployment Status`. A deployment usually takes 5-10 minutes to roll over the task.
   Information about the task being terminated and about the new task being started can be seen at the bottom of the page under `Events`
4. If the Service Deployment does not succeed (Multiple tasks being lauched but failing to stabilize under the `Events` heading) the service
    is unlikely to stabilize on it's own and additional engineering work will need to be done to determine root cause. As the service is unlikely
    to stabilize you can temporarily shut the CloudTAK ECS Service down byfollowing the 8.1 steps again except setting `Desired Tasks = 0`. This will
    tell ECS that you dont want any running tasks.

> [!WARNING]
> Deployments should almost always succeed with the first task launch. If a deployment fails to launch a task successfully contact 
> Application Specific Engineering immediately.

### 8.2: Terminate CloudTAK Task

> [!CAUTION]
> Following #2 and terminating the CloudTAK task WILL RESULT IN DOWNTIME. The ECS Service will detect that the minimum task capacity of 1 task is not met and will create a new task
> but this process can lead to up to 5 minutes of downtime while the service launches the new instance

1. From the Health and Metrics tab, click the `Tasks` tab.
2. Select the `Stop` dropdown in the upper right-hand corner
3. Select `Stop All`.
4. Tasks should shutdown and will be replaced by the number of tasks set in the ECS Service `Desired Tasks` setting (Usually 1).

