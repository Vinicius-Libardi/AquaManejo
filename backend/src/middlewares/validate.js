const { ApiError } = require('../errors/api-error');

function validate(schema, target = 'body') {
  return (request, response, next) => {
    const result = schema.safeParse(request[target]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Os dados enviados são inválidos.', details));
    }

    request.validated ??= {};
    request.validated[target] = result.data;
    return next();
  };
}

module.exports = { validate };
