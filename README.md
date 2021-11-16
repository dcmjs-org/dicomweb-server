# dicomweb-server
Lightweight DICOMweb Server with CouchDB

*Note: this is a work in progress and not intended for production or clinical use.*

More background information can found in https://na-mic.github.io/ProjectWeek/PW30_2019_GranCanaria/Projects/DICOMweb-CouchDB/

## Architecture

The dicomweb-server is a fastify server that speaks DICOMweb to clients and fullfills their requests using CouchDB or other plugin services.
![Overall design](image.png)

## Authentification

By default, the authentication is none and the application mode is development.
You can change the authentication method by changing the auth attribute in config/development.js
The value you put in should be the name of a json file in the config directory. A sample config for authentication should have the following information


`{
    "realm": "your-realm",
    "authServerUrl": "your-auth-server-port-and-port",
    "clientId": "your-client-id",
    "clientSecret": "your-secret"
}`

If using the default authentication of couchdb with an admin account, you will need to specify the admin username and password in config/development.js in the below style:

`{
    dbServer: process.env.DB_SERVER || 'http://username:password@localhost'
}`



## Installation

```
git clone git://github.com/dcmjs-org/dicomweb-server

cd dicomweb-server
npm install
```

Install [CouchDB](http://couchdb.apache.org/).

Initially your CouchDB database starts empty, but dicomweb-server will set up the internal database
and design documents so there is no need to configure it.

You can run tests by running `npm test`.

## Running

Be sure to have [CouchDB](http://couchdb.apache.org/) running at localhost:5984 (the default), then start the dicomweb-server:

```
npm start
```

## Usage

The server should be ultimately compatible with any DICOMweb client library.

We test with a Python implementation [dicomweb_client](https://github.com/clindatsci/dicomweb-client).

Get study list:

`dicomweb_client --url http://localhost:5985 search studies`

Store a DATA_DIRECTORY of DICOM image files (here with the ".IMA" extension).  Adjust the command line to match the location and naming of your files.  (The `-n25` option to xargs is for batching files, leading to fewer calls and thus less overhead.)

`find DATA_DIRECTORY -iname \*.IMA -print0 | xargs -0 -n25 dicomweb_client --url http://localhost:5985 store instances`


## Use with a viewer

It's possible to use this server as a backend to the [OHIF Viewer](http://ohif.org) using a configuration like this. (See [this file](https://github.com/OHIF/Viewers/blob/master/platform/viewer/public/config/default.js#L1-L31)).

```
     const dicomweb_serverConfig = {
        routerBasename: "/ohif",
        rootUrl: "http://localhost:2016/ohif",
        servers: {
          "dicomWeb": [
            {
              "name": "dicomweb_server",
              "wadoUriRoot": "http://localhost:5985",
              "qidoRoot": "http://localhost:5985",
              "wadoRoot": "http://localhost:5985",
              "qidoSupportsIncludeField": true,
              "imageRendering": "wadouri",
              "thumbnailRendering": "wadors",
              "requestOptions": {
                  "requestFromBrowser": true
              }
            },
          ]
        }
      };
```

Note that currently the `imageRendering` option must be `wadouri`
