const chai = require('chai');
const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const { expect } = chai;

describe('QIDO Tests', () => {
  it('it should GET all studies', done => {
    chai
      .request(`http://${process.env.host}:${process.env.port}`)
      .get('/studies')
      .end((err, res) => {
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.a('array');
        expect(res.body.length).to.be.eql(0);
        done();
      });
  });
});
