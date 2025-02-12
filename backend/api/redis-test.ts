import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.split(' ')[1];
  const queryToken = req.query.token as string;
  const token = headerToken || queryToken;
  
  if (!token || token !== process.env.VERCEL_AUTH_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL!;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!;
    
    // Ensure URL starts with https://
    const formattedUrl = redisUrl.startsWith('https://') ? redisUrl : `https://${redisUrl}`;
    
    console.log('Redis connection details:', {
      originalUrl: redisUrl,
      formattedUrl,
      tokenLength: redisToken.length
    });
    
    const redis = new Redis({
      url: formattedUrl,
      token: redisToken,
    });

    // Test basic operations
    const testKey = 'test:' + Date.now();
    const testValue = 'test value';
    
    // Test set
    const setResult = await redis.set(testKey, testValue);
    console.log('Set result:', setResult);
    
    // Test get
    const getValue = await redis.get(testKey);
    console.log('Get result:', getValue);
    
    // Test list operations
    const listKey = 'test:list:' + Date.now();
    const pushResult = await redis.lpush(listKey, 'item1', 'item2');
    console.log('List push result:', pushResult);
    
    const listItems = await redis.lrange(listKey, 0, -1);
    console.log('List items:', listItems);
    
    // Test delete
    await redis.del(testKey, listKey);

    res.status(200).json({
      success: true,
      message: 'Redis connection successful',
      details: {
        set: {
          key: testKey,
          value: testValue,
          result: setResult
        },
        get: {
          key: testKey,
          value: getValue
        },
        list: {
          key: listKey,
          pushResult,
          items: listItems
        }
      }
    });
  } catch (error) {
    console.error('Redis test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      details: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
} 