// defines stow route
async function stowRoutes(fastify) {
  fastify.route({
    method: 'POST',
    url: '/studies',
    schema: {
      params: {
        type: 'object',
        properties: {
          study: {
            type: 'string',
          },
        },
      },
    },
    handler: fastify.stow,
  });
}

module.exports = stowRoutes;
