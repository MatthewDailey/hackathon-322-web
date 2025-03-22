/**
 * @fileoverview Sets up an Express server with CORS, JSON parsing, and a ping endpoint. Serves either the Vite development server or static production files.
 */

import express from 'express'
import cors from 'cors'
import { createServer as createViteServer } from 'vite'
import Anthropic from '@anthropic-ai/sdk';

export async function createApp() {
  const app = express()
  const isDev = process.env.NODE_ENV !== 'production'
  console.log('isDev', isDev)

  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY, // Make sure to add this to your environment variables
  });

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
      
      const response = await anthropic.messages.create({
        model: 'claude-3-7-sonnet-latest', // Or your preferred Claude model
        max_tokens: 1000,
        messages: [
          { role: 'user', content: req.query.query as string }
        ],
      });
      
      if (response.content[0].type === 'text') {
        return res.json({
          answer: response.content[0].text,
          model: response.model
        });
      } else {
        return res.status(500).json({ error: 'Unexpected response format from Claude' });
      }
    } catch (error) {
      console.error('Error querying Claude:', error);
      return res.status(500).json({ error: 'Failed to get response from Claude' });
    }
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
