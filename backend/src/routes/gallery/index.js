import albumsRoutes from './albums.js';
import photosRoutes from './photos.js';
import legacyRoutes from './legacy.js';

export default async function galleryRoutes(fastify, options) {
  // register sub-route modules
  await fastify.register(albumsRoutes, { prefix: '/gallery/albums' });
  await fastify.register(photosRoutes, { prefix: '/gallery' });
  await fastify.register(legacyRoutes, { prefix: '/' });
}
