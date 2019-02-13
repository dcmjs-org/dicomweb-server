async function routes (fastify, options) {
    // GET	{s}/patients
    fastify.route({
        method: 'GET',
        url: '/patients',
        schema: {
        response: {
            200: {
            type: "array",
            items: [
                {
                type: "object",
                properties: {
                    "00080005": {
                    type: "object",
                    properties: {
                        Value: {
                        type: "array",
                        items: [
                            {
                            type: "string"
                            }
                        ]
                        },
                        vr: {
                        type: "string"
                        }
                    },
                    required: [
                        "vr"
                    ]
                    },
                    "00081190": {
                    type: "object",
                    properties: {
                        Value: {
                        type: "array",
                        items: [
                            {
                            type: "string"
                            }
                        ]
                        },
                        vr: {
                        type: "string"
                        }
                    },
                    required: [
                        "vr"
                    ]
                    },
                    "00080080": {
                    type: "object",
                    properties: {
                        Value: {
                        type: "array",
                        items: [
                            {
                            type: "string"
                            }
                        ]
                        },
                        vr: {
                        type: "string"
                        }
                    },
                    required: [
                        "vr"
                    ]
                    },
                    "00100020": {
                    type: "object",
                    properties: {
                        Value: {
                        type: "array",
                        items: [
                            {
                            type: "string"
                            }
                        ]
                        },
                        vr: {
                        type: "string"
                        }
                    },
                    required: [
                        "vr"
                    ]
                    },
                    "00100010": {
                    type: "object",
                    properties: {
                        Value: {
                        type: "array",
                        items: [
                            {
                            type: "object",
                            properties: {
                                Alphabetic: {
                                type: "string"
                                }
                            }
                            }
                        ]
                        },
                        vr: {
                        type: "string"
                        }
                    },
                    required: [
                        "vr"
                    ]
                    },
                    "00101030": {
                    type: "object",
                    properties: {
                        Value: {
                        type: "array",
                        items: [
                            {
                            type: "string"
                            }
                        ]
                        },
                        vr: {
                        type: "string"
                        }
                    },
                    required: [
                        "vr"
                    ]
                    },
                    "00100040": {
                    type: "object",
                    properties: {
                        Value: {
                        type: "array",
                        items: [
                            {
                            type: "string"
                            }
                        ]
                        },
                        vr: {
                        type: "string"
                        }
                    },
                    required: [
                        "vr"
                    ]
                    }
                }
                }
            ]
            }
        }
        },
    
        handler: async (request, reply) => {
        try {
            const dicomDB = fastify.couch.db.use('chronicle');
            const body = await dicomDB.view('instances', 'patients', 
            {
                reduce: true, 
                group_level: 3
            },
            function(error, body) {
                if (!error) {
                fastify.log.info(body)
                
                var res=[];
                body.rows.forEach(function(patient) {
                    res.push(patient.key);
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

module.exports =  routes