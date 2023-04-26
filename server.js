const express = require('express');
const redis = require('redis');
const util = require('util');
const MongoClient = require('mongodb').MongoClient;
const url = 'mongodb://localhost:27017/mydb';

const app = express();
const client = redis.createClient();
const cache = util.promisify(client.get).bind(client);
const setCache = util.promisify(client.setEx).bind(client);

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

app.get('/products', async (req, res) => {
  const page = parseInt(req.query.page) || DEFAULT_PAGE;
  const limit = parseInt(req.query.limit) || DEFAULT_LIMIT;
  const skip = (page - 1) * limit;
  const cacheKey = `products-page-${page}-limit-${limit}`;
  
  // Try to retrieve the data from cache first
  const cachedData = await cache(cacheKey);
  if (cachedData) {
    const data = JSON.parse(cachedData);
    return res.json({
      data: data,
      currentPage: page,
      totalPages: Math.ceil(data.length / limit)
    });
  }

  // If data is not in cache, fetch it from database and cache it
  MongoClient.connect(url, async (err, db) => {
    if (err) throw err;
    const dbo = db.db("mydb");
    const products = await dbo.collection("products").find().skip(skip).limit(limit).toArray();
    await setCache(cacheKey, 3600, JSON.stringify(products));
    res.json({
      data: products,
      currentPage: page,
      totalPages: Math.ceil(await dbo.collection("products").count() / limit)
    });
    db.close();
  });
});

const server = app.listen(3000, () => {
  console.log(`Server running on port ${server.address().port}`);
});
