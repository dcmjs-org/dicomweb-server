require('./stowTest');
const chai = require('chai');
const chaiHttp = require('chai-http');
const config = require('../config/index');

chai.use(chaiHttp);
const { expect } = chai;

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

describe('WADO Tests', () => {
  it('it should get dicom file for instance 1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/series/1.3.6.1.4.1.14519.5.2.1.1706.4996.170872952012850866993878606126/instances/1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694`
      )
      .buffer()
      .parse(binaryParser)
      .then(res => {
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }

        expect(res.statusCode).to.equal(200);
        expect(res).to.have.header(
          'Content-Disposition',
          'attachment; filename=1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694.dcm'
        );
        expect(Buffer.byteLength(res.body)).to.equal(526934);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('it should get first frame of dicom file for instance 1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/series/1.3.6.1.4.1.14519.5.2.1.1706.4996.170872952012850866993878606126/instances/1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694/frames/1`
      )
      .buffer()
      .parse(binaryParser)
      .then(res => {
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }

        expect(res.statusCode).to.equal(200);
        expect(Buffer.byteLength(res.body)).to.equal(Number(res.header['content-length']));
        expect(Buffer.byteLength(res.body)).to.equal(524414);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('it should GET metadata of study 1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/metadata`
      )
      .then(res => {
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }

        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.a('array');
        expect(res.body.length).to.be.eql(19);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('it should GET empty metadata for madeup study 1.3.6.1.4.1.65476457.5.2.1.1706.4996.6436336251031414136865313', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1.3.6.1.4.1.65476457.5.2.1.1706.4996.6436336251031414136865313/metadata`
      )
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

  it('it should GET metadata of series 1.3.6.1.4.1.14519.5.2.1.1706.4996.170872952012850866993878606126', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/series/1.3.6.1.4.1.14519.5.2.1.1706.4996.170872952012850866993878606126/metadata`
      )
      .then(res => {
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }

        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.a('array');
        expect(res.body.length).to.be.eql(18);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('it should GET empty metadata for madeup study study 1111111111 and series 1.3.6.1.4.1.54747.5.2.1.1706.4996.4562342246724757457', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1111111111/series/1.3.6.1.4.1.54747.5.2.1.1706.4996.4562342246724757457/metadata`
      )
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

  it('it should GET metadata of instance 1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/series/1.3.6.1.4.1.14519.5.2.1.1706.4996.170872952012850866993878606126/instances/1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694/metadata`
      )
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

  it('the metadata of instance 1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694 should contain the uid', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/series/1.3.6.1.4.1.14519.5.2.1.1706.4996.170872952012850866993878606126/instances/1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694/metadata`
      )
      .then(res => {
        if (res.statusCode >= 400) {
          done(new Error(res.body.error, res.body.message));

          return;
        }
        expect(res.statusCode).to.equal(200);
        expect(res.body[0]['00080018'].Value[0]).to.be.eql(
          '1.3.6.1.4.1.14519.5.2.1.1706.4996.101091068805920483719105146694'
        );
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('it should GET empty metadata for madeup study study 1111111111, series 222222222222 and instance 3333333333333', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        `${config.prefix}/studies/1111111111/series/222222222222/instances/3333333333333/metadata`
      )
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
});
