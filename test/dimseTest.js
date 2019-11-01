require('./stowTest');
const chai = require('chai');
const chaiHttp = require('chai-http');

const config = require('../config/index');
const dcmtk = require('../../dcmtk-node')({
  verbose: true, // default: false
});

chai.use(chaiHttp);
const { expect } = chai;

describe('DIMSE', () => {
  it('should be able to echoscu', done => {
    dcmtk.echoscu(
      {
        args: ['-aet', config.DIMSEAET, '-aec', 'TEST', 'localhost', config.DIMSEPort],
      },
      (err, output) => {
        expect(output.parsed.accepted).to.be.equal(true);
        done(err);
      }
    );
  });

  // TODO no storescu in dcmtk-node
  // it('should store with storescu', done => {
  //   dcmtk.storescu(
  //     {
  //       args: ['localhost', config.DIMSEPort, 'test/data/dimse_files'],
  //     },
  //     (err, output) => {
  //       console.log(output);
  //       expect(output.parsed.accepted).to.be.equal(true);
  //       done(err);
  //     }
  //   );
  // });
});
