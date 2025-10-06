import nodemailer from 'nodemailer';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const smtpHost = process.env.EMAIL_SMTP_HOST;
const smtpPort = process.env.EMAIL_SMTP_PORT;
const smtpUser = process.env.EMAIL_SMTP_USER;
const smtpPass = process.env.EMAIL_SMTP_PASS;
const feedbackTo = process.env.FEEDBACK_TO || smtpUser;

// Simple XSS prevention: strip tags and limit length
function sanitize(input) {
  return String(input).replace(/<[^>]*>?/gm, '').slice(0, 2000);
}

export async function feedbackRoute(fastify, opts) {
  fastify.post('/api/feedback', async (request, reply) => {
    const { name, email, body } = request.body || {};
    if (!name || !email || !body) {
      return reply.code(400).send({ error: 'All fields required.' });
    }
    if (!/^.+@.+\..+$/.test(email)) {
      return reply.code(400).send({ error: 'Invalid email.' });
    }
    const sanitizedBody = sanitize(body);
    if (sanitizedBody !== body) {
      return reply.code(400).send({ error: 'Feedback contains invalid characters.' });
    }
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort == 465, // true for 465, false for other ports
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: `Sensay Feedback <${smtpUser}>`,
        to: feedbackTo,
        subject: `Feedback from ${name}`,
        replyTo: email,
        text: `Name: ${name}\nEmail: ${email}\n\n${sanitizedBody}`,
      });
      return { ok: true };
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send({ error: 'Failed to send feedback.' });
    }
  });
}

export default feedbackRoute;