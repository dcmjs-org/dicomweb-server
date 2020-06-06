const chai = require('chai');
const chaiHttp = require('chai-http');
const fs = require('fs');
const config = require('../config/index');

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
      .get(`${config.prefix}/studies`)
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

  const binaryParser = (res, cb) => {
    res.setEncoding('binary');
    res.data = '';
    res.on('data', chunk => {
      res.data += chunk;
    });
    res.on('end', () => {
      cb(null, Buffer.from(res.data, 'binary'));
    });
  };

  it('wado image should not exist', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/series/1.3.6.1.4.1.14519.5.2.1.1706.4996.170872952012850866993878606126/instances/1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694`
      )
      .buffer()
      .parse(binaryParser)
      .end((err, res) => {
        if (err) {
          done(err);
        }
        expect(res.statusCode).to.equal(404);
        done();
      });
  });

  it(`linkFolder should not work for data folder when called with process host`, done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .post(`${config.prefix}/linkFolder?path=test/data`)
      .send()
      .then(res => {
        expect(res.statusCode).to.equal(400);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('linkFolder should work for data folder with localhost', done => {
    chai
      .request(`http://localhost:${process.env.port}`)
      .post(`${config.prefix}/linkFolder?path=test/data`)
      .send()
      .then(res => {
        expect(res.statusCode).to.equal(200);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('wado image should return correct amount of data', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/series/1.3.6.1.4.1.14519.5.2.1.1706.4996.170872952012850866993878606126/instances/1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694`
      )
      .buffer()
      .parse(binaryParser)
      .end((err, res) => {
        if (err) {
          done(err);
        }
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }
        expect(res.statusCode).to.equal(200);
        const { size } = fs.statSync('test/data/image.dcm');
        expect(Buffer.byteLength(res.body)).to.equal(size);
        done();
      });
  });

  it('stow should succeed with multipart study', done => {
    const buffer = fs.readFileSync('test/data/multipart_study');
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .post(`${config.prefix}/studies`)
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

  it('wado study should return correct amount of data', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313?format=stream`
      )
      .buffer()
      .parse(binaryParser)
      .end((err, res) => {
        if (err) {
          done(err);
        }
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }
        expect(res.statusCode).to.equal(200);
        expect(Buffer.byteLength(res.body)).to.equal(Number(res.header['content-length']));
        expect(Buffer.byteLength(res.body)).to.equal(9570313);
        done();
      });
  });

  it('wado series should return correct amount of data', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/series/1.3.6.1.4.1.14519.5.2.1.1706.4996.170872952012850866993878606126?format=stream`
      )
      .buffer()
      .parse(binaryParser)
      .end((err, res) => {
        if (err) {
          done(err);
        }
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }
        expect(res.statusCode).to.equal(200);
        expect(Buffer.byteLength(res.body)).to.equal(Number(res.header['content-length']));
        expect(Buffer.byteLength(res.body)).to.equal(9486962);
        done();
      });
  });

  it('stow should fail with dicom file', done => {
    const buffer = fs.readFileSync('test/data/image.dcm');
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .post(`${config.prefix}/studies`)
      .set(
        'content-type',
        'multipart; type=application/dicom; boundary=--594b1491-fdae-4585-9b48-4d7cd999edb3'
      )
      .send(buffer)
      .then(res => {
        expect(res.statusCode).to.equal(500);
        done();
      })
      .catch(e => {
        done(e);
      });
  });
});
