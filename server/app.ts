/**
 * @fileoverview Sets up an Express server with CORS, JSON parsing, and a ping endpoint. Serves either the Vite development server or static production files.
 */

import express from 'express'
import cors from 'cors'
import { createServer as createViteServer } from 'vite'
import Anthropic from '@anthropic-ai/sdk';
import * as LaunchDarkly from 'launchdarkly-node-server-sdk';

export async function createApp() {
  const app = express()
  const isDev = process.env.NODE_ENV !== 'production'
  console.log('isDev', isDev)

  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY, // Make sure to add this to your environment variables
  });

  // Initialize LaunchDarkly client
  const ldClient = LaunchDarkly.init(process.env.LAUNCHDARKLY_SDK_KEY as string);
  await ldClient.waitForInitialization();
  console.log('LaunchDarkly client initialized');

  app.use('/api', cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))
  app.use(express.json())

  app.get('/api/ping', (req, res) => {
    console.log('Received ping.')
    return res.send('pong')
  })

  app.get('/api/search', async (req, res) => {
    console.log('Search query:', req.query.query);
    try {
      if (!req.query.query) {
        return res.status(400).json({ error: 'Query parameter is required' });
      }
      
      // Define user context for LaunchDarkly
      const user = {
        kind: 'user',
        key: (req.query.userId as string) || 'anonymous-user',
        custom: {
          queryType: (req.query.type as string) || 'default'
        }
      };
      
      // Check feature flag
      const useNewSearchBehavior = await ldClient.variation('better-ai-search', user, true);
      console.log('useNewSearchBehavior', useNewSearchBehavior)
      if (useNewSearchBehavior) {
        console.log('Using new search behavior');
        const response = await anthropic.messages.create({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 1500, // Increased token limit for new behavior
          messages: [
            { 
              role: 'user', 
              content: `Enhanced search (provide a very long detailed answer): ${req.query.query as string}` 
            }
          ],
        });
        
        if (response.content[0].type === 'text') {
          return res.json({
            answer: response.content[0].text,
            model: response.model,
            version: 'enhanced'
          });
        } else {
          return res.status(500).json({ error: 'Unexpected response format from Claude' });
        }
      } else {
        console.log('Using original search behavior');
        return res.json({
          answer: "banana",
          model: "none",
        });
      }
    } catch (error) {
      console.error('Error querying Claude:', error);
      return res.status(500).json({ error: 'Failed to get response from Claude' });
    }
  });

  // Cleanup function for LaunchDarkly when the server shuts down
  process.on('beforeExit', () => {
    ldClient.close();
  });

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
    app.get('*', (req, res, next) => {
      if (!req.url.startsWith('/api')) {
        vite.middlewares(req, res, next)
      } else {
        next()
      }
    })
  } else {
    app.use(express.static('dist'))
    app.get('*', (req, res) => {
      res.sendFile('index.html', { root: './dist' })
    })
  }

  return app
}
