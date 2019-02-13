async function qido_routes (fastify, options) {
    // QIDO Retrieve Studies
    // GET	{s}/studies
    fastify.route({
        method: 'GET',
        url: '/studies',
        schema: {
        response: {
            200: 'studies_schema#'
        }
        },
    
        handler: async (request, reply) => {
        try {
            const dicomDB = fastify.couch.db.use('chronicle');
            var seriesCounts={};
            const bodySeriesCounts = await dicomDB.view('instances', 'qido_study_series', 
            {
                reduce: true, 
                group_level: 1
            },
            function(error, bodySeriesCounts) {
                if (!error) {
                
                bodySeriesCounts.rows.forEach(function(study) {
                    seriesCounts[study.key[0]]=study.value;
                });
                
                }else{
                fastify.log.info(error)
                }
            });
            
            fastify.log.info(seriesCounts);
            const body = await dicomDB.view('instances', 'qido_study', 
            {
                reduce: true, 
                group_level: 2
            },
            function(error, body) {
                if (!error) {
                fastify.log.info(body)
                
                var res=[];
                body.rows.forEach(function(study) {
                    study.key[1]["00201208"].Value=[]
                    study.key[1]["00201208"].Value.push(study.value);
                    study.key[1]["00201206"].Value=[]
                    study.key[1]["00201206"].Value.push(seriesCounts[study.key[0]]);
                    res.push(study.key[1]);
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

    // QIDO Retrieve Series
    // GET	{s}/studies/:study/series
    fastify.route({
        method: 'GET',
        url: '/studies/:study/series',
        schema: {
        params: {
            type: 'object',
            properties: {
            study: {
                type: 'string'
            }
            }
        },
        response: {
            200: 'series_schema#'
        }
        },
    
        handler: async (request, reply) => {
        try {
            fastify.log.info(request.params.study);
                
            const dicomDB = fastify.couch.db.use('chronicle');
            const body = await dicomDB.view('instances', 'qido_series', 
            {
                startkey: [request.params.study,""],
                endkey: [request.params.study+"\u9999","{}"],
                reduce: true, 
                group_level: 3
            },
            function(error, body) {
                if (!error) {
                fastify.log.info(body)
                
                var res=[];
                body.rows.forEach(function(series) {
                    //get the actual instance object (tags only)
                    series.key[2]["00201209"].Value=[]
                    series.key[2]["00201209"].Value.push(series.value);
                    res.push(series.key[2]);
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
    
    // QIDO Retrieve Instances
    // GET	{s}/studies/:study/series/:series/instances
    fastify.route({
        method: 'GET',
        url: '/studies/:study/series/:series/instances',
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
        },
        response: {
            200: 'instances_schema#'
        }
        },
    
        handler: async (request, reply) => {
        try {
            fastify.log.info(request.params.study);
                
            const dicomDB = fastify.couch.db.use('chronicle');
            const body = await dicomDB.view('instances', 'qido_instances', 
            {
                startkey: [request.params.study,request.params.series,""],
                endkey: [request.params.study+"\u9999",request.params.series+"\u9999","{}"],
                reduce: true, 
                group_level: 4
            },
            function(error, body) {
                if (!error) {
                var res=[];
                body.rows.forEach(function(instance) {
                    //get the actual instance object (tags only)
                    res.push(instance.key[3]);
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

module.exports = qido_routes