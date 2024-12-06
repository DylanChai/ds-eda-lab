import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const imagesTable = new dynamodb.Table(this, "ImagesTable", {
      tableName: "Images",
      partitionKey: { name: "ImageName", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3 Bucket
    const imagesBucket = new s3.Bucket(this, "ImagesBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });

    // Dead Letter Queue
    const deadLetterQueue = new sqs.Queue(this, "DeadLetterQueue", {
      retentionPeriod: cdk.Duration.minutes(45),
    });

    // SQS Queues
    const imageProcessQueue = new sqs.Queue(this, "ImageProcessQueue", {
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 5,
      },
    });

    const mailerQueue = new sqs.Queue(this, "MailerQueue");

    // SNS Topic
    const newImageTopic = new sns.Topic(this, "NewImageTopic", {
      displayName: "New Image Topic",
    });

    // SNS Filtering Policy for Metadata Updates
    const metadataFilterPolicy = {
      metadata_type: sns.SubscriptionFilter.stringFilter({
        allowlist: ["Caption", "Date", "Photographer"],
      }),
    };

    const processImageFn = new lambdanode.NodejsFunction(this, "ProcessImageFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/processImage.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      environment: {
        TABLE_NAME: imagesTable.tableName,
        REGION: "eu-west-1",
        DLQ_URL: deadLetterQueue.queueUrl,
      },
    });

    const mailerFn = new lambdanode.NodejsFunction(this, "MailerFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/mailer.ts`,
      timeout: cdk.Duration.seconds(5),
      memorySize: 512,
      environment: {
        SES_EMAIL_TO: "20099297@mail.wit.ie",
        SES_EMAIL_FROM: "20099297@mail.wit.ie",
        SES_REGION: "eu-west-1",
      },
    });

    const rejectionMailerFn = new lambdanode.NodejsFunction(this, "RejectionMailerFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/rejectionMailer.ts`,
      timeout: cdk.Duration.seconds(5),
      memorySize: 512,
      environment: {
        SES_EMAIL_TO: "20099297@mail.wit.ie",
        SES_EMAIL_FROM: "20099297@mail.wit.ie",
        SES_REGION: "eu-west-1",
      },
    });

    const updateMetadataFn = new lambdanode.NodejsFunction(this, "UpdateMetadataFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/updateMetadata.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: imagesTable.tableName,
        REGION: "eu-west-1",
      },
    });

    // S3 --> SNS Notification
    imagesBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(newImageTopic)
    );

    // SNS --> SQS Subscriptions
    newImageTopic.addSubscription(
      new subs.SqsSubscription(imageProcessQueue, {
        filterPolicy: metadataFilterPolicy,
      })
    );
    newImageTopic.addSubscription(new subs.SqsSubscription(mailerQueue));

    // SQS --> Lambda Event Sources
    processImageFn.addEventSource(new events.SqsEventSource(imageProcessQueue));
    mailerFn.addEventSource(new events.SqsEventSource(mailerQueue));
    rejectionMailerFn.addEventSource(new events.SqsEventSource(deadLetterQueue));
    updateMetadataFn.addEventSource(new events.SqsEventSource(imageProcessQueue));

    // Permissions
    imagesBucket.grantRead(processImageFn);
    imagesTable.grantReadWriteData(processImageFn);
    imagesTable.grantReadWriteData(updateMetadataFn);

    // Grant SQS permissions to ProcessImageFn for DLQ
    deadLetterQueue.grantSendMessages(processImageFn);

    mailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ses:SendEmail", "ses:SendRawEmail", "ses:SendTemplatedEmail"],
        resources: ["*"],
      })
    );

    rejectionMailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ses:SendEmail", "ses:SendRawEmail", "ses:SendTemplatedEmail"],
        resources: ["*"],
      })
    );

    // Outputs
    new cdk.CfnOutput(this, "BucketName", {
      value: imagesBucket.bucketName,
    });
  }
}
