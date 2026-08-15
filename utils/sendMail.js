const nodemailer = require('nodemailer');
const { EMAIL_USER, EMAIL_PASS } = require('../config/env');

const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com', // Hostinger SMTP host
  port: 465, // SSL port
  secure: true, // true for 465, false for other ports
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // For self-signed certificates
  },
  debug: true, // Enable debug output
  logger: true // Enable logger
});

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: `"Atvan Reward System" <${EMAIL_USER}>`,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error.message);
    console.error('Error details:', error);
    return { success: false, error: error.message };
  }
};

// Specific email templates
const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Reward System!';
  const html = `
    <h1>Welcome ${user.name}!</h1>
    <p>Thank you for joining our reward system. Start earning coins by logging in daily!</p>
    <p>Your current tier: ${user.tier}</p>
  `;
  return await sendEmail(user.email, subject, html);
};

const sendWithdrawalSuccessEmail = async (user, withdrawal) => {
  const subject = 'Withdrawal Successful';
  const html = `
    <h1>Withdrawal Processed Successfully!</h1>
    <p>Dear ${user.name},</p>
    <p>Your withdrawal of ${withdrawal.amount} coins has been processed successfully.</p>
    <p>The amount will be credited to your bank account within 1-2 business days.</p>
    <p>Transaction ID: ${withdrawal.transactionId}</p>
  `;
  return await sendEmail(user.email, subject, html);
};

const sendWithdrawalFailedEmail = async (user, withdrawal, reason) => {
  const subject = 'Withdrawal Failed';
  const html = `
    <h1>Withdrawal Failed</h1>
    <p>Dear ${user.name},</p>
    <p>Your withdrawal request of ${withdrawal.amount} coins could not be processed.</p>
    <p>Reason: ${reason}</p>
    <p>Please try again or contact support.</p>
  `;
  return await sendEmail(user.email, subject, html);
};

const sendResetEmail = async (user, resetToken) => {
  const subject = 'Password Reset Request';
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  const html = `
    <h1>Password Reset</h1>
    <p>Dear ${user.name},</p>
    <p>You requested a password reset for your RewardSystem account.</p>
    <p>Please click the link below to reset your password:</p>
    <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p>This link will expire in 10 minutes.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;
  return await sendEmail(user.email, subject, html);
};

const sendUserCredentialsEmail = async (user, password) => {
  const subject = 'Your Account Credentials - Reward System';
  const html = `
    <h1>Welcome to Reward System!</h1>
    <p>Dear ${user.name},</p>
    <p>Your account has been created successfully. Here are your login credentials:</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Password:</strong> ${password}</p>
      <p><strong>User ID:</strong> ${user.uniqueId}</p>
    </div>
    <p>Please login and change your password immediately for security.</p>
    <p>You can login at: ${process.env.FRONTEND_URL}/login</p>
    <p>If you have any questions, please contact support.</p>
  `;
  return await sendEmail(user.email, subject, html);
};

const sendCoinCertificateEmail = async (user) => {
  const subject = 'Your Coin Certificate - Atvan Reward System';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #4CAF50; border-radius: 10px; overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">ATVAN</h1>
        <p style="margin: 5px 0 0 0; font-size: 16px;">Reward System Certificate</p>
      </div>

      <!-- Certificate Body -->
      <div style="padding: 40px 30px; background: #f9f9f9;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

          <h2 style="color: #333; text-align: center; margin-bottom: 30px; font-size: 24px;">Coin Balance Certificate</h2>

          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background: #4CAF50; color: white; padding: 15px 30px; border-radius: 50px; font-size: 18px; font-weight: bold;">
              🏆 ${user.tier} Member
            </div>
          </div>

          <p style="font-size: 16px; line-height: 1.6; color: #555; text-align: center; margin-bottom: 20px;">
            This is to certify that
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <h3 style="color: #4CAF50; font-size: 28px; margin: 0; text-transform: uppercase;">${user.name}</h3>
            <p style="color: #666; font-size: 14px; margin: 5px 0;">User ID: ${user.uniqueId}</p>
          </div>

          <div style="background: #f0f8f0; padding: 25px; border-radius: 8px; margin: 30px 0; text-align: center;">
            <div style="font-size: 48px; color: #4CAF50; margin-bottom: 10px;">💰</div>
            <div style="font-size: 36px; font-weight: bold; color: #333;">${user.totalCoins}</div>
            <div style="font-size: 18px; color: #666;">Total Coins Earned</div>
          </div>

          <div style="margin: 30px 0; padding: 20px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">Achievement Details:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #856404;">
              <li>Login Count: ${user.loginCount || 0}</li>
              <li>Service Status: ${user.serviceActivated ? 'Active' : 'Inactive'}</li>
              <li>Payment Status: ${user.paymentStatus}</li>
              <li>Member Since: ${new Date(user.createdAt).toLocaleDateString('en-IN')}</li>
            </ul>
          </div>

          <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px; line-height: 1.5;">
            This certificate is issued by Atvan Reward System and represents your achievements and coin balance as of ${new Date().toLocaleDateString('en-IN')}.
          </p>

        </div>
      </div>

      <!-- Footer -->
      <div style="background: #333; color: white; padding: 20px; text-align: center;">
        <p style="margin: 0; font-size: 14px;">
          Atvan Reward System | Keep earning more coins!
        </p>
        <p style="margin: 5px 0 0 0; font-size: 12px;">
          For support, contact us at support@atvan.com
        </p>
      </div>
    </div>
  `;
  return await sendEmail(user.email, subject, html);
};

