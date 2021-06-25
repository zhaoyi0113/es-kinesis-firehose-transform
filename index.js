const express = require('express');
const cors = require('cors');

let app = express();

const port = 8080;

app.use(express.bodyParser({limit: '50mb'}));
app.use(express.json({limit: '50mb'}));

app.post('/', cors(), function (req, res) {
  console.log('get a request:', req);
  res.status(200).send();
});

app.listen(port, '0.0.0.0', () => {
  console.log(`CORS-enabled web server listening on port ${port}`);
});
