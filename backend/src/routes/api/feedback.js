import { Resend } from 'resend';

// Simple XSS prevention: strip tags and limit length
function sanitize(input) {
  return String(input).replace(/<[^>]*>?/gm, '').slice(0, 2000);
}

/**
 * Feedback routes
 * @param {import('fastify').FastifyInstance} fastify
 * @param {Object} opts
 */
export async function feedbackRoutes(fastify, opts) {
  const { RESEND_API_KEY, EMAIL_FROM, FEEDBACK_TO } = process.env;

  // Validate email configuration on startup
  if (!RESEND_API_KEY) {
    fastify.log.warn('RESEND_API_KEY not configured. Feedback functionality may not work.');
  }

  // Initialize Resend client
  let resend;
  if (RESEND_API_KEY) {
    resend = new Resend(RESEND_API_KEY);
  }

  /**
   * Submit feedback
   * POST /api/feedback
   * Body: { name: string, email: string, body: string }
   * Auth: Optional (works for both authenticated and non-authenticated users)
   */
  fastify.post('/api/feedback', async (request, reply) => {
    try {
      const { name, email, body } = request.body || {};

      // Validate required fields
      if (!name || !email || !body) {
        return reply.code(400).send({ 
          error: 'All fields are required.',
          details: {
            name: !name ? 'Name is required' : null,
            email: !email ? 'Email is required' : null,
            body: !body ? 'Feedback message is required' : null
          }
        });
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply.code(400).send({ error: 'Invalid email address format.' });
      }

      // Sanitize feedback body
      const sanitizedBody = sanitize(body);
      if (sanitizedBody !== body) {
        return reply.code(400).send({ 
          error: 'Feedback contains invalid characters. Please remove any HTML tags or special formatting.' 
        });
      }

      // Check if Resend is configured
      if (!resend) {
        request.log.error('Resend API key not configured');
        return reply.code(500).send({ 
          error: 'Email service is not configured. Please contact support.' 
        });
      }

      // Get user info if authenticated
      let userInfo = '';
      if (request.user) {
        userInfo = `\n\nUser Info:\nUser ID: ${request.user.userId}\nUsername: ${request.user.username || 'N/A'}\nRole: ${request.user.role || 'N/A'}`;
      }

      const fromAddress = EMAIL_FROM || 'noreply@sensay.ai';
      const toAddress = FEEDBACK_TO || fromAddress;

      // Send email via Resend
      const response = await resend.emails.send({
        from: fromAddress,
        to: toAddress,
        replyTo: email,
        subject: `Feedback from ${name}`,
        text: `Name: ${name}\nEmail: ${email}${userInfo}\n\nFeedback:\n${sanitizedBody}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Feedback Received</h2>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              ${userInfo ? `<p><strong>User Info:</strong><pre style="background: white; padding: 10px; border-radius: 4px;">${userInfo.trim()}</pre></p>` : ''}
            </div>
            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h3>Feedback:</h3>
              <p style="white-space: pre-wrap;">${sanitizedBody}</p>
            </div>
          </div>
        `
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      request.log.info({ email, name }, 'Feedback submitted successfully');

      return reply.send({ 
        ok: true,
        message: 'Feedback submitted successfully' 
      });

    } catch (error) {
      request.log.error({ error: error.message, stack: error.stack }, 'Failed to send feedback email');
      return reply.code(500).send({ 
        error: 'Failed to send feedback. Please try again later.' 
      });
    }
  });
}
export default feedbackRoutes;
