async function stow_routes (fastify, options) {
    fastify.route({
        method: 'POST',
        url: '/',
        // this function is executed for every request before the handler is executed
        beforeHandler: async (request, reply) => {
          // E.g. check authentication
        },
        handler: async (request, reply) => {
          // dicomwc=new dicomweb_client.api.DICOMwebClient({"url" : "noURL"});
          res=fastify.dicomweb_client.message.multipartDecode(request.body);
          ab = toArrayBuffer(res)
          var dicomAttach = {
            name: 'object.dcm', 
            data: ab,
            content_type: ''
          };
          
          dictDataset = DICOMZero.dictAndDatasetFromArrayBuffer(ab);
          // console.log(dataset)
          couchDoc={
            '_id':dictDataset.dataset.SOPInstanceUID,
            dataset:dictDataset.dict
          }
          const dicomDB = fastify.couch.db.use('chronicle');
          dicomDB.multipart.insert(couchDoc, [dicomAttach], couchDoc._id, function(err, body) {
            console.log(err)
            if (!err)
              console.log(body);
          });
          reply.send('success')
          
        }
      })
}

module.exports = stow_routes