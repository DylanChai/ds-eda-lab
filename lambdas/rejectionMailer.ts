import { SQSHandler } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.SES_REGION });

export const handler: SQSHandler = async (event) => {
  console.log("Rejection Handler Event: ", JSON.stringify(event));

  const toAddress = process.env.SES_EMAIL_TO;
  const fromAddress = process.env.SES_EMAIL_FROM;

  if (!toAddress || !fromAddress) {
    console.error("Email addresses are not set in environment variables.");
    return;
  }

  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);
    console.log("Parsed record body:", recordBody);

    const errorMessage = recordBody.errorMessage || "Invalid file type";

    const emailParams = {
      Destination: {
        ToAddresses: [toAddress],
      },
      Message: {
        Body: {
          Text: {
            Data: `Your file upload was rejected due to the following reason: ${errorMessage}`,
          },
        },
        Subject: {
          Data: "File Upload Rejected",
        },
      },
      Source: fromAddress,
    };

    try {
      await ses.send(new SendEmailCommand(emailParams));
      console.log("Rejection email sent.");
    } catch (err) {
      console.error("Error sending rejection email:", err);
    }
  }
};
