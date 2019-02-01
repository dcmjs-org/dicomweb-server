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

// Update the views in couchdb with the ones defined in the code
function checkViews (){
  const dicomDB = fastify.couch.db.use('chronicle');
  dicomDB.get('_design/instances', function (e, b, h) { // create view
    if (e) {
      fastify.log.info('Error getting the design document '+ e.message)
      return;
    }
    for (view in views){
      b.views[view] = views[view]
            
    }
    dicomDB.insert(b, '_design/instances', function (e, b, h) {
      if (e) 
      fastify.log.info('Error updating the design document ' + e.message  )
        // console.log(e)
      else
      fastify.log.info('Design document updated successfully ' )
    })
  });
}


const views={
  wado_metadata:
  {'map':"function(doc){var key={};if(doc.dataset){studyUID='NA';if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];"+
    " seriesUID='NA'; if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];"+
    " instanceUID='NA'; if (doc.dataset['00080018'].Value[0]) instanceUID=doc.dataset['00080018'].Value[0];"+
    " for(var t in doc.dataset){var fallback='';if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){key[t]={};if(doc.dataset[t].Value[0]!==''){if(doc.dataset[t].vr==='PN')"+
    " key[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else key[t].Value=[doc.dataset[t].Value[0]||fallback]}"+
    " key[t].vr=doc.dataset[t].vr}}"+
    " emit([studyUID,seriesUID,instanceUID],key);}}"
  },
  patients:
  {'map':"function(doc){var tags=[['institution','00080080','','CS'],['patientID','00100020','','LO'],['patientName','00100010','','PN']"+
    " ,['patientBirthDate','00101030','','DA'],['patientSex','00100040','','CS'],['charset','00080005','','CS'],['retrieveURL','00081190','','UR']];var key={};"+
    " if(doc.dataset){var i;for(i=0;i<tags.length;i++){var tag=tags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){key[t]={};"+
    " if(doc.dataset[t].Value[0]!==''){if(vr==='PN')"+
    " key[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else key[t].Value=[doc.dataset[t].Value[0]||fallback]}"+
    " key[t].vr=doc.dataset[t].vr||vr}else{key[t]={};"+
    " key[t].vr=vr;}}"+
    " emit(key,1)}}",
   'reduce':'_count()'
  },
  qido_study_series:
  {'map':"function(doc){if(doc.dataset){studyUID='NA'; if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];"+
    " seriesUID='NA'; if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];"+
    " emit([studyUID,seriesUID],null)}}",
    'reduce':'_approx_count_distinct()'
  },
  qido_study:
  {'map':"function(doc){var studyTags=[['charset','00080005','','CS',1],['studyDate','00080020','','DA',1],"+
    " ['studyTime','00080030','','TM',1],['accessionNumber','00080050','','SH',1],['instanceAvailability','00080056','','CS',1],"+
    " ['modalitiesInStudy','00080061','','CS',1],['referringPhysicianName','00080090','','PN',1],['timezoneOffsetFromUTC','00080201','','SH',0],"+
    " ['retrieveURL','00081190','','UR',1],['patientName','00100010','','PN',1],['patientID','00100020','','LO',1],['patientBirthDate','00101030','','DA',1],"+
    " ['patientSex','00100040','','CS',1],['studyUID','0020000D','','UI',1],['studyID','00200010','','SH',1],['numberOfStudyRelatedSeries','00201206','','IS',1],"+
    " ['numberOfStudyRelatedInstances','00201208','','IS',1],['retrieveAETitle','00080054','','AE']];var studyKey={};if(doc.dataset){studyUID='NA'; if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];"+
    " var i;for(i=0;i<studyTags.length;i++){var tag=studyTags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];var required=tag[4];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){if(doc.dataset[t].Value[0]!==''){studyKey[t]={};if(vr==='PN')"+
    " studyKey[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else studyKey[t].Value=[doc.dataset[t].Value[0]||fallback]}"+
    " studyKey[t].vr=doc.dataset[t].vr||vr}else{if(required){studyKey[t]={};studyKey[t].vr=vr}}}"+
    " emit([studyUID,studyKey],1)}}",
    'reduce':'_count()'
  },
  qido_series:
  {'map':"function(doc){var seriesTags=[['charset','00080005','','CS',1,],['modality','00080060','','CS',1],['timezoneOffsetFromUTC','00080201','','SH',0],['seriesDescription','0008103E','','LO',0],['retrieveURL','00081190','','UR',0],"+
    " ['seriesUID','0020000E','','UI',1],['seriesNumber','00200011','','IS',1],['numberOfSeriesRelatedInstances','00201209','','IS',1],['retrieveAETitle','00080054','','AE',0],['instanceAvailability','00080056','','CS',0],['studyUID','0020000D','','UI',0]];"+
    " var seriesKey={};if(doc.dataset){studyUID='NA'; if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];"+
    " seriesUID='NA'; if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];"+
    " var i;for(i=0;i<seriesTags.length;i++){var tag=seriesTags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];var required=tag[4];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){seriesKey[t]={};if(doc.dataset[t].Value[0]!==''){if(vr==='PN')"+
    " seriesKey[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else seriesKey[t].Value=[doc.dataset[t].Value[0]||fallback]}"+
    " seriesKey[t].vr=doc.dataset[t].vr||vr}else{if(required){seriesKey[t]={};seriesKey[t].vr=vr}}}"+
    " emit([studyUID,seriesUID,seriesKey],1)}}",
    'reduce':'_count()'
  },
  qido_instances:
  {'map':"function(doc){var tags=[['charset','00080005','','CS',1],['SOPClassUID','00080016','','UI',1],['SOPInstanceUID','00080018','','UI',1],['instanceAvailability','00080056','','CS',1],['timezoneOffsetFromUTC','00080201','','SH',0],"+
    " ['retrieveURL','00081190','','UR',0],['instanceNumber','00200013','','IS',1],['rows','0008103E','','US',0],['columns','00081190','','US',0],['bitsAllocated','00280100','','US',0],['numberOfFrames','00280008','','IS',0],['studyUID','0020000D','','UI',1],"+
    " ['seriesUID','0020000E','','UI',1],['retrieveAETitle','00080054','','AE',1]];var key={};if(doc.dataset){studyUID='NA';if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];seriesUID='NA';if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];instanceUID='NA'; if (doc.dataset['00080018'].Value[0]) instanceUID=doc.dataset['00080018'].Value[0];var i;"+
    " for(i=0;i<tags.length;i++){var tag=tags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];var required=tag[4];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){key[t]={};if(doc.dataset[t].Value[0]!==''){if(vr==='PN')"+
    " key[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else key[t].Value=[doc.dataset[t].Value[0]||fallback]}"+
    " key[t].vr=doc.dataset[t].vr||vr}else{if(required){key[t]={};key[t].vr=vr}}}"+
    " emit([studyUID,seriesUID,instanceUID,key],1)}}",
    'reduce':'_count()'
  }

}

