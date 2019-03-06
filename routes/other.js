// defines routes that are not specified by the DICOMweb standard
async function routes(fastify) {
  // GET {s}/patients
  fastify.route({
    method: 'GET',
    url: '/patients',
    schema: {
      response: {
        200: 'patients_schema#',
      },
    },

    handler: fastify.getPatients,
  });
}

module.exports = routes;
