import { SQSHandler } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.SES_REGION });

export const handler: SQSHandler = async (event) => {
  console.log("Event: ", JSON.stringify(event));

  // Validate email environment variables
  const toAddress = process.env.SES_EMAIL_TO;
  const fromAddress = process.env.SES_EMAIL_FROM;

  if (!toAddress || !fromAddress) {
    console.error("Email addresses are not set in environment variables.");
    return;
  }

  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const message = JSON.parse(body.Message);
    const s3Object = message.Records[0];
    const bucketName = s3Object.s3.bucket.name;
    const key = decodeURIComponent(s3Object.s3.object.key.replace(/\+/g, " "));

    const emailParams = {
      Destination: {
        ToAddresses: [toAddress], // Ensure this is a valid string
      },
      Message: {
        Body: {
          Text: {
            Data: `Your image upload (${key}) was successfully processed.`, // Corrected syntax
          },
        },
        Subject: {
          Data: "Image Upload Confirmation", // Corrected syntax
        },
      },
      Source: fromAddress, // Ensure this is a valid string
    };

    try {
      await ses.send(new SendEmailCommand(emailParams));
      console.log("Success email sent.");
    } catch (err) {
      console.error("Error sending success email:", err);
    }
  }
};
