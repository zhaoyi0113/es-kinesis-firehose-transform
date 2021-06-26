const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

let app = express();

const port = 8080;

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json({limit: '50mb'}));

const processRecords = (req, res, type) => {
	console.log('get a request:');
  const records = req.body.records.map(record => Buffer.from(record.data, 'base64').toString('utf-8'));
  console.log('records:', records);
	res.set({
		'X-Amz-Firehose-Protocol-Version': '1.0',
		'X-Amz-Firehose-Request-Id': req.requestId,
		'Content-Type': 'application/json',
	})
  res.json({requestId: req.requestId, timestamp: req.timestamp});
};

app.post('/logs', cors(), (req, res) => processRecords(req, res, 'logs'));

app.post('/metrics', cors(), (req, res) => processRecords(req, res, 'metrics'));

app.listen(port, '0.0.0.0', () => {
  console.log(`CORS-enabled web server listening on port ${port}`);
});
