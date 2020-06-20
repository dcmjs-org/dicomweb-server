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

  fastify.route({
    method: 'POST',
    url: '/linkFolder',
    schema: {
      query: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
          },
        },
      },
    },
    handler: fastify.linkFolder,
  });
}

module.exports = stowRoutes;
