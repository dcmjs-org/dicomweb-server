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
    },
    // filter just the fileNamePath
    response: {
      200: {
        type: 'object',
        properties: {
          fileNamePath: { type: 'string' }
        }
      }
    }
  },
  // this function is executed for every request before the handler is executed
  beforeHandler: async (request, reply) => {
    // TODO check authentication
  },
  handler: async (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use('chronicle');
      const body = await dicomDB.get(request.params.instance)
      reply.header('Content-Disposition', `attachment; filename=${request.params.instance}.dcm`);      
      reply.send(fs.createReadStream(body.fileNamePath))
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
