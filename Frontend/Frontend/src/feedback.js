// src/feedback.js
// Serverless feedback handler with email - deploy to Vercel/Netlify

import nodemailer from 'nodemailer';

function sanitize(input) {
  return String(input).replace(/<[^>]*>?/gm, '').slice(0, 2000);
}

let transporter = null;

async function initializeEmailService() {
  if (transporter) return transporter;

  const { EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS } = process.env;

  if (!EMAIL_SMTP_HOST || !EMAIL_SMTP_USER || !EMAIL_SMTP_PASS) {
    console.warn('Email not configured - feedback will be logged only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: EMAIL_SMTP_HOST,
    port: parseInt(EMAIL_SMTP_PORT) || 587,
    secure: parseInt(EMAIL_SMTP_PORT) === 465,
    auth: {
      user: EMAIL_SMTP_USER,
      pass: EMAIL_SMTP_PASS
    },
    tls: { rejectUnauthorized: false }
  });

  return transporter;
}

export async function handle
