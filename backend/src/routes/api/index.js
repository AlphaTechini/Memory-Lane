import feedbackRoute from './feedback.js';

export default async function apiRoutes(fastify, opts) {
  await fastify.register(feedbackRoute);
}
