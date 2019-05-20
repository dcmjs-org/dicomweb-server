require('./stowTest');
const chai = require('chai');
const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const { expect } = chai;

describe('QIDO Tests', () => {
  it('it should GET all studies (one study that was stowed)', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/studies')
      .then(res => {
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.a('array');
        expect(res.body.length).to.be.eql(1);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('returned study should have uid: 1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/studies')
      .then(res => {
        expect(res.statusCode).to.equal(200);
        expect(res.body[0]['0020000D'].Value[0]).to.be.eql(
          '1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313'
        );
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('returned study should have number of series in tags: 2', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/studies')
      .then(res => {
        expect(res.statusCode).to.equal(200);
        expect(res.body[0]['00201206'].Value[0]).to.be.eql(2);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('returned study should have number of images: 19', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/studies')
      .then(res => {
        expect(res.statusCode).to.equal(200);
        expect(res.body[0]['00201208'].Value[0]).to.be.eql(19);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('series endpoint should return 2 series for study 1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/series')
      .then(res => {
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.a('array');
        expect(res.body.length).to.be.eql(2);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('series endpoint should return no series for madeup study 1.3.6.1.4.1.675457.5.2.1.1706.4996.2675014637636865313', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/studies/1.3.6.1.4.1.675457.5.2.1.1706.4996.2675014637636865313/series')
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

  it('instances endpoint should return 18 instances for series 1.3.6.1.4.1.14519.5.2.1.1706.4996.170872952012850866993878606126', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        '/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/series/1.3.6.1.4.1.14519.5.2.1.1706.4996.170872952012850866993878606126/instances'
      )
      .then(res => {
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.a('array');
        expect(res.body.length).to.be.eql(18);
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  it('instances endpoint should return no instance for madeup series 1.3.6.1.4.1.54747.5.2.1.1706.4996.4562342246724757457', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        '/studies/1.3.6.1.4.1.14519.5.2.1.1706.4996.267501199180251031414136865313/series/1.3.6.1.4.1.54747.5.2.1.1706.4996.4562342246724757457/instances'
      )
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

  it('instances endpoint should return no instance for madeup study 1111111111 and series 1.3.6.1.4.1.54747.5.2.1.1706.4996.4562342246724757457', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get(
        '/studies/1111111111/series/1.3.6.1.4.1.54747.5.2.1.1706.4996.4562342246724757457/instances'
      )
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
