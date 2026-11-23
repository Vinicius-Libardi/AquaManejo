const express = require('express');
const { validate } = require('../middlewares/validate');
const { schemas } = require('../validators/api-schemas');
const users = require('../controllers/users-controller');
const properties = require('../controllers/properties-controller');
const ponds = require('../controllers/ponds-controller');
const species = require('../controllers/species-controller');
const parameters = require('../controllers/parameters-controller');
const measurements = require('../controllers/measurements-controller');
const references = require('../controllers/technical-references-controller');
const dashboard = require('../controllers/dashboard-controller');
const authController = require('../controllers/auth-controller');
const qualityAnalysis = require('../controllers/quality-analysis-controller');
const { authRateLimit } = require('../middlewares/auth-rate-limit');

const router = express.Router();
const auth = (request, response, next) => request.app.locals.authenticate(request, response, next);
const body = (schema) => validate(schema, 'body');
const params = (schema) => validate(schema, 'params');
const query = (schema) => validate(schema, 'query');

router.post('/auth/register', authRateLimit, body(schemas.registerUser), authController.register);
router.post('/auth/login', authRateLimit, body(schemas.login), authController.login);
router.get('/auth/session', auth, authController.current);
router.post('/auth/logout', auth, authController.logout);
router.get('/users/:id', auth, params(schemas.idParams), users.getById);
router.get('/dashboard/summary', auth, dashboard.summary);

router.route('/properties').get(auth, properties.list).post(auth, body(schemas.createProperty), properties.create);
router.route('/properties/:id')
  .get(auth, params(schemas.idParams), properties.getById)
  .patch(auth, params(schemas.idParams), body(schemas.updateProperty), properties.update)
  .delete(auth, params(schemas.idParams), properties.remove);
router.get('/properties/:propertyId/ponds', auth, params(schemas.propertyIdParams), ponds.listByProperty);
router.post('/ponds', auth, body(schemas.createPond), ponds.create);
router.route('/ponds/:id')
  .get(auth, params(schemas.idParams), ponds.getById)
  .patch(auth, params(schemas.idParams), body(schemas.updatePond), ponds.update)
  .delete(auth, params(schemas.idParams), ponds.remove);

router.route('/species').get(auth, species.list).post(auth, body(schemas.createSpecies), species.create);
router.get('/species/:speciesId/references', auth, params(schemas.speciesIdParams), references.listBySpecies);
router.get('/species/:id', auth, params(schemas.idParams), species.getById);
router.route('/parameters').get(auth, parameters.list).post(auth, body(schemas.createParameter), parameters.create);
router.get('/parameters/:id', auth, params(schemas.idParams), parameters.getById);

router.get('/measurements', auth, query(schemas.measurementFilters), measurements.list);
router.post('/measurements', auth, body(schemas.createMeasurement), measurements.create);
router.get('/ponds/:pondId/measurements', auth, params(schemas.pondIdParams), query(schemas.measurementFilters), measurements.listByPond);
router.get('/measurements/:id', auth, params(schemas.idParams), measurements.getById);
router.delete('/measurements/:id', auth, params(schemas.idParams), measurements.remove);
router.post('/measurements/:id/analysis', auth, params(schemas.idParams), qualityAnalysis.create);
router.get('/measurements/:id/analysis', auth, params(schemas.idParams), qualityAnalysis.getLatest);

router.get('/references', auth, query(schemas.referenceFilters), references.list);
router.post('/references', auth, body(schemas.createReference), references.create);
router.get('/references/:id', auth, params(schemas.idParams), references.getById);
router.patch('/references/:id', auth, params(schemas.idParams), body(schemas.updateReference), references.update);

module.exports = router;
