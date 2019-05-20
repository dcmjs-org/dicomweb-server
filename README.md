# dicomweb-server
Lightweight DICOMweb Server with CouchDB

Details can found in https://na-mic.github.io/ProjectWeek/PW30_2019_GranCanaria/Projects/DICOMweb-CouchDB/

By default, the authentication is none and the application mode is development.
You can change the authentication method by changing the auth attribute in config/development.js
The value you put in should be the name of a json file in the config directory. A sample config for authentication should have the following information


`{
    "realm": "your-realm",
    "authServerUrl": "your-auth-server-port-and-port",
    "clientId": "your-client-id",
    "clientSecret": "your-secret"
}`

You can run tests by running npm test
