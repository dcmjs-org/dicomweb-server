const chai = require('chai');
const chaiHttp = require('chai-http');
const fs = require('fs');

chai.use(chaiHttp);
const { expect } = chai;

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

describe('STOW Tests', () => {
  it('studies should be empty', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/studies')
      .then(res => {
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }

        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.a('array');
        expect(res.body.length).to.be.eql(0);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('stow should succeed with multipart study', done => {
    const buffer = fs.readFileSync('test/data/multipart_study');
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .post('/studies')
      .set(
        'content-type',
        'multipart/related; type=application/dicom; boundary=--594b1491-fdae-4585-9b48-4d7cd999edb3'
      )
      .send(buffer)
      .then(res => {
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }

        expect(res.statusCode).to.equal(200);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('stow should fail with dicom file', done => {
    const buffer = fs.readFileSync('test/data/image.dcm');
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .post('/studies')
      .set(
        'content-type',
        'multipart; type=application/dicom; boundary=--594b1491-fdae-4585-9b48-4d7cd999edb3'
      )
      .send(buffer)
      .then(res => {
        expect(res.statusCode).to.equal(503);
        done();
      })
      .catch(e => {
        done(e);
      });
  });
});
