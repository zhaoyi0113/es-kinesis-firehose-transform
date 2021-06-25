let express = require('express');
let cors = require('cors');
let app = express();

const port = 8080;

app.post('/', cors(), function (req, res, next) {
  console.log('get a request:', req);
  res.status(200).send();
});

app.listen(port, '0.0.0.0', () => {
  console.log(`CORS-enabled web server listening on port ${port}`);
});
