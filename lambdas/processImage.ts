import { SQSHandler } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const ddbClient = new DynamoDBClient({ region: process.env.REGION });

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const message = JSON.parse(body.Message);
    const s3Event = message.Records[0];
    const bucketName = s3Event.s3.bucket.name;
    const key = decodeURIComponent(s3Event.s3.object.key.replace(/\+/g, " "));

    const fileType = key.split('.').pop()?.toLowerCase();
    if (fileType === "jpeg" || fileType === "png") {
      // Save to DynamoDB
      await ddbClient.send(
        new PutItemCommand({
          TableName: process.env.TABLE_NAME,
          Item: { ImageName: { S: key } },
        })
      );
    } else {
      console.log(`Invalid file type: ${fileType}`);
    }
  }
};
