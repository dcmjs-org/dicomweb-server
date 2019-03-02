const chai = require('chai');
const chaiHttp = require('chai-http');
// const fastify = require('fastify');

chai.use(chaiHttp);
const { expect } = chai;

describe('Patients API', () => {
  let server;
  before((done) => {
    process.env.host = '0.0.0.0';
    process.env.port = 5987;
    server = require('../server'); // eslint-disable-line
    // await server.ready();
    server.ready(async () => {
      await server.checkAndCreateDb();
      console.log('ready');
      done();
    });
  });
  after(() => {
    server.close();
  });
  it('it should GET all patients', (done) => {
    chai.request(`http://${process.env.host}:${process.env.port}`)
      .get('/patients')
      .end((err, res) => {
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.a('array');
        expect(res.body.length).to.be.eql(0);
        done();
      });
  });
});
