import { json } from '@sveltejs/kit';
import nodemailer from 'nodemailer';
import { 
  EMAIL_SMTP_HOST, 
  EMAIL_SMTP_PORT, 
  EMAIL_SMTP_USER, 
  EMAIL_SMTP_PASS, 
  FEEDBACK_TO 
} from '$env/static/private';

// Simple XSS prevention: strip tags and limit length
function sanitize(input) {
  if (!input) return '';
  return String(input).replace(/<[^>]*>?/gm, '').slice(0, 2000);
}

/**
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request, locals }) {
  try {
    const { name, email, body } = await request.json();

    // Validate required fields
    if (!name || !email || !body) {
      return json({ 
        error: 'All fields are required.',
        details: {
          name: !name ? 'Name is required' : null,
          email: !email ? 'Email is required' : null,
          body: !body ? 'Feedback message is required' : null
        }
      }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Invalid email address format.' }, { status: 400 });
    }

    // Sanitize feedback body
    const sanitizedBody = sanitize(body);

    // Check if email is configured
    if (!EMAIL_SMTP_HOST || !EMAIL_SMTP_USER || !EMAIL_SMTP_PASS) {
      console.error('Email not configured');
      return json({ 
        error: 'Email service is not configured. Please contact support.' 
      }, { status: 500 });
    }

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: EMAIL_SMTP_HOST,
      port: parseInt(EMAIL_SMTP_PORT) || 587,
      secure: parseInt(EMAIL_SMTP_PORT) === 465,
      auth: { 
        user: EMAIL_SMTP_USER, 
        pass: EMAIL_SMTP_PASS 
      },
    });

    // Get user info if authenticated
    let userInfo = '';
    if (locals.user) {
      userInfo = `\n\nUser Info:\nUser ID: ${locals.user.userId}\nUsername: ${locals.user.username || 'N/A'}\nRole: ${locals.user.role || 'N/A'}`;
    }

    // Send email
    await transporter.sendMail({
      from: `Memory Lane Feedback <${EMAIL_SMTP_USER}>`,
      to: FEEDBACK_TO || EMAIL_SMTP_USER,
      subject: `Feedback from ${name}`,
      replyTo: email,
      text: `Name: ${name}\nEmail: ${email}${userInfo}\n\nFeedback:\n${sanitizedBody}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Feedback Received</h2>
          <p><strong>Name:</strong> ${sanitize(name)}</p>
          <p><strong>Email:</strong> ${sanitize(email)}</p>
          ${userInfo ? `<p><strong>User Info:</strong><pre style="background: #f3f4f6; padding: 10px; border-radius: 4px;">${userInfo.trim()}</pre></p>` : ''}
          <h3>Feedback:</h3>
          <p style="white-space: pre-wrap;">${sanitizedBody}</p>
        </div>
      `
    });

    return json({ 
      ok: true,
      message: 'Feedback submitted successfully' 
    });

  } catch (error) {
    console.error({ error: error.message, stack: error.stack }, 'Failed to send feedback email');
    return json({ 
      error: 'Failed to send feedback. Please try again later.' 
    }, { status: 500 });
  }
}