//schemas
fastify.addSchema( {
  "$id": "studies_schema",
  type: "array",
  items: [
    {
      type: "object",
      properties: {
        "00080005": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080020": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080030": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080050": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080054": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080056": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080061": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                },
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080090": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "object",
                  properties: {
                    Alphabetic: {
                      type: "string"
                    }
                  },
                  required: [
                    "Alphabetic"
                  ]
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00081190": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00100010": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "object",
                  properties: {
                    Alphabetic: {
                      type: "string"
                    }
                  },
                  required: [
                    "Alphabetic"
                  ]
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00100020": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00100030": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00100040": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0020000D": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00200010": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00201206": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00201208": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        }
      },
      required: [
        "00080005",
        "00080020",
        "00080030",
        "00080050",
        "00080054",
        "00080056",
        "00080061",
        "00080090",
        "00081190",
        "00100010",
        "00100020",
        "00100030",
        "00100040",
        "0020000D",
        "00200010",
        "00201206",
        "00201208"
      ]
    }   
  ]
});

fastify.addSchema({
  "$id": "series_schema",
  type: "array",
  items: [
    {
      type: "object",
      properties: {
        "00080005": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080054": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080056": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080060": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0008103E": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00081190": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0020000D": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0020000E": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00200011": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00201209": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        }
      },
      required: [
        "00080005",
        "00080054",
        "00080056",
        "00080060",
        "0008103E",
        "00081190",
        "0020000D",
        "0020000E",
        "00200011",
        "00201209"
      ]
    }
  ]
});

fastify.addSchema({
  "$id": "instances_schema",
  type: "array",
  items: [
    {
      type: "object",
      properties: {
        "00080005": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080016": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080018": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080054": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080056": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00081190": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0020000D": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0020000E": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00200013": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00280010": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00280011": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00280100": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        }
      },
      required: [
        "00080005",
        "00080016",
        "00080018",
        "00080054",
        "00080056",
        "00081190",
        "0020000D",
        "0020000E",
        "00200013",
        "00280010",
        "00280011",
        "00280100"
      ]
    }
  ]
});

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
    checkViews();
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
