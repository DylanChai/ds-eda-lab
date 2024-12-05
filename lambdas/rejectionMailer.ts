import { SQSHandler } from "aws-lambda";
import { SESClient, SendEmailCommand, SendEmailCommandInput } from "@aws-sdk/client-ses";

// Initialize the SES client
const ses = new SESClient({ region: process.env.AWS_REGION || "eu-west-1" });

// Lambda handler
export const handler: SQSHandler = async (event) => {
  console.log("Processing rejection messages...");

  for (const record of event.Records) {
    try {
      // Parse the message from the DLQ
      const message = JSON.parse(record.body);
      const bucket = message.bucket || "Unknown Bucket";
      const key = message.key || "Unknown File";

      // Compose rejection email
      const emailParams: SendEmailCommandInput = {
        Destination: {
          ToAddresses: [process.env.SES_EMAIL_TO || ""], // Recipient email
        },
        Message: {
          Body: {
            Text: {
              Charset: "UTF-8",
              Data: `Your upload (${key}) was rejected because it is not a valid image file type. Accepted types are .jpeg and .png.`,
            },
            Html: {
              Charset: "UTF-8",
              Data: `
                <html>
                  <body>
                    <h3>Image Upload Rejection</h3>
                    <p>Unfortunately, your upload was rejected.</p>
                    <ul>
                      <li><strong>Bucket:</strong> ${bucket}</li>
                      <li><strong>File:</strong> ${key}</li>
                    </ul>
                    <p><em>Reason: Invalid file type. Accepted types are .jpeg and .png.</em></p>
                  </body>
                </html>
              `,
            },
          },
          Subject: {
            Charset: "UTF-8",
            Data: "Image Upload Rejection",
          },
        },
        Source: process.env.SES_EMAIL_FROM || "", // Sender email
      };

      // Send the email using SES
      await ses.send(new SendEmailCommand(emailParams));
      console.log(`Rejection email sent for ${key}`);
    } catch (error) {
      console.error("Error processing DLQ message:", error);
    }
  }
};
