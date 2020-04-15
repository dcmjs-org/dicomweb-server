/* eslint-disable max-classes-per-file */
// based on https://rclayton.silvrback.com/custom-errors-in-node-js
class ResourceNotFoundError extends Error {
  constructor(resourceType, resourceId, error) {
    super(`${resourceType} ${resourceId} was not found. Error: ${error.message}`);
    this.data = { resourceType, resourceId };
  }
}

class InternalError extends Error {
  constructor(reason, error) {
    super(`${reason}. Error: ${error.message}`);
    this.data = { error, reason };
  }
}

class BadRequestError extends Error {
  constructor(reason, error) {
    super(`${reason}. Error: ${error.message}`);
    this.data = { error, reason };
  }
}

module.exports = {
  ResourceNotFoundError,
  InternalError,
  BadRequestError,
};
