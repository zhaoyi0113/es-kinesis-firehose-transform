const axios = require('axios');
const { testData } = require('./sample/logs/kinesisLog');
const { server, esclient, getIndexName } = require('./index');

describe('test log', () => {
  const logEndpoint = 'http://localhost:8080/logs';

  beforeAll(async () => {
    jest.setTimeout(60);
  });

  afterAll(() => {
    server.close();
  });

  it('should be able to ingest log', async () => {
    await axios.post(logEndpoint, JSON.stringify(testData[0]), {
      headers: { 'Content-Type': 'application/json' },
    });
    const index = getIndexName('logs');
    const docs = await esclient.search({
      index,
      body: {
        query: {
          match: {
            '@message': {
              query: '7c883b5cc430: Download complete',
              operator: 'and',
            },
          },
        },
      },
    });
    expect(docs.body.hits.total.value).toBeGreaterThanOrEqual(1);
  });
});
