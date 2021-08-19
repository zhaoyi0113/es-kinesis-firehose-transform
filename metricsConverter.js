const convertMetric = (record) => {
  const { timestamp, region, account_id, namespace, metric_name, value, dimensions } = record;
  let serviceName;
  if (namespace && namespace.includes('/')) {
    serviceName = namespace.split('/')[1].toLowerCase();
  }
  if (!serviceName) {
    console.error('failed to parse metric record:', record);
    return;
  }
  return {
    service: { type: 'aws' },
    ecs: { version: '1.7.0' },
    '@timestamp': new Date(timestamp).toISOString(),
    cloud: {
      provider: 'aws',
      region,
      account: {
        name: account_id,
        id: account_id,
      },
    },
    aws: {
      [serviceName]: {
        metrics: {
          [metric_name]: {
            ...value,
          },
        },
      },
      cloudwatch: {
        namespace,
      },
      dimensions,
    },
    metricset: {
      name: 'cloudwatch',
    },
  };
};

module.exports = { convertMetric };
