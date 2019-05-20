const chai = require('chai');
const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const { expect } = chai;

const username = 'admin';
const password = 'admin';

// as these are outside any describe, they are global to all tests!
let server;
before(async () => {
  process.env.host = '0.0.0.0';
  process.env.port = 5987;
  server = require('../server'); // eslint-disable-line
  await server.ready();
});
after(() => {
  server.close();
});

describe('Basic Auth', () => {
  it('patients call should fail unauthorized with wrong authentication info', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/patients')
      .auth(username, 'aaaaaa')
      .then(res => {
        expect(res.statusCode).to.equal(401);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('patients call should fail unauthorized without authentication', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/patients')
      .then(res => {
        expect(res.statusCode).to.equal(401);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  // test successful auth finally as we are not revoking token for now
  it('it should GET no patient with basic auth', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/patients')
      .auth(username, password)
      .then(res => {
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.a('array');
        expect(res.body.length).to.be.eql(0);
        done();
      })
      .catch(e => {
        done(e);
      });
  });
});
