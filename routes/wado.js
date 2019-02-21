//defines WADO routes
async function wado_routes (fastify, options) {
    // WADO Retrieve Instance
    // GET	{s}/studies/{study}/series/{series}/instances/{instance}
    fastify.route({
        method: 'GET',
        url: '/studies/:study/series/:series/instances/:instance',
        schema: {
            params: {
                type: 'object',
                properties: {
                study: {
                    type: 'string'
                },
                series: {
                    type: 'string'
                },
                instance: {
                    type: 'string'
                }
                }
            }
        },
    
        handler: fastify.retrieveInstance
    })

    // WADO Retrieve Study Metadata
    // GET	{s}/studies/{study}/metadata
    fastify.route({
        method: 'GET',
        url: '/studies/:study/metadata',
        schema: {
            params: {
                type: 'object',
                properties: {
                study: {
                    type: 'string'
                }
                }
            },
        
        },
    
        handler: fastify.getStudyMetadata
    })


    // WADO Retrieve Series Metadata
    // GET	{s}/studies/{study}/series/{series}/metadata
    fastify.route({
        method: 'GET',
        url: '/studies/:study/series/:series/metadata',
        schema: {
            params: {
                type: 'object',
                properties: {
                study: {
                    type: 'string'
                },
                series: {
                    type: 'string'
                }
                }
            }
        },
    
        handler: fastify.getSeriesMetadata
    })

    // WADO Retrieve Instance Metadata
    // GET	{s}/studies/{study}/series/{series}/instances/{instance}/metadata
    fastify.route({
        method: 'GET',
        url: '/studies/:study/series/:series/instances/:instance/metadata',
        schema: {
            params: {
                type: 'object',
                properties: {
                study: {
                    type: 'string'
                },
                series: {
                    type: 'string'
                },
                instance: {
                    type: 'string'
                }
                }
            }
        },
    
        handler: fastify.getInstanceMetadata
    })
}

module.exports =  wado_routes