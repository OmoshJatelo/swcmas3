const ApiError = require('../utils/ApiError');

/**
 * Convert flat bracket-notation keys to nested objects.
 * e.g. { 'startLocation[lat]': '-1.29' } => { startLocation: { lat: -1.29 } }
 */
const unflatten = (obj) => {
  const result = {};
  for (const key of Object.keys(obj)) {
    const match = key.match(/^(\w+)\[(\w+)\]$/);
    if (match) {
      const [, parent, child] = match;
      if (!result[parent]) result[parent] = {};
      let val = obj[key];
      // Convert numeric strings to numbers
      if (val !== '' && !isNaN(val)) val = Number(val);
      result[parent][child] = val;
    } else {
      result[key] = obj[key];
    }
  }
  return result;
};

// wrapper for Joi validation schemas
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    // Unflatten bracket-notation keys from multipart form data
    if (property === 'body') {
      req.body = unflatten(req.body);
    }
    const { error } = schema.validate(req[property]);
    if (error) {
      const message = error.details.map((d) => d.message).join(', ');
      return next(new ApiError(400, `Validation error: ${message}`));
    }
    next();
  };
};

module.exports = validate;
