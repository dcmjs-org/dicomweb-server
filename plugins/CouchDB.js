const fp = require('fastify-plugin')
var toArrayBuffer = require('to-array-buffer')

const dicomweb_client = require('dicomweb-client');
window={}
const dcmjs = require('dcmjs');
var viewsjs =require('../config/views');

async function couchdb (fastify, options, next) {
    //register couchdb
    fastify.register(require('fastify-couchdb'), {
        url: options.url
    });

    // // Update the views in couchdb with the ones defined in the code
    fastify.decorate('checkCouchDBViews', async ()=>{
      const dicomDB = fastify.couch.db.use('chronicle');
      dicomDB.get('_design/instances', function (e, b, h) { // create view
        if (e) {
          fastify.log.info('Error getting the design document '+ e.message)
          return;
        }
        for (view in viewsjs.views){
          b.views[view] = viewsjs.views[view]
                
        }
        dicomDB.insert(b, '_design/instances', function (e, b, h) {
          if (e) 
          fastify.log.info('Error updating the design document ' + e.message  )
            // console.log(e)
          else
          fastify.log.info('Design document updated successfully ' )
        })
      });
    });




    //add accessor methods with decorate
    fastify.decorate('getQIDOStudies' , async (request, reply) => {
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
    });

    fastify.decorate('getQIDOSeries', async (request, reply) => {
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
    });

    fastify.decorate('getQIDOInstances', async (request, reply) => {
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
    });

    fastify.decorate('retrieveInstance', async (request, reply) => {
        try {
            const dicomDB = fastify.couch.db.use('chronicle');
            reply.header('Content-Disposition', `attachment; filename=${request.params.instance}.dcm`);      
            reply.send(dicomDB.attachment.getAsStream(request.params.instance, "object.dcm"))
        }
        catch(err) {
            reply.send(err);
        }
    });

    fastify.decorate('getStudyMetadata', async (request, reply) => {
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
    });

    fastify.decorate('getSeriesMetadata', async (request, reply) => {
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
    });

    fastify.decorate('getInstanceMetadata', async (request, reply) => {
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
    })


    fastify.decorate('getPatients', async (request, reply) => {
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
    });

    fastify.decorate('stow', async (request, reply) => {
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
        
    });

    next();
}
//expose as plugin so the module using it can access the decorated methods
module.exports=fp(couchdb)