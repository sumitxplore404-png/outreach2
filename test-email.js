// Test script to verify email sending with CC recipients
// Run with: node test-email.js

const { sendEmail } = require('./lib/email.ts');

async function testEmailSending() {
  console.log('Testing email sending with CC recipients...');

  const testOptions = {
    to: 'test@example.com', // Replace with actual test email
    subject: 'Test Email with CC Recipients',
    htmlContent: '<h1>Test Email</h1><p>This is a test email with CC recipients.</p>',
    textContent: 'Test Email - This is a test email with CC recipients.',
    smtpEmail: 'gautam@foreignadmits.com', // Your test email
    smtpPassword: 'qbxchnhyxmrbjyfp', // Your app password
    trackingId: 'test-tracking-id',
    batchId: 'test-batch-id',
    contactName: 'Test Contact',
    trackingBaseUrl: 'http://localhost:3000',
    cc: ['sumitkumar969074@gmail.com'] // CC recipient
  };

  try {
    const result = await sendEmail(testOptions);
    console.log('Email sending result:', result);
    if (result) {
      console.log('✅ Email sent successfully with CC recipients!');
    } else {
      console.log('❌ Email sending failed');
    }
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
  }
}

testEmailSending();
