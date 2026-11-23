const dashboardService = require('../services/dashboard-service');

function summary(request, response) {
  return response.json({ data: dashboardService.getSummary(request.app.locals.database, request.user.id) });
}

module.exports = { summary };
