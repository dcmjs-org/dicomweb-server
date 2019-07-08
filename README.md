# dicomweb-server
Lightweight DICOMweb Server with CouchDB

Details can found in https://na-mic.github.io/ProjectWeek/PW30_2019_GranCanaria/Projects/DICOMweb-CouchDB/

# running in Docker (only for testing - there is no security!):

`docker run --name dicomweb -it --rm -p 5984:5984 -p 5985:5985 stevepieper/dicomweb-server`

## log in to container for testing/debugging

`docker exec -it dicomweb /bin/bash`
