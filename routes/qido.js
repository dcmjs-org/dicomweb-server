// defines QIDO routes
async function qidoRoutes(fastify) {
  // QIDO Retrieve Studies
  // GET {s}/studies
  fastify.route({
    method: 'GET',
    url: '/studies',
    schema: {
      response: {
        200: 'studies_schema#',
      },
    },
    handler: fastify.getQIDOStudies,
  });

  // QIDO Retrieve Series
  // GET {s}/studies/:study/series
  fastify.route({
    method: 'GET',
    url: '/studies/:study/series',
    schema: {
      params: {
        type: 'object',
        properties: {
          study: {
            type: 'string',
          },
        },
      },
      response: {
        200: 'series_schema#',
      },
    },

    handler: fastify.getQIDOSeries,
  });

  // QIDO Retrieve Instances
  // GET {s}/studies/:study/series/:series/instances
  fastify.route({
    method: 'GET',
    url: '/studies/:study/series/:series/instances',
    schema: {
      params: {
        type: 'object',
        properties: {
          study: {
            type: 'string',
          },
          series: {
            type: 'string',
          },
        },
      },
      response: {
        200: 'instances_schema#',
      },
    },

    handler: fastify.getQIDOInstances,
  });
}

module.exports = qidoRoutes;
