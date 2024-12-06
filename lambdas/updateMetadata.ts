import { SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB Document Client
const ddbClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "eu-west-1", // Provide a default region
  })
);

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      // Parse the body and extract message attributes
      const body = JSON.parse(record.body);
      const message = JSON.parse(body.Message);

      const metadataType = record.messageAttributes?.metadata_type?.stringValue; // Correct path
      const { id, value } = message; // Extract id and value from message body

      if (metadataType && id && value) {
        // Update DynamoDB with the metadata
        await ddbClient.send(
          new UpdateCommand({
            TableName: process.env.TABLE_NAME, // Ensure TABLE_NAME is set in the environment variables
            Key: { ImageName: id }, // Key for the DynamoDB table
            UpdateExpression: `SET #attr = :val`,
            ExpressionAttributeNames: {
              "#attr": metadataType, // Use metadataType as an attribute
            },
            ExpressionAttributeValues: {
              ":val": value, // Set the value for the attribute
            },
          })
        );
        console.log(`Updated metadata: ${metadataType} for ${id}`);
      } else {
        console.log("Invalid message attributes or missing data.");
      }
    } catch (err) {
      console.error("Failed to process record:", err);
    }
  }
};
