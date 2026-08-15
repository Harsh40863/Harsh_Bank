import dotenv from "dotenv"
import nodemailer from "nodemailer"
dotenv.config()

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Error connecting to email server:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});
// Function to send email
export const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Harsh_bank" <${process.env.EMAIL_USER}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

export async function testemail(userEMAIL,name){
     const subject = "Welcome to Harsh Bank";
     const text="thank you for registering"

    const html = `
        <h1>Welcome, ${name}!</h1>
        <p>Your account has been successfully created.</p>
        <p>Thank you for joining our Harsh Bank</p>
    `;
    sendEmail(userEMAIL,subject,text,html)
}
export async function transaction_mail(
    userEMAIL,
    name,
    amount,
    otherUserName,
    type
) {
    let subject;
    let text;
    let html;

    if (type === "DEBIT") {
        subject = "Transaction Debited";

        text = `₹${amount} has been debited from your account and sent to ${otherUserName}.`;

        html = `
            <h1>Hello, ${name}!</h1>
            <p>₹${amount} has been <strong>debited</strong> from your account.</p>
            <p>Sent to: <strong>${otherUserName}</strong></p>
            <p>Your transaction has been completed successfully.</p>
        `;
    }

    if (type === "CREDIT") {
        subject = "Transaction Credited";

        text = `₹${amount} has been credited to your account from ${otherUserName}.`;

        html = `
            <h1>Hello, ${name}!</h1>
            <p>₹${amount} has been <strong>credited</strong> to your account.</p>
            <p>Received from: <strong>${otherUserName}</strong></p>
            <p>Your transaction has been completed successfully.</p>
        `;
    }

    await sendEmail(userEMAIL, subject, text, html);
}



