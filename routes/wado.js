// defines WADO routes
async function wadoRoutes(fastify) {
  // WADO URI Retrieve Instance
  // GET {s}?{querystring}
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      querystring: {
        type: 'object',
        properties: {
          studyUID: {
            type: 'string',
          },
          seriesUID: {
            type: 'string',
          },
          objectUID: {
            type: 'string',
          },
          contentType: {
            type: 'string',
          },
          transferSyntax: {
            type: 'string',
          },
          frame: {
            type: 'string',
          },
        },
        required: ['objectUID'],
      },
    },

    handler: fastify.retrieveInstance,
  });

  // WADO Retrieve Instance
  // GET {s}/studies/{study}/series/{series}/instances/{instance}
  fastify.route({
    method: 'GET',
    url: '/studies/:study/series/:series/instances/:instance',
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
          instance: {
            type: 'string',
          },
        },
      },
    },

    handler: fastify.retrieveInstance,
  });

  // WADO Retrieve Instance frame
  // GET {s}/studies/{study}/series/{series}/instances/{instance}/frames/{frames}
  fastify.route({
    method: 'GET',
    url: '/studies/:study/series/:series/instances/:instance/frames/:frames',
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
          instance: {
            type: 'string',
          },
          frames: {
            type: 'string',
          },
        },
      },
    },

    handler: fastify.retrieveInstanceFrames,
  });

  // WADO Retrieve Study Metadata
  // GET {s}/studies/{study}/metadata
  fastify.route({
    method: 'GET',
    url: '/studies/:study/metadata',
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

    handler: fastify.getStudyMetadata,
  });

  // WADO Retrieve Series Metadata
  // GET {s}/studies/{study}/series/{series}/metadata
  fastify.route({
    method: 'GET',
    url: '/studies/:study/series/:series/metadata',
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
    },

    handler: fastify.getSeriesMetadata,
  });

  // WADO Retrieve Instance Metadata
  // GET {s}/studies/{study}/series/{series}/instances/{instance}/metadata
  fastify.route({
    method: 'GET',
    url: '/studies/:study/series/:series/instances/:instance/metadata',
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
          instance: {
            type: 'string',
          },
        },
      },
    },

    handler: fastify.getInstanceMetadata,
  });

  fastify.route({
    method: 'GET',
    url: '/studies/:study',
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
    handler: fastify.getWado,
  });

  fastify.route({
    method: 'GET',
    url: '/studies/:study/series/:series',
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
    },
    handler: fastify.getWado,
  });
}

module.exports = wadoRoutes;
