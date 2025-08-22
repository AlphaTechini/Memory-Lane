const ContextManager = require('../contextManager');
const sensayClient = require('../sensayClient');
const { FromSchema } = require('json-schema-to-ts');

/**
 * Registers the Sensay API routes.
 * This plugin encapsulates all chat-related endpoints.
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance.
 * @param {object} options - Plugin options.
 */
async function sensayRoutes(fastify, options) {
  // A single instance of the context manager is created for this plugin scope,
  // ensuring it's shared between the /chat and /new-chat routes.
  const contextManager = new ContextManager();

  const chatRouteSchema = {
    body: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          response: { type: 'string' },
        },
      },
    },
  };

  /**
   * Handles incoming chat messages, interacts with the Sensay API,
   * and maintains conversation history.
   * @param {import('fastify').FastifyRequest<{Body: FromSchema<typeof chatRouteSchema.body>}>} request
   */
  fastify.post('/api/chat', { schema: chatRouteSchema }, async (request, reply) => {
    try {
      // 1. Extract message from the request body.
      // Fastify has already validated that `message` is a non-empty string
      // based on the schema we provided.
      const { message } = request.body;

      // 2. Retrieve the current conversation history.
      const history = contextManager.getHistory();

      // 3. Call the Sensay API with the new message and history.
      const apiResponse = await sensayClient.sendMessage(message, history);

      // 4. Store the user's message and the API's response for future turns.
      contextManager.addMessage('user', message);
      contextManager.addMessage('assistant', apiResponse);

      // 5. Return the API's response to the client.
      // Fastify will use a pre-compiled, high-speed serializer for this object.
      return { response: apiResponse };
    } catch (err) {
      fastify.log.error(err, 'Error processing chat message');
      // On error, send a generic 500 response.
      return reply.status(500).send({ error: 'Failed to process message' });
    }
  });

  /**
   * Resets the conversation history to start a new chat.
   */
  fastify.post('/api/new-chat', async (request, reply) => {
    contextManager.reset();
    return { success: true, message: 'New chat started, history cleared.' };
  });
}

module.exports = sensayRoutes;
