# dicomweb-server
Lightweight DICOMweb Server with CouchDB

*Note: this is a work in progress and not intended for production or clinical use.*

More background information can found in https://na-mic.github.io/ProjectWeek/PW30_2019_GranCanaria/Projects/DICOMweb-CouchDB/

By default, the authentication is none and the application mode is development.
You can change the authentication method by changing the auth attribute in config/development.js
The value you put in should be the name of a json file in the config directory. A sample config for authentication should have the following information


`{
    "realm": "your-realm",
    "authServerUrl": "your-auth-server-port-and-port",
    "clientId": "your-client-id",
    "clientSecret": "your-secret"
}`



## Installation

```
git clone git://github.com:dcmjs-org/dicomweb-server

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

Store a DATA_DIRECTORY of DICOM image files (here with the ".IMA" extension).  Adjust the command line to match the location and naming of your files).

`find DATA_DIRECTORY -iname \*.IMA -exec dicomweb_client --url http://localhost:5985 store instances \{\} \;`
