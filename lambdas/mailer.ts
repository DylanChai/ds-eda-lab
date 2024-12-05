import { SQSHandler } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({ region: "eu-west-1" });

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    // Send confirmation email
  }
};
