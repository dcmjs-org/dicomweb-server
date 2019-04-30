const chai = require('chai');
const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const { expect } = chai;

const config = require('../config/index');
// I need to import this after config as it uses config values
// eslint-disable-next-line import/order
const keycloak = require('keycloak-backend')({
  realm: config.authConfig.realm, // required for verify
  'auth-server-url': config.authConfig.authServerUrl, // required for verify
  client_id: config.authConfig.clientId,
  client_secret: config.authConfig.clientSecret,
});

const username = 'admin';
const password = 'admin';
let token = '';

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

describe('OIDC Auth', () => {
  it('patients call should fail unauthorized with wrong authentication token', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/patients')
      .set('Authorization', 'Bearer sillytoken')
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
  it('it should authenticate through keycloak to get the token (not API functionality, for debugging purposes only)', done => {
    keycloak.accessToken.config.username = username;
    keycloak.accessToken.config.password = password;
    // see if we can authenticate
    // keycloak supports oidc, this is a workaround to support basic authentication
    token = keycloak.accessToken
      .get()
      .then(accessToken => {
        token = accessToken;
        done();
      })
      .catch(err => done(err));
  });

  // test successful auth finally as we are not revoking token for now
  it('it should GET no patient with oidc auth', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/patients')
      .set('Authorization', `Bearer ${token}`)
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
