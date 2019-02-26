const chai = require('chai');
const chaiHttp = require('chai-http');

chai.use(chaiHttp);
const { expect } = chai;

describe('Patients API', () => {
  it('it should GET all patients', (done) => {
    chai.request('http://localhost:5985')
      .get('/patients')
      .end((err, res) => {
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.a('array');
        expect(res.body.length).to.be.eql(1);
        done();
      });
  });
});
