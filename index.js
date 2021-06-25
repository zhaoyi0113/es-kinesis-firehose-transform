let express = require('express');
let cors = require('cors');
let app = express();

const port = 8080;

app.post('/', cors(), function (req, res, next) {
  console.log('get a request:', req);
  res.status(200);
});

app.listen(8080, function () {
  console.log('CORS-enabled web server listening on port 8080');
});