const sendAtvanCoinCertificateEmail = async (user, purchase = null) => {
  const subject = 'Your Coin / Share Certificate - ATVAN';
  const certificateNo = purchase?.certificateNo || `CF-${new Date().getFullYear()}-${String(user.uniqueId || user._id).slice(-6)}`;
  const coins = purchase?.baseCoins || user.totalCoins || 0;
  const amount = purchase?.amount || Math.round((coins || 0) * 10);
  const aadhaar = user.aadhaarNumber ? `********${String(user.aadhaarNumber).slice(-4)}` : 'Not updated';
  const rows = [
    [0, '1-Jan-27', 10, 100, 8, '1-Jan-35', 300, 3000],
    [1, '1-Jan-28', 15, 150, 9, '1-Jan-36', 500, 5000],
    [2, '1-Jan-29', 25, 250, 10, '1-Jan-37', 650, 6500],
    [3, '1-Jan-30', 40, 400, 11, '1-Jan-38', 800, 8000],
    [4, '1-Jan-31', 55, 550, 12, '1-Jan-39', 1000, 10000],
    [5, '1-Jan-32', 75, 750, 13, '1-Jan-40', 1150, 11500],
    [6, '1-Jan-33', 100, 1000, 14, '1-Jan-41', 1300, 13000],
    [7, '1-Jan-34', 200, 2000, 15, '1-Jan-42', 1500, 15000]
  ];
  const chartRows = rows.map(row => `<tr>${row.map(cell => `<td style="border:1px solid #d7c28a;padding:8px;text-align:center;color:#fff;font-weight:700;">${cell}</td>`).join('')}</tr>`).join('');
  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 860px; margin: 0 auto; background:#080906; color:#fff; padding:28px; border:8px double #d6aa46;">
      <div style="border:2px solid #d6aa46; padding:24px; background:linear-gradient(135deg,#0b0d09,#1d2118);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;">
          <div style="font-size:18px;font-weight:700;">CF No - <span style="display:inline-block;background:#fff;color:#111;padding:3px 14px;">${certificateNo}</span></div>
          <div style="text-align:center;">
            <div style="font-size:42px;font-weight:900;color:#d6aa46;letter-spacing:2px;">ATVAN</div>
            <div style="font-family:Arial,sans-serif;font-size:12px;color:#f4d47a;">FUTURE OF DIGITAL WEALTH</div>
          </div>
        </div>
        <h1 style="text-align:center;color:#f4d47a;font-size:34px;margin:26px 0 18px;">COIN / SHARE CERTIFICATE</h1>
        <div style="border:2px solid #d6aa46;padding:18px;margin:0 auto 20px;max-width:720px;text-align:center;font-size:18px;line-height:1.45;">
          THIS IS TO CERTIFY that the certificate holder is the registered holder of the within-mentioned coin(s). The amount endorsed herein has been paid up on each such coin.
        </div>
        <div style="display:flex;gap:10px;background:linear-gradient(90deg,#f8e6a1,#b8842e,#f8e6a1);color:#111;border-radius:8px;padding:12px;margin:18px 0;font-family:Arial,sans-serif;font-weight:900;font-size:18px;">
          <div style="flex:1;text-align:center;">No. Of Coin : ${coins}</div>
          <div style="flex:1;text-align:center;">Price Per Coin : 10/-</div>
          <div style="flex:1;text-align:center;">Total Amount: ${amount}/-</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:28px 0;font-size:18px;">
          <div>Mr/Ms: <span style="display:inline-block;background:#fff;color:#111;min-width:240px;padding:7px 10px;">${user.name || ''}</span></div>
          <div>Aadhaar: <span style="display:inline-block;background:#fff;color:#111;min-width:240px;padding:7px 10px;">${aadhaar}</span></div>
          <div>User ID: <span style="color:#f4d47a;font-weight:900;">${user.uniqueId || '-'}</span></div>
          <div>Current Balance: <span style="color:#f4d47a;font-weight:900;">${user.totalCoins || 0} coins</span></div>
        </div>
        <h2 style="text-align:center;background:linear-gradient(90deg,#f8e6a1,#b8842e,#f8e6a1);color:#111;border-radius:8px;padding:10px;">COIN / SHARE CHART</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;background:#111;">
          <thead><tr>${['Sr. No.','Year','Price','Value @Rs.100','Sr. No.','Year','Price','Value @Rs.100'].map(h => `<th style="border:1px solid #d7c28a;padding:8px;background:#d6aa46;color:#111;">${h}</th>`).join('')}</tr></thead>
          <tbody>${chartRows}</tbody>
        </table>
        <div style="text-align:center;margin-top:24px;color:#f4d47a;font-size:28px;font-weight:900;">ATVAN</div>
        <p style="text-align:center;color:#d9d9d9;font-family:Arial,sans-serif;font-size:13px;">Issued on ${new Date().toLocaleDateString('en-IN')} | Support: 9953701057</p>
      </div>
    </div>
  `;
  return await sendEmail(user.email, subject, html);
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendWithdrawalSuccessEmail,
  sendWithdrawalFailedEmail,
  sendResetEmail,
  sendUserCredentialsEmail,
  sendCoinCertificateEmail: sendAtvanCoinCertificateEmail
};
