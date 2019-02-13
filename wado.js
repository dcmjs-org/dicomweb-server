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
    
        handler: async (request, reply) => {
        try {
            const dicomDB = fastify.couch.db.use('chronicle');
            reply.header('Content-Disposition', `attachment; filename=${request.params.instance}.dcm`);      
            reply.send(dicomDB.attachment.getAsStream(request.params.instance, "object.dcm"))
        }
        catch(err) {
            reply.send(err);
        }
        }
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
    
        handler: async (request, reply) => {
        try {
            const dicomDB = fastify.couch.db.use('chronicle');
            const body = await dicomDB.view('instances', 'wado_metadata', 
            {
                startkey: [request.params.study,"",""],
                endkey: [request.params.study+"\u9999",{},{}]
            },
            function(error, body) {
                if (!error) {
                var res=[];
                body.rows.forEach(function(instance) {
                    //get the actual instance object (tags only)
                    res.push(instance.value);
                });
                reply.send(JSON.stringify(res));
                }else{
                fastify.log.info(error)
                }
            });
        }
        catch(err) {
            reply.send(err);
        }
        }
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
    
        handler: async (request, reply) => {
        try {
            const dicomDB = fastify.couch.db.use('chronicle');
            const body = await dicomDB.view('instances', 'wado_metadata', 
            {
                startkey: [request.params.study,request.params.series,""],
                endkey: [request.params.study+"\u9999",request.params.series+"\u9999",{}]
            },
            function(error, body) {
                if (!error) {
                var res=[];
                body.rows.forEach(function(instance) {
                    //get the actual instance object (tags only)
                    res.push(instance.value);
                });
                reply.send(JSON.stringify(res));
                }else{
                fastify.log.info(error)
                }
            });
        }
        catch(err) {
            reply.send(err);
        }
        }
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
    
        handler: async (request, reply) => {
        try {
            const dicomDB = fastify.couch.db.use('chronicle');
            const body = await dicomDB.view('instances', 'wado_metadata', 
            {
                key: [request.params.study,request.params.series,request.params.instance]
            },
            function(error, body) {
                if (!error) {
                var res=[];
                body.rows.forEach(function(instance) {
                    //get the actual instance object (tags only)
                    res.push(instance.value);
                });
                reply.send(JSON.stringify(res));
                }else{
                fastify.log.info(error)
                }
            });
        }
        catch(err) {
            reply.send(err);
        }
        }
    })

}

module.exports =  wado_routes