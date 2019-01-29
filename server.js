// Require the framework and instantiate it
const fastify = require('fastify')({
  logger: true
})

const path = require('path')
const fs = require('fs')

fastify.register(require('fastify-couchdb'), {
  url: 'http://localhost:5984'
})

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, ''),
  // prefix: '/public/', // optional: default '/'
})
 
const authenticate = {realm: 'Westeros'}
fastify.register(require('fastify-basic-auth'), { validate, authenticate })
// `this` inside validate is `fastify`
function validate (username, password, req, reply, done) {
  if (username === 'dicomweb' && password === 'server') {
    done()
  } else {
    done(new Error('Not Authenticated'))
  }
}

fastify.after(() => {
  //this enables basic authentication
  // disabling authentication for now 
  // fastify.addHook('preHandler', fastify.basicAuth)
  
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
      },
      // filter just the fileNamePath
      response: {
        200: {
          type: 'object',
          properties: {
            fileNamePath: { type: 'string' },
            dataset: {
              type: "object",
              properties: {
                "0020000D": {
                  type: "object",
                  properties: {
                    vr: {
                      type: "string"
                    },
                    Value: {
                      type: "string"
                    }
                  },
                  required: [
                    "vr",
                    "Value"
                  ]
                }
              }
            }
          }
        }
      }
    },
   
    handler: async (request, reply) => {
      try {
        const dicomDB = fastify.couch.db.use('chronicle');
        const body = await dicomDB.get(request.params.instance)
        reply.send(body)
      }
      catch(err) {
        reply.send(err);
      }
    }
  })

  
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
                    "Value",
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
                    "Value",
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
                    "Value",
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
                    "Value",
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
                    "Value",
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
                    "Value",
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
                    "Value",
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
              
              result=[]
              body.rows.forEach(function(patient) {
                result.push(patient.key)
              });
              reply.send(result)
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

  
  
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      // request needs to have a querystring with a `name` parameter
      querystring: {
        name: { type: 'string' }
      },
      // the response needs to be an object with an `hello` property of type 'string'
      response: {
        200: {
          type: 'object',
          properties: {
            hello: { type: 'string' }
          }
        }
      }
    },
    // this function is executed for every request before the handler is executed
    beforeHandler: async (request, reply) => {
      // E.g. check authentication
    },
    handler: async (request, reply) => {
      return { hello: 'world' }
    }
  })
})

// Run the server!
const start = async () => {
  try {
    await fastify.listen(5985, '0.0.0.0')
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
