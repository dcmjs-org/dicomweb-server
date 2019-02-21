//defines stow route
async function stow_routes (fastify, options) {
    fastify.route({
        method: 'POST',
        url: '/studies/:study',
        schema: {
          params: {
              type: 'object',
              properties: {
              study: {
                  type: 'string'
              }
            }
          }
        },
        handler: fastify.stow
      }
    )
}

module.exports = stow_routes