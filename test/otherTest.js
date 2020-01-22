require('./stowTest');
const chai = require('chai');
const chaiHttp = require('chai-http');
const config = require('../config/index');

chai.use(chaiHttp);
const { expect } = chai;

describe('Patients API', () => {
  it('it should GET all patients (one patient from stowed data)', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(`${config.prefix}/patients`)
      .then(res => {
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }

        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.a('array');
        expect(res.body.length).to.be.eql(1);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('returned patient should be MRI-DIR-T2_3', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(`${config.prefix}/patients`)
      .then(res => {
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }

        expect(res.statusCode).to.equal(200);
        expect(res.body[0]['00100010'].Value[0].Alphabetic).to.be.eql('MRI-DIR-T2_3');
        done();
      })
      .catch(e => {
        done(e);
      });
  });
});
