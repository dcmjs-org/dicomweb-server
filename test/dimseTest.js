require('./stowTest');
const chai = require('chai');
const chaiHttp = require('chai-http');

const config = require('../config/index');
const dcmtk = require('../utils/dcmtk-node')({
  verbose: true, // default: false
});

chai.use(chaiHttp);
const { expect } = chai;

describe('DIMSE', () => {
  // if no DIMSE setting skip the tests
  if (!config.DIMSE) return;
  it('should be able to echoscu', done => {
    dcmtk.echoscu(
      {
        args: ['-aet', config.DIMSE.AET, '-aec', 'TEST', 'localhost', config.DIMSE.port],
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
  //       args: ['localhost', config.DIMSE.port, 'test/data/dimse_files'],
  //     },
  //     (err, output) => {
  //       console.log(output);
  //       expect(output.parsed.accepted).to.be.equal(true);
  //       done(err);
  //     }
  //   );
  // });
});
